import { PROVIDERS } from "@/constants";
import { getModelsForProvider } from "@/settings/model";
import type CopilotPlugin from "@/main";
import { ChatInput } from "@/ui/ChatInput";
import { MessageList } from "@/ui/MessageList";
import { QuickActions } from "@/ui/QuickActions";
import { BotIcon, ChevronDownIcon, HistoryIcon, MoreIcon, PlusIcon, TrashIcon } from "@/ui/icons";
import { isProviderKeyMissing } from "@/ui/ApiKeyField";
import { ModelPanel } from "@/ui/ModelPanel";
import { useChatController } from "@/ui/useChatController";
import { useConversationHistory } from "@/ui/useConversationHistory";
import type { ProviderId } from "@/types";
import React, { useEffect, useMemo, useState } from "react";
import { Menu } from "obsidian";

const MODEL_DOCK_OPEN_KEY = "copilot-agent-cn-model-dock-open";
const RECENT_LIMIT = 12;

type PanelKind = "model" | "history";

function readModelPanelOpen(): boolean {
  try {
    const raw = localStorage.getItem(MODEL_DOCK_OPEN_KEY);
    if (raw === null) {
      return true;
    }

    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

function formatHistoryTime(ms: number): string {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ChatViewProps {
  plugin: CopilotPlugin;
}

export function ChatView({ plugin }: ChatViewProps): React.JSX.Element {
  const chat = useChatController(plugin);
  const { history, remove } = useConversationHistory(plugin);
  const [input, setInput] = useState("");
  const [openPanel, setOpenPanel] = useState<PanelKind | null>(readModelPanelOpen() ? "model" : null);
  const [settingsVersion, setSettingsVersion] = useState(0);

  const models = useMemo(() => {
    void settingsVersion;
    return getModelsForProvider(chat.providerId, plugin.settings);
  }, [chat.providerId, plugin, settingsVersion]);

  const providerLabel = useMemo(() => {
    return PROVIDERS.find((p) => p.id === chat.providerId)?.label ?? chat.providerId;
  }, [chat.providerId]);

  // settingsVersion 触发重算：面板内填好 Key 后警示即时消失
  const keyMissing = useMemo(() => {
    void settingsVersion;
    return isProviderKeyMissing(plugin, chat.providerId);
  }, [plugin, chat.providerId, settingsVersion]);

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_DOCK_OPEN_KEY, openPanel === "model" ? "1" : "0");
    } catch {
      // ignore quota / private mode
    }
  }, [openPanel]);

  useEffect(() => {
    if (!models.includes(chat.model)) {
      chat.setModel(models[0] ?? plugin.settings.defaultModel);
    }
  }, [chat, models, plugin.settings.defaultModel]);

  useEffect(() => {
    if (plugin.pendingPrefill) {
      setInput((current) => (current ? `${current}\n\n${plugin.pendingPrefill}` : plugin.pendingPrefill));
      plugin.pendingPrefill = "";
    }
  }, [plugin]);

  useEffect(() => {
    plugin.viewController = {
      onPrefill(value, options) {
        setInput((current) => (current ? `${current}\n\n${value}` : value));

        if (options?.attachActiveNote) {
          chat.setAttachActiveNote(true);
        }
      },
      onNewChat() {
        handleNewChat();
      },
    };

    return () => {
      plugin.viewController = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 与 v0.1 相同：注册即覆盖
  }, [plugin, chat.providerId, chat.model]);

  function handleNewChat(): void {
    chat.newChat();
    setInput("");
  }

  function handleQuickPick(prompt: string, options?: { attachActiveNote?: boolean }): void {
    setInput(prompt);

    if (options?.attachActiveNote) {
      chat.setAttachActiveNote(true);
    }
  }

  function openMoreMenu(event: React.MouseEvent<HTMLButtonElement>): void {
    const menu = new Menu();
    const busy = chat.isStreaming || !chat.messages.length;

    menu.addItem((item) =>
      item
        .setTitle("明文保存对话")
        .setIcon("save")
        .setDisabled(busy)
        .onClick(() => void chat.saveManually()),
    );
    menu.addItem((item) =>
      item
        .setTitle("导出 Markdown")
        .setIcon("download")
        .setDisabled(busy)
        .onClick(() => void chat.exportMarkdown()),
    );
    menu.showAtMouseEvent(event.nativeEvent);
  }

  function togglePanel(kind: PanelKind): void {
    setOpenPanel((current) => (current === kind ? null : kind));
  }

  const recent = history.slice(0, RECENT_LIMIT);
  const showQuickActions = !chat.messages.length && !chat.isStreaming;

  return (
    <div className="copilot-root">
      <header className="copilot-header">
        <div className="copilot-header-brand">
          <span className="copilot-header-logo" aria-hidden>
            <BotIcon size={16} />
          </span>
          <span className="copilot-header-title">File Copilot</span>
          <span className="copilot-header-badge">Agent</span>
        </div>
        <div className="copilot-header-actions">
          <button
            type="button"
            className="copilot-icon-button"
            title="最近对话"
            aria-label="最近对话"
            aria-expanded={openPanel === "history"}
            onClick={() => togglePanel("history")}
          >
            <HistoryIcon size={16} />
          </button>
          <button
            type="button"
            className="copilot-icon-button"
            title="新对话"
            aria-label="新对话"
            onClick={handleNewChat}
            disabled={chat.isStreaming}
          >
            <PlusIcon size={16} />
          </button>
          <button
            type="button"
            className="copilot-icon-button"
            title="更多操作"
            aria-label="更多操作"
            onClick={(event) => openMoreMenu(event)}
          >
            <MoreIcon size={16} />
          </button>
        </div>
      </header>

      <button
        type="button"
        className={`copilot-model-bar${openPanel === "model" ? " is-open" : ""}`}
        aria-expanded={openPanel === "model"}
        title="服务商 / 模型"
        onClick={() => togglePanel("model")}
      >
        <span className="copilot-model-bar-label" title={`${providerLabel} · ${chat.model}`}>
          {providerLabel} · {chat.model}
          {keyMissing ? <span className="copilot-model-bar-warn">未配置 Key</span> : null}
        </span>
        <ChevronDownIcon size={14} className="copilot-model-bar-caret" />
      </button>

      {openPanel === "model" ? (
        <ModelPanel
          plugin={plugin}
          providerId={chat.providerId}
          model={chat.model}
          isStreaming={chat.isStreaming}
          onProviderChange={chat.setProviderId}
          onModelChange={chat.setModel}
          onSettingsChanged={() => setSettingsVersion((version) => version + 1)}
        />
      ) : null}

      {openPanel === "history" ? (
        <div className="copilot-panel">
          <div className="copilot-history-title">最近对话</div>
          {recent.length ? (
            <div className="copilot-history-list">
              {recent.map((item) => (
                <div key={item.id} className="copilot-history-row">
                  <button
                    type="button"
                    className="copilot-history-item"
                    disabled={chat.isStreaming}
                    title={item.title}
                    onClick={() => {
                      chat.loadConversation(item);
                      setOpenPanel(null);
                    }}
                  >
                    <span className="copilot-history-item-title">{item.title}</span>
                    <span className="copilot-history-item-meta">
                      {item.providerId} · {item.model} · {formatHistoryTime(item.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="copilot-icon-button copilot-history-delete"
                    title="删除该对话（移入系统废纸篓）"
                    aria-label="删除该对话"
                    disabled={chat.isStreaming}
                    onClick={() => void remove(item)}
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="copilot-history-empty">还没有保存的对话。</div>
          )}
        </div>
      ) : null}

      <main className="copilot-main">
        <MessageList messages={chat.messages} isStreaming={chat.isStreaming} phase={chat.phase} />
      </main>

      {showQuickActions ? <QuickActions disabled={chat.isStreaming} onPick={handleQuickPick} /> : null}

      <ChatInput
        value={input}
        disabled={false}
        isStreaming={chat.isStreaming}
        phase={chat.phase}
        attachActiveNote={chat.attachActiveNote}
        onToggleAttachActiveNote={() => chat.setAttachActiveNote(!chat.attachActiveNote)}
        onChange={setInput}
        onClear={() => setInput("")}
        onSend={() => {
          const text = input;
          setInput("");
          void chat.send(text);
        }}
        onStop={chat.stop}
      />
    </div>
  );
}
