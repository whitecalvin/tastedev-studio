//! 출시 파일의 발행자 서명 확인 — `ssh-keygen -Y sign -n file` 이 만든 SSH 서명(`<파일>.sig`).
//!
//! 출시 도구는 리눅스 설치 파일(deb · rpm · AppImage · tar.gz)마다 GXSOFT 출시 키(release@tastedev.net)로
//! 서명해 릴리스에 함께 올린다. 다섯 제품의 자동 업데이트는 받은 파일을 이것으로 확인한 뒤에만 설치한다
//! ([`crate::gxsoft_release_signature`] 를 [`crate::Session::set_signature_check`] 에 넘긴다). 앱에는 **공개키만** 들어간다.
//!
//! 형식(OpenSSH PROTOCOL.sshsig):
//! ```text
//! 겉: -----BEGIN SSH SIGNATURE----- / base64 / -----END SSH SIGNATURE-----
//! 속: "SSHSIG" · u32 판(1) · string 공개키 · string 이름공간 · string 예약 · string 해시 이름 · string 서명
//! 서명한 것: "SSHSIG" · string 이름공간 · string 예약 · string 해시 이름 · string H(파일)
//! ```
//! string 은 4바이트 빅엔디언 길이 + 바이트. 공개키 · 서명은 다시 string("ssh-ed25519") + string(값).

use std::io::Read;
use std::path::Path;

use ed25519_dalek::{Signature, VerifyingKey};
use sha2::{Digest, Sha256, Sha512};

/// GXSOFT 출시 키(release@tastedev.net)의 공개키 — `ssh-ed25519` 뒤의 base64.
/// 지문 SHA256:DpGg4oWYas1GSPxa6bb0Xq3EtYbq5A2rxyfdv8O9G1k (출시 설정 `expectedFingerprint` 와 같다).
pub const RELEASE_KEY: &str =
    "AAAAC3NzaC1lZDI1NTE5AAAAIGPfqi5HGcKDyim2b7jQUIddG8C34v1pcEfI7hmbplz2";

/// 출시 도구가 쓰는 이름공간(`ssh-keygen -Y sign -n file`).
const NAMESPACE: &[u8] = b"file";

/// `file` 이 GXSOFT 출시 키로 서명됐는지 `armored`(`.sig` 내용)로 본다.
pub fn verify_release_file(file: &Path, armored: &[u8]) -> Result<(), String> {
    let key = base64::decode(RELEASE_KEY).ok_or("bad built-in key")?;
    verify_with_key(file, armored, &key)
}

/// [`verify_release_file`] 와 같되 공개키(ssh 꼴 바이트)를 받는다(시험).
pub fn verify_with_key(file: &Path, armored: &[u8], public_key: &[u8]) -> Result<(), String> {
    let blob = dearmor(armored).ok_or("not an SSH signature")?;
    let mut r = Wire(&blob);
    if r.bytes(6) != Some(b"SSHSIG".as_slice()) || r.u32() != Some(1) {
        return Err("not an SSH signature".into());
    }
    let signer = r.string().ok_or("truncated signature")?;
    let namespace = r.string().ok_or("truncated signature")?;
    let reserved = r.string().ok_or("truncated signature")?;
    let hash = r.string().ok_or("truncated signature")?;
    let signature = r.string().ok_or("truncated signature")?;
    if signer != public_key {
        return Err("signed by another key".into());
    }
    if namespace != NAMESPACE {
        return Err("wrong signature namespace".into());
    }
    let key = ed25519_key(signer).ok_or("unsupported key")?;
    let mut sig = Wire(signature);
    if sig.string() != Some(b"ssh-ed25519".as_slice()) {
        return Err("unsupported signature".into());
    }
    let raw: [u8; 64] = sig
        .string()
        .and_then(|s| s.try_into().ok())
        .ok_or("bad signature")?;
    let digest = match hash {
        b"sha512" => digest_file::<Sha512>(file)?,
        b"sha256" => digest_file::<Sha256>(file)?,
        _ => return Err("unsupported hash".into()),
    };
    let mut signed = b"SSHSIG".to_vec();
    for part in [namespace, reserved, hash, digest.as_slice()] {
        put_string(&mut signed, part);
    }
    key.verify_strict(&signed, &Signature::from_bytes(&raw))
        .map_err(|_| "signature does not match".to_owned())
}

/// 공개키 string 안의 ed25519 키.
fn ed25519_key(public_key: &[u8]) -> Option<VerifyingKey> {
    let mut r = Wire(public_key);
    if r.string()? != b"ssh-ed25519" {
        return None;
    }
    let raw: [u8; 32] = r.string()?.try_into().ok()?;
    VerifyingKey::from_bytes(&raw).ok()
}

fn digest_file<D: Digest>(file: &Path) -> Result<Vec<u8>, String> {
    let mut f = std::fs::File::open(file).map_err(|e| e.to_string())?;
    let mut hasher = D::new();
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize().to_vec())
}

/// 겉(BEGIN/END 줄)을 벗기고 base64 를 푼다.
fn dearmor(armored: &[u8]) -> Option<Vec<u8>> {
    let text = std::str::from_utf8(armored).ok()?;
    let body = text
        .split_once("-----BEGIN SSH SIGNATURE-----")?
        .1
        .split_once("-----END SSH SIGNATURE-----")?
        .0;
    let joined: String = body.chars().filter(|c| !c.is_whitespace()).collect();
    base64::decode(&joined)
}

fn put_string(out: &mut Vec<u8>, s: &[u8]) {
    out.extend_from_slice(&(s.len() as u32).to_be_bytes());
    out.extend_from_slice(s);
}

/// SSH wire 꼴 읽개.
struct Wire<'a>(&'a [u8]);

