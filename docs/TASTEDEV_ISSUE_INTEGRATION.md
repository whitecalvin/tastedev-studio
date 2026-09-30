# TASTEDEV Issue Integration

Status: STEP14 PASS — STEP15 NOT_STARTED.

## Issue Domain and Candidate

Run/Test → buildCandidate → IssueService → review/search/approval → IssueProvider → GitHub. Domain types have no GitHub SDK dependency. Internal candidate status (draft/reviewing/duplicate/approved/creating/linked/failed/dismissed) is separate from external open/closed state. Core derives Run, Job/Test, failed Step, revision, logs and Artifact metadata from the project-scoped repository. Optional existing AI Analysis and FixAttempt add grounded summary, related file ranges, attempt/proposal/retest IDs and validation results; their source buffers/patch bodies are not sent. Missing data is omitted. A passed FixAttempt may be recorded without closing GitHub automatically.

Candidates are bounded to200 per Core session. Local edits increment version and invalidate approval and duplicate-search results. Dismiss performs no external write. The repository is normalized from Project.repositoryUrl; GitHub HTTPS/git@ URLs and owner/repository are supported. Non-GitHub projects retain local drafts but cannot create GitHub Issues. Credential-bearing URLs, unknown hosts and path escapes are rejected. The gateway rechecks the currently registered Project repository before external actions.

## Provider and Authentication

IssueProvider exposes identify/search/get/create/reconcile with normalized ExternalIssue, independent of SDK types. GitHubIssueProvider runs gh api using shell:false, managed keyring auth, JSON stdin, bounded output and15s timeout. It never reads the raw managed token. Optional TASTEDEV_GITHUB_TOKEN is Core-only and uses api.github.com HTTPS with redirect rejection; use minimum Issues permissions when supplying a new token. No NEXT_PUBLIC token or browser credential persistence is introduced. Core endpoint bearer authentication, allowed origins, project registration, body limit100KB and four concurrent requests apply. GitHub errors normalize authentication, permission, repository/404, rate limit, validation, timeout and uncertain creation without exposing raw credentials/errors.

## Duplicate Search

After identify, search uses at most four unique keyword groups from title, test, error/summary and related component. Each GitHub query requests up to20 results; deduplicated candidates get shared-word similarity and human-review reasons. Search is cached5s for an unchanged candidate version. Results are suggestions, not automatic duplicate decisions. Link Existing fetches and validates the selected searched Issue and performs no POST. User may explicitly approve a new Issue despite suggestions.

## Approval and Idempotency

Review/edit → Save → Search → Review and Create → Approve Create → create. Cancel sends no create. Approval binds project, repository, candidate ID/version, exact title/body/labels hash and timestamp. Modified candidates require fresh search and approval. Creation locks the candidate across asynchronous operations and rechecks the approved hash plus final masking. Repeated linked creation returns the same Issue; concurrent create is blocked. A stable HTML comment tastedev-issue:candidateId is added to the approved content as the request identity.

POST timeout/unknown outcome becomes create-uncertain, blocks retry and offers Reconcile Uncertain Create. Reconciliation uses the newest100 Issues and requires exactly one matching marker. It never blindly repeats POST. This is session-level idempotency, not crash/restart durable storage. The actual verification harness additionally saved pending request metadata before its one approved POST so interruption could resume with read-only reconciliation.

## Evidence and Security

Before candidate formation and again after edits/final approval, common API keys/Authorization/password/token/credential patterns and known Core secret values are masked. GitHub token patterns are covered. Windows/UNC/local absolute Unix paths are omitted; related project-relative source ranges remain. Labels whose masking would alter their value are rejected. Dummy credentials qualify masking; actual secrets are not verification fixtures. Evidence is tastedev:artifact/id and tastedev:run/id with an explicit internal/nonpublic note. Local artifact locations, screenshot bytes, project sources and account credentials are not uploaded as Issue attachments. Unknown secrets/custom patterns outside configured values remain a review responsibility.

Returned links must be exact HTTPS github.com/repository/issues/number URLs, without credentials/query/fragment. Text is rendered as plain React text/inputs/textarea, so HTML/script strings do not execute. Models receive no GitHub create/comment/close tool. User-approved application actions control writes. No automatic Issue close, comment, PR, commit or push.

## GUI and Existing Issue Link

Issues activity provides completed Run selection, Candidate and Linked lists, summary, Run/Test/revision, Evidence, optional AI/FixAttempt, editable title/body/labels, duplicates and safe external link. Review/Create uses existing confirmation UI. Link Existing does not require a new external write. Dismiss locks creation. Core unavailable or repository absent gives a visible unavailable state while other IDE services remain independent. Fix status may be shown from live AI attempt history; Issue status is still the recorded external state, not automatically refreshed/closed.

## Verification and Known Limitations

Issue automated33 tests plus prior329 tests =362 PASS. Provider error/masking/scope/idempotency/concurrency/uncertain-reconciliation and authenticated HTTP integration are automated. Production GUI uses test-only FakeIssueProvider and distinguishes itself from actual GitHub E2E. Actual GitHub #1 creation/readback/search/link verifies the real default provider and existing managed account. No raw token was read. Detailed gates and actual evidence are in the STEP14 RESULT/index.

No durable Issue history or distributed idempotency; newest100 reconciliation window; keyword-only similarity; optional existing labels only (actual label assignment not tested); no comments/close or attachment publication; no GitHub Enterprise adapter; no native installed GUI/Unix rerun. An operator running remote Core must configure authentication on that host. These are nonblocking v1 limits. STEP15 Scheduler/Continuous Testing is not started.
