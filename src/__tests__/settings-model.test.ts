import { DEFAULT_SETTINGS } from "@/constants";
import {
  applyProviderToSettings,
  getModelsForProvider,
  loadPluginSettings,
  sanitizeSettings,
  serializeSettingsForStorage,
  shouldScrubPersistedApiKeys,
} from "@/settings/model";

describe("sanitizeSettings", () => {
  it("falls back to default provider and model when values are invalid", () => {
    const settings = sanitizeSettings({
      defaultProvider: "invalid" as never,
      defaultModel: "unknown",
      temperature: 10,
      maxTokens: 999999,
    });

    expect(settings.defaultProvider).toBe(DEFAULT_SETTINGS.defaultProvider);
    expect(settings.defaultModel).toBe(DEFAULT_SETTINGS.defaultModel);
    expect(settings.temperature).toBe(2);
    expect(settings.maxTokens).toBe(16384);
    expect(settings.includeActiveNoteContext).toBe(false);
  });

  it("keeps a valid provider and swaps to the provider default model when needed", () => {
    const settings = sanitizeSettings({
      defaultProvider: "glm",
      defaultModel: "kimi-k2.5",
    });

    expect(settings.defaultProvider).toBe("glm");
    expect(settings.defaultModel).toBe("glm-5.2");
  });

  it("normalizes GLM model casing to canonical ids", () => {
    const settings = sanitizeSettings({
      defaultProvider: "glm",
      defaultModel: "GLM-5.1",
    });

    expect(settings.defaultModel).toBe("glm-5.1");
  });

  it("reverts unsafe storage paths to defaults", () => {
    const settings = sanitizeSettings({
      conversationStorageFolder: "evil/../../../tmp",
      exportMarkdownFolder: "/absolute",
    });

    expect(settings.conversationStorageFolder).toBe(DEFAULT_SETTINGS.conversationStorageFolder);
    expect(settings.exportMarkdownFolder).toBe(DEFAULT_SETTINGS.exportMarkdownFolder);
  });

  it("clamps active note context max chars", () => {
    expect(sanitizeSettings({ activeNoteContextMaxChars: 100 }).activeNoteContextMaxChars).toBe(2000);
    expect(sanitizeSettings({ activeNoteContextMaxChars: 999_999 }).activeNoteContextMaxChars).toBe(50_000);
  });
});

describe("applyProviderToSettings", () => {
  it("updates provider and switches model when current model does not belong to that provider", () => {
    const next = applyProviderToSettings(DEFAULT_SETTINGS, "minimax");

    expect(next.defaultProvider).toBe("minimax");
    expect(next.defaultModel).toBe("MiniMax-M2.7");
  });
});

describe("serializeSettingsForStorage", () => {
  it("removes API keys from persisted data when local persistence is disabled", () => {
    const persisted = serializeSettingsForStorage({
      ...DEFAULT_SETTINGS,
      minimaxApiKey: "minimax-secret",
      kimiApiKey: "kimi-secret",
      glmApiKey: "glm-secret",
      persistApiKeysLocally: false,
    });

    expect(persisted.minimaxApiKey).toBe("");
    expect(persisted.kimiApiKey).toBe("");
    expect(persisted.glmApiKey).toBe("");
  });

  it("keeps API keys when local persistence is explicitly enabled", () => {
    const persisted = serializeSettingsForStorage({
      ...DEFAULT_SETTINGS,
      kimiApiKey: "kimi-secret",
      persistApiKeysLocally: true,
    });

    expect(persisted.kimiApiKey).toBe("kimi-secret");
  });
});

describe("shouldScrubPersistedApiKeys", () => {
  it("returns true when legacy plaintext keys exist while local persistence is disabled", () => {
    expect(
      shouldScrubPersistedApiKeys({
        kimiApiKey: "legacy-key",
        persistApiKeysLocally: false,
      }),
    ).toBe(true);
  });

  it("returns false when local persistence is enabled", () => {
    expect(
      shouldScrubPersistedApiKeys({
        kimiApiKey: "legacy-key",
        persistApiKeysLocally: true,
      }),
    ).toBe(false);
  });
});

