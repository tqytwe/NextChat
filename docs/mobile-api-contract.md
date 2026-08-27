# JisudengChat Mobile API Contract (Schema Reference)

> API lifecycle, canonical/legacy status, client owners and retirement rules are
> maintained in [`docs/mobile/api-lifecycle.md`](mobile/api-lifecycle.md). This
> document retains request/response schema detail for compatibility review.

This document freezes the APP/backend contract before the next production backend release. The goal is one coordinated backend update, one APP integration pass, and no repeated production restarts while users are active.

## Release Rules

- Do not deploy production backend changes until this contract is implemented on a test/staging instance and the APP has passed smoke tests against it.
- New mobile endpoints must be additive and backward compatible. Existing Web and old APP behavior must keep working.
- APP must keep fallback behavior for missing optional endpoints during the transition.
- Backend errors must use stable machine-readable `error.code`; APP must not branch on Chinese error text.
- Backend responses must never include access tokens, refresh tokens, API keys, or full chat content in diagnostics endpoints.

## Envelope

Preferred success envelope:

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "request_id": "req_xxx"
}
```

Preferred failure envelope:

```json
{
  "code": "TOKEN_EXPIRED",
  "message": "access token expired",
  "data": null,
  "request_id": "req_xxx",
  "retryable": true
}
```

The current APP client already accepts the existing managed API envelope. Backend should not introduce a third response shape.

## Stable Error Codes

| Code | Meaning | APP behavior |
| --- | --- | --- |
| `TOKEN_EXPIRED` | Access token expired | Refresh silently and retry once |
| `REFRESH_TOKEN_EXPIRED` | Refresh token expired/revoked | Ask user to sign in again |
| `TOTP_REQUIRED` | 2FA required | Show Google Authenticator code input |
| `INVALID_TOTP` | Invalid 2FA code | Keep user on 2FA screen |
| `PERMISSION_DENIED` | Feature not allowed | Show permission/plan hint |
| `INSUFFICIENT_BALANCE` | Balance or quota insufficient | Show billing/plan hint |
| `GROUP_UNAVAILABLE` | Selected group disabled/missing | Refresh account summary and ask user to select again |
| `MODEL_UNAVAILABLE` | Selected model unavailable | Keep prompt, ask user to select another model |
| `PAYMENT_PENDING` | Payment not finished | Keep polling or show pending |
| `PAYMENT_PAID` | Payment completed | Refresh account summary |
| `PAYMENT_FAILED` | Payment failed | Show provider reason and retry |
| `TASK_CANCELLED` | Task cancelled | Mark cancelled, allow retry if supported |
| `NOT_FOUND` | Endpoint/resource missing | APP fallback if optional; otherwise show service unavailable |
| `RATE_LIMITED` | Too many requests | Back off and retry later |
| `UPSTREAM_UNAVAILABLE` | Upstream AI service unavailable | Show retryable service hint |

## Auth

These endpoints are shared by Web and APP.

### `POST /api/v1/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "secret",
  "device": {
    "platform": "android",
    "app_version": "2.0.42",
    "installation_id": "install_xxx"
  }
}
```

Success response data:

```json
{
  "access_token": "jwt",
  "refresh_token": "refresh",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "user"
  }
}
```

2FA response data:

```json
{
  "requires_2fa": true,
  "temp_token": "tmp_xxx",
  "user_email_masked": "u***@example.com"
}
```

### `POST /api/v1/auth/login/2fa`

Request:

```json
{
  "temp_token": "tmp_xxx",
  "totp_code": "123456"
}
```

Response data is the same as login success.

### `POST /api/v1/auth/refresh`

Request:

```json
{
  "refresh_token": "refresh"
}
```

Response data is the same as login success. Backend should rotate refresh tokens when possible and keep a grace window to avoid weak-network double-submit failures.

### `POST /api/v1/auth/logout`

Request:

```json
{
  "refresh_token": "refresh"
}
```

## Account Summary

### `GET /api/v1/mobile/account-summary`

Purpose: account page should load once, especially on weak Wi-Fi/mobile networks.

APP fallback: if missing, current APP can still use legacy account/bootstrap/payment calls, but the target backend should implement this.

Response data:

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "user",
    "balance": 968.03,
    "frozen_balance": 0
  },
  "balance": 968.03,
  "frozen_balance": 0,
  "chat_group": {
    "id": 10,
    "name": "国产分组"
  },
  "image_group": {
    "id": 12,
    "name": "生图分组"
  },
  "subscription": {
    "status": "active",
    "plan_name": "Pro",
    "expires_at": "2026-08-27T00:00:00Z"
  },
  "quotas": [
    {
      "feature": "chat",
      "used": 12000,
      "remaining": 88000,
      "total": 100000,
      "unit": "token",
      "reset_at": "2026-08-01T00:00:00Z"
    },
    {
      "feature": "image",
      "used": 3,
      "remaining": 97,
      "total": 100,
      "unit": "image"
    }
  ],
  "sessions": {
    "chat": {
      "purpose": "chat",
      "api_key": "chat_key",
      "api_key_id": 100,
      "group_id": 10,
      "group_name": "国产分组",
      "expires_at": "2026-07-27T12:00:00Z"
    },
    "image": {
      "purpose": "image",
      "api_key": "image_key",
      "api_key_id": 101,
      "group_id": 12,
      "group_name": "生图分组",
      "expires_at": "2026-07-27T12:00:00Z"
    }
  },
  "models": {},
  "payment": {
    "last_order_id": "order_xxx",
    "last_status": "paid"
  },
  "refreshed_at": "2026-07-27T10:00:00Z"
}
```

