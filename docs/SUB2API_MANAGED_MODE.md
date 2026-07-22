# Sub2API Managed Mode

## Summary

NextChat is used as the hosted frontend for the Jisudeng AI workspace. Sub2API remains the only backend source of truth for identity, balances, API keys, model permissions, billing, image tasks, image assets, and retention policy.

The current rollout uses scheme C:

- Public workspace URL: `https://nexta.zeabur.app`
- No new domain in the current phase.
- No `/ai` reverse proxy in the current phase.
- Do not casually change Zeabur environment variables.
- Future migration to `https://www.jisudeng.com/ai` or `ai.jisudeng.com` must not change the business boundary.

## Runtime Contract

In managed mode, `nexta.zeabur.app` may be opened publicly, but it must not be usable without a Sub2API-issued session.

Allowed entry states:

- User clicks `AI 工作台` from the Sub2API console.
- Sub2API creates a one-time launch token and redirects to `NEXTCHAT_PUBLIC_URL`.
- NextChat exchanges the launch token through `/api/nextchat/session`.
- NextChat stores an encrypted httpOnly session cookie.
- Page refresh works while the managed session is still valid.

Blocked entry states:

- Direct visit to `https://nexta.zeabur.app` without a launch token or valid cookie.
- Expired or consumed launch token.
- Expired or tampered managed session cookie.
- Any attempt to pass a browser-owned API key through `Authorization`, `api-key`, `x-api-key`, or `x-goog-api-key`.

Unauthenticated users see only the lock page:

- Title: `极速蹬 AI 工作台`
- Message: `请从极速蹬控制台进入`
- Action: `返回极速蹬`

The lock page must not load the main chat UI, model list, MCP, plugin markets, WebDAV, Upstash, or provider settings.

## Environment

Current Zeabur values are expected to keep working:

```text
NODE_VERSION=20
SUB2API_MANAGED_MODE=true
SUB2API_BASE_URL=sub2api-wortic.zeabur.internal
SUB2API_NEXTCHAT_SECRET=<same value as Sub2API>
NEXTCHAT_SESSION_SECRET=<random long secret>
NEXTCHAT_BASE_PATH=/
```

Do not add or rename variables for the current scheme C rollout unless there is a separate deploy change request.

`SUB2API_BASE_URL` may use the Zeabur internal service host when both services are in the same Zeabur private network. It is server-side only and is not exposed through `/api/config`.

## API Policy

Managed mode is default-deny for capability APIs.

Allowed:

- `/api/config`, public runtime flags only, no secrets.
- `/api/nextchat/session`, launch exchange, session status, logout.
- `/api/openai/*`, only as the Sub2API OpenAI-compatible gateway proxy, with a valid managed session.

Denied:

- `/api/google/*`
- `/api/anthropic/*`
- `/api/azure/*`
- `/api/deepseek/*`
- `/api/moonshot/*`
- `/api/xai/*`
- `/api/siliconflow/*`
- `/api/302ai/*`
- `/api/stability/*`
- `/api/tencent/*`
- `/api/webdav/*`
- `/api/upstash/*`
- `/api/artifacts`
- generic proxy fallback

The OpenAI-compatible proxy must inject the managed Sub2API API key on the server. Browser-supplied auth headers are deleted before injection.

## UI Policy

All managed visual changes must also follow
[`MANAGED_UI_DESIGN_SYSTEM.md`](./MANAGED_UI_DESIGN_SYSTEM.md). Read that
document and inspect the current rendered UI before changing managed layout,
icons, support surfaces, or system states.

The reviewed rollout sequence and frozen chat-core boundary are recorded in
[`MANAGED_UI_REMEDIATION_PLAN.md`](./MANAGED_UI_REMEDIATION_PLAN.md). Every
visible managed change must also include a completed record under
`docs/visual-reviews/`.

The executable file ownership, icon boundary and frozen-core list are stored in
[`managed-ui-governance.json`](./managed-ui-governance.json). Update the policy,
checker and tests together when that ownership changes.

Managed mode must hide or remove:

- User API key inputs.
- External provider settings.
- Custom endpoint switching.
- WebDAV and Upstash cloud sync.
- External plugin marketplace and MCP startup.
- Direct `/plugins`, `/mcp-market`, and `/artifacts/*` routes.
- NextChat GitHub/update prompts.
- External DALL-E/SD entry points outside the Sub2API image workspace.

Managed mode keeps:

- Chat UI backed by Sub2API `/v1/chat/completions`.
- Image creation backed by Sub2API `/api/v1/nextchat/image-studio/*`.
- Local browser history.
- Theme, language, Sub2API prompt catalog, model parameter, workspace archive import/export, and local clear-data controls.
- `返回极速蹬`.
- `充值`.
- `退出工作台`.

## Retention

Current v1 defaults:

- Text sessions stay in browser IndexedDB/local storage and are pruned after 7 days on local store hydration and migration.
- Image assets are owned by Sub2API and NextChat image generation forces a 24-hour retention window.
- Server-side plaintext chat history is not stored by default.

Managed workspace export package shape:

```text
workspace-export.zip
  chat.json
  chat.md
  metadata.json
  images/
```

Expired images export metadata only and render as `图片已过期` on import.
Archived images are copied into `images/` and import back as local data URLs, so exported conversations remain readable after the Sub2API asset TTL passes.

## Sub2API BFF

Sub2API exposes the workspace BFF through server-to-server requests from
NextChat. Current baseline:

- `GET /api/v1/nextchat/bootstrap`
- `GET /api/v1/nextchat/prompts`
- `POST /api/v1/nextchat/group`
- `POST /api/v1/nextchat/image-studio/*`
- `GET /api/v1/nextchat/image-studio/*`
- `DELETE /api/v1/nextchat/image-studio/*`

Bootstrap should include:

- user display info
- balance
- allowed models
- default model
- image capabilities
- prompt/template entry data
- feature flags
- `return_url`
- `recharge_url`
- `profile_url`
- retention policy

NextChat must not create an independent user system, business database, balance ledger, or billing path.

## Rollout

1. Keep old `/image-studio` frozen and available.
2. Use Sub2API console `AI 工作台` to launch `nexta.zeabur.app`.
3. Verify direct access shows the lock page.
4. Verify chat works and bills through Sub2API.
5. Verify prompt catalog loads from Sub2API through `/api/nextchat/prompts`.
6. Verify image creation, references, downloads, history refresh, and expired asset rendering.
7. Verify workspace export/import before full release.
8. Only after acceptance, hide old `/image-studio` navigation while keeping rollback access.
