# TASTEDEV Protocol v1

## STEP11 acceptance — 2026-09-30

STEP 11 PASS — STEP 12 착수 가능. Node264 distinct + Runner2; Rust Debug18/Release18; actual Chromium/Agent Browser6 groups, legacy Agent11 and Pipeline14 distinct groups; artifact integrity/sanitization and production GUI PASS. Final Web build OHcgxvcH8WgtoEaRSzBQv; Agent/Web/Desktop no-bundle builds PASS. UI reviewer resolved its one spacing finding and returned ship. Exact scope, gate reuse and limitations: workspace resources/verification/dev-01/tasks/tastedev-studio/step-11-20260930/RESULT.md. STEP12 NOT_STARTED.

## STEP11 current implementation — 2026-09-30

Browser/e2e TestPlan steps now execute official Playwright Test on the separate Rust Agent. Real Chromium capability probing, isolated contexts, failure screenshots/traces, Console/Page Error/Network/Test Report evidence, bounded authenticated binary transfer, LocalArtifactStore, SHA-256 verification and Studio Evidence Viewer are implemented. [Browser Evidence](TASTEDEV_BROWSER_EVIDENCE.md) is the current contract. The STEP11 task evidence under resources/verification/dev-01/tasks/tastedev-studio/step-11-20260930 determines final acceptance. Core history remains memory-only; binary artifacts persist separately. STEP12 NOT_STARTED. Earlier STEP11-unimplemented statements below are historical.

## STEP10 acceptance — 2026-09-30

STEP 10 PASS — STEP 11 착수 가능. Node253 distinct, Agent Debug17/Release17, real pipeline14 groups and legacy Agent11 groups PASS. Final production GUI4 groups PASS (errors0); Agent/Web/Desktop no-bundle builds PASS. Final evidence: resources/verification/dev-01/tasks/tastedev-studio/step-10-20260930/RESULT.md in the workspace. STEP11 NOT_STARTED. Native GUI/installed QA were not rerun.

## STEP 10 current implementation — 2026-09-30

STEP10 adds TestDefinition → separate TestPlan → existing Job/Queue/Matcher/Run/RunStep → same-Agent sequential execution. Optional Git source, install/build/start/HTTP health/test/cleanup, primary failure and dependent skip, cleanup after failure/cancel/timeout, per-step logs, source SHA and Studio Tests/Run detail are implemented. [Test Orchestration](TASTEDEV_TEST_ORCHESTRATION.md) is the current contract.

The STEP10 task directory under resources/verification/dev-01/tasks/tastedev-studio/step-10-20260930 records exact final acceptance and evidence. STEP11 is NOT_STARTED. Core remains server-memory only. Git uses credential-free HTTPS/git URLs and a detached checkout of an explicitly fetched revision; local dirty/uncommitted files are not transferred. Health v1 is bounded loopback HTTP. Browser engine/evidence upload, AI and Scheduler are excluded.

Tests now use TestPlan: test timeout is the overall main-pipeline budget (default600s), task timeouts still bound individual steps, and cleanup has its own bounded allowance. Optional Test environment/profile overrides reuse STEP9 resolution; resolved per-step constraints are intersected for one Agent. Legacy single-command Tasks retain their existing behavior.

The historical sections below describe earlier STEP8/9 contracts and do not override STEP10 multi-step execution, source provisioning or current Tests UI. Earlier NOT_STARTED/source-copy-absent/single-command-only statements are retained as history.

## Historical baseline

STEP9 defines portable project declarations and converts an explicitly selected task/test into the existing Core Job. Project declares WHAT, Core selects WHO/WHEN, and the independent Rust Agent executes HOW/WHERE. Agent has no project-name branches. STEP10 orchestration is not implemented.

## Files and domain

    .tastedev/
      project.yml          required entry point
      environments.yml     optional named environment profiles
      tasks.yml            optional named commands
      tests.yml            optional references to tasks

Without .tastedev or project.yml the state is Not Configured, even if auxiliary files exist. The loader checks the parent directory first so a host that throws on a missing nested parent cannot misclassify an unconfigured project as Invalid. Missing optional files mean empty definitions. An empty auxiliary document or {} also means no definitions; a non-mapping value is invalid. Version must be the YAML number 1. Explicit null is not a general clearing syntax in YAML.

Sources: src/features/protocol/domain.ts defines TasteDevProjectDefinition, RequirementDefinition, EnvironmentDefinition, TaskDefinition, TestDefinition and ProtocolState. loader.ts reads through the existing FileSystemHost; parser.ts produces validated domain values; resolver.ts returns the existing CreateJob shape. Raw YAML is not passed into Core.

Status is Not Configured, Valid or Invalid. Folder access and loading are separate UI conditions. Validation returns the first issue with file, field/path and message. YAML syntax issues include line/column where available; raw source and environment values are not echoed in error text.

## Schema

