//! 켤 때 묻기 흐름(화면 없는 상태 기계). 제품은 [`Stage`] 를 묻는 창(`tastedev-ui-kit::update_dialog`)으로 그리고,
//! 고른 것을 [`Flow::install`] · [`Flow::later`] 등으로 넘긴다.
//!
//! - 자동 업데이트가 꺼져 있으면 [`Flow::start`] 가 세션을 만들지 않는다 — 요청도 묻기도 없다.
//! - 켜져 있으면 한 번 확인하고, 새 판이면 [`Stage::Ask`]. "나중에" 는 이번 실행에서 다시 묻지 않는다.
//! - "지금 설치" → [`Stage::Downloading`] → 검증 → 설치 명령. Windows 는 [`Flow::take_quit`] 이 참이 되어 제품이
//!   앱을 닫는다(스크립트가 앱이 끝난 뒤 설치 · 다시 시작). Linux 는 [`Stage::Installing`] 뒤 성공하면 새 앱을 켜고
//!   닫는다. 실패는 [`Stage::Failed`](옛 판 그대로).

use std::path::PathBuf;

use crate::{Event, InstallResult, Release, Session, Started, UpdateError, Waker, notes_excerpt};

/// 묻는 창 단계.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Stage {
    /// 할 일 없음(꺼짐 · 확인 중 · 새 판 없음 · 끝남).
    Idle,
    /// 새 판을 찾아 묻는 중.
    Ask(Release),
    /// 받는 중.
    Downloading(Release),
    /// 설치 중(Linux 권한 창 · Windows 는 곧 닫힌다).
    Installing(Release),
    /// 실패(받은 파일이 있으면 `file`).
    Failed {
        release: Release,
        error: UpdateError,
        file: Option<PathBuf>,
    },
}

/// 켤 때 업데이트 한 번.
pub struct Flow {
    session: Option<Session>,
    stage: Stage,
    /// 이번 실행에서 이미 물었는지(나중에 · 닫기 뒤 다시 묻지 않는다).
    asked: bool,
    quit: bool,
    last: Option<InstallResult>,
}

impl Flow {
    /// 켤 때 부른다. `auto` 가 거짓이면 세션을 만들지 않는다(네트워크 요청 없음).
    /// 켜져 있으면 지난 설치 결과를 거두고 곧바로 확인을 시작한다.
    pub fn start(auto: bool, make: impl FnOnce() -> Session, wake: Waker) -> Self {
        let mut flow = Self {
            session: None,
            stage: Stage::Idle,
            asked: false,
            quit: false,
            last: None,
        };
        if auto {
            let mut session = make();
            flow.last = session.take_last_result();
            session.check(wake);
            flow.session = Some(session);
        }
        flow
    }

    /// 확인 · 받기 · 설치를 하는 세션(꺼져 있으면 없음).
    pub fn session(&self) -> Option<&Session> {
        self.session.as_ref()
    }

    pub fn stage(&self) -> &Stage {
        &self.stage
    }

    /// 지난번 앱이 끝난 뒤 설치한 결과(켤 때 한 번 — 제품이 알림으로 보일 수 있다).
    pub fn take_last_result(&mut self) -> Option<InstallResult> {
        self.last.take()
    }

    /// 묻는 창을 보일 차례인지.
    pub fn showing(&self) -> bool {
        !matches!(self.stage, Stage::Idle)
    }

    /// 매 프레임: 끝난 일을 거둔다. 새 판을 찾았으면 그 판을 돌려준다(제품의 설정 카드용).
    pub fn poll(&mut self, wake: &Waker) -> Option<Release> {
        let event = self.session.as_mut()?.poll()?;
        match event {
            Event::Checked(Ok(Some(release))) => {
                if !self.asked {
                    self.asked = true;
                    self.stage = Stage::Ask(release.clone());
                }
                Some(release)
            }
            // 켤 때 확인 실패 · 새 판 없음은 조용히.
            Event::Checked(_) => None,
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
                        if let Some(s) = &self.session {
                            let _ = s.relaunch();
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

    fn install_file(&mut self, release: Release, file: PathBuf, wake: &Waker) {
        let Some(session) = self.session.as_mut() else {
            return;
        };
        match session.install_now(&release, &file, wake.clone()) {
            Ok(Started::QuitToInstall) => {
                self.quit = true;
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

    /// "지금 설치": 받기 → 검증 → 설치. 이 PC 에서 설치할 수 없으면 내려받기 페이지를 연다.
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
        session.download(release.clone(), wake.clone());
        self.stage = Stage::Downloading(release);
    }

    /// "나중에"(묻기 · 받는 중) · "닫기"(실패): 이번 실행에서는 다시 묻지 않는다.
    pub fn later(&mut self) {
        if !matches!(self.stage, Stage::Installing(_)) {
            self.stage = Stage::Idle;
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
