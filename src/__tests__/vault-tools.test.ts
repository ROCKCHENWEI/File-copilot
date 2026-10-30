import { ToolExecutor, type ToolExecutionContext } from "@/agent/tools/index";
import { readNoteTool, resolveNoteFile } from "@/agent/tools/vaultRead";
import { searchNotesTool } from "@/agent/tools/vaultSearch";
import { listRecentNotesTool } from "@/agent/tools/vaultList";
import { appendNoteTool, createNoteTool, replaceNoteContentTool } from "@/agent/tools/vaultWrite";
import type { AgentWriteMode } from "@/types";
import { TFile, type App } from "obsidian";

interface MockFileInit {
  path: string;
  content: string;
  mtime?: number;
}

function makeTFile(init: MockFileInit): TFile {
  const file = new TFile();
  const basename = init.path.replace(/\.md$/i, "").split("/").pop() ?? "";

  Object.assign(file, {
    path: init.path,
    basename,
    stat: { ctime: init.mtime ?? 0, mtime: init.mtime ?? 0, size: init.content.length },
  });

  return file;
}

function buildMockApp(filesInit: MockFileInit[]) {
  const files = filesInit.map(makeTFile);
  const contents = new Map(filesInit.map((init) => [init.path, init.content]));
  const created: Array<{ path: string; content: string }> = [];
  const modified: Array<{ path: string; content: string }> = [];

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: (path: string) => files.find((file) => file.path === path) ?? null,
      cachedRead: async (file: TFile) => {
        const content = contents.get(file.path);

        if (content == null) {
          throw new Error(`mock miss: ${file.path}`);
        }

        return content;
      },
      read: async (file: TFile) => {
        const content = contents.get(file.path);

        if (content == null) {
          throw new Error(`mock miss: ${file.path}`);
        }

        return content;
      },
      create: async (path: string, content: string) => {
        const file = makeTFile({ path, content });
        files.push(file);
        contents.set(path, content);
        created.push({ path, content });
        return file;
      },
      modify: async (file: TFile, content: string) => {
        contents.set(file.path, content);
        modified.push({ path: file.path, content });
      },
      adapter: { exists: async () => true, read: async () => "" },
    },
  } as unknown as App;

  return { app, created, modified, contents };
}

function buildCtx(app: App, overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return {
    app,
    writeMode: "auto" as AgentWriteMode,
    readNoteMaxChars: 20_000,
    requestWriteApproval: () => true,
    notifyWrite: () => {},
    ...overrides,
  };
}

describe("search_notes", () => {
  it("ranks filename and content matches with snippets", async () => {
    const { app } = buildMockApp([
      { path: "工作/周报.md", content: "本周完成了 A", mtime: 200 },
      { path: "日记/diary.md", content: "今天写了周报总结，还聊了周报模板", mtime: 100 },
      { path: "无关/note.md", content: "nothing here", mtime: 300 },
    ]);

    const result = await searchNotesTool.execute({ query: "周报" }, buildCtx(app));

    expect(result.status).toBe("ok");
    expect(result.output).toContain("[[周报]]");
    expect(result.output).toContain("diary");
    expect(result.output).not.toContain("[[note]]");
    // 文件名命中的「周报」应排在仅正文命中的 diary 之前
    expect(result.output.indexOf("[[周报]]")).toBeLessThan(result.output.indexOf("[[diary]]"));
  });

  it("reports empty results with suggestions", async () => {
    const { app } = buildMockApp([{ path: "a.md", content: "hello" }]);

    const result = await searchNotesTool.execute({ query: "不存在" }, buildCtx(app));

    expect(result.output).toContain("没有找到");
    expect(result.output).toContain("list_recent_notes");
  });
});

