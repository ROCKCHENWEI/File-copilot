import { PLUGIN_NAME, VIEW_TYPE_COPILOT } from "@/constants";
import type CopilotPlugin from "@/main";
import { ChatView } from "@/ui/ChatView";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ItemView, WorkspaceLeaf } from "obsidian";

export class AgentView extends ItemView {
  private root: Root | null = null;
  private readonly plugin: CopilotPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: CopilotPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_COPILOT;
  }

  getDisplayText(): string {
    return PLUGIN_NAME;
  }

  getIcon(): string {
    return "bot";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("copilot-agent-container");
    this.root = createRoot(this.contentEl);
    this.root.render(<ChatView plugin={this.plugin} />);
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}
