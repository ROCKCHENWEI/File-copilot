import { formatChatCompletionHttpError } from "@/llm/apiErrorMessage";
import { clampTemperature, getProviderApiKey, getProviderById, resolveProviderModel } from "@/llm/providers";
import { parseSseText, readSseStream } from "@/llm/sse";
import type {
  ApiToolCall,
  ChatClientConfig,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatRequestMessage,
  CopilotSettings,
  ProviderId,
} from "@/types";
import { requestUrl, type RequestUrlResponse } from "obsidian";

/** OpenAI 兼容 wire 消息（含 tool_calls / tool 角色）。 */
interface OpenAIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ApiToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: ApiToolCall[];
    };
  }>;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildMessages(messages: ChatRequestMessage[], systemPrompt?: string): OpenAIChatMessage[] {
  const payload: OpenAIChatMessage[] = [];

  if (systemPrompt?.trim()) {
    payload.push({ role: "system", content: systemPrompt.trim() });
  }

  for (const message of messages) {
    if (message.role === "tool") {
      payload.push({
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId ?? "",
        name: message.name,
      });
      continue;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      payload.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: message.toolCalls,
      });
      continue;
    }

    payload.push({ role: message.role, content: message.content });
  }

  return payload;
}

function parseNonStreamResult(res: RequestUrlResponse): ChatCompletionResult {
  const fromJson = res.json as OpenAIChatCompletionResponse | null | undefined;

  if (fromJson && typeof fromJson === "object" && Array.isArray(fromJson.choices)) {
    return {
      content: fromJson.choices[0]?.message?.content ?? "",
      toolCalls: fromJson.choices[0]?.message?.tool_calls ?? [],
    };
  }

  try {
    const parsed = JSON.parse(res.text) as OpenAIChatCompletionResponse;
    return {
      content: parsed.choices?.[0]?.message?.content ?? "",
      toolCalls: parsed.choices?.[0]?.message?.tool_calls ?? [],
    };
  } catch {
    return { content: "", toolCalls: [] };
  }
}

async function parseNonStreamResultFromFetch(response: Response): Promise<ChatCompletionResult> {
  const json = (await response.json()) as OpenAIChatCompletionResponse;
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    toolCalls: json.choices?.[0]?.message?.tool_calls ?? [],
  };
}


/** 各家 OpenAI 兼容 /models 响应。 */
interface OpenAIModelListResponse {
  data?: Array<{ id?: string }>;
}

