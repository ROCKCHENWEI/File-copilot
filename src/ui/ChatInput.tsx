import type { AgentPhase } from "@/types";
import React from "react";
import { NoteIcon, SendIcon, StopIcon, TrashIcon } from "@/ui/icons";

interface ChatInputProps {
  value: string;
  disabled: boolean;
  isStreaming: boolean;
  phase: AgentPhase;
  attachActiveNote: boolean;
  onToggleAttachActiveNote: () => void;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onClear: () => void;
}

const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: "正在生成中",
  thinking: "思考中…",
  tool: "调用工具中…",
  writing: "撰写中…",
};

export function ChatInput({
  value,
  disabled,
  isStreaming,
  phase,
  attachActiveNote,
  onToggleAttachActiveNote,
  onChange,
  onSend,
  onStop,
  onClear,
}: ChatInputProps): React.JSX.Element {
  const canSend = !disabled && !!value.trim() && !isStreaming;
  const canClear = !disabled && !!value && !isStreaming;

  return (
    <div className="copilot-composer">
      <textarea
        className="copilot-composer-input"
        placeholder="给 Agent 下指令：总结、检索、起草笔记，或直接提问。Enter 发送，Shift + Enter 换行"
        value={value}
        disabled={disabled}
        rows={2}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();

            if (isStreaming) {
              onStop();
            } else {
              onSend();
            }
          }
        }}
      />
      <div className="copilot-composer-bar">
        <div className="copilot-composer-meta">
          <button
            type="button"
            className={`copilot-chip${attachActiveNote ? " is-active" : ""}`}
            title="发送时附带当前活动笔记的正文摘录（仅本对话生效，可在设置中改默认值）"
            aria-pressed={attachActiveNote}
            disabled={disabled}
            onClick={onToggleAttachActiveNote}
          >
            <NoteIcon size={13} />
            <span>@当前笔记</span>
          </button>
          {isStreaming ? (
            <span className="copilot-composer-live">{PHASE_LABELS[phase]}</span>
          ) : (
            <span className="copilot-composer-count">{value.length} 字</span>
          )}
        </div>
        <div className="copilot-composer-actions">
          <button
            type="button"
            className="copilot-icon-button"
            title="清空"
            aria-label="清空"
            onClick={onClear}
            disabled={!canClear}
          >
            <TrashIcon size={15} />
          </button>
          {isStreaming ? (
            <button type="button" className="copilot-stop-button" onClick={onStop} title="停止生成">
              <StopIcon size={14} />
              <span>停止</span>
            </button>
          ) : (
            <button
              type="button"
              className="copilot-send-button"
              onClick={onSend}
              disabled={!canSend}
              title="发送"
              aria-label="发送"
            >
              <SendIcon size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
