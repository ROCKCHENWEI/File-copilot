import { CONVERSATION_FOLDER } from "@/constants";
import { saveConversation } from "@/utils/storage";
import type { ConversationRecord } from "@/types";

describe("saveConversation", () => {
  it("uses opaque filenames instead of prompt-derived titles", async () => {
    const create = vi.fn().mockResolvedValue({});
    const app = {
      vault: {
        adapter: {
          exists: vi.fn().mockResolvedValue(true),
        },
        getAbstractFileByPath: vi.fn().mockReturnValue(null),
        createFolder: vi.fn(),
        create,
      },
    } as unknown as Parameters<typeof saveConversation>[0];

    const record: ConversationRecord = {
      id: "abc123",
      title: "这是一个敏感标题",
      providerId: "kimi",
      model: "kimi-k2.5",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "这是一个很敏感的问题",
          createdAt: 1,
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    };

    await saveConversation(app, record, CONVERSATION_FOLDER);

    expect(create).toHaveBeenCalledTimes(1);
    const [filePath] = create.mock.calls[0];
    expect(String(filePath)).toContain(`${CONVERSATION_FOLDER}/kimi-`);
    expect(String(filePath)).not.toContain("敏感");
  });
});
