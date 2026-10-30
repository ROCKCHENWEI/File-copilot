import { LEGACY_PLUGIN_ID } from "@/constants";
import { sanitizeSettings } from "@/settings/model";
import type { CopilotSettings } from "@/types";
import type { App } from "obsidian";

/** 旧版 v0.1.x data.json 中可识别的字段（多余的忽略）。 */
interface LegacySettingsShape {
  minimaxApiKey?: unknown;
  kimiApiKey?: unknown;
  glmApiKey?: unknown;
  persistApiKeysLocally?: unknown;
  defaultProvider?: unknown;
  defaultModel?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  systemPrompt?: unknown;
  autoSaveHistory?: unknown;
  streamResponses?: unknown;
  includeActiveNoteContext?: unknown;
  activeNoteContextMaxChars?: unknown;
  conversationStorageFolder?: unknown;
  exportMarkdownFolder?: unknown;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pickBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** 读取旧版插件的 data.json（只读，绝不写旧插件数据）。 */
export async function readLegacySettings(app: App): Promise<Partial<CopilotSettings> | null> {
  const configDir = (app.vault as unknown as { configDir?: string }).configDir ?? ".obsidian";
  const legacyPath = `${configDir}/plugins/${LEGACY_PLUGIN_ID}/data.json`;
  const adapter = app.vault.adapter;

  try {
    if (!(await adapter.exists(legacyPath))) {
      return null;
    }

    const raw = await adapter.read(legacyPath);
    const parsed = JSON.parse(raw) as LegacySettingsShape;

    return {
      minimaxApiKey: pickString(parsed.minimaxApiKey) ?? "",
      kimiApiKey: pickString(parsed.kimiApiKey) ?? "",
      glmApiKey: pickString(parsed.glmApiKey) ?? "",
      // 旧版若明文保存了 Key，迁移后保持明文保存，否则 Key 会话内即失。
      persistApiKeysLocally: pickBoolean(parsed.persistApiKeysLocally) ?? false,
      defaultProvider: pickString(parsed.defaultProvider) as CopilotSettings["defaultProvider"] | undefined,
      defaultModel: pickString(parsed.defaultModel),
      temperature: pickNumber(parsed.temperature),
      maxTokens: pickNumber(parsed.maxTokens),
      systemPrompt: pickString(parsed.systemPrompt),
      autoSaveHistory: pickBoolean(parsed.autoSaveHistory),
      streamResponses: pickBoolean(parsed.streamResponses),
      includeActiveNoteContext: pickBoolean(parsed.includeActiveNoteContext),
      activeNoteContextMaxChars: pickNumber(parsed.activeNoteContextMaxChars),
      conversationStorageFolder: pickString(parsed.conversationStorageFolder),
      exportMarkdownFolder: pickString(parsed.exportMarkdownFolder),
    };
  } catch (error) {
    console.warn(`[Copilot CN Agent] 读取旧版配置失败：${legacyPath}`, error);
    return null;
  }
}

/** 读取并规整旧版配置；无可迁移内容时返回 null。 */
export async function importLegacySettings(app: App): Promise<CopilotSettings | null> {
  const legacy = await readLegacySettings(app);

  if (!legacy) {
    return null;
  }

  return sanitizeSettings(legacy);
}
