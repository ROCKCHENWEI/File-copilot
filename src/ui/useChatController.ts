import { runAgentTurn } from "@/agent/AgentRunner";
import { buildSystemPrompt } from "@/agent/prompts";
import { ToolExecutor, type ToolExecutionContext } from "@/agent/tools/index";
import { listRecentNotesTool } from "@/agent/tools/vaultList";
import { readNoteTool } from "@/agent/tools/vaultRead";
import { searchNotesTool } from "@/agent/tools/vaultSearch";
import { appendNoteTool, createNoteTool, replaceNoteContentTool } from "@/agent/tools/vaultWrite";
import { DEFAULT_CONVERSATION_TITLE } from "@/constants";
import type CopilotPlugin from "@/main";
import { ChatService } from "@/llm/ChatService";
import { buildConversationTitle, saveConversation } from "@/utils/storage";
import { buildActiveNoteContextAppendix } from "@/utils/active-note-context";
import { writeConversationMarkdownExport } from "@/utils/export-conversation-markdown";
import type {
  AgentPhase,
  AgentStep,
  ChatMessage,
  ChatRequestMessage,
  ConversationRecord,
  ProviderId,
} from "@/types";
import React, { useCallback, useRef, useState } from "react";
import { Notice } from "obsidian";

export const AGENT_TOOLS = [
  searchNotesTool,
  readNoteTool,
  listRecentNotesTool,
  createNoteTool,
  appendNoteTool,
  replaceNoteContentTool,
];

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
  };
}

