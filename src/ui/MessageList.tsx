import type { AgentPhase, ChatMessage } from "@/types";
import React, { useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "@/ui/MarkdownRenderer";
import { BotIcon, CheckIcon, ChevronDownIcon, CopyIcon, UserIcon } from "@/ui/icons";
import { ToolSteps } from "@/ui/ToolSteps";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  phase: AgentPhase;
}

const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: "",
  thinking: "思考中…",
  tool: "检索笔记中…",
  writing: "撰写中…",
};

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actorLabel(role: ChatMessage["role"]): string {
  if (role === "user") {
    return "你";
  }

  if (role === "assistant") {
    return "Copilot CN";
  }

  return "系统";
}

export function MessageList({ messages, isStreaming, phase }: MessageListProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const element = listRef.current;

    if (!element) {
      return;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceFromBottom < 72) {
      element.scrollTop = element.scrollHeight;
      setShowScrollButton(false);
    }
  }, [messages]);

  function updateScrollState(): void {
    const element = listRef.current;

    if (!element) {
      return;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScrollButton(distanceFromBottom > 72);
  }

  async function copyMessage(message: ChatMessage): Promise<void> {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1200);
    } catch (error) {
      console.warn("Failed to copy message", error);
    }
  }

  if (!messages.length) {
    return (
      <div className="copilot-empty-state">
        <div className="copilot-empty-icon" aria-hidden>
          <BotIcon size={28} />
        </div>
        <div className="copilot-empty-title">开始一段新对话</div>
        <div className="copilot-empty-subtitle">
          Agent 可以检索、阅读和整理你的笔记库：总结当前笔记、查找资料、起草新笔记，或直接提问。
        </div>
      </div>
    );
  }

  const lastPhaseLabel =
    isStreaming && phase !== "idle" ? PHASE_LABELS[phase] : "";

  return (
    <div className="copilot-message-list-wrap">
      <div ref={listRef} className="copilot-message-list" onScroll={updateScrollState}>
        {messages.map((message) => {
          const isUser = message.role === "user";
          const isLastStreamingPlaceholder =
            isStreaming && message.role === "assistant" && !message.content;

          return (
            <div key={message.id} className={`copilot-message copilot-message-${message.role}`}>
              <div className={`copilot-avatar ${isUser ? "copilot-avatar-user" : "copilot-avatar-bot"}`} aria-hidden>
                {isUser ? <UserIcon size={16} /> : <BotIcon size={16} />}
              </div>
              <div className="copilot-message-body">
                <div className="copilot-message-meta">
                  <span className="copilot-message-name">{actorLabel(message.role)}</span>
                  <span className="copilot-message-time">{formatTimestamp(message.createdAt)}</span>
                  {!!message.content && (
                    <button
                      type="button"
                      className="copilot-icon-button copilot-message-copy"
                      title={copiedId === message.id ? "已复制" : "复制"}
                      aria-label={copiedId === message.id ? "已复制" : "复制"}
                      onClick={() => void copyMessage(message)}
                    >
                      {copiedId === message.id ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    </button>
                  )}
                </div>
                <ToolSteps steps={message.steps ?? []} />
                <div className="copilot-message-content">
                  {isLastStreamingPlaceholder ? (
                    <div className="copilot-streaming-placeholder" aria-label="正在生成回答">
                      {lastPhaseLabel ? (
                        <span className="copilot-phase-label">{lastPhaseLabel}</span>
                      ) : null}
                      <span className="copilot-typing-dot" />
                      <span className="copilot-typing-dot" />
                      <span className="copilot-typing-dot" />
                    </div>
                  ) : (
                    <MarkdownRenderer>{message.content}</MarkdownRenderer>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {showScrollButton && (
        <button
          type="button"
          className="copilot-scroll-button"
          title="回到底部"
          aria-label="回到底部"
          onClick={() => {
            const element = listRef.current;

            if (!element) {
              return;
            }

            element.scrollTop = element.scrollHeight;
            setShowScrollButton(false);
          }}
        >
          <ChevronDownIcon size={16} />
        </button>
      )}
    </div>
  );
}
