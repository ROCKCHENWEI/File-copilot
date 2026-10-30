import { fail, ok, type ToolExecutionContext, type VaultAgentTool } from "@/agent/tools/index";
import { truncateText } from "@/utils/markdown";
import { TFile } from "obsidian";

/** 按用户/模型给出的路径线索解析笔记：精确路径 → 补 .md → 唯一文件名匹配。 */
export function resolveNoteFile(app: ToolExecutionContext["app"], rawPath: string): { file: TFile | null; note?: string } {
  const clean = rawPath.trim().replace(/^\/+/, "");

  if (!clean) {
    return { file: null, note: "路径为空。" };
  }

  const byPath = app.vault.getAbstractFileByPath(clean);
  if (byPath && byPath instanceof TFile && byPath.extension === "md") {
    return { file: byPath };
  }

  const withMd = clean.toLowerCase().endsWith(".md") ? clean : `${clean}.md`;
  const byMdPath = app.vault.getAbstractFileByPath(withMd);
  if (byMdPath && byMdPath instanceof TFile) {
    return { file: byMdPath };
  }

  // 文件名（不含扩展名）唯一匹配，便于模型只给标题。
  const stripped = withMd.replace(/\.md$/i, "");
  const matches = app.vault
    .getMarkdownFiles()
    .filter((f) => f.basename === stripped || f.path === withMd || f.path.endsWith(`/${stripped}.md`));

  if (matches.length === 1) {
    return { file: matches[0] };
  }

  if (matches.length > 1) {
    return {
      file: null,
      note: `「${rawPath}」匹配到多篇笔记，请给出完整路径：\n${matches.map((f) => `- ${f.path}`).join("\n")}`,
    };
  }

  return { file: null, note: `未找到笔记「${rawPath}」。可先用 search_notes 检索确认路径。` };
}

export const readNoteTool: VaultAgentTool = {
  isWrite: false,
  definition: {
    name: "read_note",
    description: "读取一篇笔记的完整正文。path 可以是库内完整路径，也可以是笔记标题（需唯一）。",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "笔记路径或标题，例如 `项目/周报.md` 或 `周报`" },
      },
      required: ["path"],
    },
  },
  async execute(args, ctx: ToolExecutionContext) {
    const rawPath = String(args.path ?? "");
    const resolved = resolveNoteFile(ctx.app, rawPath);

    if (!resolved.file) {
      return fail(resolved.note ?? "未找到笔记。");
    }

    const file = resolved.file;
    let content: string;

    try {
      content = await ctx.app.vault.cachedRead(file);
    } catch {
      try {
        content = await ctx.app.vault.read(file);
      } catch (error) {
        return fail(`读取失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const truncated = truncateText(content, ctx.readNoteMaxChars);
    const cutNote = content.length > ctx.readNoteMaxChars ? `（正文超过 ${ctx.readNoteMaxChars} 字符，已截断）` : "";
    const date = new Date(file.stat.mtime).toLocaleString("zh-CN");

    return ok(`# ${file.basename}\n路径：\`${file.path}\`｜修改时间：${date}${cutNote}\n\n---\n\n${truncated}`);
  },
};
