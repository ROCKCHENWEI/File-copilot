import { SseAggregator, extractDataPayloads, parseSseText } from "@/llm/sse";

function sse(...events: string[]): string {
  return events.map((event) => `data: ${event}\n\n`).join("");
}

describe("SseAggregator", () => {
  it("aggregates delta content chunks", () => {
    const agg = new SseAggregator("delta");
    const chunks: string[] = [];

    for (const payload of ['{"choices":[{"delta":{"content":"你"}}]}', '{"choices":[{"delta":{"content":"好"}}]}']) {
      agg.ingestPayload(payload, (chunk) => chunks.push(chunk));
    }

    expect(agg.text).toBe("你好");
    expect(chunks).toEqual(["你", "好"]);
  });

  it("deduplicates cumulative content chunks", () => {
    const agg = new SseAggregator("cumulative");

    agg.ingestPayload('{"choices":[{"delta":{"content":"你好"}}]}');
    agg.ingestPayload('{"choices":[{"delta":{"content":"你好呀"}}]}');

    expect(agg.text).toBe("你好呀");
  });

  it("accepts message.content frames (cumulative providers)", () => {
    const agg = new SseAggregator("cumulative");

    agg.ingestPayload('{"choices":[{"message":{"content":"A"}}]}');
    agg.ingestPayload('{"choices":[{"message":{"content":"AB"}}]}');

    expect(agg.text).toBe("AB");
  });

  it("assembles streamed tool_calls fragments by index", () => {
    const agg = new SseAggregator("delta");

    agg.ingestPayload(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"search_notes","arguments":""}}]}}]}',
    );
    agg.ingestPayload('{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"query\\":\\"周"}}]}}]}');
    agg.ingestPayload('{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"报\\"}"}}]}}]}');

    expect(agg.calls).toEqual([
      {
        id: "call_1",
        type: "function",
        function: { name: "search_notes", arguments: '{"query":"周报"}' },
      },
    ]);
    expect(agg.text).toBe("");
  });

  it("keeps multiple tool calls ordered by index", () => {
    const agg = new SseAggregator("delta");

    agg.ingestPayload(
      '{"choices":[{"delta":{"tool_calls":[{"index":1,"id":"c2","function":{"name":"read_note","arguments":"{}"}}]}}]}',
    );
    agg.ingestPayload(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"search_notes","arguments":"{}"}}]}}]}',
    );

    expect(agg.calls.map((call) => call.id)).toEqual(["c1", "c2"]);
  });

  it("guards against cumulative arguments replay", () => {
    const agg = new SseAggregator("cumulative");

    agg.ingestPayload('{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"t","arguments":"{\\"a"}}]}}]}');
    agg.ingestPayload('{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"a\\":1}"}}]}}]}');

    expect(agg.calls[0].function.arguments).toBe('{"a":1}');
  });

  it("ignores broken JSON frames without throwing", () => {
    const agg = new SseAggregator("delta");

    expect(() => agg.ingestPayload("not-json")).not.toThrow();
    expect(agg.text).toBe("");
  });
});

describe("extractDataPayloads", () => {
  it("collects data lines and skips [DONE]", () => {
    const payloads = extractDataPayloads('data: {"a":1}\ndata: [DONE]\n: keep-alive comment');

    expect(payloads).toEqual(['{"a":1}']);
  });
});

describe("parseSseText", () => {
  it("parses a full SSE body with mixed content and tool calls", () => {
    const raw = sse(
      '{"choices":[{"delta":{"content":"让我找找。"}}]}',
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"search_notes","arguments":"{\\"query\\":\\"x\\"}"}}]}}]}',
      "[DONE]",
    );

    const result = parseSseText(raw, "kimi");

    expect(result.content).toBe("让我找找。");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe("search_notes");
  });
});
