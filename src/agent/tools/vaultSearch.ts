import { fail, ok, type ToolExecutionContext, type VaultAgentTool } from "@/agent/tools/index";
import { truncateText } from "@/utils/markdown";
import type { TFile } from "obsidian";

const SNIPPET_RADIUS = 80;
const MAX_SCAN_CHARS = 60_000;

interface SearchHit {
  file: TFile;
  score: number;
  snippet: string;
  mtime: number;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
}

function buildSnippet(content: string, query: string): string {
  const index = content.toLowerCase().indexOf(query.toLowerCase());

  if (index === -1) {
    return truncateText(content.trim().replace(/\s+/g, " "), 120);
  }

  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(content.length, index + query.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < content.length ? "…" : "";

  return `${prefix}${content.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const searchNotesTool: VaultAgentTool = {
  isWrite: false,
  definition: {
    name: "search_notes",
    description:
      "在用户的 Obsidian 笔记库中按关键词全文检索笔记。返回匹配笔记的标题、路径、修改日期与内容摘录。回答任何涉及库内已有内容的问题前，先用它定位相关笔记。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "检索关键词（会对文件名与正文做不区分大小写的匹配）" },
        limit: { type: "number", description: "返回条数上限，1-10，默认 5" },
      },
      required: ["query"],
    },
  },
  async execute(args, ctx: ToolExecutionContext) {
    const query = String(args.query ?? "").trim();

    if (!query) {
      return fail("query 不能为空。");
    }

    const limit = Math.min(Math.max(Math.floor(Number(args.limit ?? 5)) || 5, 1), 10);
    const files = ctx.app.vault.getMarkdownFiles();
    const hits: SearchHit[] = [];

    for (const file of files) {
      let score = 0;
      const nameHit = file.basename.toLowerCase().includes(query.toLowerCase());

      if (nameHit) {
        score += 5;
      }

      let content = "";

      try {
        content = await ctx.app.vault.cachedRead(file);
      } catch {
        content = "";
      }

      const occurrences = countOccurrences(content.slice(0, MAX_SCAN_CHARS).toLowerCase(), query.toLowerCase());

      if (!nameHit && occurrences === 0) {
        continue;
      }

      score += Math.min(occurrences, 10);
      hits.push({ file, score, snippet: buildSnippet(content, query), mtime: file.stat?.mtime ?? 0 });
    }

    hits.sort((a, b) => b.score - a.score || b.mtime - a.mtime);

    if (!hits.length) {
      return ok(
        `没有找到与「${query}」相关的笔记。可尝试更换/拆分关键词，或用 list_recent_notes 浏览库内笔记。`,
      );
    }

    const lines = hits.slice(0, limit).map((hit, i) => {
      const date = formatDate(hit.mtime);
      return [
        `${i + 1}. [[${hit.file.basename}]]（${date} 修改）`,
        `   路径：\`${hit.file.path}\``,
        `   摘录：${hit.snippet}`,
      ].join("\n");
    });

    return ok(`找到 ${Math.min(hits.length, limit)} 篇相关笔记（共命中 ${hits.length} 篇）：\n\n${lines.join("\n\n")}`);
  },
};
