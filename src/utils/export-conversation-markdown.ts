import type { ConversationRecord } from "@/types";
import { ensureVaultFolders } from "@/utils/storage";
import type { App } from "obsidian";

export function slugifyForFileName(title: string): string {
  const base = title
    .replace(/[\\/:*?"<>|#\n\r\t]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
    .replace(/^-+|-+$/g, "");

  return base || "chat";
}

export function buildConversationMarkdownDocument(record: ConversationRecord): string {
  const title = record.title?.trim() || "未命名对话";
  const exportedAt = new Date().toISOString();
  const lines: string[] = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `exported_at: ${JSON.stringify(exportedAt)}`,
    `provider: ${JSON.stringify(record.providerId)}`,
    `model: ${JSON.stringify(record.model)}`,
    "conversation_id: " + JSON.stringify(record.id),
    "---",
    "",
    `# ${title}`,
    "",
  ];

  for (const message of record.messages) {
    const roleLabel = message.role === "user" ? "用户" : message.role === "assistant" ? "助手" : "系统";
    const time = new Date(message.createdAt).toLocaleString("zh-CN");

    lines.push(`## ${roleLabel} · ${time}`);
    lines.push("");

    for (const step of message.steps ?? []) {
      const mark = step.status === "ok" ? "✓" : step.status === "denied" ? "⊘" : "✗";
      lines.push(`> 🔧 ${mark} ${step.toolName}（${step.argsPreview}）`);
    }

    if (message.steps?.length) {
      lines.push("");
    }

    if (message.content.trim()) {
      lines.push(message.content);
    } else {
      lines.push("_（空）_");
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export async function writeConversationMarkdownExport(
  app: App,
  record: ConversationRecord,
  exportFolder: string,
): Promise<string> {
  const markdown = buildConversationMarkdownDocument(record);
  await ensureVaultFolders(app, exportFolder);

  const slug = slugifyForFileName(record.title || "chat");
  const ts = new Date(record.updatedAt || record.createdAt || Date.now()).toISOString().replace(/[:.]/g, "-");
  let relativePath = `${exportFolder}/${slug}-${ts}.md`;
  let suffix = 0;

  while (await app.vault.adapter.exists(relativePath)) {
    suffix += 1;
    relativePath = `${exportFolder}/${slug}-${ts}-${suffix}.md`;
  }

  const created = await app.vault.create(relativePath, markdown);
  return created.path;
}
