import { buildConversationMarkdownDocument, slugifyForFileName } from "@/utils/export-conversation-markdown";
import type { ChatMessage, ConversationRecord } from "@/types";

function msg(role: ChatMessage["role"], content: string, createdAt: number): ChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt };
}

describe("slugifyForFileName", () => {
  it("removes unsafe characters and limits length", () => {
    expect(slugifyForFileName("hello/world:test")).toBe("hello-world-test");
    expect(slugifyForFileName("   ")).toBe("chat");
  });
});

describe("buildConversationMarkdownDocument", () => {
  it("includes front matter and role sections", () => {
    const record: ConversationRecord = {
      id: "rid-1",
      title: "测试标题",
      providerId: "kimi",
      model: "kimi-for-coding",
      messages: [
        msg("user", "你好", 1_700_000_000_000),
        msg("assistant", "你好！", 1_700_000_001_000),
      ],
      createdAt: 1,
      updatedAt: 2,
    };

    const md = buildConversationMarkdownDocument(record);

    expect(md).toContain("title:");
    expect(md).toContain("kimi-for-coding");
    expect(md).toContain("## 用户");
    expect(md).toContain("## 助手");
    expect(md).toContain("你好");
    expect(md).toContain("你好！");
    expect(md).toContain("conversation_id");
  });
});
