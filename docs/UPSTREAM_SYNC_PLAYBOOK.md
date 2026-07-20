# Upstream Sync Playbook

## Fixed Branches

Current integration branch:

```text
repo: tqytwe/NextChat
branch: feat/sub2api-managed-20260720
worktree: /home/dell/worktrees/nextchat-sub2api-managed-20260720
```

Baseline reference only:

```text
worktree: /home/dell/worktrees/nextchat
branch: main
```

Do not treat `main` as the rollout branch for this integration.

Sub2API production branch:

```text
repo: tqytwe/sub2api
branch: play/main
```

Sub2API production-bound changes must be developed in an isolated worktree created from `origin/play/main`, then merged back through PR. Do not edit dirty shared worktrees for production changes.

## Sync Rule

Never sync upstream NextChat directly into the integration branch.

Use this shape:

```text
git fetch origin
git worktree add /home/dell/worktrees/nextchat-upstream-sync-YYYYMMDD feat/sub2api-managed-20260720
cd /home/dell/worktrees/nextchat-upstream-sync-YYYYMMDD
git switch -c sync/nextchat-upstream-YYYYMMDD
git fetch upstream main
git merge upstream/main
```

Resolve conflicts by preserving:

- Sub2API managed session gate.
- `nexta.zeabur.app` scheme C root-path support.
- API default-deny policy.
- Browser auth-header stripping.
- Managed mode UI hiding for provider keys, cloud sync, plugin/MCP, and external image paths.
- Jisudeng branding.
- Model list loaded from Sub2API, not from built-in NextChat defaults.

After sync, open a PR back into `feat/sub2api-managed-20260720`.

## Required Checks

NextChat:

```text
yarn test:ci
yarn build
```

Manual checks:

- Direct `https://nexta.zeabur.app` visit shows the lock page.
- Sub2API console `AI 工作台` launch opens the workspace.
- Refresh keeps the session while valid.
- Logout clears the cookie and returns to the lock page.
- `/api/openai/v1/models` requires the managed cookie.
- `/api/google/*`, `/api/anthropic/*`, `/api/webdav/*`, `/api/upstash/*`, and `/api/artifacts` return 403 in managed mode.
- Browser storage does not contain the Sub2API API key.

Sub2API production changes:

```text
make test
GOFLAGS=-buildvcs=false make build
./scripts/check-fork-integrity.sh
```

Sub2API changes must merge into `play/main` before production deploy.

## Future Domain Migration

The current deploy remains:

```text
https://nexta.zeabur.app
```

Future targets may be:

```text
https://www.jisudeng.com/ai
https://ai.jisudeng.com
```

Migration should only change routing, cookie path, and basePath/reverse-proxy details. It must not move billing, model permissions, image jobs, assets, or retention out of Sub2API.