impl<'a> Wire<'a> {
    fn bytes(&mut self, n: usize) -> Option<&'a [u8]> {
        if self.0.len() < n {
            return None;
        }
        let (head, rest) = self.0.split_at(n);
        self.0 = rest;
        Some(head)
    }

    fn u32(&mut self) -> Option<u32> {
        Some(u32::from_be_bytes(self.bytes(4)?.try_into().ok()?))
    }

    fn string(&mut self) -> Option<&'a [u8]> {
        let n = self.u32()? as usize;
        self.bytes(n)
    }
}

/// 공개키 · 서명을 적는 base64(짧아서 직접 둔다 — 의존성을 늘리지 않으려고).
mod base64 {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    #[cfg(test)]
    #[must_use]
    pub fn encode(bytes: &[u8]) -> String {
        let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
        for chunk in bytes.chunks(3) {
            let padded = [
                chunk[0],
                *chunk.get(1).unwrap_or(&0),
                *chunk.get(2).unwrap_or(&0),
            ];
            let n =
                (u32::from(padded[0]) << 16) | (u32::from(padded[1]) << 8) | u32::from(padded[2]);
            for i in 0..4 {
                if i <= chunk.len() {
                    out.push(TABLE[((n >> (18 - i * 6)) & 0x3F) as usize] as char);
                } else {
                    out.push('=');
                }
            }
        }
        out
    }

    #[must_use]
    pub fn decode(text: &str) -> Option<Vec<u8>> {
        let mut out = Vec::with_capacity(text.len() * 3 / 4);
        let mut acc: u32 = 0;
        let mut bits = 0u32;
        for c in text.bytes() {
            if c == b'=' || c == b'\r' || c == b'\n' {
                continue;
            }
            // TABLE 은 64글자라 자리값은 0..64 다. u32 로 줄여도 잘리지 않는다.
            let value = u32::try_from(TABLE.iter().position(|&t| t == c)?).ok()?;
            acc = (acc << 6) | value;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                // bits 를 8 이상으로 올린 뒤 그만큼만 떼어 내므로 언제나 한 바이트다.
                out.push(u8::try_from((acc >> bits) & 0xFF).unwrap_or(0));
            }
        }
        Some(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    /// ssh-keygen 과 같은 꼴로 서명을 만든다(시험용 키).
    fn sign(key: &SigningKey, data: &[u8], namespace: &[u8]) -> (Vec<u8>, Vec<u8>) {
        let mut public = Vec::new();
        put_string(&mut public, b"ssh-ed25519");
        put_string(&mut public, key.verifying_key().as_bytes());
        let digest = Sha512::digest(data).to_vec();
        let mut signed = b"SSHSIG".to_vec();
        for part in [namespace, b"".as_slice(), b"sha512", digest.as_slice()] {
            put_string(&mut signed, part);
        }
        let mut sig = Vec::new();
        put_string(&mut sig, b"ssh-ed25519");
        put_string(&mut sig, &key.sign(&signed).to_bytes());
        let mut blob = b"SSHSIG".to_vec();
        blob.extend_from_slice(&1u32.to_be_bytes());
        for part in [public.as_slice(), namespace, b"", b"sha512", sig.as_slice()] {
            put_string(&mut blob, part);
        }
        let armored = format!(
            "-----BEGIN SSH SIGNATURE-----\n{}\n-----END SSH SIGNATURE-----\n",
            base64::encode(&blob)
        );
        (armored.into_bytes(), public)
    }

    #[test]
    fn a_release_signature_is_checked_end_to_end() {
        let dir = std::env::temp_dir().join(format!("tf-sig-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("pkg.deb");
        std::fs::write(&file, b"package body").unwrap();
        let key = SigningKey::from_bytes(&[7u8; 32]);
        let (sig, public) = sign(&key, b"package body", b"file");

        assert_eq!(verify_with_key(&file, &sig, &public), Ok(()));

        // 파일이 바뀌었다.
        std::fs::write(&file, b"package body!").unwrap();
        assert!(verify_with_key(&file, &sig, &public).is_err());
        std::fs::write(&file, b"package body").unwrap();

        // 다른 키 · 다른 이름공간 · 망가진 겉.
        let other = SigningKey::from_bytes(&[8u8; 32]);
        let (other_sig, _) = sign(&other, b"package body", b"file");
        assert_eq!(
            verify_with_key(&file, &other_sig, &public),
            Err("signed by another key".into())
        );
        let (git_sig, _) = sign(&key, b"package body", b"git");
        assert!(verify_with_key(&file, &git_sig, &public).is_err());
        assert!(verify_with_key(&file, b"garbage", &public).is_err());

        // 내장 키로는 시험 키 서명이 통과하지 않는다.
        assert!(verify_release_file(&file, &sig).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 실제 출시 파일: `TASTEDEV_RELEASE_FILE=<받은 deb>` 와 옆의 `<파일>.sig` 로
    /// `cargo test -- --ignored real_release`. 저장소에 출시 파일을 두지 않아 평소엔 건너뛴다.
    #[test]
    #[ignore = "TASTEDEV_RELEASE_FILE 에 실제 출시 파일 경로가 있어야 한다"]
    fn a_real_release_file_passes_with_the_built_in_key() {
        let file = std::path::PathBuf::from(
            std::env::var("TASTEDEV_RELEASE_FILE").expect("TASTEDEV_RELEASE_FILE"),
        );
        let mut sig_path = file.clone().into_os_string();
        sig_path.push(".sig");
        let sig = std::fs::read(sig_path).unwrap();
        assert_eq!(verify_release_file(&file, &sig), Ok(()));
    }

    #[test]
    fn the_built_in_key_is_an_ed25519_key() {
        let key = base64::decode(RELEASE_KEY).unwrap();
        assert!(ed25519_key(&key).is_some());
    }
}