describe("read_note / resolveNoteFile", () => {
  it("resolves by exact path, .md suffix, and unique basename", () => {
    const { app } = buildMockApp([{ path: "项目/会议.md", content: "x" }]);

    expect(resolveNoteFile(app, "项目/会议.md").file).toBeTruthy();
    expect(resolveNoteFile(app, "项目/会议").file).toBeTruthy();
    expect(resolveNoteFile(app, "会议").file).toBeTruthy();
    expect(resolveNoteFile(app, "没有的笔记").file).toBeNull();
  });

  it("asks for clarification when the basename matches multiple notes", () => {
    const { app } = buildMockApp([
      { path: "a/周报.md", content: "x" },
      { path: "b/周报.md", content: "y" },
    ]);

    const resolved = resolveNoteFile(app, "周报");

    expect(resolved.file).toBeNull();
    expect(resolved.note).toContain("匹配到多篇");
  });

  it("truncates long notes and reports the cut", async () => {
    const long = "长".repeat(2000);
    const { app } = buildMockApp([{ path: "big.md", content: long }]);

    const result = await readNoteTool.execute({ path: "big.md" }, buildCtx(app, { readNoteMaxChars: 50 }));

    expect(result.output).toContain("已截断");
    expect(result.output.length).toBeLessThan(long.length);
    expect(result.output).not.toContain("长".repeat(51));
  });
});

describe("list_recent_notes", () => {
  it("orders by mtime desc and caps the limit", async () => {
    const { app } = buildMockApp([
      { path: "old.md", content: "x", mtime: 1 },
      { path: "new.md", content: "x", mtime: 99 },
      { path: "mid.md", content: "x", mtime: 50 },
    ]);

    const result = await listRecentNotesTool.execute({ limit: 2 }, buildCtx(app));

    expect(result.output.indexOf("[[new]]")).toBeLessThan(result.output.indexOf("[[mid]]"));
    expect(result.output).not.toContain("[[old]]");
  });
});

describe("write tools gating", () => {
  it("create_note refuses to overwrite existing notes", async () => {
    const { app } = buildMockApp([{ path: "存在.md", content: "x" }]);

    const result = await createNoteTool.execute({ path: "存在.md", content: "y" }, buildCtx(app));

    expect(result.status).toBe("error");
    expect(result.output).toContain("已存在");
  });

  it("executor blocks writes in readonly mode", async () => {
    const { app } = buildMockApp([]);
    const executor = new ToolExecutor([createNoteTool], buildCtx(app, { writeMode: "readonly" }));

    const result = await executor.execute({
      id: "c1",
      type: "function",
      function: { name: "create_note", arguments: JSON.stringify({ path: "新.md", content: "x" }) },
    });

    expect(result.status).toBe("denied");
    expect(result.output).toContain("只读");
  });

  it("confirm mode denies when the user declines", async () => {
    const { app } = buildMockApp([{ path: "目标.md", content: "旧内容" }]);
    const ctx = buildCtx(app, { writeMode: "confirm", requestWriteApproval: () => false });

    const result = await appendNoteTool.execute({ path: "目标.md", content: "追加" }, ctx);

    expect(result.status).toBe("denied");
    expect(result.output).toContain("拒绝");
  });

  it("create_note normalizes path and appends .md", async () => {
    const { app, created } = buildMockApp([]);

    const result = await createNoteTool.execute({ path: "/工作/纪要/", content: "# 纪要" }, buildCtx(app));

    expect(result.status).toBe("ok");
    expect(created[0].path).toBe("工作/纪要.md");
  });

  it("append_note joins with a blank line and keeps existing content", async () => {
    const { app, modified } = buildMockApp([{ path: "a.md", content: "第一段" }]);

    const result = await appendNoteTool.execute({ path: "a", content: "第二段" }, buildCtx(app));

    expect(result.status).toBe("ok");
    expect(modified[0].content).toBe("第一段\n\n第二段");
  });

  it("replace_note_content overwrites the whole body", async () => {
    const { app, modified } = buildMockApp([{ path: "a.md", content: "旧" }]);

    const result = await replaceNoteContentTool.execute({ path: "a.md", content: "新" }, buildCtx(app));

    expect(result.status).toBe("ok");
    expect(modified[0].content).toBe("新");
  });
});

describe("ToolExecutor", () => {
  it("rejects unknown tools and malformed JSON args", async () => {
    const { app } = buildMockApp([]);
    const executor = new ToolExecutor([readNoteTool], buildCtx(app));

    const unknown = await executor.execute({
      id: "c1",
      type: "function",
      function: { name: "nope", arguments: "{}" },
    });
    expect(unknown.status).toBe("error");
    expect(unknown.output).toContain("未知工具");

    const malformed = await executor.execute({
      id: "c2",
      type: "function",
      function: { name: "read_note", arguments: "{broken" },
    });
    expect(malformed.status).toBe("error");
    expect(malformed.output).toContain("参数不是合法 JSON");
  });
});