function parseModelIds(payload: OpenAIModelListResponse | null | undefined): string[] {
  const ids = (payload?.data ?? [])
    .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
    .filter((id) => id.length > 0);

  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

export class ChatService {
  private readonly config: ChatClientConfig;

  constructor(config: ChatClientConfig) {
    this.config = {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl),
    };
  }

  static fromSettings(settings: CopilotSettings, providerId: ProviderId, model?: string): ChatService {
    const provider = getProviderById(providerId);
    const apiKey = getProviderApiKey(settings, providerId);

    return new ChatService({
      providerId,
      baseUrl: provider.baseUrl,
      apiKey,
      model: resolveProviderModel(providerId, model ?? settings.defaultModel, settings),
    });
  }

  /** 拉取当前 Key 在服务商 /models 接口下可用的模型 id 列表。 */
  static async listAvailableModels(settings: CopilotSettings, providerId: ProviderId): Promise<string[]> {
    const provider = getProviderById(providerId);
    const apiKey = getProviderApiKey(settings, providerId);

    if (!apiKey.trim()) {
      throw new Error(`请先填写 ${provider.label} 的 API Key。`);
    }

    const url = `${normalizeBaseUrl(provider.baseUrl)}/models`;
    const headers = { Authorization: `Bearer ${apiKey}` };

    if (provider.transport === "requestUrl") {
      const res = await requestUrl({ url, method: "GET", headers, throw: false });

      if (res.status < 200 || res.status >= 300) {
        throw new Error(formatChatCompletionHttpError(res.status, res.text ?? ""));
      }

      return parseModelIds(res.json as OpenAIModelListResponse);
    }

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(formatChatCompletionHttpError(response.status, errorText));
      }

      return parseModelIds(await response.json());
    } catch (error) {
      if (error instanceof TypeError) {
        const res = await requestUrl({ url, method: "GET", headers, throw: false });

        if (res.status < 200 || res.status >= 300) {
          throw new Error(formatChatCompletionHttpError(res.status, res.text ?? ""));
        }

        return parseModelIds(res.json as OpenAIModelListResponse);
      }

      throw error;
    }
  }

  /**
   * 联通测试：用「当前服务商 + 用户选定的具体模型 + 当前 Key」发一个最小 ping 请求，
   * 在正式对话前验证整条链路可用。成功返回耗时与回复摘要。
   */
  static async testConnection(
    settings: CopilotSettings,
    providerId: ProviderId,
    model: string,
  ): Promise<{ latencyMs: number; reply: string }> {
    const provider = getProviderById(providerId);
    const apiKey = getProviderApiKey(settings, providerId);

    if (!apiKey.trim()) {
      throw new Error(`请先填写 ${provider.label} 的 API Key。`);
    }

    if (!model.trim()) {
      throw new Error("请先选择要测试的模型。");
    }

    // 直接使用用户选定的模型 id（不做内置列表回退），确保测的就是将要用的。
    const service = new ChatService({
      providerId,
      baseUrl: provider.baseUrl,
      apiKey,
      model: model.trim(),
    });

    const timeoutSignal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(30_000)
      : undefined;
    const startedAt = Date.now();
    const result = await service.complete({
      messages: [{ role: "user", content: "ping" }],
      temperature: provider.minTemperature,
      maxTokens: 64,
      stream: false,
      signal: timeoutSignal,
    });
    const latencyMs = Date.now() - startedAt;

    // 走到这里说明 HTTP 200：网络、Key、模型名全部验证通过。
    // 推理模型可能把 max_tokens 耗在思考上而正文为空，不视为连通失败。
    return { latencyMs, reply: result.content };
  }

  async complete(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (!this.config.apiKey.trim()) {
      throw new Error("请先配置当前服务商的 API Key（侧边栏模型面板或设置页均可填写）。");
    }

    const provider = getProviderById(this.config.providerId);
    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages: buildMessages(options.messages, options.systemPrompt),
      temperature: clampTemperature(this.config.providerId, options.temperature),
      max_tokens: options.maxTokens,
      stream: options.stream,
    };

    if (options.tools?.length) {
      payload.tools = options.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      payload.tool_choice = "auto";
    }

    if (provider.transport === "requestUrl") {
      return this.completeViaRequestUrl(options, payload);
    }

    return this.completeViaFetch(options, payload);
  }

  private async completeViaRequestUrl(
    options: ChatCompletionOptions,
    payload: Record<string, unknown>,
  ): Promise<ChatCompletionResult> {
    const res = await requestUrl({
      url: `${this.config.baseUrl}/chat/completions`,
      method: "POST",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(payload),
      throw: false,
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(formatChatCompletionHttpError(res.status, res.text ?? ""));
    }

    // requestUrl 会缓冲完整响应：stream 场景是拿到全文后回放 chunk。
    if (options.stream) {
      return parseSseText(res.text, this.config.providerId, options.onChunk);
    }

    return parseNonStreamResult(res);
  }

  private async completeViaFetch(
    options: ChatCompletionOptions,
    payload: Record<string, unknown>,
  ): Promise<ChatCompletionResult> {
    let emitted = false;

    // 监听是否已向 UI 输出过内容：流式中途断开时不能重试，否则会重复输出。
    const guardedChunk = options.onChunk
      ? (chunk: string) => {
          emitted = true;
          options.onChunk?.(chunk);
        }
      : undefined;

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(formatChatCompletionHttpError(response.status, errorText));
      }

      if (options.stream) {
        return await readSseStream(this.config.providerId, response, guardedChunk);
      }

      return await parseNonStreamResultFromFetch(response);
    } catch (error) {
      // TypeError("Failed to fetch")：请求未到达服务器（典型为端点不发 CORS 头，如
      // open.bigmodel.cn 的 /chat/completions）。此时改走 Obsidian requestUrl
      // （主进程发起，不受 CORS 限制）。仅在尚未输出任何内容时降级，避免重复输出。
      if (error instanceof TypeError && !emitted) {
        console.warn(`[Copilot CN Agent] fetch 被拦截（${error.message}），改用 requestUrl 重试`);
        return this.completeViaRequestUrl(options, payload);
      }

      throw error;
    }
  }
}

