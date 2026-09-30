# Git Runtime Architecture — STEP 5

## Boundary

Source Control UI → GitService → GitHost → Runtime. The production provider composes WebUnavailableGitHost. FakeGitHost lives only under tests/helpers; it performs no OS, filesystem or network operations. STEP6 will provide TauriGitHost. No server Git API, shell fallback, remote operation or credential store is present.

GitScope carries projectId, authorized workspaceId and optional native workspacePath. Repository id/root are returned by the host, not inferred from Project defaultBranch or a visible .git folder. Root/id can represent nested repositories and worktrees. Native authorization and root resolution remain host responsibilities.

## Domain and state

GitRepository includes root/currentBranch/detached/hasRemote; GitBranch includes name/current/remote. GitFileStatus has independent index and workingTree kinds, so partially staged files appear in both lists. Kinds include untracked/added/modified/deleted/renamed/conflicted, with rename originalPath. GitDiff identifies path and staged/working side with original/modified/binary. GitCommit carries hash/shortHash/message/author/date.

Feature-local GitService observable state is separate from Workspace reducer and Editor documents. Each project/connected folder receives a fresh service; disposal suppresses late responses. A single operation lock prevents refresh, index mutation, commit and diff races. Refresh reads detection, status, branches and a maximum 50 commits. Diff is fetched only on selection, with a combined two-million-character limit; binary payload is discarded before Monaco.

Refresh failure keeps any previous snapshot visibly stale and disables mutations until refresh succeeds. Mutation failure also invalidates freshness because the host outcome might be uncertain. A commit acknowledged by the host remains successful if the following refresh fails: the message clears, the UI reports the saved commit and requires refresh before another submission. This avoids retrying an already-created commit. No automatic retries occur.

## Source Control and editor

Repository/Branch, Conflicts, Changes, Staged Changes, Commit and History use typed domain data. Status letters and accessible names supplement color. Stage/Unstage individual/all actions go through the service; conflicts block all-file staging and commit. Empty messages, messages over 4096 characters, null characters and empty index are rejected. History is bounded to 50 entries.

GitEditorArea preserves the normal file editor mounted while a distinct read-only DiffView is visible. The existing Monaco 0.57.0 loader/workers are shared; diff models and observers are disposed on close/change. Themes follow the existing root attribute. Original/Modified headers identify HEAD→Index or Index→Working tree. Binary files show an explicit unsupported message. Diff never uses or changes dirty buffers; the UI explains that Git compares saved disk content. Git refresh/stage/commit never calls Editor Save.

Explorer accepts a small optional decoration function. Workspace supplies Git domain decorations only for fresh, available status. Explorer has no GitHost dependency. Status Bar and Run capability both use the composed Git host; no invented main branch or clean repository is displayed on Web.

## Security and native handoff

Path validation requires normalized repository-relative paths and rejects absolute/traversal/null/control inputs. Rename operations include source and target as distinct literal paths. Commit messages are data, never concatenated into shell commands. No credentials, raw CLI output or exception detail are stored or logged by Git UI/state; errors use stable codes and actionable messages.

Native STEP6 must reauthorize every workspace/repository, use executable plus args with shell disabled, literal pathspec semantics and option separators, bound output, handle encoding/binary/deleted/untracked files, verify index/conflicts immediately before mutation, and define cancellation/uncertain commit outcomes. Service validation alone does not establish OS containment or prevent external Git races. Branch and remote names remain display data; branch switching, fetch/pull/push and authentication are intentionally absent.

## Verification boundaries

90 automated tests pass: 61 retained + 29 Git domain/service/FakeHost cases. Successful fake commit and index transitions are automated evidence, not native Git execution. Production browser verifies WebUnavailable Source Control, Refresh, capability, dirty preservation, actual disk save, normal Monaco/Explorer/Run/Terminal, project navigation and three desktop resolutions.

Development-only /verification/git renders static component snapshots for real Monaco text/binary diff, status labels, conflicts and history. It instantiates no GitHost and creates no repository or commit. It returns HTTP404 in production. A development HMR-only Monaco disposed-context error was recorded; after full reload, binary/text/close/reopen cycles reported no new errors. Production console evidence is recorded separately.

Evidence: TASTEDEV/resources/verification/dev-01/tasks/tastedev-studio/step-5-20260929. STEP6 has not started. No CI/deployment/QA-01/cross-platform certification or commit/push was performed.
