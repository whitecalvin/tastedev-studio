//! 업데이트 흐름(화면 없는 상태 기계) — 다섯 제품의 모든 업데이트 입구가 이것 하나를 쓴다(규격 2-2 업데이트).
//! 제품은 [`Stage`] 를 묻는 창(`tastedev-ui-kit::update_dialog`)으로, [`Flow::status`] 를 설정 › 업데이트 카드로 그리고,
//! 고른 것을 [`Flow::install`] · [`Flow::later`] 등으로 넘긴다.
//!
//! 입구(다섯 제품 같음):
//! - **켤 때 · 하루 한 번** — 자동 업데이트([`Flow::set_auto`])가 켜져 있으면 켤 때 한 번, 그 뒤 앱이 켜져 있는 동안
//!   마지막 확인([`Flow::check_now`] 포함)에서 [`AUTO_CHECK_INTERVAL`](24시간)마다 다시 확인한다([`Schedule`]).
//!   새 판이면 [`Stage::Ask`] — 이번 실행에서 한 번만 묻는다("나중에" 뒤에는 카드 · 배지에만 보인다).
//!   꺼져 있으면 세션을 만들지 않고(네트워크 요청 없음) 스스로 묻지도 않는다.
//! - **지금 확인**(설정 › 업데이트 `지금 확인` · 명령 팔레트 `업데이트 확인`) — [`Flow::check_now`]. 자동 업데이트가
//!   꺼져 있어도 된다. 결과는 카드 · 알림으로만(묻는 창은 띄우지 않는다).
//! - **업데이트 설치…**(설정 카드 · 상태줄 배지) — [`Flow::offer`]. 찾은 판이 있으면 곧바로 묻는 창, 없으면 확인한 뒤
//!   새 판이면 묻는 창.
//! - "지금 설치" → 받기 전에 최신 판을 한 번 더 확인([`Recheck`] — 그사이 더 새 판이 나왔으면 그 판을 받는다.
//!   출시가 하루에 여러 번 나가면 켤 때 찾은 판이 이미 옛 판일 수 있다) → [`Stage::Downloading`] → 검증 → 설치 명령. Windows 는
//!   작업을 마친 사용자가 모든 창을 직접 닫기를 기다린다. Linux 는 [`Stage::Installing`] 뒤 성공하면 새 앱을 켜고
//!   닫는다. 실패는 [`Stage::Failed`](옛 판 그대로).

use std::path::PathBuf;
use std::time::{Duration, Instant};

use crate::{
    AUTO_CHECK_INTERVAL, Event, InstallResult, Release, Session, Started, UpdateError, Waker,
    notes_excerpt,
};

/// 묻는 창 단계.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Stage {
    /// 할 일 없음(꺼짐 · 확인 중 · 새 판 없음 · 끝남).
    Idle,
    /// 새 판을 찾아 묻는 중.
    Ask(Release),
    /// 받는 중.
    Downloading(Release),
    /// 설치 중(Linux 권한 창 · Windows 는 사용자가 모든 창을 직접 닫기를 기다린다).
    Installing(Release),
    /// 실패(받은 파일이 있으면 `file`).
    Failed {
        release: Release,
        error: UpdateError,
        file: Option<PathBuf>,
    },
}

#[cfg(test)]
mod handoff_tests {
    use super::*;
    use crate::testing::{fixture, harness};
    use crate::{InstallKind, Product};
    use std::sync::Arc;

    #[test]
    fn flow_can_be_owned_by_a_thread_safe_desktop_bridge() {
        fn send<T: Send>() {}
        send::<Flow>();
    }

