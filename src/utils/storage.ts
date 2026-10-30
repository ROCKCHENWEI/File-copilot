import type { ConversationRecord } from "@/types";
import { stripMarkdown, truncateText } from "@/utils/markdown";
import type { App, TFile } from "obsidian";

function buildConversationFileName(record: ConversationRecord): string {
  const timestamp = new Date(record.updatedAt || record.createdAt).toISOString().replace(/[:.]/g, "-");
  return `${record.providerId}-${timestamp}-${record.id}.json`;
}

export async function ensureVaultFolders(app: App, folderPath: string): Promise<void> {
  const segments = folderPath.split("/").filter(Boolean);
  let currentPath = "";

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;

    if (!(await app.vault.adapter.exists(currentPath))) {
      await app.vault.createFolder(currentPath);
    }
  }
}

async function ensureFolder(app: App, conversationFolder: string): Promise<void> {
  await ensureVaultFolders(app, conversationFolder);
}

export function buildConversationTitle(record: ConversationRecord): string {
  const firstUserMessage = record.messages.find((message) => message.role === "user");
  const fallbackTitle = `${record.providerId}-${new Date(record.createdAt).toLocaleString("zh-CN")}`;

  if (!firstUserMessage) {
    return fallbackTitle;
  }

  const plainText = stripMarkdown(firstUserMessage.content);
  return truncateText(plainText || fallbackTitle, 36);
}

export async function saveConversation(
  app: App,
  record: ConversationRecord,
  conversationFolder: string,
): Promise<TFile> {
  await ensureFolder(app, conversationFolder);

  const filePath = `${conversationFolder}/${buildConversationFileName(record)}`;
  const content = JSON.stringify(record, null, 2);

  const existing = app.vault.getAbstractFileByPath(filePath);

  if (existing && "path" in existing) {
    const existingFile = existing as TFile;
    await app.vault.modify(existingFile, content);
    return existingFile;
  }

  return app.vault.create(filePath, content);
}

export async function loadConversations(app: App, conversationFolder: string): Promise<ConversationRecord[]> {
  if (!(await app.vault.adapter.exists(conversationFolder))) {
    return [];
  }

  const prefix = `${conversationFolder}/`;
  const files = app.vault.getFiles().filter((file) => file.path.startsWith(prefix) && file.extension === "json");

  const records: ConversationRecord[] = [];

  for (const file of files) {
    try {
      const content = await app.vault.read(file);
      const parsed = JSON.parse(content) as ConversationRecord;
      records.push(parsed);
    } catch (error) {
      console.warn("Failed to parse conversation file", file.path, error);
    }
  }

  return records.sort((a, b) => b.updatedAt - a.updatedAt);
}
