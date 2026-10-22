# Stage 6 — CI configuration and delivery state

2026-10-23, Asia/Shanghai.

The validation workflow runs on pushes to main/codex branches, pull requests and manual dispatch. Its Windows/Linux matrix uses Node 24 and read-only repository permissions. It installs the lockfile, runs tests and score gates, regenerates the library and rejects generated differences, then builds the application. Official checkout/setup-node v7.0.0 tags were resolved with `git ls-remote` and pinned to full commits; credentials are not persisted.

Local Windows validation: Node 26.10.0 passes all 112 tests, 44 score checks and production build. A separate Node 24.22.1 executable also passes all 112 tests, TypeScript compilation and Vite production build. The initial `npx --package=node@24` attempt still selected Node 26 and is not counted as Node 24 evidence. A subsequent explicit executable invocation confirms the correct version.

Remote delivery: [draft PR #1](https://github.com/ax2/harpscore/pull/1), branch `codex/stage-4-score-correctness`. No merge or release. GitHub confirms the workflow file exists on the branch, repository Actions is enabled, and the PR is mergeable. However, the Actions runs/workflows APIs returned empty results after the initial push and PR creation. Manual dispatch returned HTTP 404 because the workflow was not found on the default branch. The reason automatic events have not registered a run remains unconfirmed. No remote CI success is claimed, and the default branch was not modified merely to force a run.

Remaining review boundaries include the Spanish Rowing Song source gap, Linux/remote CI execution, other browser engines, physical instrument/printer testing and independent music review. Source details are recorded in the [legacy audit](../sources/stage-6-legacy-audit.md).
