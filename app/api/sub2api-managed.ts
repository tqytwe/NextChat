import { getServerSideConfig } from "../config/server";
import { ApiPath, ModelProvider } from "../constant";
import { NextRequest, NextResponse } from "next/server";

export const SUB2API_MANAGED_SESSION_COOKIE = "nextchat_sub2api_session";

const COOKIE_VERSION = "v1";
const SESSION_ADDITIONAL_DATA = "nextchat-sub2api-managed-session:v1";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type Sub2APIManagedSession = {
  userId: number;
  apiKey: string;
  apiKeyId: number;
  expiresAt: string;
};

export function isSub2APIManagedMode(config = getServerSideConfig()): boolean {
  return !!config.sub2apiManagedMode;
}

export function getSub2APIManagedCookiePath(
  config = getServerSideConfig(),
): string {
  return config.nextChatBasePath || "/";
}

export function canHandleManagedProvider(
  req: NextRequest,
  modelProvider: ModelProvider,
): boolean {
  return (
    modelProvider === ModelProvider.GPT &&
    req.nextUrl.pathname.includes("/api/openai/")
  );
}

export function canUseProviderApiInManagedMode(apiPath: string): boolean {
  return apiPath === ApiPath.OpenAI;
}

export function getManagedModeApiBlockMessage(apiPath: string): string {
  return `Sub2API managed mode does not allow ${apiPath}`;
}

export async function sealManagedSession(
  session: Sub2APIManagedSession,
  secret: string,
): Promise<string> {
  const crypto = getCrypto();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const key = await deriveKey(secret);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: textEncoder.encode(SESSION_ADDITIONAL_DATA),
    },
    key,
    textEncoder.encode(JSON.stringify(session)),
  );

  return [
    COOKIE_VERSION,
    bytesToBase64Url(iv),
    bytesToBase64Url(new Uint8Array(ciphertext)),
  ].join(".");
}

export async function openManagedSession(
  sealed: string | undefined,
  secret: string,
): Promise<Sub2APIManagedSession | null> {
  if (!sealed || !secret) return null;

  const parts = sealed.split(".");
  if (parts.length !== 3 || parts[0] !== COOKIE_VERSION) return null;

  try {
    const iv = base64UrlToBytes(parts[1]);
    const ciphertext = base64UrlToBytes(parts[2]);
    const key = await deriveKey(secret);
    const plaintext = await getCrypto().subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: textEncoder.encode(SESSION_ADDITIONAL_DATA),
      },
      key,
      ciphertext,
    );
    const session = JSON.parse(
      textDecoder.decode(plaintext),
    ) as Sub2APIManagedSession;

    if (!session.apiKey || !Number.isFinite(session.userId)) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) return null;

    return session;
  } catch (error) {
    console.warn("[Sub2API Managed] invalid session cookie", error);
    return null;
  }
}

export async function getManagedSessionFromRequest(
  req: NextRequest,
): Promise<Sub2APIManagedSession | null> {
  const config = getServerSideConfig();
  if (!isSub2APIManagedMode(config) || !config.nextChatSessionSecret) {
    return null;
  }

  return openManagedSession(
    req.cookies.get(SUB2API_MANAGED_SESSION_COOKIE)?.value,
    config.nextChatSessionSecret,
  );
}

export async function proxySub2APINextChatBFF(
  req: NextRequest,
  path: string,
  init?: RequestInit,
) {
  const config = getServerSideConfig();
  if (!isSub2APIManagedMode(config)) {
    return NextResponse.json(
      { error: true, msg: "Sub2API managed mode is disabled" },
      { status: 404 },
    );
  }
  const session = await getManagedSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { error: true, msg: "missing or expired Sub2API managed session" },
      { status: 401 },
    );
  }
  const baseUrl = normalizeSub2APIOrigin(config.sub2apiBaseUrl);
  if (!baseUrl || !config.sub2apiNextChatSecret) {
    return NextResponse.json(
      { error: true, msg: "Sub2API managed BFF is not configured" },
      { status: 500 },
    );
  }

  const upstream = await fetch(`${baseUrl}/api/v1/nextchat/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-NextChat-Secret": config.sub2apiNextChatSecret,
      "X-NextChat-User-ID": String(session.userId),
      "X-NextChat-API-Key-ID": String(session.apiKeyId),
      ...(init?.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });
  const body = await upstream.arrayBuffer();
  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("Content-Type") || "application/json",
    "Cache-Control": "no-store",
  };
  for (const name of ["Content-Disposition", "Location"]) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const digest = await getCrypto().subtle.digest(
    "SHA-256",
    textEncoder.encode(secret),
  );
  return getCrypto().subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function normalizeSub2APIOrigin(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/g, "");
}

function getCrypto(): Crypto {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle || !crypto.getRandomValues) {
    throw new Error("Web Crypto is required for managed NextChat sessions");
  }
  return crypto;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(i, i + 0x8000));
  }
  return base64Encode(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = base64Decode(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64Encode(binary: string): string {
  if (typeof btoa === "function") return btoa(binary);
  return (globalThis as any).Buffer.from(binary, "binary").toString("base64");
}

function base64Decode(base64: string): string {
  if (typeof atob === "function") return atob(base64);
  return (globalThis as any).Buffer.from(base64, "base64").toString("binary");
}