## Independent Sessions

The backend must not rely on one shared "current group" for both chat and image generation.

### `GET /api/v1/mobile/sessions`

Response data:

```json
{
  "chat": {
    "purpose": "chat",
    "api_key": "chat_key",
    "api_key_id": 100,
    "group_id": 10,
    "group_name": "国产分组",
    "model": "deepseek-chat",
    "expires_at": "2026-07-27T12:00:00Z"
  },
  "image": {
    "purpose": "image",
    "api_key": "image_key",
    "api_key_id": 101,
    "group_id": 12,
    "group_name": "生图分组",
    "model": "gpt-image-1",
    "expires_at": "2026-07-27T12:00:00Z"
  }
}
```

### `POST /api/v1/mobile/sessions/chat/switch-group`

### `POST /api/v1/mobile/sessions/image/switch-group`

Request:

```json
{
  "group_id": 12,
  "model": "gpt-image-1",
  "client_request_id": "switch_xxx"
}
```

Response data is the full session bundle from `GET /api/v1/mobile/sessions`.

Compatibility note: the old endpoint `/api/v1/nextchat/mobile/sessions/{purpose}/group` may remain temporarily, but the canonical endpoint is `/api/v1/mobile/sessions/{purpose}/switch-group`.

## Task History

Task state must be consistent for chat, image, and file operations.

### `POST /api/v1/mobile/tasks`

Request:

```json
{
  "kind": "image",
  "operation": "generate",
  "client_request_id": "task_xxx",
  "title_zh": "蓝色方块",
  "model": "gpt-image-1",
  "group_id": 12,
  "asset_ids": ["asset_1"],
  "parameters": {
    "size": "1024x1024"
  },
  "resource": {
    "prompt": "a small blue cube on a white table"
  },
  "locale": "zh-CN"
}
```

Response data:

```json
{
  "id": "task_1",
  "kind": "image",
  "operation": "generate",
  "client_request_id": "task_xxx",
  "status": "queued",
  "progress": 0,
  "cancellable": true,
  "retryable": false,
  "created_at": "2026-07-27T10:00:00Z"
}
```

### `GET /api/v1/mobile/tasks`

Query: `kind`, `status`, `query`, `date_from`, `date_to`, `cursor`, `limit`, `order`.

`cursor` is opaque and stable on `(created_at,id)`. During the compatibility
window the APP also sends `page/page_size`, but new clients must continue from
`next_cursor` and use `has_more`.

### `GET /api/v1/mobile/tasks/{id}`

Returns one task.

### `POST /api/v1/mobile/tasks/{id}/cancel`

Request:

```json
{
  "reason": "user_cancelled",
  "client_request_id": "cancel_xxx"
}
```

### `POST /api/v1/mobile/tasks/{id}/retry`

Request:

```json
{
  "client_request_id": "retry_xxx",
  "overrides": {
    "model": "gpt-image-1"
  }
}
```

### `POST /api/v1/mobile/tasks/{id}/status`

Used by APP as a transitional status projection when backend orchestration is not fully deployed.

### `DELETE /api/v1/mobile/tasks/{id}`

Soft-delete one task from the user's history. Do not delete billing/audit records.

### `POST /api/v1/mobile/tasks/bulk-delete`

Requires matching `client_request_id`, `X-Client-Request-ID`, and
`Idempotency-Key`. Accepts at most 100 task IDs. Only terminal tasks are soft
deleted. Each result is `deleted`, `not_found`, `not_terminal`, or `failed`.

### `POST /api/v1/mobile/tasks/bulk-cancel`

Uses the same request and idempotency contract. Each result is `cancelled`,
`not_found`, `not_cancellable`, or `failed`.

## Image History

### `GET /api/v1/mobile/image-history`

Query: `status`, `model`, `group_id`, `cursor`, `limit`, `order`.

Response data is `MobilePage<MobileImageHistoryItem>`.

### `DELETE /api/v1/mobile/image-history/{id}`

Soft-delete failed/completed image history from the user's visible list.

### `POST /api/v1/mobile/image-history/{id}/retry`

Request:

```json
{
  "client_request_id": "retry_image_xxx",
  "overrides": {
    "size": "1024x1024"
  }
}
```

Response data is the new task.

## Assets

Already implemented in APP client.