describe("loadPluginSettings", () => {
  it("scrubs legacy persisted API keys on load when local persistence is disabled", async () => {
    const saveData = vi.fn().mockResolvedValue(undefined);
    const plugin = {
      loadData: vi.fn().mockResolvedValue({
        kimiApiKey: "legacy-key",
        persistApiKeysLocally: false,
      }),
      saveData,
    } as never;

    const settings = await loadPluginSettings(plugin);

    expect(settings.kimiApiKey).toBe("");
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(saveData).toHaveBeenCalledWith(
      expect.objectContaining({
        kimiApiKey: "",
      }),
    );
  });
});

describe("agent settings sanitization", () => {
  it("fills agent defaults for legacy-shaped data", () => {
    const settings = sanitizeSettings({});

    expect(settings.enableAgentTools).toBe(DEFAULT_SETTINGS.enableAgentTools);
    expect(settings.agentWriteMode).toBe(DEFAULT_SETTINGS.agentWriteMode);
    expect(settings.maxToolRounds).toBe(DEFAULT_SETTINGS.maxToolRounds);
    expect(settings.readNoteMaxChars).toBe(DEFAULT_SETTINGS.readNoteMaxChars);
  });

  it("clamps maxToolRounds and readNoteMaxChars", () => {
    expect(sanitizeSettings({ maxToolRounds: 99 }).maxToolRounds).toBe(10);
    expect(sanitizeSettings({ maxToolRounds: 0 }).maxToolRounds).toBe(1);
    expect(sanitizeSettings({ readNoteMaxChars: 10 }).readNoteMaxChars).toBe(2000);
    expect(sanitizeSettings({ readNoteMaxChars: 999_999 }).readNoteMaxChars).toBe(100_000);
  });

  it("falls back to confirm mode for invalid write modes", () => {
    expect(sanitizeSettings({ agentWriteMode: "yolo" as never }).agentWriteMode).toBe("confirm");
    expect(sanitizeSettings({ agentWriteMode: "readonly" }).agentWriteMode).toBe("readonly");
  });
});

describe("custom models", () => {
  it("sanitizes custom model lists (trims, dedupes, drops junk, caps at 50)", () => {
    const junk = Array.from({ length: 60 }, (_, i) => `model-${i}`);
    const settings = sanitizeSettings({
      customModels: { kimi: [" a ", "a", "", 42, ...junk], glm: "not-an-array", minimax: undefined } as never,
    });

    expect(settings.customModels.kimi).toHaveLength(50);
    expect(settings.customModels.kimi[0]).toBe("a");
    expect(settings.customModels.kimi).not.toContain("");
    expect(settings.customModels.glm).toEqual([]);
    expect(settings.customModels.minimax).toEqual([]);
  });

  it("getModelsForProvider prefers the custom list and falls back to built-ins", () => {
    const settings = sanitizeSettings({
      customModels: { kimi: ["kimi-custom-1"] } as never,
    });

    expect(getModelsForProvider("kimi", settings)).toEqual(["kimi-custom-1"]);
    expect(getModelsForProvider("glm", settings)).toEqual(getModelsForProvider("glm"));
  });

  it("resolves defaultModel against the custom list when present", () => {
    const settings = sanitizeSettings({
      defaultProvider: "kimi",
      defaultModel: "kimi-custom-1",
      customModels: { kimi: ["kimi-custom-1", "kimi-custom-2"] } as never,
    });

    expect(settings.defaultModel).toBe("kimi-custom-1");

    const swapped = sanitizeSettings({
      defaultProvider: "kimi",
      defaultModel: "kimi-for-coding",
      customModels: { kimi: ["kimi-custom-1"] } as never,
    });
    expect(swapped.defaultModel).toBe("kimi-custom-1");
  });
});