    #[test]
    fn changed_cached_payload_is_rejected_immediately_before_handoff() {
        let product = Product {
            name: "TASTESTUDIO",
            package: "tastestudio",
            tag_prefix: "studio-v",
            version: "0.0.1",
        };
        let name = "tastestudio_0.2.0_windows_x64.msi";
        let fx = fixture(&product, "0.2.0", &[name], None);
        let h = harness(
            product,
            &fx,
            InstallKind::Msi,
            "C:/Studio/tastestudio.exe",
            &[],
        );
        let runner = h.runner.clone();
        let release = crate::latest(&std::fs::read(&fx.list).unwrap(), product.tag_prefix)
            .unwrap()
            .unwrap();
        let mut flow = Flow::start(false, move || h.session, Arc::new(|| {}));
        flow.ensure_session().unwrap();
        let file = fx.dir.0.join(name);
        std::fs::write(&file, vec![b'x'; fx.payload.len()]).unwrap();
        let wake: Waker = Arc::new(|| {});
        flow.install_file(release, file, &wake);
        assert!(matches!(flow.stage(), Stage::Failed { .. }));
        assert!(runner.lines().is_empty());
        assert!(!flow.take_quit());
    }
}

#[cfg(test)]
mod waiting_tests {
    use super::*;
    use crate::{Product, testing::fixture};
    use std::sync::Arc;

    #[test]
    fn another_check_or_offer_cannot_replace_the_waiting_installation() {
        let product = Product {
            name: "TASTESTUDIO",
            package: "tastestudio",
            tag_prefix: "studio-v",
            version: "0.0.1",
        };
        let fx = fixture(&product, "0.2.0", &[], None);
        let release = crate::latest(&std::fs::read(&fx.list).unwrap(), product.tag_prefix)
            .unwrap()
            .unwrap();
        let mut flow = Flow::start(
            false,
            || panic!("no new session while waiting"),
            Arc::new(|| {}),
        );
        flow.found = Some(release.clone());
        flow.stage = Stage::Installing(release);
        flow.waiting_for_exit = true;
        let wake: Waker = Arc::new(|| {});
        assert!(!flow.check_now(&wake));
        flow.offer(&wake);
        flow.install(&wake);
        assert!(matches!(flow.stage(), Stage::Installing(_)));
        assert!(!flow.take_quit());
    }
}

/// 설정 › 업데이트 카드 상태(다섯 제품 같은 다섯 갈래).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Status {
    /// 이번 실행에서 아직 확인하지 않았다.
    Unchecked,
    /// 확인 중.
    Checking,
    /// 지금 판이 가장 새 판이다.
    Latest,
    /// 새 판(`업데이트 설치…` 단추 · 상태줄 배지).
    Available(Release),
    /// 확인하지 못했다.
    Failed(UpdateError),
}

/// 끝난 확인 하나(제품이 카드 · 알림에 쓴다).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Checked {
    /// 사용자가 누른 확인인지(`지금 확인` · `업데이트 확인` · `업데이트 설치…`) — 참이면 결과를 알림으로 알린다.
    /// 자동 확인(켤 때 · 하루 한 번)은 조용히(새 판이면 묻는 창).
    pub manual: bool,
    /// 지금보다 새 판이면 `Some`.
    pub result: Result<Option<Release>, UpdateError>,
}

impl Checked {
    /// 찾은 새 판.
    pub fn found(&self) -> Option<&Release> {
        self.result.as_ref().ok().and_then(Option::as_ref)
    }
}

/// 자동 확인 일정: 마지막 확인(자동이든 수동이든)에서 [`AUTO_CHECK_INTERVAL`] 이 지나면 다시 확인할 차례.
/// 아직 확인하지 않았으면 곧바로 차례다(켤 때 확인 · 실행 중에 자동 업데이트를 켬).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Schedule {
    last: Option<Instant>,
}

impl Schedule {
    pub const fn new() -> Self {
        Self { last: None }
    }

    /// 확인을 시작했다.
    pub fn checked(&mut self, now: Instant) {
        self.last = Some(now);
    }

    /// 마지막 확인 때.
    pub fn last(&self) -> Option<Instant> {
        self.last
    }

    /// 자동 확인할 차례인지. 자동 업데이트가 꺼져 있으면 언제나 거짓.
    pub fn due(&self, auto: bool, now: Instant) -> bool {
        auto && self
            .last
            .is_none_or(|t| now.saturating_duration_since(t) >= AUTO_CHECK_INTERVAL)
    }

