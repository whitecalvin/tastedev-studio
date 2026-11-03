//! Child handles never refer to the broker's interactive console or input.
use crate::model::Result;
use std::{
    fs,
    io::{self, Read},
    os::windows::io::AsRawHandle,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc::{self, Receiver, SyncSender},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
const TAIL: usize = 16384;

#[derive(Default)]
struct Loss {
    chunks: AtomicU64,
    bytes: AtomicU64,
    failed: AtomicBool,
}
struct MaskedStream {
    stream: &'static str,
    sender: SyncSender<(&'static str, String)>,
    loss: Arc<Loss>,
    redactor: crate::executor::Redactor,
    pending: Vec<u8>,
}
impl MaskedStream {
    fn feed(&mut self, bytes: &[u8], eof: bool) {
        let decoded = crate::executor::decode_chunk(&mut self.pending, bytes, eof);
        let text = self.redactor.feed(&decoded, eof);
        for text in crate::executor::output_chunks(&text) {
            if self.sender.try_send((self.stream, text.into())).is_err() {
                self.loss.chunks.fetch_add(1, Ordering::Relaxed);
                self.loss
                    .bytes
                    .fetch_add(text.len() as u64, Ordering::Relaxed);
            }
        }
    }
}

pub(super) struct PrivateStdio {
    input: fs::File,
    output: Option<io::PipeWriter>,
    error: Option<io::PipeWriter>,
    tails: [Arc<Mutex<Vec<u8>>>; 2],
    pumps: Vec<thread::JoinHandle<()>>,
    stop: Arc<AtomicBool>,
    receiver: Option<Receiver<(&'static str, String)>>,
    loss: Arc<Loss>,
}
#[link(name = "kernel32")]
unsafe extern "system" {
    fn PeekNamedPipe(
        handle: *mut std::ffi::c_void,
        buffer: *mut std::ffi::c_void,
        size: u32,
        read: *mut u32,
        available: *mut u32,
        remaining: *mut u32,
    ) -> i32;
}
fn available(reader: &io::PipeReader) -> Option<usize> {
    let mut count = 0;
    // SAFETY: live owned anonymous pipe reader; only available-byte metadata is requested.
    let ok = unsafe {
        PeekNamedPipe(
            reader.as_raw_handle(),
            std::ptr::null_mut(),
            0,
            std::ptr::null_mut(),
            &mut count,
            std::ptr::null_mut(),
        )
    };
    (ok != 0).then_some(count as usize)
}
impl PrivateStdio {
    pub fn new() -> Result<Self> {
        Self::create(None)
    }
    pub fn observed(secrets: &[String]) -> Result<Self> {
        Self::create(Some(secrets))
    }
    fn create(secrets: Option<&[String]>) -> Result<Self> {
        let input = fs::File::open("NUL").map_err(|_| "Private null input unavailable")?;
        let (out_reader, output) = io::pipe().map_err(|_| "Private stdout pipe unavailable")?;
        let (err_reader, error) = io::pipe().map_err(|_| "Private stderr pipe unavailable")?;
        let (sender, receiver) = mpsc::sync_channel(32);
        let mut io = Self {
            input,
            output: Some(output),
            error: Some(error),
            tails: std::array::from_fn(|_| Arc::new(Mutex::new(Vec::new()))),
            pumps: Vec::new(),
            stop: Arc::new(AtomicBool::new(false)),
            receiver: secrets.map(|_| receiver),
            loss: Arc::new(Loss::default()),
        };
        for (reader, tail, stream) in [
            (out_reader, io.tails[0].clone(), "stdout"),
            (err_reader, io.tails[1].clone(), "stderr"),
        ] {
            let stop = io.stop.clone();
            let failure = io.loss.clone();
            let mut masked = secrets.map(|secrets| MaskedStream {
                stream,
                sender: sender.clone(),
                loss: io.loss.clone(),
                redactor: crate::executor::Redactor::new(secrets.to_vec()),
                pending: Vec::new(),
            });
            let pump = thread::Builder::new()
                .name("isolation-output".into())
                .spawn(move || {
                    let mut reader = reader;
                    let mut chunk = [0u8; 2048];
                    let mut drain_deadline = None;
                    loop {
                        if stop.load(Ordering::Acquire) {
                            let deadline = drain_deadline
                                .get_or_insert_with(|| Instant::now() + Duration::from_millis(100));
                            if Instant::now() >= *deadline {
                                if available(&reader).is_some_and(|count| count > 0) {
                                    failure.failed.store(true, Ordering::Release);
                                }
                                break;
                            }
                        }
                        let Some(count) = available(&reader) else {
                            if std::io::Error::last_os_error().raw_os_error() != Some(109) {
                                failure.failed.store(true, Ordering::Release);
                            }
                            break;
                        };
                        if count == 0 {
                            if stop.load(Ordering::Acquire) {
                                break;
                            }
                            thread::sleep(Duration::from_millis(5));
                            continue;
                        }
                        let capacity = count.min(chunk.len());
                        let count = match reader.read(&mut chunk[..capacity]) {
                            Ok(count) => count,
                            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                            Err(error) => {
                                if error.kind() != io::ErrorKind::BrokenPipe {
                                    failure.failed.store(true, Ordering::Release);
                                }
                                break;
                            }
                        };
                        if count == 0 {
                            break;
                        }
                        if let Some(masked) = &mut masked {
                            masked.feed(&chunk[..count], false);
                        } else if let Ok(mut tail) = tail.lock() {
                            let discard = (tail.len() + count).saturating_sub(TAIL);
                            tail.drain(..discard);
                            tail.extend_from_slice(&chunk[..count]);
                        }
                    }
                    if let Some(masked) = &mut masked {
                        masked.feed(&[], true);
                    }
                })
                .map_err(|_| "Private output reader unavailable")?;
            io.pumps.push(pump);
        }
        Ok(io)
    }
    pub fn forward(&self, receive: &mut dyn FnMut(&str, &str) -> bool) -> bool {
        let Some(receiver) = &self.receiver else {
            return true;
        };
        // A bounded batch prevents output floods from starving timeout/cancel.
        for _ in 0..32 {
            let Ok((stream, text)) = receiver.try_recv() else {
                break;
            };
            if !receive(stream, &text) {
                return false;
            }
        }
        true
    }
    pub fn finish(&mut self, observer: &mut super::super::OutputObserver<'_>) -> Result<bool> {
        self.close();
        let connected = self.forward(observer.receive);
        if !connected {
            if let Some(receiver) = &self.receiver {
                for (_, text) in receiver.try_iter() {
                    self.loss.chunks.fetch_add(1, Ordering::Relaxed);
                    self.loss
                        .bytes
                        .fetch_add(text.len() as u64, Ordering::Relaxed);
                }
            }
        }
        observer.dropped_chunks = observer
            .dropped_chunks
            .saturating_add(self.loss.chunks.load(Ordering::Acquire));
        observer.dropped_bytes = observer
            .dropped_bytes
            .saturating_add(self.loss.bytes.load(Ordering::Acquire));
        if self.loss.failed.load(Ordering::Acquire) {
            return Err("Isolated output capture failed".into());
        }
        Ok(connected)
    }
    pub fn handles(&self) -> [*mut std::ffi::c_void; 3] {
        [
            self.input.as_raw_handle(),
            self.output.as_ref().unwrap().as_raw_handle(),
            self.error.as_ref().unwrap().as_raw_handle(),
        ]
    }
    fn close(&mut self) {
        drop(self.output.take());
        drop(self.error.take());
        self.stop.store(true, Ordering::Release);
        for pump in self.pumps.drain(..) {
            if pump.join().is_err() {
                self.loss.failed.store(true, Ordering::Release);
            }
        }
    }
}
impl Drop for PrivateStdio {
    fn drop(&mut self) {
        self.close();
        // Only the unobserved controlled fixture prints raw diagnostics. The
        // observed production path never retains or prints a raw output tail.
        #[cfg(test)]
        for (name, tail) in ["stdout", "stderr"].into_iter().zip(&self.tails) {
            if let Ok(bytes) = tail.lock() {
                if !bytes.is_empty() {
                    eprintln!(
                        "CONTROLLED_PRIVATE_CHILD_{name}={}",
                        String::from_utf8_lossy(&bytes)
                    );
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use windows_sys::Win32::Storage::FileSystem::{GetFileType, FILE_TYPE_PIPE};
    #[test]
    fn masked_transport_preserves_split_utf8_and_secrets_before_queueing() {
        let (sender, receiver) = mpsc::sync_channel(32);
        let loss = Arc::new(Loss::default());
        let mut stream = MaskedStream {
            stream: "stdout",
            sender,
            loss: loss.clone(),
            redactor: crate::executor::Redactor::new(vec!["dummy-secret".into()]),
            pending: Vec::new(),
        };
        for bytes in [b"A\xe3\x81".as_slice(), b"\x82dummy-", b"secretZ"] {
            stream.feed(bytes, false);
        }
        stream.feed(&[], true);
        let text: String = receiver.try_iter().map(|(_, text)| text).collect();
        assert_eq!(text, "Aあ[redacted]Z");
        assert_eq!(loss.chunks.load(Ordering::Acquire), 0);
    }

    #[test]
    fn slow_transport_is_bounded_and_reports_loss_without_blocking_a_pipe_reader() {
        let (sender, receiver) = mpsc::sync_channel(1);
        let loss = Arc::new(Loss::default());
        let mut stream = MaskedStream {
            stream: "stdout",
            sender,
            loss: loss.clone(),
            redactor: crate::executor::Redactor::new(vec![]),
            pending: Vec::new(),
        };
        let start = Instant::now();
        for _ in 0..128 {
            stream.feed(&[b'x'; 2048], false);
        }
        stream.feed(&[], true);
        assert!(start.elapsed() < Duration::from_secs(5));
        assert_eq!(receiver.try_iter().count(), 1);
        assert_eq!(loss.chunks.load(Ordering::Acquire), 127);
        assert_eq!(loss.bytes.load(Ordering::Acquire), 127 * 2048);
    }

    #[test]
    fn observed_native_pipes_mask_output_and_finish_with_a_retained_writer() {
        let mut streams = PrivateStdio::observed(&["dummy-secret".into()]).unwrap();
        let held = streams.output.as_ref().unwrap().try_clone().unwrap();
        streams
            .output
            .as_mut()
            .unwrap()
            .write_all("hello dummy-secret あ".as_bytes())
            .unwrap();
        streams
            .error
            .as_mut()
            .unwrap()
            .write_all(b"warning")
            .unwrap();
        let mut received = std::collections::BTreeMap::<String, String>::new();
        let mut receive = |stream: &str, text: &str| {
            received.entry(stream.into()).or_default().push_str(text);
            true
        };
        let mut observer = super::super::super::OutputObserver {
            secrets: vec![],
            receive: &mut receive,
            dropped_chunks: 0,
            dropped_bytes: 0,
            artifact_installation: None,
        };
        let start = Instant::now();
        assert!(streams.finish(&mut observer).unwrap());
        assert!(start.elapsed() < Duration::from_secs(1));
        assert_eq!(observer.dropped_chunks, 0);
        assert_eq!(received["stdout"], "hello [redacted] あ");
        assert_eq!(received["stderr"], "warning");
        assert!(streams
            .tails
            .iter()
            .all(|tail| tail.lock().unwrap().is_empty()));
        drop(held);
    }

    #[test]
    fn disconnected_output_consumer_is_reported_without_a_blocking_join() {
        let mut streams = PrivateStdio::observed(&[]).unwrap();
        streams
            .output
            .as_mut()
            .unwrap()
            .write_all(b"unobserved output")
            .unwrap();
        let mut observer = super::super::super::OutputObserver {
            secrets: vec![],
            receive: &mut |_, _| false,
            dropped_chunks: 0,
            dropped_bytes: 0,
            artifact_installation: None,
        };
        assert!(!streams.finish(&mut observer).unwrap());
    }
    #[test]
    fn private_streams_have_no_console_input_and_drain_with_bounded_memory() {
        let mut streams = PrivateStdio::new().unwrap();
        let held_writer = streams.output.as_ref().unwrap().try_clone().unwrap();
        let handles = streams.handles();
        assert_eq!(unsafe { GetFileType(handles[1]) }, FILE_TYPE_PIPE);
        assert_eq!(unsafe { GetFileType(handles[2]) }, FILE_TYPE_PIPE);
        let mut input = [0u8; 1];
        assert_eq!(streams.input.read(&mut input).unwrap(), 0);
        streams
            .output
            .as_mut()
            .unwrap()
            .write_all(&vec![b'x'; TAIL * 4])
            .unwrap();
        streams
            .error
            .as_mut()
            .unwrap()
            .write_all(b"controlled error")
            .unwrap();
        let start = Instant::now();
        streams.close();
        assert!(
            start.elapsed() < Duration::from_secs(1),
            "a retained writer must not block cleanup indefinitely"
        );
        drop(held_writer);
        assert_eq!(
            streams.tails[0].lock().unwrap().as_slice(),
            vec![b'x'; TAIL]
        );
        assert_eq!(
            streams.tails[1].lock().unwrap().as_slice(),
            b"controlled error"
        );
        // No controlled test output needs to be repeated by Drop.
        for tail in &streams.tails {
            tail.lock().unwrap().clear();
        }
    }
}
