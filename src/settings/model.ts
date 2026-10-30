import { CONVERSATION_FOLDER, DEFAULT_SETTINGS, EXPORT_MARKDOWN_FOLDER, PROVIDERS } from "@/constants";
import type { AgentWriteMode, CopilotSettings, ProviderDefinition, ProviderId } from "@/types";
import { normalizeVaultRelativeFolder } from "@/utils/vault-path";
import type { Plugin } from "obsidian";

const AGENT_WRITE_MODES: AgentWriteMode[] = ["readonly", "confirm", "auto"];

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.some((provider) => provider.id === value);
}

export function getProviderDefinition(providerId: ProviderId): ProviderDefinition {
  const provider = PROVIDERS.find((item) => item.id === providerId);

  if (!provider) {
    return PROVIDERS[0];
  }

  return provider;
}

/** 可用模型列表：API 拉取的自定义列表优先，否则用内置列表。 */
export function getModelsForProvider(providerId: ProviderId, settings?: Pick<CopilotSettings, "customModels">): string[] {
  const custom = settings?.customModels?.[providerId] ?? [];

  if (custom.length) {
    return custom;
  }

  return getProviderDefinition(providerId).models;
}

export function getDefaultModelForProvider(
  providerId: ProviderId,
  settings?: Pick<CopilotSettings, "customModels">,
): string {
  return getModelsForProvider(providerId, settings)[0];
}

export function resolveKnownModelForProvider(
  providerId: ProviderId,
  candidate?: string,
  availableModels?: string[],
): string | null {
  if (!candidate?.trim()) {
    return null;
  }

  const models = availableModels?.length ? availableModels : getModelsForProvider(providerId);
  const exactMatch = models.find((model) => model === candidate);

  if (exactMatch) {
    return exactMatch;
  }

  const normalizedCandidate = candidate.trim().toLowerCase();
  return models.find((model) => model.toLowerCase() === normalizedCandidate) ?? null;
}

export function applyProviderToSettings(settings: CopilotSettings, providerId: ProviderId): CopilotSettings {
  const nextModel =
    resolveKnownModelForProvider(providerId, settings.defaultModel, settings.customModels?.[providerId]) ??
    getDefaultModelForProvider(providerId, settings);

  return {
    ...settings,
    defaultProvider: providerId,
    defaultModel: nextModel,
  };
}

function sanitizeCustomModels(value: unknown): Record<ProviderId, string[]> {
  const result = { minimax: [], kimi: [], glm: [] } as Record<ProviderId, string[]>;

  if (!value || typeof value !== "object") {
    return result;
  }

  for (const provider of PROVIDERS) {
    const list = (value as Record<string, unknown>)[provider.id];

    if (!Array.isArray(list)) {
      continue;
    }

    result[provider.id] = [
      ...new Set(
        list
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim()),
      ),
    ].slice(0, 50);
  }

  return result;
}

function sanitizeAgentWriteMode(value: unknown): AgentWriteMode {
  return AGENT_WRITE_MODES.includes(value as AgentWriteMode)
    ? (value as AgentWriteMode)
    : DEFAULT_SETTINGS.agentWriteMode;
}

export function sanitizeSettings(data?: Partial<CopilotSettings> | null): CopilotSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...data,
  };

  const defaultProvider = isProviderId(merged.defaultProvider)
    ? merged.defaultProvider
    : DEFAULT_SETTINGS.defaultProvider;

  const customModels = sanitizeCustomModels(merged.customModels);
  const availableForDefault = customModels[defaultProvider];
  const defaultModel =
    resolveKnownModelForProvider(defaultProvider, merged.defaultModel, availableForDefault) ??
    getDefaultModelForProvider(defaultProvider, { customModels });

  return {
    minimaxApiKey: merged.minimaxApiKey ?? "",
    kimiApiKey: merged.kimiApiKey ?? "",
    glmApiKey: merged.glmApiKey ?? "",
    persistApiKeysLocally: merged.persistApiKeysLocally ?? DEFAULT_SETTINGS.persistApiKeysLocally,
    defaultProvider,
    defaultModel,
    temperature: clamp(merged.temperature, 0, 2, DEFAULT_SETTINGS.temperature),
    maxTokens: clamp(merged.maxTokens, 256, 16384, DEFAULT_SETTINGS.maxTokens),
    systemPrompt: merged.systemPrompt?.trim() || DEFAULT_SETTINGS.systemPrompt,
    autoSaveHistory: merged.autoSaveHistory ?? DEFAULT_SETTINGS.autoSaveHistory,
    streamResponses: merged.streamResponses ?? DEFAULT_SETTINGS.streamResponses,
    includeActiveNoteContext: merged.includeActiveNoteContext ?? DEFAULT_SETTINGS.includeActiveNoteContext,
    activeNoteContextMaxChars: clamp(
      merged.activeNoteContextMaxChars ?? DEFAULT_SETTINGS.activeNoteContextMaxChars,
      2000,
      50_000,
      DEFAULT_SETTINGS.activeNoteContextMaxChars,
    ),
    conversationStorageFolder: normalizeVaultRelativeFolder(
      merged.conversationStorageFolder,
      CONVERSATION_FOLDER,
    ),
    exportMarkdownFolder: normalizeVaultRelativeFolder(merged.exportMarkdownFolder, EXPORT_MARKDOWN_FOLDER),
    customModels,
    enableAgentTools: merged.enableAgentTools ?? DEFAULT_SETTINGS.enableAgentTools,
    agentWriteMode: sanitizeAgentWriteMode(merged.agentWriteMode),
    maxToolRounds: clamp(merged.maxToolRounds ?? DEFAULT_SETTINGS.maxToolRounds, 1, 10, DEFAULT_SETTINGS.maxToolRounds),
    readNoteMaxChars: clamp(
      merged.readNoteMaxChars ?? DEFAULT_SETTINGS.readNoteMaxChars,
      2000,
      100_000,
      DEFAULT_SETTINGS.readNoteMaxChars,
    ),
  };
}

export function serializeSettingsForStorage(settings: CopilotSettings): CopilotSettings {
  const sanitized = sanitizeSettings(settings);

  if (sanitized.persistApiKeysLocally) {
    return sanitized;
  }

  return {
    ...sanitized,
    minimaxApiKey: "",
    kimiApiKey: "",
    glmApiKey: "",
  };
}

export function shouldScrubPersistedApiKeys(data?: Partial<CopilotSettings> | null): boolean {
  if (!data) {
    return false;
  }

  const persistApiKeysLocally = data.persistApiKeysLocally ?? DEFAULT_SETTINGS.persistApiKeysLocally;

  if (persistApiKeysLocally) {
    return false;
  }

  return Boolean(data.minimaxApiKey || data.kimiApiKey || data.glmApiKey);
}

export async function loadPluginSettings(plugin: Plugin): Promise<CopilotSettings> {
  const raw = (await plugin.loadData()) as Partial<CopilotSettings> | null;
  const sanitized = sanitizeSettings(raw);

  if (shouldScrubPersistedApiKeys(raw)) {
    await plugin.saveData(serializeSettingsForStorage(sanitized));
  }

  return serializeSettingsForStorage(sanitized).persistApiKeysLocally
    ? sanitized
    : {
        ...sanitized,
        minimaxApiKey: "",
        kimiApiKey: "",
        glmApiKey: "",
      };
}

export async function persistPluginSettings(plugin: Plugin, settings: CopilotSettings): Promise<void> {
  await plugin.saveData(serializeSettingsForStorage(settings));
}
