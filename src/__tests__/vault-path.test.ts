import { CONVERSATION_FOLDER, EXPORT_MARKDOWN_FOLDER } from "@/constants";
import { normalizeVaultRelativeFolder } from "@/utils/vault-path";

describe("normalizeVaultRelativeFolder", () => {
  it("returns fallback for empty or dot segments", () => {
    expect(normalizeVaultRelativeFolder("", CONVERSATION_FOLDER)).toBe(CONVERSATION_FOLDER);
    expect(normalizeVaultRelativeFolder("   ", CONVERSATION_FOLDER)).toBe(CONVERSATION_FOLDER);
    expect(normalizeVaultRelativeFolder("a/../b", CONVERSATION_FOLDER)).toBe(CONVERSATION_FOLDER);
    expect(normalizeVaultRelativeFolder("a/./b", CONVERSATION_FOLDER)).toBe(CONVERSATION_FOLDER);
  });

  it("returns fallback for absolute-style paths", () => {
    expect(normalizeVaultRelativeFolder("/etc/passwd", CONVERSATION_FOLDER)).toBe(CONVERSATION_FOLDER);
    expect(normalizeVaultRelativeFolder("C:/tmp", EXPORT_MARKDOWN_FOLDER)).toBe(EXPORT_MARKDOWN_FOLDER);
  });

  it("normalizes backslashes", () => {
    expect(normalizeVaultRelativeFolder("my\\sub\\dir", "fallback")).toBe("my/sub/dir");
  });
});