Unknown and reserved fields, duplicate YAML keys and unsupported versions are rejected.

| File | Root and fields |
| --- | --- |
| project.yml | Mapping: required version: 1 and project: {name, type}; optional requirements and environment. Both project name/type are nonempty strings; type is descriptive metadata, not an execution adapter selector. |
| environments.yml | Profile name → mapping of environment variable names to string values. |
| tasks.yml | Task name → required command; optional args, cwd, environment, env, timeout, requirements. |
| tests.yml | Test name → required task reference and type; optional requirements, timeout. |

Definition names start with an ASCII letter, use letters/digits/underscore/hyphen and are at most64 characters. Each auxiliary file permits at most100 definitions. Project name is at most120 characters and type at most64. Nonempty bounded names reject control characters.

Task defaults are args: [], cwd: ".", env: {}, timeout: 60 and requirements: {}. environment selects one profile; env contains task-level variable overrides. A nonexistent profile is invalid. Test type is unit, integration, api, browser or e2e; its task must exist. Type is metadata only and starts no specialized test engine.

Timeout is an integer **1–3600 seconds**. A test timeout replaces its task timeout; otherwise the task value/default applies. Resolution multiplies seconds by1000 for Core timeoutMs.

## Requirements and merge rules

The same requirement schema is accepted on Project, Task and Test:

| YAML field | Accepted values and mapping |
| --- | --- |
| os | windows, linux or macos → Core platform |
| architecture | x86_64 or arm64 |
| runtimes | node/java/python/rust/git → quoted numeric minimum such as ">=24", ">=24.1" or ">=24.1.2" |
| tools.git | true → Git runtime ">=0"; false → clear inherited Git requirement |
| tools.docker | true → required; false → clear inherited Docker requirement |
| browsers | Exactly one chromium/firefox/webkit boolean entry when this field is present; true requires that browser, false clears the inherited browser requirement |
| gpu.required | true → required; false → optional |

Runtime components contain1–4 digits; ranges, caret/tilde constraints and prerelease syntax are unsupported. Declaring tools.git and runtimes.git in the same layer is invalid. CPU/memory/PTY are not YAML v1 fields even though the existing Core domain has such capability fields.

Effective requirements are Project → Task → Test, with the later explicit value winning. Omitted fields inherit. Runtime maps merge by runtime key rather than replacing the whole map; an empty runtimes map does not clear inherited keys. The browser constraint is a single scalar in Core, not a set: a later browser declaration replaces or clears it.

False Git/Docker/browser flags normalize to internal null removal markers; merge removes the corresponding inherited constraint before Core validation. These internal nulls are **not** permission to write raw null in YAML. gpu.required: false weakens required to optional. Explicit later values can weaken a base constraint; merge is an override, not an intersection or strongest-minimum calculation.

Example: Project node ">=24" and Git required + Task node ">=22" and tools.git: false yields node ">=22" with no Git constraint. Project linux + Task windows yields windows. Core's existing Matcher reports incompatible OS/runtime/browser/tool/GPU reasons; Protocol adds no separate matching engine.

## Environment resolution

Effective environment is project.yml environment → selected environments.yml profile → task env. Later string values replace earlier values for the same key; unrelated keys survive. Tests inherit their referenced task's environment and cannot add profile/env fields in v1.

Every layer and the merged environment allow at most32 variables. Names match an ASCII letter/underscore followed by letters/digits/underscore, up to64 characters. Values must be strings, at most4096 characters, without NUL; quote numeric/boolean-looking values. Empty string is allowed. There is no null deletion, variable expansion, interpolation or Secret Manager.

Do not treat Protocol as a secret store. UI shows requirements and execution metadata, not all environment values. Agent still starts children with its bounded inherited environment plus explicit task values; its authentication token is not automatically inherited.

## Commands, paths and YAML limits

command is a portable executable name (up to240 characters), starting with an ASCII alphanumeric/underscore and followed by alphanumerics/underscore/dot/plus/hyphen. Paths, spaces, shell expressions and .cmd/.bat names are rejected. Arguments remain a separate array: at most100 strings, each at most1024 characters and without control characters. No shell expression is assembled automatically.

On Windows, use a real PATH-resolvable executable such as bare node for the example below. Package-manager shim names may resolve to batch files and are not automatically wrapped in a shell. Selecting a shell executable explicitly remains executable code and does not create an OS sandbox.

cwd defaults to "." and otherwise must be a normalized forward-slash relative path. Absolute paths, traversal, backslashes, percent escapes and Windows reserved path segments are rejected. It is a logical project-relative declaration; current Agent resolution applies it inside a fresh per-Run directory. **The Agent does not copy project source, check out a revision or install dependencies.** A source-dependent build task needs future workspace provisioning; naming apps/web does not transfer that folder from Studio.

The existing Agent symlink/junction checks and process-tree lifecycle remain in force. Fresh cwd is not OS isolation; commands execute with the Agent account's permissions.

