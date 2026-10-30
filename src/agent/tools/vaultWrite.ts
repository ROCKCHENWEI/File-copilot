import {
  denied,
  fail,
  ok,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type VaultAgentTool,
} from "@/agent/tools/index";
import { resolveNoteFile } from "@/agent/tools/vaultRead";
import { truncateText } from "@/utils/markdown";

/** 规整模型给出的新笔记路径：去首斜杠、合并空段、补 .md。 */
function normalizeNewNotePath(raw: string): string {
  const segments = raw
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..");

  let path = segments.join("/");

  if (!path) {
    return "";
  }

  if (!path.toLowerCase().endsWith(".md")) {
    path = `${path}.md`;
  }

  return path;
}

/** confirm 档位下的写入审批；readonly 已在 ToolExecutor 拦截，auto 直接放行。 */
function approve(ctx: ToolExecutionContext, message: string): ToolExecutionResult | null {
  if (ctx.writeMode === "confirm" && !ctx.requestWriteApproval(message)) {
    return denied("用户拒绝了本次写入操作。请勿重复尝试同一写入，改为在回复中直接给出内容，或询问用户希望如何保存。");
  }

  return null;
}

function preview(content: string): string {
  return truncateText(content.replace(/\s+/g, " ").trim(), 300);
}

export const createNoteTool: VaultAgentTool = {
  isWrite: true,
  definition: {
    name: "create_note",
    description: "在笔记库中新建一篇笔记。路径不存在时自动创建父文件夹；若目标已存在会失败（改用 replace_note_content）。",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "新笔记的库内相对路径，如 `工作/会议纪要-1015.md`" },
        content: { type: "string", description: "笔记完整内容（Markdown）" },
      },
      required: ["path", "content"],
    },
  },
  async execute(args, ctx: ToolExecutionContext) {
    const path = normalizeNewNotePath(String(args.path ?? ""));
    const content = String(args.content ?? "");

    if (!path) {
      return fail("path 不能为空。");
    }

    if (ctx.app.vault.getAbstractFileByPath(path)) {
      return fail(`笔记已存在：\`${path}\`。如需修改请使用 replace_note_content，或追加内容用 append_note。`);
    }

    const rejected = approve(
      ctx,
      `Agent 请求新建笔记：\n${path}\n\n内容预览：\n${preview(content)}`,
    );

    if (rejected) {
      return rejected;
    }

    const created = await ctx.app.vault.create(path, content);
    ctx.notifyWrite(`已创建笔记：${created.path}`);
    return ok(`已创建笔记 \`${created.path}\`（${content.length} 字符）。用户可在 Obsidian 中打开查看。`);
  },
};

export const appendNoteTool: VaultAgentTool = {
  isWrite: true,
  definition: {
    name: "append_note",
    description: "向已有笔记末尾追加内容（自动加空行分隔）。适合追加日志、待办、增量记录。",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "笔记路径或标题" },
        content: { type: "string", description: "要追加的内容（Markdown）" },
      },
      required: ["path", "content"],
    },
  },
  async execute(args, ctx: ToolExecutionContext) {
    const rawPath = String(args.path ?? "");
    const content = String(args.content ?? "");
    const resolved = resolveNoteFile(ctx.app, rawPath);

    if (!resolved.file) {
      return fail(resolved.note ?? "未找到笔记。");
    }

    const file = resolved.file;
    const rejected = approve(
      ctx,
      `Agent 请求向笔记追加内容：\n${file.path}\n\n追加内容预览：\n${preview(content)}`,
    );

    if (rejected) {
      return rejected;
    }

    const existing = await ctx.app.vault.read(file);
    const next = existing.endsWith("\n") || !existing ? `${existing}${content}` : `${existing}\n\n${content}`;

    await ctx.app.vault.modify(file, next);
    ctx.notifyWrite(`已追加内容到：${file.path}`);

    return ok(`已向 \`${file.path}\` 末尾追加 ${content.length} 字符，当前共 ${next.length} 字符。`);
  },
};

export const replaceNoteContentTool: VaultAgentTool = {
  isWrite: true,
  definition: {
    name: "replace_note_content",
    description:
      "用新内容整体替换一篇笔记的正文（破坏性操作，会请求用户确认）。适合整理、重写、结构化已有笔记。",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "笔记路径或标题" },
        content: { type: "string", description: "替换后的完整正文（Markdown）" },
      },
      required: ["path", "content"],
    },
  },
  async execute(args, ctx: ToolExecutionContext) {
    const rawPath = String(args.path ?? "");
    const content = String(args.content ?? "");
    const resolved = resolveNoteFile(ctx.app, rawPath);

    if (!resolved.file) {
      return fail(resolved.note ?? "未找到笔记。");
    }

    const file = resolved.file;
    const existing = await ctx.app.vault.read(file);
    const rejected = approve(
      ctx,
      [
        `Agent 请求整体改写笔记：${file.path}`,
        ``,
        `当前正文开头：${preview(existing)}`,
        ``,
        `新正文开头：${preview(content)}`,
      ].join("\n"),
    );

    if (rejected) {
      return rejected;
    }

    await ctx.app.vault.modify(file, content);
    ctx.notifyWrite(`已改写笔记：${file.path}`);

    return ok(
      `已将 \`${file.path}\` 的正文整体替换（原 ${existing.length} 字符 → 新 ${content.length} 字符）。`,
    );
  },
};

export const vaultWriteTools: VaultAgentTool[] = [createNoteTool, appendNoteTool, replaceNoteContentTool];