    /// 다음 자동 확인까지 남은 때(꺼져 있으면 `None`, 차례면 0) — 제품은 이만큼 뒤에 다시 그리기를 청한다.
    pub fn wait(&self, auto: bool, now: Instant) -> Option<Duration> {
        if !auto {
            return None;
        }
        Some(self.last.map_or(Duration::ZERO, |t| {
            AUTO_CHECK_INTERVAL.saturating_sub(now.saturating_duration_since(t))
        }))
    }
}

/// "지금 설치" 직전 다시 확인한 결과(제품 · 시험이 [`Flow::recheck`] 로 본다).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Recheck {
    /// 기억한 판보다 새 판이 있어 그 판을 받는다(`from` → `to`).
    Newer {
        from: crate::Version,
        to: crate::Version,
    },
    /// 기억한 판이 그대로 가장 새 판이다.
    Same(crate::Version),
    /// 확인하지 못해 기억한 판으로 진행한다(작업 폴더의 [`crate::LOG_FILE`] 에도 남긴다).
    Failed {
        version: crate::Version,
        error: UpdateError,
    },
}

/// 진행 중인 확인을 누가 시작했는지.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Why {
    /// 켤 때 · 하루 한 번(새 판이면 이번 실행에서 한 번 묻는다).
    Auto,
    /// "지금 설치" 직전 다시 확인(묻지 않고, 결과는 제품에 넘기지 않는다).
    Install,
    /// `지금 확인` · `업데이트 확인`(묻지 않고 카드 · 알림).
    Manual,
    /// `업데이트 설치…` · 배지(새 판이면 곧바로 묻는다).
    Offer,
}

type Make = Box<dyn FnOnce() -> Session + Send>;

/// 한 실행의 업데이트(확인 · 묻기 · 받기 · 설치).
pub struct Flow {
    make: Option<Make>,
    session: Option<Session>,
    auto: bool,
    schedule: Schedule,
    /// 진행 중인 확인(없으면 `None`).
    why: Option<Why>,
    /// 마지막으로 찾은 새 판.
    found: Option<Release>,
    /// 마지막 확인 실패.
    error: Option<UpdateError>,
    /// 이번 실행에서 확인을 끝낸 적이 있는지.
    checked: bool,
    stage: Stage,
    /// 이번 실행에서 이미 스스로 물었는지(나중에 · 닫기 뒤 다시 묻지 않는다).
    asked: bool,
    quit: bool,
    waiting_for_exit: bool,
    last: Option<InstallResult>,
    /// "지금 설치" 를 눌러 다시 확인 중인 판(확인이 끝나면 받기를 시작한다).
    pending: Option<Release>,
    /// 마지막 "지금 설치" 직전 다시 확인한 결과.
    recheck: Option<Recheck>,
}

impl Flow {
    /// 본 창이 뜬 뒤(첫 프레임) 부른다. `auto` 가 거짓이면 세션을 만들지 않는다(네트워크 요청 없음) —
    /// 사용자가 `지금 확인` · `업데이트 설치…` 를 누를 때 `make` 로 만든다.
    /// 켜져 있으면 지난 설치 결과를 거두고 곧바로 확인을 시작한다.
    pub fn start(auto: bool, make: impl FnOnce() -> Session + Send + 'static, wake: Waker) -> Self {
        Self::start_at(auto, make, wake, Instant::now())
    }

    /// [`Flow::start`] — 때를 받는다(시험).
    pub fn start_at(
        auto: bool,
        make: impl FnOnce() -> Session + Send + 'static,
        wake: Waker,
        now: Instant,
    ) -> Self {
        let mut flow = Self {
            make: Some(Box::new(make)),
            session: None,
            auto,
            schedule: Schedule::new(),
            why: None,
            found: None,
            error: None,
            checked: false,
            stage: Stage::Idle,
            asked: false,
            quit: false,
            waiting_for_exit: false,
            last: None,
            pending: None,
            recheck: None,
        };
        if auto {
            flow.begin(Why::Auto, &wake, now);
        }
        flow
    }

