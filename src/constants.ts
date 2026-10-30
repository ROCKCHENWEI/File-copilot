import type { CopilotSettings, ProviderDefinition } from "@/types";

export const PLUGIN_ID = "copilot-agent-cn";
export const PLUGIN_NAME = "Copilot CN Agent (MiniMax/Kimi/GLM)";
export const VIEW_TYPE_COPILOT = "copilot-agent-cn-view";
export const CONVERSATION_FOLDER = "copilot-agent/conversations";
export const EXPORT_MARKDOWN_FOLDER = "copilot-agent/exports";
export const DEFAULT_CONVERSATION_TITLE = "未命名对话";
/** 旧版插件目录：首次启动时从中导入设置与 API Key。 */
export const LEGACY_PLUGIN_ID = "copilot-cn";

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "minimax",
    label: "MiniMax",
    description: "MiniMax 官方 API",
    baseUrl: "https://api.minimax.io/v1",
    models: ["MiniMax-M2.7", "MiniMax-M2.5", "MiniMax-M2.1", "MiniMax-M2.5-highspeed"],
    streamMode: "cumulative",
    transport: "fetch",
    minTemperature: 0.01,
    maxTemperature: 1,
    apiKeySettingKey: "minimaxApiKey",
  },
  {
    id: "kimi",
    label: "Kimi",
    description: "Kimi Code Plan（OpenAI 兼容）",
    baseUrl: "https://api.kimi.com/coding/v1",
    models: ["kimi-for-coding", "kimi-k2.5", "kimi-k2-0905-preview", "kimi-k2-turbo-preview"],
    streamMode: "delta",
    transport: "requestUrl",
    minTemperature: 0,
    maxTemperature: 1,
    apiKeySettingKey: "kimiApiKey",
  },
  {
    id: "glm",
    label: "GLM",
    description: "智谱 AI BigModel Coding Plan API",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    models: ["glm-5.2", "glm-5.1", "glm-4.7", "glm-5-turbo", "glm-4.5-air"],
    streamMode: "delta",
    transport: "fetch",
    minTemperature: 0,
    maxTemperature: 1,
    apiKeySettingKey: "glmApiKey",
  },
];

export const DEFAULT_AGENT_SYSTEM_PROMPT =
  "你是 Obsidian 中的中文工作助理。请优先用中文回答，回答要清晰、务实、结构化，并尽量结合用户当前笔记场景。";

export const DEFAULT_SETTINGS: CopilotSettings = {
  minimaxApiKey: "",
  kimiApiKey: "",
  glmApiKey: "",
  persistApiKeysLocally: false,
  defaultProvider: "kimi",
  defaultModel: "kimi-for-coding",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT,
  autoSaveHistory: false,
  streamResponses: true,
  includeActiveNoteContext: false,
  activeNoteContextMaxChars: 12_000,
  conversationStorageFolder: CONVERSATION_FOLDER,
  exportMarkdownFolder: EXPORT_MARKDOWN_FOLDER,
  enableAgentTools: true,
  agentWriteMode: "confirm",
  maxToolRounds: 6,
  readNoteMaxChars: 20_000,
  customModels: { minimax: [], kimi: [], glm: [] },
};

/** 工具结果回传给模型前的截断上限（避免上下文爆炸）。 */
export const TOOL_RESULT_MAX_CHARS = 6000;

/** 各工具的展示名（UI 与导出用）。 */
export const TOOL_LABELS: Record<string, string> = {
  search_notes: "搜索笔记",
  read_note: "读取笔记",
  list_recent_notes: "最近笔记",
  create_note: "新建笔记",
  append_note: "追加内容",
  replace_note_content: "改写笔记",
};
