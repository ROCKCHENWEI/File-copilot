import { importLegacySettings, readLegacySettings } from "@/settings/migrate";
import { DEFAULT_SETTINGS } from "@/constants";
import type { App } from "obsidian";

function buildApp(legacyData: string | null): App {
  return {
    vault: {
      configDir: ".obsidian",
      adapter: {
        exists: async (path: string) => path === ".obsidian/plugins/copilot-cn/data.json" && legacyData != null,
        read: async () => legacyData ?? "",
      },
    },
  } as unknown as App;
}

const LEGACY_JSON = JSON.stringify({
  minimaxApiKey: "mm-key",
  kimiApiKey: "kimi-key",
  glmApiKey: "glm-key",
  persistApiKeysLocally: true,
  defaultProvider: "glm",
  defaultModel: "glm-5.1",
  temperature: 0.7,
  maxTokens: 8192,
  systemPrompt: "旧提示词",
  autoSaveHistory: false,
  streamResponses: true,
  includeActiveNoteContext: false,
  activeNoteContextMaxChars: 12000,
  conversationStorageFolder: "copilot-cn/conversations",
  exportMarkdownFolder: "copilot-cn/exports",
  someUnknownField: "ignored",
});

describe("readLegacySettings", () => {
  it("reads and maps known fields from the legacy data.json", async () => {
    const legacy = await readLegacySettings(buildApp(LEGACY_JSON));

    expect(legacy).not.toBeNull();
    expect(legacy?.glmApiKey).toBe("glm-key");
    expect(legacy?.persistApiKeysLocally).toBe(true);
    expect(legacy?.conversationStorageFolder).toBe("copilot-cn/conversations");
    expect(Object.keys(legacy ?? {})).not.toContain("someUnknownField");
  });

  it("returns null when the legacy file is absent", async () => {
    expect(await readLegacySettings(buildApp(null))).toBeNull();
  });

  it("returns null on broken JSON without throwing", async () => {
    expect(await readLegacySettings(buildApp("{broken"))).toBeNull();
  });
});

describe("importLegacySettings", () => {
  it("sanitizes into full settings with agent defaults filled in", async () => {
    const imported = await importLegacySettings(buildApp(LEGACY_JSON));

    expect(imported).not.toBeNull();
    expect(imported?.defaultProvider).toBe("glm");
    expect(imported?.glmApiKey).toBe("glm-key");
    expect(imported?.enableAgentTools).toBe(DEFAULT_SETTINGS.enableAgentTools);
    expect(imported?.agentWriteMode).toBe(DEFAULT_SETTINGS.agentWriteMode);
    expect(imported?.maxToolRounds).toBe(DEFAULT_SETTINGS.maxToolRounds);
  });

  it("falls back to defaults for an empty legacy object", async () => {
    const imported = await importLegacySettings(buildApp("{}"));

    expect(imported?.defaultProvider).toBe(DEFAULT_SETTINGS.defaultProvider);
    expect(imported?.minimaxApiKey).toBe("");
  });
});
