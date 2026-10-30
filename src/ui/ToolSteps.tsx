import { TOOL_LABELS } from "@/constants";
import type { AgentStep } from "@/types";
import React from "react";
import { ClockIcon, FileTextIcon, PencilIcon, SearchIcon, WrenchIcon } from "@/ui/icons";

interface ToolStepsProps {
  steps: AgentStep[];
}

const TOOL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  search_notes: SearchIcon,
  read_note: FileTextIcon,
  list_recent_notes: ClockIcon,
  create_note: PencilIcon,
  append_note: PencilIcon,
  replace_note_content: PencilIcon,
};

function StatusBadge({ status }: { status: AgentStep["status"] }): React.JSX.Element {
  if (status === "running") {
    return (
      <span className="copilot-step-badge copilot-step-running" aria-label="执行中">
        <span className="copilot-typing-dot" />
        <span className="copilot-typing-dot" />
        <span className="copilot-typing-dot" />
      </span>
    );
  }

  if (status === "ok") {
    return <span className="copilot-step-badge copilot-step-ok">完成</span>;
  }

  if (status === "denied") {
    return <span className="copilot-step-badge copilot-step-denied">已跳过</span>;
  }

  return <span className="copilot-step-badge copilot-step-error">出错</span>;
}

export function ToolSteps({ steps }: ToolStepsProps): React.JSX.Element | null {
  if (!steps.length) {
    return null;
  }

  return (
    <div className="copilot-steps">
      {steps.map((step) => {
        const Icon = TOOL_ICONS[step.toolName] ?? WrenchIcon;
        const label = TOOL_LABELS[step.toolName] ?? step.toolName;

        return (
          <details key={step.id} className="copilot-step">
            <summary className="copilot-step-summary">
              <span className="copilot-step-icon" aria-hidden>
                <Icon size={13} />
              </span>
              <span className="copilot-step-name">{label}</span>
              {step.argsPreview ? (
                <code className="copilot-step-args">{step.argsPreview}</code>
              ) : null}
              <StatusBadge status={step.status} />
            </summary>
            {step.resultPreview ? (
              <div className="copilot-step-result">{step.resultPreview}</div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}
