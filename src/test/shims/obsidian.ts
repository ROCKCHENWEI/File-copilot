import { vi } from "vitest";

/** Minimal stub so Vitest can load modules that import `obsidian` (package has no Node entry). */
export const requestUrl = vi.fn();

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
  json: unknown;
  text: string;
}

/** 测试用 TFile 替身：接受属性对象，便于构造假笔记。 */
export class TFile {
  vault = null;
  path = "";
  name = "";
  basename = "";
  extension = "md";
  parent = null;
  stat: { ctime: number; mtime: number; size: number } = { ctime: 0, mtime: 0, size: 0 };

  constructor(init?: Partial<TFile>) {
    Object.assign(this, init);

    if (init?.path && !init.basename) {
      this.basename = this.path.replace(/\.md$/i, "").split("/").pop() ?? "";
    }
  }
}

export class TFolder {
  vault = null;
  path = "";
  name = "";
  parent = null;

  constructor(init?: Partial<TFolder>) {
    Object.assign(this, init);
  }
}

export class Notice {
  constructor(
    public message: string | DocumentFragment,
    public timeout?: number,
  ) {}
}

export class Menu {
  addItem() {
    return this;
  }
  showAtMouseEvent() {
    return this;
  }
}
