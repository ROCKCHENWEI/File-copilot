import { ok, type VaultAgentTool } from "@/agent/tools/index";
import type { TFile } from "obsidian";

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const listRecentNotesTool: VaultAgentTool = {
  isWrite: false,
  definition: {
    name: "list_recent_notes",
    description: "列出笔记库中最近修改的笔记（标题 + 路径 + 修改日期）。在不确定关键词时用它了解库里有什么。",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "返回条数上限，1-20，默认 10" },
      },
    },
  },
  async execute(args, ctx) {
    const limit = Math.min(Math.max(Math.floor(Number(args.limit ?? 10)) || 10, 1), 20);
    const files = [...ctx.app.vault.getMarkdownFiles()].sort(
      (a, b) => (b.stat?.mtime ?? 0) - (a.stat?.mtime ?? 0),
    );

    if (!files.length) {
      return ok("笔记库为空（没有 Markdown 文件）。");
    }

    const lines = files.slice(0, limit).map((file: TFile, i) => {
      return `${i + 1}. [[${file.basename}]]（${formatDate(file.stat?.mtime ?? 0)}）· 路径：${file.path}`;
    });

    return ok(`最近修改的 ${Math.min(limit, files.length)} 篇笔记：\n\n${lines.join("\n")}`);
  },
};
