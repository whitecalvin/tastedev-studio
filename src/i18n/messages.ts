import {interpolate,type Language} from './core.ts';
import {international} from './international.ts';
import {development} from './development.ts';
import {guidance} from './guidance.ts';
import {analysisGuidance} from './analysis-guidance.ts';
import {fragments} from './fragments.ts';
import {interaction} from './interaction.ts';
import {approval,matchFeedback} from './approval.ts';
import {stateMessages} from './state-messages.ts';
import {reliabilityMessages} from './reliability.ts';
import {onboardingMessages} from './onboarding.ts';
import {teamMessages} from './team.ts';
import {updateMessages} from './update.ts';
/** English source messages remain the stable IDs; user content never enters this catalog. */
const entries=`Language|언어
System language|시스템 언어
Projects|프로젝트
Project|프로젝트
New Project|새 프로젝트
Recent Projects|최근 프로젝트
All projects|모든 프로젝트
All|전체
Your starting point. Pick up where you left off.|이전에 작업하던 프로젝트에서 시작하세요.
Start a project|프로젝트 시작
Register a workspace|작업 공간 등록
Open Project|프로젝트 열기
Connect a local folder|로컬 폴더 연결
Clone Repository|저장소 복제
Start from a Git repository|Git 저장소에서 시작
Search projects|프로젝트 검색
Find a project…|프로젝트 검색…
No matching projects|검색 결과가 없습니다
Try a different name or workspace path.|다른 이름이나 작업 공간 경로로 검색하세요.
No projects yet|아직 프로젝트가 없습니다
A workspace starts with a project.|프로젝트로 작업 공간을 시작하세요.
Create a new project, open an existing project,|새 프로젝트를 만들거나 기존 프로젝트를 열고,
or clone a Git repository to get started.|Git 저장소를 복제하여 시작하세요.
Loading your projects…|프로젝트를 불러오는 중…
Projects couldn’t be loaded|프로젝트를 불러올 수 없습니다
Retry load|다시 불러오기
Clear search|검색 지우기
Dismiss notification|알림 닫기
Not opened yet|아직 열지 않음
Opening folder…|폴더를 여는 중…
Waiting for folder selection…|폴더 선택을 기다리는 중…
Project name|프로젝트 이름
Workspace path|작업 공간 경로
Target workspace|대상 작업 공간
Description|설명
Required|필수
Optional|선택
My project|내 프로젝트
What are you working on?|어떤 작업을 하고 있나요?
Repository URL|저장소 URL
Branch|브랜치
Use repository default|저장소 기본값 사용
Use an absolute Windows, macOS, or Linux path. Folder existence is not checked in the browser.|Windows, macOS 또는 Linux의 절대 경로를 입력하세요. 브라우저에서는 폴더 존재 여부를 확인하지 않습니다.
Register a project in this browser. This saves metadata; it does not create folders or source files.|이 브라우저에 프로젝트 정보를 등록합니다. 폴더나 소스 파일은 만들지 않습니다.
Enter a repository and destination. Cloning requires native Git in the future desktop runtime.|저장소와 대상 경로를 입력하세요. 복제에는 데스크톱 런타임의 Git 연결이 필요합니다.
The project could not be saved. Please retry.|프로젝트를 저장하지 못했습니다. 다시 시도하세요.
Create Project|프로젝트 만들기
Check clone availability|복제 가능 여부 확인
Cancel|취소
Save|저장
Close dialog|대화 상자 닫기
Main navigation|주 메뉴
Skip to content|본문으로 이동
Skip to editor|편집기로 이동
Color theme|색상 테마
System theme|시스템 테마
Light theme|밝은 테마
Dark theme|어두운 테마
Desktop runtime|데스크톱 런타임
Web runtime|웹 런타임
Working on your computer|컴퓨터에서 작업
Working in your browser|브라우저에서 작업
Project metadata stays on this computer|프로젝트 정보는 이 컴퓨터에 저장됩니다
Project metadata stays in this browser|프로젝트 정보는 이 브라우저에 저장됩니다
Connect a local folder to edit files, use the terminal and manage Git changes. Projects stay on this computer. Git cloning is not connected.|로컬 폴더를 연결하여 파일을 편집하고 터미널과 Git 변경사항을 관리하세요. 프로젝트 정보는 이 컴퓨터에 저장됩니다. Git 복제는 아직 연결되지 않았습니다.
Chrome and Edge can connect a local folder with your permission. Metadata and folder handles stay in this browser. Git cloning is not connected.|Chrome과 Edge에서는 권한을 허용하여 로컬 폴더를 연결할 수 있습니다. 프로젝트 정보와 폴더 연결 정보는 이 브라우저에 저장됩니다. Git 복제는 아직 연결되지 않았습니다.
Page not found|페이지를 찾을 수 없습니다
This page does not exist.|존재하지 않는 페이지입니다.
Return to Project Manager|프로젝트 관리자로 돌아가기
Something went wrong|문제가 발생했습니다
The page could not be displayed. Retry to load your projects again.|페이지를 표시하지 못했습니다. 다시 시도하여 프로젝트를 불러오세요.
The application could not be displayed. Retry to recover.|앱을 표시하지 못했습니다. 다시 시도하여 복구하세요.
Retry|다시 시도
Explorer|탐색기
Search|검색
Source Control|소스 제어
Run|실행
Tests|테스트
Agents|에이전트
Queue|대기열
Runs|실행 기록
Issues|이슈
Settings|설정
Scheduler|스케줄러
Workspace activities|작업 공간 활동
Appearance & layout|테마와 레이아웃
Theme is shared across the application. Layout is saved separately for each project in this browser.|테마는 앱 전체에 적용됩니다. 레이아웃은 이 브라우저에 프로젝트별로 저장됩니다.
Search this workspace|작업 공간 검색
File content search will be available after filesystem integration.|파일 내용 검색은 파일 시스템 통합 이후 제공됩니다.
No files have been indexed.|색인된 파일이 없습니다.
Primary sidebar|기본 사이드바
Secondary panel|보조 패널
Bottom panel|하단 패널
Bottom panel tabs|하단 패널 탭
primary sidebar|기본 사이드바
secondary panel|보조 패널
bottom panel|하단 패널
Resize bottom panel|하단 패널 크기 조절
Resize secondary panel|보조 패널 크기 조절
Output|출력
Problems|문제
Agent|에이전트
Logs|로그
Terminal|터미널
Loading workspace…|작업 공간을 불러오는 중…
Loading workspace layout…|작업 공간 레이아웃을 불러오는 중…
Project unavailable|프로젝트를 사용할 수 없습니다
This project could not be opened.|프로젝트를 열지 못했습니다.
Loading…|불러오는 중…
Layout changes are temporary because browser storage is unavailable.|브라우저 저장소를 사용할 수 없어 레이아웃 변경은 임시로 적용됩니다.
Layout storage is unavailable.|레이아웃 저장소를 사용할 수 없습니다.
Saved layout is invalid. Using a temporary layout; saved data is unchanged.|저장된 레이아웃이 유효하지 않습니다. 임시 레이아웃을 사용하며 저장된 정보는 유지합니다.
No folder connected|연결된 폴더 없음
No open file|열린 파일 없음
unsaved|미저장
Access Required|권한 필요
Connected|연결됨
Checking access…|접근 권한 확인 중…
Checking folder access…|폴더 접근 권한 확인 중…
Permission Denied|권한 거부됨
Permission was denied. Request access or reconnect the folder.|권한이 거부되었습니다. 접근 권한을 요청하거나 폴더를 다시 연결하세요.
Request access|권한 요청
Reconnect Folder|폴더 다시 연결
Connect Folder|폴더 연결
Choose a local folder to browse and edit its files.|로컬 폴더를 선택하여 파일을 탐색하고 편집하세요.
No workspace folder is connected.|연결된 작업 공간 폴더가 없습니다.
Requires File System Access API in desktop Chrome or Edge.|데스크톱 Chrome 또는 Edge의 File System Access API가 필요합니다.
This connection is temporary. Reconnect after reloading.|임시 연결입니다. 새로고침 후 다시 연결하세요.
Workspace files|작업 공간 파일
New file|새 파일
New folder|새 폴더
Rename|이름 변경
Rename selected entry|선택 항목 이름 변경
Rename entry|항목 이름 변경
Delete|삭제
Delete selected entry|선택 항목 삭제
Delete permanently|영구 삭제
Delete permanently?|영구 삭제하시겠습니까?
Refresh Explorer|탐색기 새로고침
Refresh expanded folders|펼친 폴더 새로고침
Show ignored folders|제외된 폴더 표시
Empty folder|빈 폴더
Load folder|폴더 불러오기
Reading folder…|폴더를 읽는 중…
Connecting folder…|폴더를 연결하는 중…
Disconnecting…|연결을 해제하는 중…
Disconnect folder|폴더 연결 해제
Requesting access…|권한 요청 중…
Creating entry…|항목을 만드는 중…
Renaming entry…|이름을 변경하는 중…
Deleting entry…|항목을 삭제하는 중…
Refreshing Explorer…|탐색기를 새로고침하는 중…
Rename this entry in the connected workspace. Avoid external edits during this operation. Unsaved editor changes are preserved.|연결된 작업 공간에서 항목 이름을 변경합니다. 작업 중 외부에서 수정하지 마세요. 저장하지 않은 편집 내용은 유지됩니다.
Create|만들기
Unsaved changes|저장하지 않은 변경사항
Save changes?|변경사항을 저장할까요?
Save all|모두 저장
Don't Save|저장하지 않음
Save all edited files before leaving this workspace or changing its folder connection?|작업 공간을 떠나거나 폴더 연결을 변경하기 전에 편집한 파일을 모두 저장할까요?
Some files changed while saving. Review the remaining unsaved changes before leaving.|저장 중 일부 파일이 변경되었습니다. 남은 미저장 변경사항을 확인하세요.
File saved to the connected folder.|연결된 폴더에 파일을 저장했습니다.
Closing editor…|편집기를 닫는 중…
Saving file…|파일을 저장하는 중…
Saving files…|파일을 저장하는 중…
Opening file…|파일을 여는 중…
Dismiss file notification|파일 알림 닫기
File editor|파일 편집기
Editor area|편집 영역
Open files|열린 파일
No open editors|열린 편집기 없음
Select a file in Explorer|탐색기에서 파일을 선택하세요
Save file|파일 저장
Save file (Ctrl+S)|파일 저장 (Ctrl+S)
Save all files|모든 파일 저장
Reload file from disk|디스크에서 파일 다시 불러오기
Reload from disk?|디스크에서 다시 불러올까요?
Discard and reload|변경사항 버리고 다시 불러오기
Reloading file…|파일을 다시 불러오는 중…
Your workspace|작업 공간
Choose a file in Explorer to start editing.|탐색기에서 파일을 선택하여 편집을 시작하세요.
Connect a folder to browse and edit local files.|폴더를 연결하여 로컬 파일을 탐색하고 편집하세요.
UTF-8 text files up to 2 MiB. Changes are saved only when you choose Save.|최대 2 MiB의 UTF-8 텍스트 파일을 지원합니다. 저장을 선택해야 변경사항이 저장됩니다.
Loading editor…|편집기를 불러오는 중…
The editor could not be loaded.|편집기를 불러오지 못했습니다.
Editor worker assets are unavailable. Rebuild the application.|편집기 작업자 파일을 사용할 수 없습니다. 앱을 다시 빌드하세요.
Run Configurations|실행 설정
Add run configuration|실행 설정 추가
Edit run configuration|실행 설정 편집
Loading configurations…|실행 설정을 불러오는 중…
No configurations yet. Add an executable and its arguments to prepare a run.|실행 설정이 없습니다. 실행 파일과 인수를 추가하세요.
Configuration|설정
Executable|실행 파일
Working directory|작업 디렉터리
Workspace root|작업 공간 루트
workspace root|작업 공간 루트
Destination|대상
Terminal / PTY|터미널 / PTY
Task output|작업 출력
Edit|편집
Stop|중지
Preparing…|준비 중…
Ready|준비됨
Run: Ready|실행: 준비됨
Process: Desktop runtime required|프로세스: 데스크톱 런타임 필요
Desktop runtime required|데스크톱 런타임 필요
Unsupported runtime|지원하지 않는 런타임
Select a configuration to begin.|설정을 선택하여 시작하세요.
Filesystem|파일 시스템
Process|프로세스
Available with permission|권한 허용 시 사용 가능
Available|사용 가능
Unavailable|사용 불가
Delete run configuration?|실행 설정을 삭제할까요?
Delete configuration|설정 삭제
The configuration could not be removed. Check browser storage.|설정을 삭제하지 못했습니다. 브라우저 저장소를 확인하세요.
Name|이름
Development Server|개발 서버
Arguments (JSON array)|인수 (JSON 배열)
Arguments must be a JSON array; environment must be a JSON object.|인수는 JSON 배열, 환경 변수는 JSON 객체여야 합니다.
Could not save this configuration.|설정을 저장하지 못했습니다.
Each array item is one argument. No shell command is assembled.|배열 항목 하나가 인수 하나입니다. 셸 명령으로 조합하지 않습니다.
Relative to the connected workspace. “.” uses its root.|연결된 작업 공간 기준 상대 경로입니다. “.”은 루트를 사용합니다.
Environment (JSON object)|환경 변수 (JSON 객체)
Stored locally with the configuration. This is not a secret vault.|설정과 함께 로컬에 저장됩니다. 비밀 값 저장소가 아닙니다.
Output destination|출력 대상
Save configuration|설정 저장
Open shell|셸 열기
Close terminal|터미널 닫기
Clear terminal|터미널 지우기
Focus terminal|터미널에 포커스
Stop terminal process|터미널 프로세스 중지
Loading terminal…|터미널을 불러오는 중…
Terminal screen|터미널 화면
Terminal could not load. Reload the workspace to retry.|터미널을 불러오지 못했습니다. 작업 공간을 새로고침하세요.
Terminal layout failed. Reopen the workspace to retry.|터미널 레이아웃을 적용하지 못했습니다. 작업 공간을 다시 여세요.
Studio & task output|Studio 및 작업 출력
Clear output|출력 지우기
No task output. Studio run messages and non-interactive task output appear here.|작업 출력이 없습니다. Studio 실행 메시지와 비대화형 작업 출력이 표시됩니다.
Older output discarded at the retention limit.|보관 한도를 초과한 이전 출력은 삭제되었습니다.
Repository|저장소
Refresh Git|Git 새로고침
Detached HEAD|분리된 HEAD
Unborn branch|커밋이 없는 브랜치
Repository not detected|저장소를 찾지 못했습니다
This folder is not a Git repository.|이 폴더는 Git 저장소가 아닙니다.
Save the file to update Git changes. Git compares saved disk content; unsaved edits are preserved.|Git 변경사항을 갱신하려면 파일을 저장하세요. 저장된 디스크 내용을 비교하며 미저장 편집 내용은 유지합니다.
Status is out of date. Refresh before changing Git data.|상태가 오래되었습니다. Git 데이터를 변경하기 전에 새로고침하세요.
Conflicts|충돌
Changes|변경사항
Staged Changes|스테이징된 변경사항
Stage|스테이징
Unstage|스테이징 해제
Stage All|모두 스테이징
Unstage All|모두 스테이징 해제
Commit|커밋
Commit message|커밋 메시지
Describe your staged changes|스테이징된 변경사항을 설명하세요
Commit staged changes|스테이징된 변경사항 커밋
Only staged changes are committed.|스테이징된 변경사항만 커밋합니다.
Commit becomes available in the desktop runtime.|커밋은 데스크톱 런타임에서 사용할 수 있습니다.
History|이력
No commits yet.|아직 커밋이 없습니다.
History is unavailable.|이력을 사용할 수 없습니다.
Showing the latest 50 commits.|최근 50개 커밋을 표시합니다.
Git capability:|Git 기능:
No repository|저장소 없음
Git diff|Git 차이
Git diff ·|Git 차이 ·
Close diff|차이 보기 닫기
Original ↔ Modified · Read only · Saved repository content|원본 ↔ 수정본 · 읽기 전용 · 저장된 저장소 내용
 · Unsaved editor changes are not included.| · 저장하지 않은 편집 내용은 포함하지 않습니다.
Loading diff editor…|차이 편집기를 불러오는 중…
Original saved Git content|Git에 저장된 원본 내용
Modified saved Git content|수정된 저장 내용
Read-only Git diff|읽기 전용 Git 차이
Binary diff is not supported.|바이너리 차이 비교는 지원하지 않습니다.
Diff editor could not load. Close the diff and try again.|차이 편집기를 불러오지 못했습니다. 닫은 뒤 다시 시도하세요.
Register agent|에이전트 등록
Run on Agent|에이전트에서 실행
Shared agent registry|공용 에이전트 목록
Current project|현재 프로젝트
Core session|Core 세션
App session|앱 세션
No agents registered.|등록된 에이전트가 없습니다.
No jobs queued.|대기 중인 작업이 없습니다.
No runs recorded.|실행 기록이 없습니다.
Record an execution environment. Declared capabilities are unverified until an agent connects.|실행 환경을 등록합니다. 에이전트가 연결되기 전에는 등록된 기능을 검증하지 않습니다.
OS|운영 체제
Architecture|아키텍처
CPU cores|CPU 코어 수
Memory (MiB)|메모리 (MiB)
Node version|Node 버전
Declared capabilities|등록된 기능
Register offline|오프라인 등록
Job name|작업 이름
Timeout (seconds)|제한 시간 (초)
Any OS|모든 운영 체제
Any architecture|모든 아키텍처
Node requirement|Node 요구사항
Priority (0–100)|우선순위 (0–100)
Browser|브라우저
Not required|필요 없음
Docker required|Docker 필요
Queue job|작업 대기열 등록
Agent identity and declared capabilities|에이전트 정보와 등록된 기능
Agent ID|에이전트 ID
Status|상태
OS / Architecture|운영 체제 / 아키텍처
Last seen|마지막 연결
CPU / Memory|CPU / 메모리
Runtimes|런타임
Browsers|브라우저
None declared|등록되지 않음
Yes|예
No|아니요
Created|생성 시각
Remove registration|등록 제거
Job ID|작업 ID
Priority|우선순위
Queued|대기 중
Attempt|시도
Requirements|요구사항
Task|작업
Tasks|작업
Steps|단계
Cancellation|취소
Requested; awaiting acknowledgement|요청됨; 응답 대기 중
Not requested|요청하지 않음
Agent matching|에이전트 매칭
No compatible agent available.|호환되는 에이전트가 없습니다.
Assign next compatible job|다음 호환 작업 배정
Cancel job|작업 취소
Request cancellation|취소 요청
Queue retry|재시도 대기열 등록
Job queue|작업 대기열
Run detail|실행 상세
Run history|실행 이력
Run ID|실행 ID
Run / Job|실행 / 작업
Run / Test|실행 / 테스트
Start|시작
Duration|소요 시간
End|종료
Exit code|종료 코드
Not reported|보고되지 않음
In progress|진행 중
Not started|시작하지 않음
Order|순서
Step|단계
Exit|종료
Result|결과
Remote Agent log|원격 에이전트 로그
No output received.|수신한 출력이 없습니다.
Artifacts|아티팩트
No artifact metadata recorded.|아티팩트 정보가 없습니다.
Start / Duration|시작 / 소요 시간
Core details|Core 상세
Core connection|Core 연결
Endpoint|엔드포인트
Studio token|Studio 토큰
Connect Core|Core 연결
Disconnect Core|Core 연결 해제
Execution history is saved by Core. Connection credentials stay in memory.|Core가 실행 이력을 저장합니다. 연결 인증 정보는 메모리에 유지합니다.
Agent registered offline. No connection has been established.|에이전트를 오프라인으로 등록했습니다. 아직 연결되지 않았습니다.
Agent registration removed.|에이전트 등록을 제거했습니다.
Job queued. Select Assign next compatible job to execute.|작업을 대기열에 등록했습니다. 다음 호환 작업을 배정하여 실행하세요.
Job queued locally. Connect to Core to create executable remote jobs.|작업을 로컬 대기열에 등록했습니다. Core에 연결하여 원격 작업을 만드세요.
Compatible agent connected. Assignment sends this command for execution.|호환되는 에이전트가 연결되었습니다. 배정하면 실행 명령을 전송합니다.
Compatible registration available. Assignment does not start execution.|호환되는 등록 정보가 있습니다. 배정만으로 실행되지는 않습니다.
No compatible agent available. Jobs remain queued.|호환되는 에이전트가 없습니다. 작업은 대기열에 유지됩니다.
Job cancelled.|작업을 취소했습니다.
Cancellation requested; waiting for execution acknowledgement.|취소를 요청했습니다. 실행 측 응답을 기다리는 중입니다.
Retry queued as a new attempt.|새 시도로 재시도를 대기열에 등록했습니다.
Live Core execution records.|실시간 Core 실행 기록입니다.
No remote transport is connected.|원격 연결이 없습니다.
Inspect registered execution environments and their capabilities.|등록된 실행 환경과 기능을 확인하세요.
Create and inspect work requests for this project.|이 프로젝트의 작업 요청을 만들고 확인하세요.
Inspect run attempts, ordered steps and recorded results.|실행 시도, 단계와 결과를 확인하세요.
Select an agent to view its details.|에이전트를 선택하여 상세 정보를 확인하세요.
Select a job to inspect its requirements.|작업을 선택하여 요구사항을 확인하세요.
Select a run to inspect its steps and result.|실행을 선택하여 단계와 결과를 확인하세요.
Core retains state while its server process runs. Reconnect after reloading Studio.|Core 서버 프로세스가 실행되는 동안 상태를 유지합니다. Studio 새로고침 후 다시 연결하세요.
Local Core state resets on reload. Connect to Core for actual Agent execution.|새로고침하면 로컬 Core 상태가 초기화됩니다. 실제 에이전트 실행에는 Core 연결이 필요합니다.
Status and last seen are reported by Core. Capability probes describe the connected agent.|Core에서 상태와 마지막 연결 시각을 보고합니다. 기능 탐지는 연결된 에이전트를 기준으로 합니다.
Remote agent transport is not connected. Registration does not establish a connection.|원격 에이전트가 연결되지 않았습니다. 등록만으로 연결되지는 않습니다.
Core operation failed.|Core 작업에 실패했습니다.
TASTEDEV Protocol|TASTEDEV 프로토콜
Protocol tests|프로토콜 테스트
Test definitions|테스트 정의
Reload|다시 불러오기
Connect the project folder to inspect .tastedev.|프로젝트 폴더를 연결하여 .tastedev를 확인하세요.
Initialize TASTEDEV|TASTEDEV 초기화
Creates a definition without executable tasks.|실행 작업이 없는 정의 파일을 만듭니다.
Fix the definition, save, then reload.|정의를 수정하고 저장한 뒤 다시 불러오세요.
Project requirements|프로젝트 요구사항
Definition files|정의 파일
Optional files can be created in Explorer.|선택 파일은 탐색기에서 만들 수 있습니다.
Effective requirements|적용된 요구사항
Save Protocol edits before queuing. The view reflects saved files.|대기열에 등록하기 전에 프로토콜을 저장하세요. 화면은 저장된 파일을 기준으로 합니다.
This project has no .tastedev/project.yml. Local IDE features remain available.|이 프로젝트에는 .tastedev/project.yml이 없습니다. 로컬 IDE 기능은 사용할 수 있습니다.
Select task|작업 선택
Select test|테스트 선택
Protocol Task|프로토콜 작업
Protocol Test|프로토콜 테스트
Not Configured|미설정
Not configured|미설정
Valid|유효함
Invalid|유효하지 않음
Loading Protocol…|프로토콜을 불러오는 중…
No source provider declared. Tasks run in an empty Agent workspace.|소스 공급자가 없습니다. 빈 에이전트 작업 공간에서 작업을 실행합니다.
Branch / revision|브랜치 / 리비전
Revision|리비전
Base revision|기준 리비전
Commit SHA|커밋 SHA
Manifest checksum|매니페스트 체크섬
Workspace snapshot|작업 공간 스냅샷
Cancel test|테스트 취소
Retry test|테스트 재시도
Preparing source…|소스를 준비하는 중…
Pipeline steps|파이프라인 단계
Primary failure:|주요 실패:
Cleanup warning:|정리 경고:
Step log|단계 로그
No output for this step.|이 단계의 출력이 없습니다.
Live stdout / stderr · latest 128 KiB retained per run|실시간 stdout / stderr · 실행별 최근 128 KiB 보관
Service process:|서비스 프로세스:
Browser evidence|브라우저 증거
Evidence|증거
No evidence available. Artifacts appear after verified transfer; an interrupted run may have partial evidence.|증거가 없습니다. 검증된 전송 후 아티팩트가 표시됩니다. 중단된 실행에는 일부 증거만 있을 수 있습니다.
Select an artifact to preview or export. Files are loaded on demand.|아티팩트를 선택하여 미리 보거나 내보내세요. 필요할 때 파일을 불러옵니다.
Export|내보내기
Captured|수집 시각
Size|크기
Loading verified artifact…|검증된 아티팩트를 불러오는 중…
Artifact unavailable.|아티팩트를 사용할 수 없습니다.
Open full screenshot|전체 스크린샷 열기
Evidence content|증거 내용
Evidence warning:|증거 경고:
No network failures recorded.|네트워크 실패 기록이 없습니다.
Method|메서드
Level|수준
Analyze Failure|실패 분석
Analyze Retest Failure|재테스트 실패 분석
Analyze|분석
Analyze evidence and suggest a fix|증거를 분석하고 수정안 제안
Project assistant|프로젝트 도우미
Read source, explain code and investigate failed tests.|소스를 읽고 코드를 설명하며 실패한 테스트를 분석합니다.
Open AI assistant|AI 도우미 열기
Read + analyze + propose. Source changes require explicit proposal approval.|읽기 · 분석 · 제안. 소스 변경에는 제안별 명시적 승인이 필요합니다.
Analysis history|분석 이력
Failure analysis|실패 분석
Development|개발
No analysis in this project.|이 프로젝트에 분석 기록이 없습니다.
Summary|요약
Observed failure|관찰된 실패
Root cause candidates|원인 후보
Related source|관련 소스
Fix proposal|수정 제안
Expected impact:|예상 영향:
Suggested tests:|권장 테스트:
Compare proposal|제안 비교
Uncertainty:|불확실성:
No additional uncertainty reported; verify all suggestions before use.|추가 불확실성은 보고되지 않았습니다. 모든 제안을 사용 전에 검증하세요.
New conversation|새 대화
Ask about the connected project or inspect a failed Run. Only selected context and requested read-only tool results are sent to the provider.|연결된 프로젝트에 질문하거나 실패한 실행을 확인하세요. 선택한 문맥과 요청된 읽기 전용 도구 결과만 AI 공급자에 전송합니다.
Connect to Core in Agents. AI credentials and model are configured on Core; existing IDE features remain available.|에이전트 화면에서 Core에 연결하세요. AI 인증 정보와 모델은 Core에서 설정합니다. 기존 IDE 기능은 사용할 수 있습니다.
Context|문맥
Current file|현재 파일
Selected code|선택 코드
Ask about this project|프로젝트에 질문
Explain a function or find related code|함수를 설명하거나 관련 코드를 찾아주세요
Send|보내기
AI conversation|AI 대화
Analysis request|분석 요청
Inspecting project context…|프로젝트 문맥을 확인하는 중…
No context sent yet.|아직 전송한 문맥이 없습니다.
Close proposal|제안 닫기
Proposed diff|제안된 차이
Proposed change|제안된 변경
Saved source read from disk.|디스크에서 저장된 소스를 읽었습니다.
Saved source unavailable. Reconnect the matching folder.|저장된 소스를 사용할 수 없습니다. 해당 폴더를 다시 연결하세요.
Review this proposal. Applying requires explicit approval.|제안을 검토하세요. 적용에는 명시적 승인이 필요합니다.
Approve source changes|소스 변경 승인
Approve and Apply|승인 후 적용
Reject|거부
Actual Git Diff|실제 Git 차이
Actual Git Diff unavailable.|실제 Git 차이를 사용할 수 없습니다.
Saved Disk Diff|저장된 디스크 차이
Refresh Disk Diff|디스크 차이 새로고침
Validation|검증
Validate Locally|로컬 검증
Validate and Remote Retest|검증 후 원격 재테스트
Revert AI Changes|AI 변경사항 되돌리기
Test Result|테스트 결과
Attempt History · maximum|시도 이력 · 최대
Fix attempts · maximum|수정 시도 · 최대
Proposal / Diff / Revert|제안 / 차이 / 되돌리기
Approve local validation|로컬 검증 승인
Approve Validation|검증 승인
Approve validation and remote retest|검증 및 원격 재테스트 승인
Approve Retest|재테스트 승인
Cancel Retest|재테스트 취소
Changed files:|변경 파일:
None applied|적용된 변경 없음
Not run|실행하지 않음
Fix operation failed|수정 작업 실패
AI changes reverted; earlier user baseline restored.|AI 변경사항을 되돌리고 사용자 기준 상태를 복원했습니다.
Approved patch applied. Review actual disk diff before validation.|승인한 패치를 적용했습니다. 검증 전에 실제 디스크 차이를 확인하세요.
Proposal rejected. No source changed.|제안을 거부했습니다. 소스는 변경되지 않았습니다.
Save current edits before taking a snapshot.|스냅샷을 만들기 전에 편집 내용을 저장하세요.
Save current edits before validation.|검증 전에 편집 내용을 저장하세요.
Local validation requires the desktop runtime. Use an approved remote Protocol Test instead.|로컬 검증에는 데스크톱 런타임이 필요합니다. 승인한 원격 프로토콜 테스트를 사용하세요.
A local process is already active. Stop it first.|로컬 프로세스가 실행 중입니다. 먼저 중지하세요.
Snapshot queued for existing Core pipeline; inspect Run progress.|스냅샷을 기존 Core 파이프라인 대기열에 등록했습니다. 실행 진행 상황을 확인하세요.
No eligible Agent. Retest remains queued; inspect Queue or cancel it.|적합한 에이전트가 없습니다. 재테스트는 대기열에 유지됩니다. 대기열을 확인하거나 취소하세요.
Retest cancellation requested.|재테스트 취소를 요청했습니다.
Project issues|프로젝트 이슈
GitHub repository not configured|GitHub 저장소 미설정
Drafts stay in TASTEDEV. GitHub creation requires review and explicit approval.|초안은 TASTEDEV에 유지됩니다. GitHub 생성에는 검토와 명시적 승인이 필요합니다.
Connect to Core in Agents. IDE, AI and tests remain available without GitHub.|에이전트 화면에서 Core에 연결하세요. GitHub 연결 없이도 IDE, AI와 테스트 기능을 사용할 수 있습니다.
Source Run / Test|기준 실행 / 테스트
Select a completed Run|완료된 실행 선택
Create Candidate|후보 만들기
Create Issue Candidate|이슈 후보 만들기
Issue Candidate|이슈 후보
Issue Candidates|이슈 후보
Linked Issues|연결된 이슈
No candidates. Select a failed Run to prepare a draft.|후보가 없습니다. 실패한 실행을 선택하여 초안을 만드세요.
No linked external issues.|연결된 외부 이슈가 없습니다.
Select an Issue Candidate or Linked Issue. Failure never creates a GitHub issue automatically.|이슈 후보나 연결된 이슈를 선택하세요. 실패만으로 GitHub 이슈를 자동 생성하지 않습니다.
No artifact metadata for this Run. Logs are included when available.|이 실행의 아티팩트 정보가 없습니다. 사용 가능한 로그는 포함됩니다.
No related source analysis supplied.|관련 소스 분석이 제공되지 않았습니다.
Title|제목
Body / Review|본문 / 검토
Labels (existing GitHub labels, optional)|레이블 (기존 GitHub 레이블, 선택)
Save Review|검토 내용 저장
Search Duplicates|중복 검색
Review and Create GitHub Issue|검토 후 GitHub 이슈 생성
Dismiss Candidate|후보 제외
Reconcile Uncertain Create|생성 결과 확인
Possible duplicates|중복 후보
These are suggestions. Choose an existing Issue or explicitly approve a new Issue.|검색 결과는 제안입니다. 기존 이슈를 선택하거나 새 이슈 생성을 명시적으로 승인하세요.
No duplicate candidates returned.|중복 후보가 없습니다.
Search before creating.|생성 전에 검색하세요.
Approve GitHub Issue Create|GitHub 이슈 생성 승인
Approve Create|생성 승인
Issue operation failed. Reconnect and inspect state.|이슈 작업에 실패했습니다. 다시 연결하여 상태를 확인하세요.
Connect to Core to load issue candidates.|Core에 연결하여 이슈 후보를 불러오세요.
Continuous testing|지속 테스트
Schedules run in Core. AI analysis is off; patches and GitHub writes still need approval.|스케줄은 Core에서 실행합니다. 자동 AI 분석은 꺼져 있으며 패치와 GitHub 쓰기는 승인이 필요합니다.
Sync saved Protocol|저장된 프로토콜 동기화
New Schedule|새 스케줄
Connect to Core in Agents. Local IDE features remain available.|에이전트 화면에서 Core에 연결하세요. 로컬 IDE 기능은 사용할 수 있습니다.
Schedules|스케줄
No schedules. Sync a saved Protocol to choose a Test.|스케줄이 없습니다. 저장된 프로토콜을 동기화하여 테스트를 선택하세요.
Missed executions are skipped. An overlapping Project/Test is skipped, including queued tests. Minimum interval:60s.|놓친 실행은 건너뜁니다. 대기 중인 테스트를 포함하여 같은 프로젝트/테스트가 겹치면 건너뜁니다. 최소 간격은 60초입니다.
Select a Schedule or create one after syncing the project's saved Protocol.|스케줄을 선택하거나 프로젝트의 저장된 프로토콜을 동기화한 후 새로 만드세요.
Runtime policy|런타임 정책
Closing Studio leaves schedules running while Core is alive. Core restart restores definitions and requires Protocol sync before execution. History is kept for the current Core session. Git, dependency and OS event adapters are foundation only.|Studio를 닫아도 Core가 실행 중이면 스케줄이 유지됩니다. Core 재시작 후에는 정의를 복원하고 실행 전에 프로토콜을 동기화해야 합니다. 이력은 현재 Core 세션에 유지됩니다. Git·의존성·OS 이벤트는 확장 기반만 제공합니다.
Schedule settings|스케줄 설정
Trigger type|트리거 종류
Manual|수동
Cron (5 fields)|Cron (5개 필드)
Interval|반복 간격
One-time (ISO timestamp)|일회성 (ISO 시각)
Cron expression|Cron 표현식
Interval seconds (minimum60)|반복 간격 (초, 최소 60)
Execution time (ISO with offset or Z)|실행 시각 (오프셋 또는 Z를 포함한 ISO)
Timezone|시간대
Enabled — allow automatic Protocol Test execution|활성화 — 프로토콜 테스트 자동 실행 허용
Save Schedule|스케줄 저장
Run Now|지금 실행
Disable Schedule|스케줄 비활성화
Enable Schedule|스케줄 활성화
Delete Disabled Schedule|비활성 스케줄 삭제
Last Trigger|마지막 트리거
Never|없음
Next Run|다음 실행
Manual, disabled or waiting for Protocol|수동, 비활성 또는 프로토콜 대기 중
Schedule History|스케줄 실행 이력
not assigned|배정되지 않음
not finished|완료되지 않음
Open Run|실행 열기
No trigger history yet.|아직 트리거 실행 이력이 없습니다.
Scheduler runtime:|스케줄러 런타임:
. Inspect Core storage/queue and reconnect.|. Core 저장소와 대기열을 확인하고 다시 연결하세요.
Scheduler unavailable. Connect to Core in Agents.|스케줄러를 사용할 수 없습니다. 에이전트 화면에서 Core에 연결하세요.
Scheduler operation failed.|스케줄러 작업에 실패했습니다.
Connect the project folder and save Protocol files before syncing.|동기화 전에 프로젝트 폴더를 연결하고 프로토콜 파일을 저장하세요.
Cannot read saved Protocol. Check folder access.|저장된 프로토콜을 읽지 못했습니다. 폴더 접근 권한을 확인하세요.
Connect the project folder first.|먼저 프로젝트 폴더를 연결하세요.
Connect to Core in Agents before queuing a Protocol task.|프로토콜 작업을 대기열에 등록하기 전에 Core에 연결하세요.
Connect to Core in Agents to queue a task.|Core에 연결하여 작업을 대기열에 등록하세요.
Protocol action failed. Reload and try again.|프로토콜 작업에 실패했습니다. 다시 불러온 후 시도하세요.
Protocol task queued. Review compatibility, then assign a compatible Agent.|프로토콜 작업을 대기열에 등록했습니다. 호환성을 확인한 뒤 에이전트를 배정하세요.
Save Protocol files and reconnect the project folder before queuing.|대기열에 등록하기 전에 프로토콜을 저장하고 프로젝트 폴더를 다시 연결하세요.
The workspace changed. Reload Protocol before queuing.|작업 공간이 변경되었습니다. 대기열에 등록하기 전에 프로토콜을 다시 불러오세요.
Save Protocol edits before queuing. The view reflects saved files.|등록 전에 프로토콜 편집 내용을 저장하세요. 화면은 저장된 파일을 기준으로 합니다.
Run action failed.|실행 작업에 실패했습니다.
Run configurations could not be loaded. Stored data is unchanged; check browser storage.|실행 설정을 불러오지 못했습니다. 저장된 정보는 유지됩니다. 브라우저 저장소를 확인하세요.
Run failed. Review the configuration.|실행에 실패했습니다. 설정을 확인하세요.
Select a run configuration first.|먼저 실행 설정을 선택하세요.
Unsaved files before Run|실행 전 미저장 파일
Choose whether this run should use your saved files or save all edits first. Unsaved edits will not be discarded.|저장된 파일로 실행할지 먼저 모든 편집 내용을 저장할지 선택하세요. 미저장 내용은 버리지 않습니다.
Save All and Run|모두 저장 후 실행
Run Without Saving|저장하지 않고 실행
Saving files before Run…|실행 전에 파일을 저장하는 중…
Files could not be saved. Run was cancelled; review the file error.|파일을 저장하지 못했습니다. 실행을 취소했습니다. 파일 오류를 확인하세요.
Unsupported|지원하지 않음
Warning|경고
Error|오류
Home|처음
Enter|입력
Latest result|최근 결과
Execution in progress.|실행 중입니다.
Invalid TestPlan.|유효하지 않은 테스트 계획입니다.
Invalid plan|유효하지 않은 계획
Browser folder · absolute path unavailable|브라우저 폴더 · 절대 경로 사용 불가
Source|소스
Failure|실패
Not reported|보고되지 않음
Not run|실행하지 않음
No|아니요
No output provider is connected. Task output will appear here.|출력 공급자가 연결되지 않았습니다. 작업 출력이 여기에 표시됩니다.
No test provider is connected. No tests have been run.|테스트 공급자가 연결되지 않았습니다. 아직 테스트를 실행하지 않았습니다.
Diagnostics are not connected. No analysis has been run.|진단이 연결되지 않았습니다. 아직 분석을 실행하지 않았습니다.
Agent integration is not connected. No agent sessions have started.|에이전트가 연결되지 않았습니다. 시작된 에이전트 세션이 없습니다.
Terminal sessions are not connected. Command execution arrives in STEP 4.|터미널 세션이 연결되지 않았습니다.
Workspace log collection is not connected.|작업 공간 로그 수집이 연결되지 않았습니다.
Empty workspace|빈 작업 공간
Select a project from the Project Manager.|프로젝트 관리자에서 프로젝트를 선택하세요.
Select the project folder on your computer to reconnect.|컴퓨터에서 프로젝트 폴더를 선택하여 다시 연결하세요.
Opening project…|프로젝트를 여는 중…
Opening Protocol…|프로토콜을 여는 중…
The related source file could not be opened. Connect the matching project folder.|관련 소스 파일을 열지 못했습니다. 해당 프로젝트 폴더를 연결하세요.
Export the trace, then open it locally with Playwright show-trace. Source files and response bodies are excluded; visual content may contain sensitive information.|추적 파일을 내보내고 로컬에서 Playwright show-trace로 여세요. 소스 파일과 응답 본문은 제외됩니다. 화면에는 민감한 정보가 포함될 수 있습니다.
Remote test uses Git revision|원격 테스트에 Git 리비전 사용
Remote test uses workspace snapshot|원격 테스트에 작업 공간 스냅샷 사용
Assign the queued job to a compatible Agent to execute it.|대기 중인 작업을 호환 에이전트에 배정하여 실행하세요.
 · truncated| · 일부 생략
· Read only|· 읽기 전용
· internal only|· 내부 전용
· stopped during cleanup or termination|· 정리 또는 종료 중 중지됨
· Agent:|· 에이전트:
· Duration:|· 소요 시간:
· Exit|· 종료
· Core runtime|· Core 런타임
· Console errors|· 콘솔 오류
· Page errors|· 페이지 오류
· Network failures|· 네트워크 실패
· Trace|· 추적
· task:|· 작업:
passed · Screenshot|통과 · 스크린샷
Browser test passed|브라우저 테스트 통과
input /|입력 /
output tokens|출력 토큰
steps ·|단계 ·
logs|로그
bytes|바이트
not reported|보고되지 않음
enabled|활성화
disabled|비활성화
awaiting-protocol|프로토콜 대기
invalid|유효하지 않음
queued|대기 중
assigned|배정됨
pending|대기 중
running|실행 중
passed|통과
failed|실패
cancelled|취소됨
timeout|시간 초과
skipped|건너뜀
error|오류
online|온라인
offline|오프라인
idle|대기
busy|사용 중
starting|시작 중
stopping|중지 중
stopped|중지됨
ready|준비됨
completed|완료됨
generating|생성 중
draft|초안
reviewing|검토 중
duplicate|중복 후보
approved|승인됨
creating|생성 중
linked|연결됨
dismissed|제외됨
proposed|제안됨
applied|적용됨
validating|검증 중
retesting|재테스트 중
reverted|되돌림
rejected|거부됨
recovery-required|복구 필요
granted|허용됨
denied|거부됨
prompt|권한 요청 필요
run-now|지금 실행
manual|수동
time|일회성
interval|반복 간격
event|이벤트
open|열림
closed|닫힘
overlap|겹친 실행
capacity|실행 한도
missed|놓친 실행`;
export const korean:Readonly<Record<string,string>>=Object.freeze(Object.fromEntries(entries.split('\n').map(line=>{const at=line.indexOf('|');return[line.slice(0,at),line.slice(at+1)]})));
const koreanExtra:Record<string,string>={
 'Create in {path}.':'{path}에 생성합니다.',
 'Delete “{name}” from disk? This cannot be undone in Studio. {open} open editor(s) will close; {dirty} unsaved document(s) will be discarded.':'“{name}”을 디스크에서 삭제할까요? Studio에서 되돌릴 수 없습니다. 편집기 {open}개를 닫고 저장하지 않은 문서 {dirty}개를 버립니다.',
 'Delete “{name}” and all its contents from disk? This cannot be undone in Studio. {open} open editor(s) will close; {dirty} unsaved document(s) will be discarded.':'“{name}”과 모든 내용을 디스크에서 삭제할까요? Studio에서 되돌릴 수 없습니다. 편집기 {open}개를 닫고 저장하지 않은 문서 {dirty}개를 버립니다.',
 'Folder received: {name}. Connecting workspace…':'폴더 선택 완료: {name}. 작업 공간 연결 중…','Opening {name}…':'{name} 여는 중…',
 '{name} added to Recent Projects. No folders or source files were created.':'{name}을 최근 프로젝트에 등록했습니다. 폴더나 소스 파일은 생성하지 않았습니다.',
 '“{name}” has unsaved changes.':'“{name}”에 저장하지 않은 변경이 있습니다.',
 'Discard unsaved changes in “{name}” and load its current disk content?':'“{name}”의 저장하지 않은 변경을 버리고 디스크 내용을 불러올까요?',
 'Proposal {proposal}\nFiles: {files}\nApply exactly the reviewed change? Test execution requires a separate action.':'제안 {proposal}\n파일: {files}\n검토한 변경을 적용할까요? 테스트 실행은 별도 승인이 필요합니다.',
 'Protocol Task {task}: {command}\nRun this saved Protocol task in the connected workspace?':'Protocol 작업 {task}: {command}\n저장된 작업을 연결된 작업 공간에서 실행할까요?',
 'Run Protocol Test {test} on an eligible Agent using a secret-filtered saved workspace snapshot?':'시크릿을 제외한 저장된 작업 공간 스냅샷으로 적합한 에이전트에서 Protocol 테스트 {test}를 실행할까요?',
 'Repository: {repository}\nTitle: {title}\n{count} possible duplicate(s). Create exactly this reviewed title/body/labels? This approval covers this candidate only. Internal evidence is not public.':'저장소: {repository}\n제목: {title}\n중복 후보 {count}건. 검토한 제목·본문·라벨로 생성할까요? 승인은 이 후보에만 적용됩니다. 내부 증거는 공개되지 않습니다.',
 'Toggle {label}':'{label} 전환','Hide {label}':'{label} 숨기기','Close {name}':'{name} 닫기','Opened {date}':'최근 열기: {date}',
 'AI Analysis':'AI 분석','Apply':'적용','Match':'매칭','Open':'열기','View':'보기','No result reported yet.':'아직 보고된 결과가 없습니다.',
 'Open TASTEDEV project definition':'TASTEDEV 프로젝트 정의 열기','Link Existing #':'기존 Issue 연결 #','% shared terms ·':'% 공통 용어 ·',
 ', attempt':', 시도',', proposal':', 제안','. Manifest checksum:':'. 매니페스트 체크섬:',
 '. Open Runs to inspect this record.':'. 실행 기록에서 이 항목을 확인하세요.',
 '. Saved workspace changes are included; unsaved editor changes are excluded.':'. 저장된 작업 공간 변경은 포함되며 저장하지 않은 편집 내용은 제외됩니다.',
 '. This creates a request; it does not execute a command.':'. 요청을 생성하며 명령을 실행하지 않습니다.',
 '. Unsaved or uncommitted local changes are not included.':'. 저장 또는 커밋하지 않은 로컬 변경은 포함되지 않습니다.',
 'Execution records for':'실행 기록:', 'HEAD → Index':'HEAD → 인덱스','Index → Working tree':'인덱스 → 작업 트리',
 'Project job request ·':'프로젝트 작업 요청 ·','Queue a structured task for':'구조화된 작업 요청:',
 'Remove “':'“','” from this project? Files and processes are not changed.':'” 항목을 이 프로젝트에서 제거할까요? 파일과 프로세스는 변경하지 않습니다.',
 'Run Test:':'테스트 실행:','declared. Edit':'정의됨. 편집:','in Explorer.':'탐색기에서.', 'run':'실행',
 'stdout / stderr · latest 128 KiB retained · separate from Local Terminal':'stdout / stderr · 최근 128 KiB 보관 · 로컬 터미널과 별개',
};
export const catalogs:Partial<Record<Language,Readonly<Record<string,string>>>>={ko:{...korean,...koreanExtra,...reliabilityMessages.ko,...onboardingMessages.ko,...teamMessages.ko,...updateMessages.ko},...Object.fromEntries(Object.keys(international).map(language=>[language,{...international[language as Language],...development[language],...guidance[language],...analysisGuidance[language],...fragments[language],...interaction[language],...approval[language],...stateMessages[language],...reliabilityMessages[language],...onboardingMessages[language],...teamMessages[language as Language],...updateMessages[language as Language]}]))};
export function translate(language:Language,key:string,values?:Record<string,string|number>){const catalog=catalogs[language];return interpolate(catalog&&Object.hasOwn(catalog,key)?catalog[key]:key,values);}
export function translateFeedback(language:Language,message:string){const match=matchFeedback(message);return match?translate(language,match.key,match.values):translate(language,message);}
