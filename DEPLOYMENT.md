# Sub2API Managed NextChat Deployment

## Production source

```text
repository: tqytwe/NextChat
branch: feat/sub2api-managed-20260720
```

Do **not** deploy `main` for the Managed Web product. `main` is a fork reference
line containing independent Android/mobile development and does not represent
the complete Managed Web customization.

## Delivery flow

```text
short-lived branch from Managed production
→ pull request targeting feat/sub2api-managed-20260720
→ GitHub Actions passes
→ merge
→ deployment platform builds the Managed target commit
→ verify deployment SHA/status and Managed smoke checks
→ delete merged short-lived branch
```

All dependency installation, tests, type checks, and builds run in GitHub
Actions. The user's local computer is not used for compilation or testing.

## Required deployment evidence

Record for every production change:

- Expected target SHA.
- GitHub Actions run ID and successful conclusion.
- Deployment ID.
- Bound repository and branch.
- Deployed SHA matching the expected target SHA.
- Successful/healthy deployment status.
- Managed lock/session, model/group loading, text chat, image upload, Image
  Studio/history, logout, and re-login acceptance as applicable.

A deployment still marked building/running is not complete. A deployment from
`main`, or one whose SHA cannot be matched, is not valid Managed evidence.

## Rollback

Before deployment, retain the prior known-good deployment ID and SHA. On failure:

1. Roll the deployment service back to the prior Managed SHA.
2. Revert the integration merge through a new PR; do not rewrite branch history.
3. Add regression coverage and repeat GitHub CI before redeploying.

## Branch cleanup

After CI, merge, deployment, and ancestry checks all pass, delete the source
branch. Do not retain completed `integration/*`, `codex/*`, `feat/*`, or `fix/*`
branches as informal deployment history; commits, PRs, CI runs, and deployment
records are the durable evidence.