    /// 확인 · 받기 · 설치를 하는 세션(아직 만들지 않았으면 없음).
    pub fn session(&self) -> Option<&Session> {
        self.session.as_ref()
    }

    /// 세션을 만든다(처음 한 번 — 지난 설치 결과를 거두고 작업 폴더를 치운다).
    fn ensure_session(&mut self) -> Option<&mut Session> {
        if self.session.is_none() {
            let make = self.make.take()?;
            let session = make();
            self.last = session.take_last_result();
            self.session = Some(session);
        }
        self.session.as_mut()
    }

    /// 확인을 시작한다. 이미 확인 중이면 누가 시작했는지만 올린다(자동 → 수동 → 설치).
    fn begin(&mut self, why: Why, wake: &Waker, now: Instant) -> bool {
        if self.waiting_for_exit {
            return false;
        }
        if let Some(current) = self.why {
            self.why = Some(match (current, why) {
                (_, Why::Offer) | (Why::Offer, _) => Why::Offer,
                (_, Why::Manual) | (Why::Manual, _) => Why::Manual,
                (Why::Install, Why::Auto) | (Why::Auto, Why::Install) => Why::Auto,
                (current, _) => current,
            });
            return true;
        }
        let Some(session) = self.ensure_session() else {
            return false;
        };
        if session.busy() {
            return false; // 받는 중 · 설치 중
        }
        session.check(wake.clone());
        self.why = Some(why);
        self.schedule.checked(now);
        true
    }

    /// 설정 "자동 업데이트"(제품의 자동 확인 스위치)를 따른다 — 제품은 매 프레임 지금 값을 넘긴다.
    /// 꺼지면 스스로 확인 · 묻기를 하지 않는다(이미 뜬 묻는 창 · 받기는 그대로). 실행 중에 켜면 아직 확인하지 않았을 때
    /// 곧바로, 아니면 마지막 확인에서 24시간 뒤에 확인한다.
    pub fn set_auto(&mut self, on: bool) {
        self.auto = on;
    }

    pub fn auto(&self) -> bool {
        self.auto
    }

    /// 자동 확인 일정.
    pub fn schedule(&self) -> &Schedule {
        &self.schedule
    }

    /// 다음 자동 확인까지 남은 때(꺼져 있거나 확인 중이면 `None`) — 제품은 `request_repaint_after` 에 쓴다.
    pub fn next_check(&self, now: Instant) -> Option<Duration> {
        if self.waiting_for_exit {
            return Some(Duration::from_millis(250));
        }
        if self.why.is_some() {
            return None;
        }
        self.schedule.wait(self.auto, now)
    }

    /// `지금 확인` · 명령 팔레트 `업데이트 확인`: 자동 업데이트와 상관없이 확인한다(결과는 [`Checked::manual`]).
    /// 받는 중 · 설치 중이면 거짓.
    pub fn check_now(&mut self, wake: &Waker) -> bool {
        self.begin(Why::Manual, wake, Instant::now())
    }

    /// `업데이트 설치…`(설정 카드) · 상태줄 배지: 찾은 새 판이 있으면 곧바로 묻는 창, 없으면 확인한 뒤 새 판이면
    /// 묻는 창(없으면 [`Checked::manual`] 로 "최신 버전" 을 알린다). 이미 묻는 창이 떠 있으면 그대로.
    pub fn offer(&mut self, wake: &Waker) {
        if self.waiting_for_exit || self.showing() {
            return;
        }
        if let Some(release) = self.found.clone()
            && self.why.is_none()
        {
            self.asked = true;
            self.stage = Stage::Ask(release);
            return;
        }
        self.begin(Why::Offer, wake, Instant::now());
    }

    pub fn stage(&self) -> &Stage {
        &self.stage
    }

    /// 설정 › 업데이트 카드 상태.
    pub fn status(&self) -> Status {
        if self.checking() {
            Status::Checking
        } else if let Some(r) = &self.found {
            Status::Available(r.clone())
        } else if let Some(e) = &self.error {
            Status::Failed(e.clone())
        } else if self.checked {
            Status::Latest
        } else {
            Status::Unchecked
        }
    }

