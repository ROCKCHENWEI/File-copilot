import type { AgentStep, AgentWriteMode, ApiToolCall, ToolDefinition } from "@/types";
import type { App } from "obsidian";

/** 工具执行上下文：由 UI/插件层构造，测试可注入替身。 */
export interface ToolExecutionContext {
  app: App;
  writeMode: AgentWriteMode;
  readNoteMaxChars: number;
  /** 写入审批回调（生产环境为 window.confirm 封装）。 */
  requestWriteApproval: (message: string) => boolean;
  /** 写入成功提示（生产环境为 Notice 封装）。 */
  notifyWrite: (message: string) => void;
}

export interface ToolExecutionResult {
  /** 回传给模型的文本。 */
  output: string;
  status: AgentStep["status"];
}

export interface VaultAgentTool {
  definition: ToolDefinition;
  /** 写入类工具需要经过权限档位审批。 */
  isWrite: boolean;
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolExecutionResult>;
}

export function ok(output: string): ToolExecutionResult {
  return { output, status: "ok" };
}

export function fail(output: string): ToolExecutionResult {
  return { output, status: "error" };
}

export function denied(output: string): ToolExecutionResult {
  return { output, status: "denied" };
}

/** 解析模型给出的工具参数 JSON；失败时返回 null。 */
export function parseToolArguments(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** 执行模型发起的工具调用：查表 → 解参 → 只读门禁 → 执行。 */
export class ToolExecutor {
  private readonly byName = new Map<string, VaultAgentTool>();

  constructor(
    tools: VaultAgentTool[],
    private readonly ctx: ToolExecutionContext,
  ) {
    for (const tool of tools) {
      this.byName.set(tool.definition.name, tool);
    }
  }

  async execute(call: ApiToolCall): Promise<ToolExecutionResult> {
    const tool = this.byName.get(call.function.name);

    if (!tool) {
      return fail(`未知工具：${call.function.name}。可用工具：${[...this.byName.keys()].join("、")}。`);
    }

    const args = parseToolArguments(call.function.arguments);

    if (!args) {
      return fail(`工具 ${call.function.name} 的参数不是合法 JSON：${call.function.arguments.slice(0, 200)}`);
    }

    if (tool.isWrite && this.ctx.writeMode === "readonly") {
      return denied(
        `写入被拒绝：当前 Agent 处于只读模式（可在插件设置 → Agent 权限中调整）。请勿重试写入，改为在回复中直接给出内容。`,
      );
    }

    try {
      return await tool.execute(args, this.ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(`工具 ${call.function.name} 执行出错：${message}`);
    }
  }
}
