import { truncateText } from "@/utils/markdown";

const MAX_DETAIL = 280;

/**
 * Turn HTTP error bodies (often OpenAI-compatible JSON) into a short user-facing message.
 */
export function formatChatCompletionHttpError(status: number, bodyText: string): string {
  const trimmed = bodyText.trim().slice(0, 4000);
  let detail = "";

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { message?: string } | string;
        message?: string;
      };

      const fromNested =
        typeof parsed.error === "object" && parsed.error && "message" in parsed.error
          ? String(parsed.error.message ?? "")
          : "";

      const fromTop = typeof parsed.message === "string" ? parsed.message : "";
      const fromErrorString = typeof parsed.error === "string" ? parsed.error : "";

      const raw = fromNested || fromTop || fromErrorString;

      if (raw) {
        detail = truncateText(raw.replace(/\s+/g, " ").trim(), MAX_DETAIL);
      }
    } catch {
      if (trimmed.length <= 400) {
        detail = truncateText(trimmed.replace(/\s+/g, " ").trim(), MAX_DETAIL);
      }
    }
  }

  if (detail) {
    return `模型请求失败（${status}）：${detail}`;
  }

  return `模型请求失败（${status}），请检查 API Key、模型名和请求参数。`;
}
