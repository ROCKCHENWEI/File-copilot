import { DEFAULT_AGENT_SYSTEM_PROMPT } from "@/constants";
import type { CopilotSettings } from "@/types";

const AGENT_TOOL_INSTRUCTIONS = [
  "## 工具使用规范",
  "",
  "你可以调用工具访问用户的 Obsidian 笔记库（检索、读取、新建、追加、改写笔记）。请遵守：",
  "",
  "1. 回答涉及库内已有内容时，先用 search_notes / read_note 核实，不要凭空编造笔记路径、标题或内容。",
  "2. 引用笔记时使用 [[笔记标题]] 双链格式，便于用户点击跳转。",
  "3. 新建/改写笔记的工具会按用户设置请求确认；被拒绝后不要重复尝试同一写入，改为把内容直接写在回复里。",
  "4. 工具返回的内容可能被截断，需要更多上下文时再调用 read_note。",
  "5. 检索没有命中时，可以换关键词拆分检索，或用 list_recent_notes 了解库的结构。",
  "6. 最终回复保持中文、务实、结构化：先给结论，再给细节；标注信息来源笔记。",
].join("\n");

/** 纯聊天模式用用户系统提示词；Agent 模式追加工具使用规范。 */
export function buildSystemPrompt(settings: CopilotSettings, toolsEnabled: boolean): string {
  const base = settings.systemPrompt.trim() || DEFAULT_AGENT_SYSTEM_PROMPT;
  return toolsEnabled ? `${base}\n\n${AGENT_TOOL_INSTRUCTIONS}` : base;
}