js-yaml4.3.2 was already in the dependency graph and is now a direct dependency; no second YAML parser was introduced. Parsing uses CORE_SCHEMA, a64KiB UTF-8 limit per file, maximum depth16, no merge-key expansion, rejected anchors/aliases and warnings treated as invalid. Unknown tags and duplicate keys fail. Existing filesystem text/encoding limits still apply before parsing. No YAML object constructors or automatic execution are enabled.

## Studio workflow

1. Open/connect the project folder. Protocol detection reads saved files automatically; no task is executed.
2. Use Run or Tests and the status-bar Protocol action. A project without the entry file remains a normal editable IDE project.
3. Initialize TASTEDEV creates only .tastedev/project.yml with version1, name my-project and type generic. It creates no executable task, never overwrites an existing entry, and checks the expected empty file before writing.
4. Create optional files in Explorer and edit them in ordinary Monaco tabs. Saved Protocol content changes trigger revalidation. Reload also rereads files manually; external filesystem changes have no independent watcher.
5. Unsaved open Protocol edits block Queue. Connect to Core in Agents, then select Queue task or Queue test. The action performs a fresh disk load/validation immediately before conversion and guards workspace changes during the load.
6. The existing Queue displays the resulting Job and Matcher reasons. Assign explicitly to execute on a compatible Agent. Open Runs for stdout/stderr and terminal result.

Open Project != Execute Project. Loading, parsing and resolving are pure with respect to job submission. Explicit queueing creates one Job; explicit assignment initiates execution. Invalid Protocol cannot create a Job. A requirement mismatch keeps the Job queued instead of forcing execution.

## Task → Job mapping

| Protocol value | Existing Core value |
| --- | --- |
| Current Studio Project | projectId supplied to CoreService.createJob |
| Selected name/kind | Job name "task: NAME" or "test: NAME" |
| Referenced task name | payload.task and one step name |
| Effective requirements | Existing JobRequirement validated by Core |
| command / args / cwd / resolved environment | step.executable / args / cwd / env |
| Test timeout or Task timeout | step.timeoutMs |

There is no Protocol-specific queue, Run or Agent implementation. A test resolves its referenced task with Test requirement/timeout overrides and becomes the same single-command payload. Project declaration name does not replace the existing Studio Project identity.

## Portable safe example

Create these files using Explorer/Monaco. The task only writes text and exits0; its command is PATH-resolvable node, including on Windows. Files are declarations and do not run when saved.

.tastedev/project.yml:

    version: 1
    project:
      name: protocol-example
      type: node
    requirements:
      runtimes:
        node: ">=24"
    environment:
      APP_MODE: base

.tastedev/environments.yml:

    development:
      APP_MODE: development

.tastedev/tasks.yml:

    hello:
      command: node
      args:
        - "-e"
        - 'console.log("protocol stdout"); console.error("protocol stderr");'
      cwd: "."
      environment: development
      env:
        APP_MODE: task
      timeout: 10

.tastedev/tests.yml:

    smoke:
      task: hello
      type: unit
      timeout: 5

hello resolves APP_MODE to task and timeout to10 seconds. smoke resolves the same command/environment with5 seconds. Both require Node24 or later and need the configured Core/Agent connection plus explicit Queue and Assign actions.

## Evidence and known limits

[STEP9 evidence](../../../../resources/design/tastedev-studio-step9/EVIDENCE.md) distinguishes parser/resolver tests, production build, actual independent Rust Agent execution, visual review and native/package evidence. Final Node219 (Protocol80 plus unchanged139), lint/typecheck, Web production and Desktop no-bundle builds passed. Actual production build 8Yo38H_FqufQ5R_W3tzcN exercised independent Windows Agent execution with live stdout/stderr and passed result, mismatch remaining queued, dirty/invalid queue blocking, Monaco repair and project isolation. Rust Agent gates were reused after verifying42 unchanged Agent/Native inputs, toolchain, the release binary and five prior evidence hashes. Independent UI review returned ship for eight production captures. STEP9 PASS — STEP10 ready but NOT_STARTED.

No revision checkout/source copy, durable Core DB/Redis, multi-step pipeline/DAG, browser engine, Playwright orchestration, artifact upload/storage, Secret Manager, AI, Issue automation or Scheduler is added. Existing Core server-memory lifetime and bounded logs are unchanged. STEP10 is NOT_STARTED.


## Execution profiles (sixth advancement)

project.yml may declare named executionProfiles with requirements and optional installTask referencing an existing tasks.yml task. tests.yml may select executionProfile by name. Resolver intersects profile requirements with effective pipeline requirements; an override cannot weaken required runtime/tool/platform constraints. Contradictory platform constraints are rejected. An explicit pipeline install overrides the profile installation task; no system package installer is introduced. TestPlan retains selected profile identity, requirements and default install task; Run shows requested versus Agent-observed environment.
