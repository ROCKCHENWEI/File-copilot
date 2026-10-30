import { DEFAULT_SETTINGS, PLUGIN_ID, PLUGIN_NAME, VIEW_TYPE_COPILOT } from "@/constants";
import { CopilotSettingTab } from "@/settings/SettingsTab";
import { importLegacySettings } from "@/settings/migrate";
import { loadPluginSettings, persistPluginSettings, sanitizeSettings } from "@/settings/model";
import { AgentView } from "@/ui/AgentView";
import type { CopilotSettings, ViewControllerCallbacks } from "@/types";
import { Editor, Notice, Plugin, type MarkdownFileInfo, type WorkspaceLeaf } from "obsidian";

export default class CopilotPlugin extends Plugin {
  settings: CopilotSettings = DEFAULT_SETTINGS;
  pendingPrefill = "";
  viewController: ViewControllerCallbacks | null = null;
  private readonly settingsListeners = new Set<() => void>();

  /** Subscribe to runs of `saveSettings` (e.g. reload history when storage folder changes). */
  registerSettingsListener(listener: () => void): () => void {
    this.settingsListeners.add(listener);
    return () => {
      this.settingsListeners.delete(listener);
    };
  }

  async onload(): Promise<void> {
    // 首次安装：从旧版 Copilot CN (v0.1.x) 导入设置与 API Key（只读旧数据）。
    if ((await this.loadData()) == null) {
      const imported = await importLegacySettings(this.app);

      if (imported) {
        await this.saveData(imported);
        new Notice("Copilot CN Agent：已从旧版 Copilot CN 导入设置与 API Key。");
      }
    }

    this.settings = await loadPluginSettings(this);
    this.register(() => this.settingsListeners.clear());

    this.registerView(VIEW_TYPE_COPILOT, (leaf) => new AgentView(leaf, this));

    this.addRibbonIcon("bot", PLUGIN_NAME, () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-chat",
      name: "打开 Copilot CN Agent 侧边栏",
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: "new-chat",
      name: "新建 Agent 对话",
      callback: async () => {
        await this.activateView();
        this.viewController?.onNewChat();
      },
    });

    this.addCommand({
      id: "add-selection-to-chat",
      name: "将选中文本添加到 Agent 对话",
      editorCallback: async (editor: Editor, ctx: MarkdownFileInfo) => {
        const selection = editor.getSelection().trim();

        if (!selection) {
          new Notice("请先选中文本");
          return;
        }

        const fileName = ctx.file?.basename ?? "当前笔记";
        const context = `来自《${fileName}》的选中文本：\n\n${selection}`;

        await this.activateView();

        if (this.viewController) {
          this.viewController.onPrefill(context);
        } else {
          this.pendingPrefill = context;
        }
      },
    });

    this.addCommand({
      id: "summarize-active-note",
      name: "总结当前笔记（Agent）",
      editorCallback: async (editor: Editor, ctx: MarkdownFileInfo) => {
        if (!ctx.file) {
          new Notice("没有活动笔记");
          return;
        }

        await this.activateView();
        const prompt = `请阅读笔记《${ctx.file.basename}》并总结：先给一句话摘要，再列要点，最后提取待办事项（如有）。`;

        if (this.viewController) {
          this.viewController.onPrefill(prompt, { attachActiveNote: true });
        } else {
          this.pendingPrefill = prompt;
        }
      },
    });

    this.addCommand({
      id: "reload-plugin",
      name: "重启插件（加载最新代码）",
      callback: () => {
        void this.reloadSelf();
      },
    });

    this.addSettingTab(new CopilotSettingTab(this.app, this));
  }

  /** 开发/升级后自重启：磁盘上的 main.js 替换后需重载才会生效。 */
  private async reloadSelf(): Promise<void> {
    const plugins = (
      this.app as unknown as {
        plugins: {
          disablePlugin: (id: string) => Promise<void>;
          enablePlugin: (id: string) => Promise<void>;
        };
      }
    ).plugins;

    await plugins.disablePlugin(PLUGIN_ID);
    await plugins.enablePlugin(PLUGIN_ID);
    new Notice("Copilot CN Agent 已重新加载");
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_COPILOT);
  }

  async saveSettings(): Promise<void> {
    await persistPluginSettings(this, this.settings);
    this.settings = sanitizeSettings(this.settings);

    for (const listener of [...this.settingsListeners]) {
      try {
        listener();
      } catch (error) {
        console.warn("Copilot CN Agent settings listener failed", error);
      }
    }
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_COPILOT)[0] ?? null;

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);

      if (!leaf) {
        throw new Error("无法创建 Copilot Agent 侧边栏");
      }

      await leaf.setViewState({
        type: VIEW_TYPE_COPILOT,
        active: true,
      });
    }

    await workspace.revealLeaf(leaf);
  }
}
