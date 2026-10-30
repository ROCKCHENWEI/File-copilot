import type { ToolExecutionResult, VaultAgentTool } from "@/agent/tools/index";
import type { AgentPhase, AgentStep, ApiToolCall, ChatRequestMessage } from "@/types";
import type { ChatService } from "@/llm/ChatService";
import { TOOL_RESULT_MAX_CHARS } from "@/constants";
import { truncateText } from "@/utils/markdown";
import type { ChatCompletionResult } from "@/types";

/** AgentRunner 只依赖执行端口，便于测试注入替身。 */
export interface ToolExecutorPort {
  execute(call: ApiToolCall): Promise<ToolExecutionResult>;
}

export interface AgentRunnerDeps {
  service: ChatService;
  tools: VaultAgentTool[];
  executor: ToolExecutorPort;
  systemPrompt: string;
  maxToolRounds: number;
  stream: boolean;
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
}

export interface AgentRunnerCallbacks {
  onContentChunk?: (chunk: string) => void;
  onStepUpdate?: (step: AgentStep) => void;
  onPhase?: (phase: AgentPhase) => void;
}

export interface AgentTurnResult {
  content: string;
  steps: AgentStep[];
}

function buildStep(call: ApiToolCall, args: Record<string, unknown>): AgentStep {
  return {
    id: call.id || crypto.randomUUID(),
    toolName: call.function.name,
    argsPreview: truncateText(JSON.stringify(args), 160),
    status: "running",
    resultPreview: "",
  };
}

/**
 * 执行一轮 Agent 回合：LLM ↔ 工具循环，直到模型给出无工具调用的最终文本，
 * 或达到最大轮数后强制收尾（最后一轮不带 tools，逼出文字总结）。
 */
export async function runAgentTurn(
  deps: AgentRunnerDeps,
  history: ChatRequestMessage[],
  callbacks: AgentRunnerCallbacks,
): Promise<AgentTurnResult> {
  const working: ChatRequestMessage[] = [...history];
  const steps: AgentStep[] = [];
  const toolSchemas = deps.tools.map((tool) => tool.definition);
  let content = "";

  const completeOnce = async (withTools: boolean): Promise<ChatCompletionResult> => {
    return deps.service.complete({
      messages: working,
      systemPrompt: deps.systemPrompt,
      temperature: deps.temperature,
      maxTokens: deps.maxTokens,
      stream: deps.stream,
      tools: withTools && toolSchemas.length ? toolSchemas : undefined,
      signal: deps.signal,
      onChunk: (chunk) => {
        content += chunk;
        callbacks.onContentChunk?.(chunk);
      },
    });
  };

  for (let round = 0; round < deps.maxToolRounds; round += 1) {
    callbacks.onPhase?.(round === 0 ? "thinking" : "writing");
    const result = await completeOnce(true);

    if (!result.toolCalls.length) {
      // 兜底：流式与最终文本不一致时以最终结果为准（与 v0.1 行为一致）。
      if (!deps.stream && result.content) {
        content = content ? `${content}\n\n${result.content}` : result.content;
      }

      return { content, steps };
    }

    working.push({ role: "assistant", content: result.content ?? "", toolCalls: result.toolCalls });

    for (const call of result.toolCalls) {
      const args = safeParseArgs(call);
      const step = buildStep(call, args);
      steps.push(step);
      callbacks.onStepUpdate?.({ ...step });
      callbacks.onPhase?.("tool");

      const executed = await deps.executor.execute(call);

      const finished: AgentStep = {
        ...step,
        status: executed.status,
        resultPreview: truncateText(executed.output, 200),
      };

      const index = steps.findIndex((item) => item.id === step.id);

      if (index >= 0) {
        steps[index] = finished;
      }

      callbacks.onStepUpdate?.(finished);

      working.push({
        role: "tool",
        content: truncateText(executed.output, TOOL_RESULT_MAX_CHARS),
        toolCallId: call.id,
        name: call.function.name,
      });
    }
  }

  // 达到轮数上限：不再提供工具，让模型基于已有工具结果收尾。
  callbacks.onPhase?.("writing");
  const final = await completeOnce(false);

  if (!deps.stream && final.content) {
    content = content ? `${content}\n\n${final.content}` : final.content;
  }

  return { content, steps };
}

function safeParseArgs(call: ApiToolCall): Record<string, unknown> {
  try {
    const parsed = JSON.parse(call.function.arguments || "{}") as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallthrough
  }

  return {};
}
