// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MarkdownRenderer } from "@/ui/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders GFM tables", () => {
    render(
      <MarkdownRenderer>
        {"| 名称 | 值 |\n| --- | --- |\n| foo | bar |"}
      </MarkdownRenderer>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
  });

  it("renders code blocks with language labels and copy action", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <MarkdownRenderer>
        {"```ts\nconst answer = 42;\n```"}
      </MarkdownRenderer>,
    );

    expect(screen.getByText("ts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("const answer = 42;");
    });
  });

  it("opens links in a new tab safely", () => {
    render(
      <MarkdownRenderer>
        {"[OpenAI](https://openai.com)"}
      </MarkdownRenderer>,
    );

    const link = screen.getByRole("link", { name: "OpenAI" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
