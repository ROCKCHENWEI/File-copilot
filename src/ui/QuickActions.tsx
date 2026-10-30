import React from "react";
import { FileTextIcon, PencilIcon, SearchIcon, NoteIcon } from "@/ui/icons";

interface QuickActionsProps {
  disabled: boolean;
  onPick: (prompt: string, options?: { attachActiveNote?: boolean }) => void;
}

interface QuickAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  prompt: string;
  attachActiveNote?: boolean;
}

const ACTIONS: QuickAction[] = [
  {
    key: "summarize",
    label: "总结当前笔记",
    icon: NoteIcon,
    attachActiveNote: true,
    prompt: "请阅读并总结当前打开的笔记：先给一句话摘要，再列要点，最后提取待办事项（如有）。",
  },
  {
    key: "find",
    label: "查找相关笔记",
    icon: SearchIcon,
    prompt: "请围绕主题「　」在笔记库中检索相关笔记，逐篇说明与主题的关系，并给出 [[双链]] 列表。",
  },
  {
    key: "draft",
    label: "起草新笔记",
    icon: PencilIcon,
    prompt:
      "帮我起草一篇新笔记《　》：先检索库内相关笔记作素材，再给出结构化草稿；我确认后再用工具创建笔记。",
  },
  {
    key: "polish",
    label: "润色文字",
    icon: FileTextIcon,
    prompt: "请润色以下文字，保持原意、提升表达，并说明主要改动点：\n\n",
  },
];

export function QuickActions({ disabled, onPick }: QuickActionsProps): React.JSX.Element {
  return (
    <div className="copilot-quick-actions" role="group" aria-label="快捷指令">
      {ACTIONS.map((action) => {
        const Icon = action.icon;

        return (
          <button
            key={action.key}
            type="button"
            className="copilot-quick-action"
            disabled={disabled}
            onClick={() => onPick(action.prompt, { attachActiveNote: action.attachActiveNote })}
          >
            <span className="copilot-quick-action-icon" aria-hidden>
              <Icon size={13} />
            </span>
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
