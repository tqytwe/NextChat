export type LocalChatAttachmentKind = "image" | "text" | "unsupported";

export type ChatAttachmentFileLike = Pick<Blob, "size" | "type"> & {
  name?: string;
};

const IMAGE_EXTENSIONS = new Map<string, string>([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
  ["avif", "image/avif"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
]);

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "xml",
  "yaml",
  "yml",
  "log",
  "html",
  "htm",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "go",
  "java",
  "kt",
  "kts",
  "swift",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "rs",
  "rb",
  "php",
  "sh",
  "sql",
  "ini",
  "toml",
  "properties",
]);

function extensionFromName(name?: string) {
  const normalized = String(name || "")
    .trim()
    .toLowerCase();
  const match = normalized.match(/\.([a-z0-9]+)$/i);
  return match?.[1] || "";
}

function normalizedMimeType(file: ChatAttachmentFileLike) {
  return String(file.type || "")
    .trim()
    .toLowerCase()
    .split(";", 1)[0];
}

/**
 * Android document providers sometimes return an empty or generic MIME type.
 * The filename is a safe fallback for choosing the local representation, not
 * an authorization decision or a server-side content-type assertion.
 */
export function inferLocalChatAttachmentMimeType(file: ChatAttachmentFileLike) {
  const mime = normalizedMimeType(file);
  if (mime && mime !== "application/octet-stream") return mime;
  return IMAGE_EXTENSIONS.get(extensionFromName(file.name)) || mime;
}

export function localChatAttachmentKind(
  file: ChatAttachmentFileLike,
): LocalChatAttachmentKind {
  const mime = inferLocalChatAttachmentMimeType(file);
  if (
    IMAGE_EXTENSIONS.has(extensionFromName(file.name)) ||
    /^image\//.test(mime)
  ) {
    return "image";
  }
  if (
    /^text\//.test(mime) ||
    /(?:json|xml|javascript|typescript|sql|yaml|toml|x-sh|x-python|x-java)/.test(
      mime,
    ) ||
    TEXT_EXTENSIONS.has(extensionFromName(file.name))
  ) {
    return "text";
  }
  return "unsupported";
}

export function isLocalChatImage(file: ChatAttachmentFileLike) {
  return localChatAttachmentKind(file) === "image";
}

export function isLocalChatText(file: ChatAttachmentFileLike) {
  return localChatAttachmentKind(file) === "text";
}

/**
 * Preserve the bytes while adding an inferred image MIME type for WebView
 * image decoding. No file leaves the device through this conversion.
 */
export function normalizeLocalChatAttachmentBlob(
  file: Blob & { name?: string },
): Blob {
  const inferredType = inferLocalChatAttachmentMimeType(file);
  if (!inferredType || normalizedMimeType(file) === inferredType) return file;
  return new Blob([file], { type: inferredType });
}
