export type ProviderId = "minimax" | "kimi" | "glm";

export type ChatRole = "system" | "user" | "assistant";

/** 权限档位：只读 / 每次确认（默认）/ 自动写入。 */
export type AgentWriteMode = "readonly" | "confirm" | "auto";

/** Agent 运行阶段，用于 UI 状态展示。 */
export type AgentPhase = "thinking" | "tool" | "writing" | "idle";

/** 单次工具调用在 UI / 存档中的展示记录。 */
export interface AgentStep {
  id: string;
  toolName: string;
  argsPreview: string;
  status: "running" | "ok" | "error" | "denied";
  resultPreview: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  /** assistant 消息：本条回复前发生的工具调用步骤。 */
  steps?: AgentStep[];
}

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  description: string;
  baseUrl: string;
  models: string[];
  streamMode: "delta" | "cumulative";
  /** kimi 走 requestUrl（绕过 CORS），其余走 fetch。 */
  transport: "fetch" | "requestUrl";
  minTemperature: number;
  maxTemperature: number;
  apiKeySettingKey: keyof Pick<CopilotSettings, "minimaxApiKey" | "kimiApiKey" | "glmApiKey">;
}

export interface CopilotSettings {
  minimaxApiKey: string;
  kimiApiKey: string;
  glmApiKey: string;
  persistApiKeysLocally: boolean;
  defaultProvider: ProviderId;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  autoSaveHistory: boolean;
  streamResponses: boolean;
  /** When true, each send appends an excerpt of the active note to the user message (sent to the LLM). */
  includeActiveNoteContext: boolean;
  /** Max characters of the active note body sent as context (after truncation). */
  activeNoteContextMaxChars: number;
  /** Vault-relative folder for JSON conversation saves (opaque filenames). */
  conversationStorageFolder: string;
  /** Vault-relative folder for Markdown exports. */
  exportMarkdownFolder: string;
  // ---- Agent ----
  /** 是否向模型提供 vault 工具（关闭则退化为纯聊天）。 */
  enableAgentTools: boolean;
  /** 写入类工具的权限档位。 */
  agentWriteMode: AgentWriteMode;
  /** 单次回复中最多进行多少轮工具调用。 */
  maxToolRounds: number;
  /** read_note 工具单次读取的最大字符数。 */
  readNoteMaxChars: number;
  /** 通过「获取模型列表」从各家 API 拉取的模型（覆盖内置列表；空数组=用内置）。 */
  customModels: Record<ProviderId, string[]>;
}

export interface ConversationRecord {
  id: string;
  title: string;
  providerId: ProviderId;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/* ---- LLM 请求 / 响应（OpenAI 兼容 function calling） ---- */

/** wire 格式的工具调用。 */
export interface ApiToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** 内部消息表示；发送前由 ChatService 映射为各服务商 wire 格式。 */
export interface ChatRequestMessage {
  role: ChatRole | "tool";
  content: string;
  /** role === "assistant" 且发生了工具调用时存在。 */
  toolCalls?: ApiToolCall[];
  /** role === "tool" 时对应的调用 id 与工具名。 */
  toolCallId?: string;
  name?: string;
}

/** 提供给模型的工具定义（JSON Schema 参数）。 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ChatCompletionOptions {
  messages: ChatRequestMessage[];
  systemPrompt?: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
}

export interface ChatCompletionResult {
  content: string;
  toolCalls: ApiToolCall[];
}

export interface ChatClientConfig {
  providerId: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ViewControllerCallbacks {
  onPrefill: (value: string, options?: { attachActiveNote?: boolean }) => void;
  onNewChat: () => void;
}
