import type CopilotPlugin from "@/main";
import { loadConversations } from "@/utils/storage";
import type { ConversationRecord } from "@/types";
import React, { useCallback, useEffect, useState } from "react";
import { TFile } from "obsidian";

/** 会话历史：加载、随设置刷新、删除（移入系统废纸篓）。 */
export function useConversationHistory(plugin: CopilotPlugin): {
  history: ConversationRecord[];
  refresh: () => void;
  remove: (record: ConversationRecord) => Promise<void>;
} {
  const [history, setHistory] = useState<ConversationRecord[]>([]);

  const refresh = useCallback((): void => {
    void loadConversations(plugin.app, plugin.settings.conversationStorageFolder)
      .then((records) => {
        setHistory(records);
      })
      .catch((error) => {
        console.warn("Failed to load conversations", error);
      });
  }, [plugin.app, plugin.settings.conversationStorageFolder]);

  useEffect(() => {
    refresh();
    const unsubscribe = plugin.registerSettingsListener(refresh);

    return () => {
      unsubscribe();
    };
  }, [plugin, refresh]);

  const remove = useCallback(
    async (record: ConversationRecord): Promise<void> => {
      try {
        const prefix = `${plugin.settings.conversationStorageFolder}/`;
        const file = plugin.app.vault
          .getFiles()
          .find((item: TFile) => item.path.startsWith(prefix) && item.path.includes(record.id));

        if (file) {
          await plugin.app.vault.trash(file, true);
        }

        setHistory((current) => current.filter((item) => item.id !== record.id));
      } catch (error) {
        console.warn("Failed to remove conversation", record.id, error);
      }
    },
    [plugin.app, plugin.settings.conversationStorageFolder],
  );

  return { history, refresh, remove };
}
