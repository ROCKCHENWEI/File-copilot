/**
 * Normalizes a user-entered vault-relative folder path.
 * Rejects absolute paths, `..`, empty segments, and excessive length.
 */
export function normalizeVaultRelativeFolder(raw: string | undefined, fallback: string): string {
  const fallbackNorm = fallback.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim() || "copilot-cn";

  if (raw == null || !String(raw).trim()) {
    return fallbackNorm;
  }

  let s = String(raw).trim().replace(/\\/g, "/");

  if (s.startsWith("/") || /^[a-zA-Z]:/.test(s)) {
    return fallbackNorm;
  }

  s = s.replace(/^\/+/, "");

  const segments = s.split("/").filter((seg) => seg.length > 0);

  if (segments.length === 0 || segments.some((seg) => seg === ".." || seg === ".")) {
    return fallbackNorm;
  }

  const joined = segments.join("/");

  if (joined.length > 240) {
    return fallbackNorm;
  }

  return joined;
}
