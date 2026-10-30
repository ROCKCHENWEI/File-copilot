import { runAgentTurn } from "@/agent/AgentRunner";
import type { VaultAgentTool } from "@/agent/tools/index";
import type { ChatService } from "@/llm/ChatService";
import type { ApiToolCall, ChatCompletionResult, ChatRequestMessage } from "@/types";

function toolCall(id: string, name: string, args: unknown): ApiToolCall {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

function fakeService(responses: ChatCompletionResult[]): ChatService {
  let call = 0;

  return {
    complete: vi.fn(
      async (options: { stream?: boolean; tools?: unknown[]; onChunk?: (chunk: string) => void }) => {
        const response = responses[Math.min(call, responses.length - 1)];
        call += 1;

        if (options.stream && response.content && options.onChunk) {
          options.onChunk(response.content);
        }

        return response;
      },
    ),
  } as unknown as ChatService;
}

const echoTool: VaultAgentTool = {
  isWrite: false,
  definition: {
    name: "echo",
    description: "echo",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  async execute(args) {
    return { output: `echo:${String(args.text ?? "")}`, status: "ok" };
  },
};

function baseDeps(service: ChatService, overrides: Record<string, unknown> = {}) {
  const executed: Array<{ name: string; args: string }> = [];

  return {
    deps: {
      service,
      tools: [echoTool],
      executor: {
        async execute(call: ApiToolCall) {
          executed.push({ name: call.function.name, args: call.function.arguments });
          return echoTool.execute(JSON.parse(call.function.arguments), {} as never);
        },
      },
      systemPrompt: "sys",
      maxToolRounds: 4,
      stream: false,
      temperature: 0.5,
      maxTokens: 128,
      ...overrides,
    },
    executed,
  };
}

describe("runAgentTurn", () => {
  it("returns final text when no tools are called", async () => {
    const { deps } = baseDeps(fakeService([{ content: "直接回答", toolCalls: [] }]));
    const result = await runAgentTurn(deps, [{ role: "user", content: "hi" }], {});

    expect(result.content).toBe("直接回答");
    expect(result.steps).toEqual([]);
  });

  it("executes tool calls and feeds results back until final text", async () => {
    const service = fakeService([
      { content: "先查一下", toolCalls: [toolCall("c1", "echo", { text: "周报" })] },
      { content: "查完了：echo:周报", toolCalls: [] },
    ]);
    const { deps, executed } = baseDeps(service);
    const result = await runAgentTurn(deps, [{ role: "user", content: "hi" }], {});

    expect(executed).toEqual([{ name: "echo", args: '{"text":"周报"}' }]);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].status).toBe("ok");
    expect(result.steps[0].resultPreview).toContain("echo:周报");
    expect(result.content).toContain("查完了");

    // 第二轮请求应包含 assistant(tool_calls) 与 tool 结果消息
    const messages = (service.complete as ReturnType<typeof vi.fn>).mock.calls[1][0]
      .messages as ChatRequestMessage[];
    const roles = messages.map((message) => message.role);
    expect(roles).toEqual(["user", "assistant", "tool"]);
    expect(messages[2].toolCallId).toBe("c1");
  });

  it("passes tool schemas to the service only when tools exist", async () => {
    const service = fakeService([{ content: "ok", toolCalls: [] }]);
    const { deps } = baseDeps(service);

    await runAgentTurn(deps, [{ role: "user", content: "hi" }], {});

    const firstCall = (service.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(firstCall.tools).toEqual([echoTool.definition]);
  });

  it("forces a tool-free final call after hitting the round limit", async () => {
    const calls: Array<{ content: string; toolCalls: ReturnType<typeof toolCall>[] }> = [];
    const service = {
      complete: vi.fn(
        async (options: { stream?: boolean; tools?: unknown[]; onChunk?: (chunk: string) => void }) => {
          const index = calls.length;
          const response =
            index < 2
              ? { content: "", toolCalls: [toolCall(`c${index}`, "echo", { text: "again" })] }
              : { content: "收尾", toolCalls: [] };
          calls.push({ content: response.content, toolCalls: response.toolCalls });

          if (options.stream && response.content && options.onChunk) {
            options.onChunk(response.content);
          }

          return response;
        },
      ),
    } as unknown as ChatService;

    const { deps, executed } = baseDeps(service, { maxToolRounds: 2 });

    const result = await runAgentTurn(deps, [{ role: "user", content: "hi" }], {});

    // 2 轮带工具 + 1 轮收尾
    expect(executed).toHaveLength(2);
    expect(result.content).toBe("收尾");

    const allCalls = (service.complete as ReturnType<typeof vi.fn>).mock.calls;
    expect(allCalls[2][0].tools).toBeUndefined();
  });

  it("reports error status when a tool throws", async () => {
    const service = fakeService([
      { content: "", toolCalls: [toolCall("c1", "echo", {})] },
      { content: "抱歉出错了", toolCalls: [] },
    ]);

    const { deps } = baseDeps(service);
    deps.executor = {
      async execute() {
        return { output: "工具执行出错：boom", status: "error" };
      },
    };

    const result = await runAgentTurn(deps, [{ role: "user", content: "hi" }], {});

    expect(result.steps[0].status).toBe("error");
    expect(result.steps[0].resultPreview).toContain("boom");
  });

  it("streams content chunks through callbacks", async () => {
    const { deps } = baseDeps(fakeService([{ content: "流式文本", toolCalls: [] }]), { stream: true });
    const chunks: string[] = [];

    await runAgentTurn(deps, [{ role: "user", content: "hi" }], {
      onContentChunk: (chunk) => chunks.push(chunk),
    });

    expect(chunks).toEqual(["流式文本"]);
  });
});