    /// 마지막으로 찾은 새 판(카드 · 배지).
    pub fn available(&self) -> Option<&Release> {
        self.found.as_ref()
    }

    /// 찾은 새 판을 넣는다(제품 배치 시험 · 캡처가 카드 · 배지를 그려 볼 때 — 네트워크 없이).
    #[doc(hidden)]
    pub fn set_available(&mut self, release: Option<Release>) {
        self.found = release;
        self.checked = true;
    }

    /// 확인 중인지("지금 설치" 직전 다시 확인은 받는 중으로 본다).
    pub fn checking(&self) -> bool {
        self.why.is_some() && self.pending.is_none()
    }

    /// 마지막 "지금 설치" 직전 다시 확인한 결과(아직 없으면 `None`).
    pub fn recheck(&self) -> Option<&Recheck> {
        self.recheck.as_ref()
    }

    /// 지난번 앱이 끝난 뒤 설치한 결과(세션을 만들 때 한 번 — 제품이 알림으로 보일 수 있다).
    pub fn take_last_result(&mut self) -> Option<InstallResult> {
        self.last.take()
    }

    /// 묻는 창을 보일 차례인지.
    /// Windows handoff uses the independent progress viewer from the helper;
    /// keeping this modal open would block saving work before closing windows.
    pub fn install_notice(&self) -> &'static str {
        if cfg!(windows) {
            self.session.as_ref().map_or("", Session::install_notice)
        } else {
            ""
        }
    }

    /// 묻는 창을 보일 차례인지.
    pub fn showing(&self) -> bool {
        !self.waiting_for_exit && !matches!(self.stage, Stage::Idle)
    }

    /// 매 프레임: 자동 확인할 차례면 시작하고, 끝난 일을 거둔다. 확인이 끝났으면 그 결과를 돌려준다.
    pub fn poll(&mut self, wake: &Waker) -> Option<Checked> {
        self.poll_at(Instant::now(), wake)
    }

    /// [`Flow::poll`] — 때를 받는다(시험).
    pub fn poll_at(&mut self, now: Instant, wake: &Waker) -> Option<Checked> {
        if self.waiting_for_exit
            && let Some(error) = self
                .session
                .as_ref()
                .and_then(Session::waiting_install_failure)
        {
            self.waiting_for_exit = false;
            self.fail_running(error);
        }
        if self.why.is_none()
            && self.schedule.due(self.auto, now)
            && !matches!(self.stage, Stage::Downloading(_) | Stage::Installing(_))
        {
            self.begin(Why::Auto, wake, now);
        }
        let event = self.session.as_mut()?.poll()?;
        match event {
            Event::Checked(result) => {
                let Some(why) = self.why.take() else {
                    // 확인이 아닌 일(받기 · 설치)의 뒤 스레드가 멈췄다.
                    if let Err(error) = result {
                        self.fail_running(error);
                    }
                    return None;
                };
                self.checked = true;
                if let Some(remembered) = self.pending.take() {
                    self.download_after_recheck(remembered, &result, wake);
                    return (why != Why::Install).then_some(Checked {
                        manual: why != Why::Auto,
                        result,
                    });
                }
                match &result {
                    Ok(Some(release)) => {
                        self.found = Some(release.clone());
                        self.error = None;
                        let ask = match why {
                            Why::Offer => true,
                            Why::Auto => !self.asked,
                            Why::Manual | Why::Install => false,
                        };
                        if ask && !self.showing() {
                            self.asked = true;
                            self.stage = Stage::Ask(release.clone());
                        }
                    }
                    Ok(None) => {
                        self.found = None;
                        self.error = None;
                    }
                    Err(error) => self.error = Some(error.clone()),
                }
                (why != Why::Install).then_some(Checked {
                    manual: why != Why::Auto,
                    result,
                })
            }
            Event::Downloaded(result) => {
                let Stage::Downloading(release) = &self.stage else {
                    return None; // "나중에" 로 그만둔 받기
                };
                let release = release.clone();
                match result {
                    Ok((_, file)) => self.install_file(release, file, wake),
                    Err(error) => {
                        self.stage = Stage::Failed {
                            release,
                            error,
                            file: None,
                        }
                    }
                }
                None
            }
            Event::Installed(result) => {
                let Stage::Installing(release) = &self.stage else {
                    return None;
                };
                let release = release.clone();
                match result {
                    Ok(_) => {
                        let result = self.session.as_ref().map_or_else(
                            || Err(std::io::Error::other("update session missing")),
                            Session::relaunch,
                        );
                        if let Err(error) = result {
                            // 설치 성공과 재시작 성공은 별개다. 실패를 숨기고 현재 앱을 종료하지 않는다.
                            self.stage = Stage::Failed {
                                release,
                                error: UpdateError::Install(format!("restart failed: {error}")),
                                file: None,
                            };
                            return None;
                        }
                        self.quit = true;
                        self.stage = Stage::Idle;
                    }
                    Err(error) => {
                        let file = self
                            .session
                            .as_ref()
                            .and_then(|s| s.asset(&release).map(|a| s.work_dir().join(&a.name)));
                        self.stage = Stage::Failed {
                            release,
                            error,
                            file,
                        };
                    }
                }
                None
            }
        }
    }

    /// 받는 중 · 설치 중에 뒤 스레드가 멈췄다.
    fn fail_running(&mut self, error: UpdateError) {
        if let Stage::Downloading(release) | Stage::Installing(release) = &self.stage {
            self.stage = Stage::Failed {
                release: release.clone(),
                error,
                file: None,
            };
        }
    }

    fn install_file(&mut self, release: Release, file: PathBuf, wake: &Waker) {
        let Some(session) = self.session.as_mut() else {
            return;
        };
        // UI 큐에서 기다리는 동안 캐시 파일이 바뀌었을 수 있다. 실행 위임 직전에 다시 확인한다.
        let verified = session
            .asset(&release)
            .ok_or(UpdateError::NoAsset)
            .and_then(|asset| crate::verify_file(&file, asset));
        if let Err(error) = verified {
            self.stage = Stage::Failed {
                release,
                error,
                file: None,
            };
            return;
        }
        match session.install_now(&release, &file, wake.clone()) {
            Ok(Started::QuitToInstall) => {
                self.waiting_for_exit = true;
                self.stage = Stage::Installing(release);
            }
            Ok(Started::Background) => self.stage = Stage::Installing(release),
            Err(error) => {
                let file = error.offers_file().then_some(file);
                self.stage = Stage::Failed {
                    release,
                    error,
                    file,
                }
            }
        }
    }

    /// "지금 설치": 최신 판 다시 확인 → 받기 → 검증 → 설치. 이 PC 에서 설치할 수 없으면 내려받기 페이지를 연다.
    ///
    /// 묻는 창의 판은 켤 때(또는 하루 한 번 · 수동 확인 때) 찾은 것이라, 그사이 더 새 판이 나왔을 수 있다.
    /// 그래서 받기 전에 사이트에 한 번 더 묻고, 더 새 판이 있으면 그 판을 받는다(묻는 창 · 카드의 판 번호도 바뀐다).
    /// 확인하지 못하면 기억한 판으로 진행하고 그 사실을 [`Flow::recheck`] · 작업 폴더 기록에 남긴다.
    pub fn install(&mut self, wake: &Waker) {
        let Stage::Ask(release) = &self.stage else {
            return;
        };
        let release = release.clone();
        let Some(session) = self.session.as_mut() else {
            return;
        };
        if !session.can_install(&release) {
            let _ = session.open_page(&release.page);
            self.stage = Stage::Idle;
            return;
        }
        session.reset_progress();
        self.recheck = None;
        self.stage = Stage::Downloading(release.clone());
        // 이미 확인 중이면 그 결과를 쓴다(한 번 더 묻지 않는다).
        let started = self.why.is_some() || self.begin(Why::Install, wake, Instant::now());
        if started {
            self.pending = Some(release);
        } else if let Some(session) = self.session.as_mut() {
            session.download(release, wake.clone());
        }
    }

    /// 다시 확인한 결과로 받을 판을 정하고 받기를 시작한다.
    fn download_after_recheck(
        &mut self,
        remembered: Release,
        result: &Result<Option<Release>, UpdateError>,
        wake: &Waker,
    ) {
        if !matches!(&self.stage, Stage::Downloading(r) if *r == remembered) {
            return; // "나중에" 로 그만뒀다.
        }
        let Some(session) = self.session.as_mut() else {
            return;
        };
        let (target, recheck) = match result {
            Ok(Some(latest))
                if latest.version > remembered.version && session.can_install(latest) =>
            {
                let recheck = Recheck::Newer {
                    from: remembered.version,
                    to: latest.version,
                };
                (latest.clone(), recheck)
            }
            Ok(_) => (remembered.clone(), Recheck::Same(remembered.version)),
            Err(error) => {
                let recheck = Recheck::Failed {
                    version: remembered.version,
                    error: error.clone(),
                };
                (remembered.clone(), recheck)
            }
        };
        match &recheck {
            Recheck::Newer { from, to } => {
                session.log(&format!("recheck before install: {from} -> {to}"))
            }
            Recheck::Same(v) => session.log(&format!("recheck before install: {v} is the latest")),
            Recheck::Failed { version, error } => {
                session.log(&format!(
                    "recheck before install failed, installing remembered {version}: {error}"
                ));
            }
        }
        self.found = Some(target.clone());
        self.error = None;
        self.recheck = Some(recheck);
        session.download(target.clone(), wake.clone());
        self.stage = Stage::Downloading(target);
    }

    /// "나중에"(묻기 · 받는 중) · "닫기"(실패): 이번 실행에서는 스스로 다시 묻지 않는다.
    pub fn later(&mut self) {
        if !matches!(self.stage, Stage::Installing(_)) {
            self.stage = Stage::Idle;
            self.pending = None;
        }
    }

    /// 이 PC 에서 자동으로 설치할 수 있는 판인지(묻는 창 주 단추).
    pub fn can_install(&self, release: &Release) -> bool {
        self.session
            .as_ref()
            .is_some_and(|s| s.can_install(release))
    }

    /// 받은 바이트 비율(모르면 `None`).
    pub fn fraction(&self) -> Option<f32> {
        let (done, total) = self.session.as_ref()?.progress();
        (total > 0).then(|| (done as f64 / total as f64) as f32)
    }

    /// 받은 비율(0 ~ 100, 모르면 0).
    pub fn percent(&self) -> u32 {
        let Some((done, total)) = self.session.as_ref().map(Session::progress) else {
            return 0;
        };
        if total == 0 {
            return 0;
        }
        u32::try_from(done.min(total) * 100 / total).unwrap_or(100)
    }

    /// 릴리스 노트 앞부분(묻는 창).
    pub fn notes(release: &Release) -> String {
        notes_excerpt(&release.notes)
    }

    /// "자세히 보기" · "내려받기 페이지 열기".
    pub fn open_page(&self) {
        if let (Some(s), Some(r)) = (&self.session, self.release()) {
            let _ = s.open_page(&r.page);
        }
    }

    /// "내려받은 파일 열기".
    pub fn open_file(&self) {
        if let (Some(s), Stage::Failed { file: Some(f), .. }) = (&self.session, &self.stage) {
            let _ = s.open_file(f);
        }
    }

    /// 지금 단계의 판.
    pub fn release(&self) -> Option<&Release> {
        match &self.stage {
            Stage::Idle => None,
            Stage::Ask(r) | Stage::Downloading(r) | Stage::Installing(r) => Some(r),
            Stage::Failed { release, .. } => Some(release),
        }
    }

    /// 제품이 앱을 닫을 차례인지(한 번만 참).
    pub fn take_quit(&mut self) -> bool {
        std::mem::take(&mut self.quit)
    }
}
