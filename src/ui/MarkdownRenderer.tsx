import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { ExtraProps } from "react-markdown";

interface MarkdownRendererProps {
  children: string;
}

type CodeBlockProps = React.ClassAttributes<HTMLElement> &
  React.HTMLAttributes<HTMLElement> &
  ExtraProps & {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  };

function normalizeCode(children?: React.ReactNode): string {
  return String(children ?? "").replace(/\n$/, "");
}

function CodeBlock({ inline, className, children }: CodeBlockProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const code = normalizeCode(children);
  const language = useMemo(() => {
    const match = /language-(\S+)/.exec(className ?? "");
    return match?.[1] ?? "";
  }, [className]);

  if (inline) {
    return <code className="copilot-inline-code">{children}</code>;
  }

  async function handleCopy(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) {
        return;
      }

      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.warn("Failed to copy code block", error);
    }
  }

  return (
    <div className="copilot-code-block">
      <div className="copilot-code-header">
        <span className="copilot-code-language">{language || "text"}</span>
        <button type="button" className="copilot-code-copy" onClick={() => void handleCopy()}>
          {copied ? "已复制" : "复制代码"}
        </button>
      </div>
      <pre>
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ children }: MarkdownRendererProps): React.JSX.Element {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        a(props) {
          return <a {...props} target="_blank" rel="noopener noreferrer" />;
        },
        code(props) {
          return <CodeBlock {...props} />;
        },
        table(props) {
          return (
            <div className="copilot-table-wrap">
              <table {...props} />
            </div>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