- `POST /api/v1/mobile/assets`
- `GET /api/v1/mobile/assets`
- `GET /api/v1/mobile/assets/{id}`
- `DELETE /api/v1/mobile/assets/{id}`

Asset uploads must support images, PDFs, documents, audio, shared files, generated images, and chat exports. File parsing can be asynchronous and linked to tasks.

## Skills

Already implemented in APP client.

- `GET /api/v1/mobile/skills`
- `GET /api/v1/mobile/skills/{slug}`
- `POST /api/v1/mobile/skills/{slug}/install`
- `DELETE /api/v1/mobile/skills/{slug}/install`
- `POST /api/v1/mobile/skills/{slug}/use`

Each skill should include: `slug`, localized title/description, category, tags, author, version, system prompt, examples, input parameters, permissions, consumption note, installed state, updated time.

Important product rule: skill is not an agent/persona. It is a task ability layered onto the current agent/session.

## Redeem, Invite, Coupon

These are shared account/billing APIs, not mobile-only APIs.

### `POST /api/v1/redeem-codes/redeem`

Request:

```json
{
  "redeem_code": "JSD-2026",
  "client_request_id": "redeem_xxx",
  "locale": "zh-CN"
}
```

Response data:

```json
{
  "id": "redeem_1",
  "code": "JSD-2026",
  "credited_amount": 20,
  "credited_plan": "Pro",
  "expires_at": "2026-08-27T00:00:00Z",
  "balance": 988.03,
  "message": "兑换成功"
}
```

### `GET /api/v1/redeem-codes/history`

Returns redeem records for the current user.

### Registration invite code

Register request should accept:

```json
{
  "email": "user@example.com",
  "password": "secret",
  "verify_code": "123456",
  "invite_code": "INVITE123"
}
```

Backend must define whether invite code is required, reward amount/plan, usage limits, and anti-abuse rules.

### Purchase coupon code

Payment/order request should accept `coupon_code`. Coupon is for purchase discount; redeem code is for direct credit/equity exchange.

## Payments

### `POST /api/v1/mobile/payments/create`

Request:

```json
{
  "provider": "wechat",
  "plan_id": "pro_monthly",
  "amount": 30,
  "coupon_code": "SALE20",
  "client_request_id": "pay_xxx",
  "return_url": "jisudengchat://payment/result",
  "locale": "zh-CN"
}
```

Response data:

```json
{
  "order_id": "order_1",
  "status": "pending",
  "provider": "wechat",
  "amount": 30,
  "currency": "CNY",
  "deeplink": "weixin://...",
  "scheme_url": "weixin://...",
  "mweb_url": "https://wx.tenpay.com/...",
  "h5_url": "https://pay.example.com/h5",
  "pay_url": "https://pay.example.com/pay",
  "qr_code": "weixin://wxpay/...",
  "return_url": "jisudengchat://payment/result",
  "expires_at": "2026-07-27T10:10:00Z"
}
```

APP launch priority: `deeplink`, `scheme_url`, `mweb_url`, `h5_url`, `pay_url`, then QR code display.

### `GET /api/v1/mobile/payments/{order_id}`

Returns latest order status.

### `POST /api/v1/mobile/payments/{order_id}/sync`

Forces backend to query payment provider and update local order/subscription/balance state.

## Support Tickets

Already implemented in APP client.

- `POST /api/v1/mobile/support/tickets`
- `GET /api/v1/mobile/support/tickets`
- `GET /api/v1/mobile/support/tickets/{id}`
- `POST /api/v1/mobile/support/tickets/{id}/messages`
- `POST /api/v1/mobile/support/tickets/{id}/close`

Diagnostics attached to tickets must be redacted. Do not store access tokens, API keys, or full chat transcripts.

## Diagnostics

Already implemented in APP client.

### `POST /api/v1/mobile/diagnostics`

Must accept redacted network/client diagnostics:

- operation: `sync`, `chat`, `image`, `file`, `payment`, `support`, `other`
- category: `network`, `timeout`, `http`, `server`, `client`, `cancelled`, `other`
- path category, status code, network type, duration, retry count, app version, device metadata

## Devices And Push

Already implemented in APP client.

- `PUT /api/v1/mobile/devices/{installation_id}`
- `DELETE /api/v1/mobile/devices/{installation_id}`

Push events to support later:

- payment paid
- image/task completed
- support ticket replied
- app version notice

## Production Rollout Checklist

1. Implement this contract on a staging backend.
2. Run database migrations on staging from a clean snapshot and an upgraded snapshot.
3. Run automated API smoke tests for every endpoint above.
4. Install APP build against staging and test login refresh, Wi-Fi/mobile switch, chat, image, payment, redeem, skills, assets, support.
5. Confirm old production APP still works against the new backend.
6. Schedule a low-traffic production window.
7. Backup database.
8. Apply migrations.
9. Start new backend instance.
10. Run health checks.
11. Switch traffic.
12. Keep old backend instance available for rollback for at least 10-30 minutes.
13. Monitor login failures, refresh failures, payment failures, chat/image errors, and HTTP 5xx.
