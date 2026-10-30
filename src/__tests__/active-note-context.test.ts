import { buildActiveNoteContextAppendix } from "@/utils/active-note-context";
import type { App } from "obsidian";

describe("buildActiveNoteContextAppendix", () => {
  it("returns null when there is no active file", async () => {
    const app = {
      workspace: { getActiveFile: () => null },
      vault: { cachedRead: vi.fn(), read: vi.fn() },
    } as unknown as App;

    await expect(buildActiveNoteContextAppendix(app, 12_000)).resolves.toBeNull();
    expect(app.vault.cachedRead).not.toHaveBeenCalled();
  });

  it("returns appendix with path and excerpt when file can be read", async () => {
    const file = { path: "notes/x.md", basename: "x" };
    const app = {
      workspace: { getActiveFile: () => file },
      vault: {
        cachedRead: vi.fn().mockResolvedValue("hello\nworld"),
        read: vi.fn(),
      },
    } as unknown as App;

    const appendix = await buildActiveNoteContextAppendix(app, 12_000);

    expect(appendix).toContain("notes/x.md");
    expect(appendix).toContain("x");
    expect(appendix).toContain("hello");
    expect(appendix).toContain("world");
    expect(app.vault.cachedRead).toHaveBeenCalledWith(file);
  });

  it("falls back to vault.read when cachedRead fails", async () => {
    const file = { path: "a.md", basename: "a" };
    const app = {
      workspace: { getActiveFile: () => file },
      vault: {
        cachedRead: vi.fn().mockRejectedValue(new Error("cache miss")),
        read: vi.fn().mockResolvedValue("from disk"),
      },
    } as unknown as App;

    const appendix = await buildActiveNoteContextAppendix(app, 12_000);

    expect(appendix).toContain("from disk");
    expect(app.vault.read).toHaveBeenCalledWith(file);
  });

  it("returns null when both reads fail", async () => {
    const file = { path: "a.md", basename: "a" };
    const app = {
      workspace: { getActiveFile: () => file },
      vault: {
        cachedRead: vi.fn().mockRejectedValue(new Error("fail")),
        read: vi.fn().mockRejectedValue(new Error("fail")),
      },
    } as unknown as App;

    await expect(buildActiveNoteContextAppendix(app, 12_000)).resolves.toBeNull();
  });

  it("truncates excerpt to maxChars", async () => {
    const file = { path: "b.md", basename: "b" };
    const body = "x".repeat(100);
    const app = {
      workspace: { getActiveFile: () => file },
      vault: {
        cachedRead: vi.fn().mockResolvedValue(body),
        read: vi.fn(),
      },
    } as unknown as App;

    const appendix = await buildActiveNoteContextAppendix(app, 20);

    expect(appendix).toBeTruthy();
    expect(appendix!.length).toBeLessThan(body.length + 200);
    expect(appendix).not.toContain("x".repeat(50));
  });
});
