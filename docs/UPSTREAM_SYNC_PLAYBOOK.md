# Managed Web Upstream Sync Playbook

## Authoritative branches and baseline

| Purpose | Repository / branch |
|---|---|
| Managed Web production | `tqytwe/NextChat:feat/sub2api-managed-20260720` |
| Fork reference / independent product work | `tqytwe/NextChat:main` |
| Official NextChat upstream | `ChatGPTNextWeb/NextChat:main` |

The exact official baseline for Managed Web is:

```text
commit: 706a18b95b714ab29b2a4842d3b9ff4f887935d5
version description: v2.16.1-54-g706a18b
first Managed commit: 1d66fd9770e04e651aab495b987e12c2db2b7ea3
```

`main` is not the Managed Web rollout branch. It contains independent Android
and mobile product development and must never be treated as an official-upstream
mirror or merged wholesale into Managed Web.

## Scope boundary

Managed Web sync work changes only `tqytwe/NextChat`.

Out of scope unless separately authorized:

- `tqytwe/sub2api` source, migrations, CI, or deployment.
- `android/**`, Capacitor, Gradle, APKs, native bridges, Maestro flows, and mobile
  release/version workflows.
- Features that require a new or changed Sub2API backend contract.

If a candidate needs an out-of-scope change, record it as skipped rather than
expanding the sync.

## Safe sync procedure

1. Fetch the official repository under an `official` or `upstream` remote.
2. Compare the last recorded official SHA with `official/main`.
3. Classify every new commit as security, provider/chat, build/dependency, UI,
   desktop/PWA, Android/mobile, or backend-contract dependent.
4. Create a short-lived branch from the latest Managed Web production tip:

   ```text
   integration/managed-web-sync-YYYYMMDD
   ```

5. Cherry-pick or manually port small reviewed batches. Never blindly merge or
   rebase `main` into Managed Web.
6. Preserve these Managed invariants:
   - Sub2API session/bootstrap gate and default-deny API policy.
   - Browser auth-header stripping and no API key in browser storage.
   - Gateway-owned model list and group scope.
   - Managed recharge URL normalization.
   - Managed Image Studio, prompt usage, history, and asset behavior.
   - Managed shell/support/error behavior and design governance.
   - Uploaded-image retention and chat/session persistence.
7. Push the integration branch and use GitHub Actions for all dependency install,
   tests, type checks, and builds. Do not compile or test on the user's computer.
8. Create a PR targeting `feat/sub2api-managed-20260720`. Require successful CI.
9. Verify preview/production deployment branch, commit SHA, status, and Managed
   Web smoke checks before completion.
10. Merge without rebase/force-push, verify ancestry, then delete the completed
    integration branch.

## GitHub CI gates

The Managed branch workflow must cover:

- Dependency installation from the lockfile.
- Managed design governance.
- Jest/contract tests.
- Managed Web production build and type checking as configured by the build.

A failed/skipped gate is not completion. Fix through another commit and let
GitHub Actions rerun. Local `yarn install`, `yarn test`, `yarn build`, Gradle, and
Docker builds are not part of this workflow.

## Deployment acceptance

Before declaring a sync deployed, record:

```text
repository:
branch:
expected commit:
GitHub Actions run:
CI result:
deployment ID:
deployed commit:
deployment status:
Managed lock/session:
model/group loading:
chat text and image upload:
Image Studio/history:
logout/re-login:
residual issues:
```

The deployed branch and commit must match Managed Web. Never accept a deployment
from `main` as evidence for Managed Web.

## Rollback

Keep the last known-good Managed deployment ID and commit before merging. If
production acceptance fails:

1. Roll the deployment service back to the last known-good Managed commit.
2. Do not force-push or rewrite the Managed branch.
3. Revert the merge commit through a reviewed PR.
4. Preserve failure evidence and add a regression test before retrying.

## Branch lifecycle

Long-lived branches should be limited to the Managed production branch, the
fork reference branch, and explicitly documented active product/release lines.

A short-lived branch may be deleted only when all are true:

- Its PR is merged into the intended target.
- Required GitHub CI passed.
- Deployment succeeded and used the expected target SHA when deployment applies.
- The branch tip is reachable from the target branch.
- No service or open PR still references it.

Then delete the remote branch immediately. Enable GitHub's automatic deletion of
merged head branches, while protecting long-lived branches from deletion and
force-push.

## Current audit

See [`UPSTREAM_SYNC_AUDIT_2026-08-06.md`](./UPSTREAM_SYNC_AUDIT_2026-08-06.md)
for the complete 87-commit fork-main classification and the conclusion that the
official upstream delta was zero on 2026-08-06.