export function createConversation(providerId: ProviderId, model: string): ConversationRecord {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    title: DEFAULT_CONVERSATION_TITLE,
    providerId,
    model,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** 历史消息 → 请求消息：只回传有正文的 user/assistant 文本（工具明细留在当轮）。 */
export function toRequestMessages(messages: ChatMessage[]): ChatRequestMessage[] {
  return messages
    .filter((message) => message.content.trim() && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({ role: message.role, content: message.content }));
}

export interface UseChatControllerResult {
  providerId: ProviderId;
  model: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  phase: AgentPhase;
  attachActiveNote: boolean;
  setProviderId: (providerId: ProviderId) => void;
  setModel: (model: string) => void;
  setAttachActiveNote: (value: boolean) => void;
  send: (rawInput: string) => Promise<void>;
  stop: () => void;
  newChat: () => void;
  loadConversation: (record: ConversationRecord) => void;
  saveManually: () => Promise<void>;
  exportMarkdown: () => Promise<void>;
}

export function useChatController(plugin: CopilotPlugin): UseChatControllerResult {
  const [providerId, setProviderIdState] = useState<ProviderId>(plugin.settings.defaultProvider);
  const [model, setModelState] = useState(plugin.settings.defaultModel);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [attachActiveNote, setAttachActiveNoteState] = useState(plugin.settings.includeActiveNoteContext);

  const controllerRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<ConversationRecord>(createConversation(providerId, model));
  // 注意：面板内联 Key 输入会整体替换 plugin.settings 对象，
  // 因此回调内必须直接读 plugin.settings（不能用渲染期快照的 ref）。
  const settings = plugin.settings;

  const setProviderId = useCallback((next: ProviderId) => setProviderIdState(next), []);
  const setModel = useCallback((next: string) => setModelState(next), []);
  const setAttachActiveNote = useCallback((value: boolean) => setAttachActiveNoteState(value), []);

  const updateLastAssistant = useCallback((updater: (message: ChatMessage) => ChatMessage): void => {
    setMessages((current) => {
      const updated = [...current];
      const last = updated[updated.length - 1];

      if (!last || last.role !== "assistant") {
        return current;
      }

      updated[updated.length - 1] = updater(last);
      return updated;
    });
  }, []);

  const persistConversation = useCallback(
    async (nextMessages: ChatMessage[], force = false): Promise<boolean> => {
      const settings = plugin.settings;
      const record: ConversationRecord = {
        ...conversationRef.current,
        providerId,
        model,
        title: DEFAULT_CONVERSATION_TITLE,
        messages: nextMessages,
        updatedAt: Date.now(),
      };

      record.title = buildConversationTitle(record);
      conversationRef.current = record;

      if (!settings.autoSaveHistory && !force) {
        return false;
      }

      await saveConversation(plugin.app, record, settings.conversationStorageFolder);
      return true;
    },
    [model, plugin.app, providerId],
  );

  const send = useCallback(
    async (rawInput: string): Promise<void> => {
      const trimmed = rawInput.trim();

      if (!trimmed || isStreaming) {
        return;
      }

      const settings = plugin.settings;
      let userContent = trimmed;

      if (attachActiveNote) {
        const appendix = await buildActiveNoteContextAppendix(plugin.app, settings.activeNoteContextMaxChars);

        if (appendix) {
          userContent = `${trimmed}\n\n${appendix}`;
        }
      }

      const userMessage = createMessage("user", userContent);
      const assistantMessage: ChatMessage = { ...createMessage("assistant", ""), steps: [] };
      const nextMessages = [...messages, userMessage, assistantMessage];

      setMessages(nextMessages);
      setIsStreaming(true);
      setPhase("thinking");

      const controller = new AbortController();
      controllerRef.current = controller;

      const service = ChatService.fromSettings(settings, providerId, model);
      const toolsEnabled = settings.enableAgentTools;
      const ctx: ToolExecutionContext = {
        app: plugin.app,
        writeMode: settings.agentWriteMode,
        readNoteMaxChars: settings.readNoteMaxChars,
        requestWriteApproval: (message) => window.confirm(message),
        notifyWrite: (message) => new Notice(message),
      };

      try {
        const turn = await runAgentTurn(
          {
            service,
            tools: toolsEnabled ? AGENT_TOOLS : [],
            executor: new ToolExecutor(toolsEnabled ? AGENT_TOOLS : [], ctx),
            systemPrompt: buildSystemPrompt(settings, toolsEnabled),
            maxToolRounds: settings.maxToolRounds,
            stream: settings.streamResponses,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            signal: controller.signal,
          },
          toRequestMessages(nextMessages),
          {
            onContentChunk: (chunk) => {
              updateLastAssistant((message) => ({ ...message, content: message.content + chunk }));
            },
            onStepUpdate: (step: AgentStep) => {
              updateLastAssistant((message) => {
                const steps = [...(message.steps ?? [])];
                const index = steps.findIndex((item) => item.id === step.id);

                if (index >= 0) {
                  steps[index] = step;
                } else {
                  steps.push(step);
                }

                return { ...message, steps };
              });
            },
            onPhase: (nextPhase) => setPhase(nextPhase),
          },
        );

        setMessages((current) => {
          const updated = [...current];
          const last = updated[updated.length - 1];

          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: settings.streamResponses ? last.content : turn.content,
              steps: turn.steps.length ? turn.steps : last.steps,
            };
          }

          void persistConversation(updated);
          return updated;
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setMessages((current) => current.filter((item) => item.content || item.role !== "assistant"));
        } else {
          const message = error instanceof Error ? error.message : "未知错误";
          new Notice(message);
          setMessages((current) => current.slice(0, -1));
        }
      } finally {
        controllerRef.current = null;
        setIsStreaming(false);
        setPhase("idle");
      }
    },
    [attachActiveNote, isStreaming, messages, model, persistConversation, plugin.app, providerId, updateLastAssistant],
  );

  const stop = useCallback((): void => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsStreaming(false);
    setPhase("idle");
  }, []);

  const newChat = useCallback((): void => {
    if (isStreaming) {
      stop();
    }

    conversationRef.current = createConversation(providerId, model);
    setMessages([]);
    setPhase("idle");
    plugin.pendingPrefill = "";
  }, [isStreaming, model, plugin, providerId, stop]);

  const loadConversation = useCallback((record: ConversationRecord): void => {
    if (isStreaming) {
      stop();
    }

    conversationRef.current = record;
    setProviderIdState(record.providerId);
    setModelState(record.model);
    setMessages(record.messages);
    setPhase("idle");
  }, [isStreaming, stop]);

  const saveManually = useCallback(async (): Promise<void> => {
    if (!messages.length || isStreaming) {
      return;
    }

    if (!plugin.settings.autoSaveHistory) {
      const convFolder = plugin.settings.conversationStorageFolder;
      const confirmed = window.confirm(
        `保存后，当前对话会以 JSON 明文写入 vault 的「${convFolder}」目录，可能被同步、备份或纳入版本控制。确定继续吗？`,
      );

      if (!confirmed) {
        return;
      }
    }

    const saved = await persistConversation(messages, true);

    if (saved) {
      new Notice(`当前对话已保存到 ${plugin.settings.conversationStorageFolder}`);
    }
  }, [isStreaming, messages, persistConversation]);

  const exportMarkdown = useCallback(async (): Promise<void> => {
    if (!messages.length || isStreaming) {
      return;
    }

    const exportFolder = plugin.settings.exportMarkdownFolder;
    const confirmed = window.confirm(
      `将把当前对话导出为 Markdown 文件，保存到 vault 的「${exportFolder}」目录（可被同步或纳入版本控制）。确定继续吗？`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const record: ConversationRecord = {
        ...conversationRef.current,
        providerId,
        model,
        messages,
        updatedAt: Date.now(),
      };

      record.title = buildConversationTitle(record);
      const path = await writeConversationMarkdownExport(plugin.app, record, exportFolder);
      new Notice(`已导出 Markdown：${path}`);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "导出失败");
    }
  }, [isStreaming, messages, model, plugin.app, providerId]);

  return {
    providerId,
    model,
    messages,
    isStreaming,
    phase,
    attachActiveNote,
    setProviderId,
    setModel,
    setAttachActiveNote,
    send,
    stop,
    newChat,
    loadConversation,
    saveManually,
    exportMarkdown,
  };
}
