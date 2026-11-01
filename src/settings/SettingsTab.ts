import { PROVIDERS } from "@/constants";
import type CopilotPlugin from "@/main";
import { ChatService } from "@/llm/ChatService";
import { applyProviderToSettings, getDefaultModelForProvider, getModelsForProvider } from "@/settings/model";
import { importLegacySettings } from "@/settings/migrate";
import type { AgentWriteMode, CopilotSettings, ProviderId } from "@/types";
import { Notice, PluginSettingTab, Setting, type App } from "obsidian";

const WRITE_MODE_LABELS: Record<AgentWriteMode, string> = {
  readonly: "只读（禁止任何写入）",
  confirm: "每次写入前确认（推荐）",
  auto: "自动写入（仅 Notice 提示）",
};

export class CopilotSettingTab extends PluginSettingTab {
  plugin: CopilotPlugin;

  constructor(app: App, plugin: CopilotPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "File Copilot 设置（MiniMax/Kimi/GLM）" });

    containerEl.createEl("p", {
      text: "Obsidian 内的工作 Agent 助理：对话之外可检索、读取、创建与整理笔记。配置服务商 API Key 与 Agent 权限。",
    });

    this.renderSecuritySettings();
    this.renderApiKeySettings();
    this.renderAgentSettings();
    this.renderModelSettings();
    this.renderBehaviorSettings();
    this.renderVaultPathsSettings();
  }

  private updateSettings(patch: Partial<CopilotSettings>, redraw = false): void {
    this.plugin.settings = { ...this.plugin.settings, ...patch };
    void this.plugin.saveSettings();

    if (redraw) {
      this.display();
    }
  }

  private renderSecuritySettings(): void {
    const { containerEl } = this;

    containerEl.createEl("h3", { text: "安全与隐私" });
    containerEl.createEl("p", {
      text: "默认情况下，API Key 仅保留在当前会话内，不会写入本地插件数据；自动保存对话默认关闭，避免把聊天内容以 JSON 明文写入 vault。",
    });

    new Setting(containerEl)
      .setName("本地保存 API Key（明文）")
      .setDesc("开启后会将 API Key 明文保存到 Obsidian 插件数据中；关闭后仅当前会话有效，重启后需要重新输入。")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.persistApiKeysLocally).onChange(async (value) => {
          if (value && !window.confirm("开启后，API Key 会以明文形式保存在本地插件数据中。确定继续吗？")) {
            toggle.setValue(false);
            return;
          }

          this.updateSettings({ persistApiKeysLocally: value });
          new Notice(
            value
              ? "后续会把 API Key 持久化到本地插件数据"
              : "已切换为仅当前会话保留 API Key，本地持久化内容会被清空",
          );
        });
      });
  }

  private renderApiKeySettings(): void {
    const { containerEl } = this;

    containerEl.createEl("h3", { text: "API Key 配置" });

    for (const provider of PROVIDERS) {
      const setting = new Setting(containerEl)
        .setName(`${provider.label} API Key`)
        .setDesc(provider.description)
        .addText((text) => {
          text
            .setPlaceholder(`输入 ${provider.label} API Key`)
            .setValue(this.plugin.settings[provider.apiKeySettingKey])
            .onChange(async (value) => {
              this.updateSettings({ [provider.apiKeySettingKey]: value.trim() });

              if (!this.plugin.settings.persistApiKeysLocally && value.trim()) {
                new Notice("当前 API Key 仅保留在本次会话中，重启 Obsidian 后需要重新输入。");
              }
            });

          text.inputEl.type = "password";
        });

      setting.addButton((button) => {
        button.setButtonText("测试连接").onClick(async () => {
          await this.testProviderConnection(provider.id, button);
        });
      });
    }
  }

  private async testProviderConnection(providerId: ProviderId, button: import("obsidian").ButtonComponent): Promise<void> {
    const provider = PROVIDERS.find((item) => item.id === providerId);

    if (!provider) {
      return;
    }

    const apiKey = this.plugin.settings[provider.apiKeySettingKey];

    if (!apiKey.trim()) {
      new Notice(`${provider.label} API Key 尚未配置`);
      return;
    }

    button.setDisabled(true).setButtonText("测试中…");

    try {
      const model = getDefaultModelForProvider(providerId, this.plugin.settings);
      const { latencyMs } = await ChatService.testConnection(this.plugin.settings, providerId, model);
      new Notice(`${provider.label} 连接成功（${model}，${(latencyMs / 1000).toFixed(1)}s）`);
    } catch (error) {
      new Notice(`${provider.label} 连接失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      button.setDisabled(false).setButtonText("测试连接");
    }
  }

  private renderAgentSettings(): void {
    const { containerEl } = this;

    containerEl.createEl("h3", { text: "Agent 工具与权限" });
    containerEl.createEl("p", {
      text: "开启后，模型可调用工具检索/读取/写入笔记库。写入类操作受下方权限档位约束。",
    });

    new Setting(containerEl)
      .setName("启用笔记库工具")
      .setDesc("关闭则退化为纯聊天模式，模型无法访问笔记库。")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enableAgentTools).onChange((value) => {
          this.updateSettings({ enableAgentTools: value });
        });
      });

    new Setting(containerEl)
      .setName("写入权限")
      .setDesc("新建/追加/改写笔记前的审批方式。")
      .addDropdown((dropdown) => {
        for (const [mode, label] of Object.entries(WRITE_MODE_LABELS) as Array<[AgentWriteMode, string]>) {
          dropdown.addOption(mode, label);
        }

        dropdown.setValue(this.plugin.settings.agentWriteMode).onChange(async (value) => {
          const nextMode = value as AgentWriteMode;

          if (nextMode === "auto" && !window.confirm("自动写入模式下，Agent 新建/改写笔记不再逐次确认，仅弹 Notice 提示。确定继续吗？")) {
            dropdown.setValue(this.plugin.settings.agentWriteMode);
            return;
          }

          this.updateSettings({ agentWriteMode: nextMode });
        });
      });

    new Setting(containerEl)
      .setName("最大工具轮数")
      .setDesc("单次回复中最多进行多少轮工具调用（1-10）。")
      .addSlider((slider) => {
        slider
          .setLimits(1, 10, 1)
          .setValue(this.plugin.settings.maxToolRounds)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.updateSettings({ maxToolRounds: value });
          });
      });

    new Setting(containerEl)
      .setName("read_note 截断上限（字符）")
      .setDesc("单篇笔记读取后发给模型的最大字符数。")
      .addText((text) => {
        text
          .setPlaceholder("20000")
          .setValue(String(this.plugin.settings.readNoteMaxChars))
          .onChange(async (value) => {
            const parsed = Number(value);

            if (!Number.isNaN(parsed)) {
              this.updateSettings({ readNoteMaxChars: parsed });
            }
          });
      });
  }

  private renderModelSettings(): void {
    const { containerEl } = this;

    containerEl.createEl("h3", { text: "默认模型" });

    new Setting(containerEl)
      .setName("默认服务商")
      .setDesc("新对话默认使用的模型服务商")
      .addDropdown((dropdown) => {
        for (const provider of PROVIDERS) {
          dropdown.addOption(provider.id, provider.label);
        }

        dropdown.setValue(this.plugin.settings.defaultProvider).onChange(async (value) => {
          this.updateSettings(applyProviderToSettings(this.plugin.settings, value as ProviderId), true);
        });
      });

    new Setting(containerEl)
      .setName("默认模型")
      .setDesc("发送消息时默认选中的模型")
      .addDropdown((dropdown) => {
        const models = getModelsForProvider(this.plugin.settings.defaultProvider, this.plugin.settings);

        for (const model of models) {
          dropdown.addOption(model, model);
        }

        dropdown.setValue(this.plugin.settings.defaultModel).onChange(async (value) => {
          this.updateSettings({
            defaultModel: value || getDefaultModelForProvider(this.plugin.settings.defaultProvider),
          });
        });
      });
  }

  private renderBehaviorSettings(): void {
    const { containerEl } = this;

    containerEl.createEl("h3", { text: "聊天参数" });

    new Setting(containerEl)
      .setName("温度")
      .setDesc("值越高越发散，值越低越稳定")
      .addSlider((slider) => {
        const currentProvider = PROVIDERS.find((provider) => provider.id === this.plugin.settings.defaultProvider);
        const min = currentProvider?.minTemperature ?? 0;
        const max = currentProvider?.maxTemperature ?? 1;

        slider
          .setLimits(min, max, 0.1)
          .setValue(this.plugin.settings.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.updateSettings({ temperature: value });
          });
      });

    new Setting(containerEl)
      .setName("最大输出 Token")
      .setDesc("控制单次回复的最大输出长度")
      .addText((text) => {
        text
          .setPlaceholder("4096")
          .setValue(String(this.plugin.settings.maxTokens))
          .onChange(async (value) => {
            const parsed = Number(value);

            if (!Number.isNaN(parsed)) {
              this.updateSettings({ maxTokens: parsed });
            }
          });
      });

    new Setting(containerEl)
      .setName("自动保存对话")
      .setDesc("开启后，每次对话后会将聊天内容以 JSON 明文保存到 vault")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.autoSaveHistory).onChange(async (value) => {
          if (value && !window.confirm("开启后，聊天内容会以 JSON 明文保存到 vault 中，可能被同步、备份或纳入版本控制。确定继续吗？")) {
            toggle.setValue(false);
            return;
          }

          this.updateSettings({ autoSaveHistory: value });
        });
      });

    new Setting(containerEl)
      .setName("流式输出")
      .setDesc("逐字显示模型回复")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.streamResponses).onChange(async (value) => {
          this.updateSettings({ streamResponses: value });
        });
      });

    new Setting(containerEl)
      .setName("活动笔记摘录上限（字符）")
      .setDesc("仅在开启「附带当前活动笔记」时生效；过大可能消耗更多 token。")
      .addText((text) => {
        text
          .setPlaceholder("12000")
          .setValue(String(this.plugin.settings.activeNoteContextMaxChars))
          .onChange(async (value) => {
            const parsed = Number(value);

            if (!Number.isNaN(parsed)) {
              this.updateSettings({ activeNoteContextMaxChars: parsed });
            }
          });
      });

    new Setting(containerEl)
      .setName("附带当前活动笔记")
      .setDesc(
        "开启后，每次发送会在用户消息末尾附加当前活动笔记的正文摘录（长度受上方「摘录上限」约束），并一并发送给大模型；也可在输入框用「@当前笔记」按对话临时开关。无活动文件或读取失败则不会附加。",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.includeActiveNoteContext).onChange(async (value) => {
          if (value && !window.confirm("开启后，笔记正文摘录会随你的提问一并发送到所选的大模型服务商。若笔记含敏感信息，请勿开启。确定继续吗？")) {
            toggle.setValue(false);
            return;
          }

          this.updateSettings({ includeActiveNoteContext: value });
        });
      });

    new Setting(containerEl)
      .setName("系统提示词")
      .setDesc("应用到每次对话的全局指令；Agent 模式下会自动附加工具使用规范。")
      .addTextArea((text) => {
        text
          .setPlaceholder("输入系统提示词")
          .setValue(this.plugin.settings.systemPrompt)
          .onChange(async (value) => {
            this.updateSettings({ systemPrompt: value });
          });

        text.inputEl.rows = 6;
        text.inputEl.cols = 40;
      });
  }

  private renderVaultPathsSettings(): void {
    const { containerEl } = this;

    containerEl.createEl("h3", { text: "Vault 存储路径与数据" });
    containerEl.createEl("p", {
      text: "相对于库根目录的文件夹路径，勿以 / 开头；禁止包含 ..。非法值会自动回退为默认值。",
    });

    new Setting(containerEl)
      .setName("对话 JSON 目录")
      .setDesc("自动保存或手动「明文保存」时写入的 JSON 所在文件夹")
      .addText((text) => {
        text
          .setPlaceholder("copilot-agent/conversations")
          .setValue(this.plugin.settings.conversationStorageFolder)
          .onChange(async (value) => {
            this.updateSettings({ conversationStorageFolder: value });
          });
      });

    new Setting(containerEl)
      .setName("导出 Markdown 目录")
      .setDesc("「导出 Markdown」按钮写入的文件夹")
      .addText((text) => {
        text
          .setPlaceholder("copilot-agent/exports")
          .setValue(this.plugin.settings.exportMarkdownFolder)
          .onChange(async (value) => {
            this.updateSettings({ exportMarkdownFolder: value });
          });
      });

    new Setting(containerEl)
      .setName("从旧版 Copilot CN（旧插件）导入配置")
      .setDesc("读取旧插件（copilot-cn）的 data.json，覆盖当前设置与 API Key（只读旧数据，不会修改旧插件）。")
      .addButton((button) => {
        button.setButtonText("导入").onClick(async () => {
          const imported = await importLegacySettings(this.app);

          if (!imported) {
            new Notice("未找到可导入的旧版配置（copilot-cn/data.json）");
            return;
          }

          this.plugin.settings = imported;
          await this.plugin.saveSettings();
          this.display();
          new Notice("已从旧版 Copilot CN 导入设置与 API Key。");
        });
      });
  }
}
