import type { ApiToolCall, ChatCompletionResult, ProviderId } from "@/types";
import { getProviderById } from "@/llm/providers";

interface ToolCallDraft {
  id: string;
  name: string;
  arguments: string;
}

/**
 * 统一的 SSE 聚合器：同时处理正文增量（delta / cumulative 两种模式）
 * 与 function-calling 的 tool_calls 分片拼装（按 index 累积 id/name/arguments）。
 *
 * 既服务于 fetch 流式读取（逐帧 push），也服务于 requestUrl 整段文本回放。
 */
export class SseAggregator {
  private fullText = "";
  private previousContent = "";
  private readonly toolCalls = new Map<number, ToolCallDraft>();

  constructor(private readonly streamMode: "delta" | "cumulative") {}

  /** 处理一个 `data:` payload（JSON 字符串）。 */
  ingestPayload(payload: string, onChunk?: (chunk: string) => void): void {
    let json: {
      choices?: Array<{
        delta?: { content?: string; tool_calls?: Array<Record<string, unknown>> };
        message?: { content?: string };
      }>;
    };

    try {
      json = JSON.parse(payload);
    } catch (error) {
      console.warn("Failed to parse SSE frame", error);
      return;
    }

    const choice = json.choices?.[0];
    if (!choice) {
      return;
    }

    const rawContent = choice.delta?.content ?? choice.message?.content ?? "";

    if (rawContent) {
      const nextChunk =
        this.streamMode === "cumulative" && rawContent.startsWith(this.previousContent)
          ? rawContent.slice(this.previousContent.length)
          : rawContent;

      this.previousContent = rawContent;

      if (nextChunk) {
        this.fullText += nextChunk;
        onChunk?.(nextChunk);
      }
    }

    const wireToolCalls = choice.delta?.tool_calls;

    if (Array.isArray(wireToolCalls)) {
      for (const wire of wireToolCalls) {
        const index = typeof wire.index === "number" ? wire.index : 0;
        const fn = (wire.function ?? {}) as { name?: string; arguments?: string };
        const existing = this.toolCalls.get(index) ?? { id: "", name: "", arguments: "" };

        if (typeof wire.id === "string" && wire.id) {
          existing.id = wire.id;
        }

        if (typeof fn.name === "string" && fn.name) {
          existing.name = fn.name;
        }

        if (typeof fn.arguments === "string" && fn.arguments) {
          // cumulative 模式下个别服务商会整段重发 arguments —— 起始匹配则替换而非拼接。
          if (this.streamMode === "cumulative" && fn.arguments.startsWith(existing.arguments)) {
            existing.arguments = fn.arguments;
          } else {
            existing.arguments += fn.arguments;
          }
        }

        this.toolCalls.set(index, existing);
      }
    }
  }

  get text(): string {
    return this.fullText;
  }

  get calls(): ApiToolCall[] {
    return [...this.toolCalls.entries()]
      .sort(([a], [b]) => a - b)
      .filter(([, draft]) => draft.name)
      .map(([, draft]) => ({
        id: draft.id,
        type: "function" as const,
        function: { name: draft.name, arguments: draft.arguments || "{}" },
      }));
  }

  result(): ChatCompletionResult {
    return { content: this.fullText, toolCalls: this.calls };
  }
}

/** 从一帧 SSE 文本中提取所有 `data:` 行的 payload。 */
export function extractDataPayloads(frame: string): string[] {
  return frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s*/, "").trim())
    .filter((payload) => payload && payload !== "[DONE]");
}

/** 把整段 SSE 文本一次性解析为结果（requestUrl 路径 / 调试用）。 */
export function parseSseText(raw: string, providerId: ProviderId, onChunk?: (chunk: string) => void): ChatCompletionResult {
  const provider = getProviderById(providerId);
  const aggregator = new SseAggregator(provider.streamMode);

  for (const frame of raw.split("\n\n")) {
    for (const payload of extractDataPayloads(frame)) {
      aggregator.ingestPayload(payload, onChunk);
    }
  }

  return aggregator.result();
}

/** fetch 流式读取：逐块解码、按帧切分、保留半帧缓冲。 */
export async function readSseStream(
  providerId: ProviderId,
  response: Response,
  onChunk?: (chunk: string) => void,
): Promise<ChatCompletionResult> {
  if (!response.body) {
    throw new Error("Streaming response body is empty");
  }

  const provider = getProviderById(providerId);
  const aggregator = new SseAggregator(provider.streamMode);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const payload of extractDataPayloads(frame)) {
        aggregator.ingestPayload(payload, onChunk);
      }
    }
  }

  if (buffer.trim()) {
    for (const payload of extractDataPayloads(buffer)) {
      aggregator.ingestPayload(payload, onChunk);
    }
  }

  return aggregator.result();
}
