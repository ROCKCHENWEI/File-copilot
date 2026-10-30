// @vitest-environment jsdom
import { ModelPanel } from "@/ui/ModelPanel";
import { ChatService } from "@/llm/ChatService";
import { DEFAULT_SETTINGS } from "@/constants";
import type CopilotPlugin from "@/main";
import type { ProviderId } from "@/types";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/llm/ChatService", () => ({
  ChatService: {
    listAvailableModels: vi.fn(),
    testConnection: vi.fn(),
  },
}));

function buildPlugin(settings = { ...DEFAULT_SETTINGS }): { plugin: CopilotPlugin; settings: unknown } {
  const plugin = {
    settings,
    manifest: { version: "0.2.1-test" },
    saveSettings: async () => {},
  } as unknown as CopilotPlugin;

  return { plugin, settings };
}

function renderPanel(plugin: CopilotPlugin, overrides: Partial<Parameters<typeof ModelPanel>[0]> = {}) {
  const props = {
    plugin,
    providerId: "kimi" as ProviderId,
    model: "kimi-for-coding",
    isStreaming: false,
    onProviderChange: vi.fn(),
    onModelChange: vi.fn(),
    onSettingsChanged: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<ModelPanel {...props} />) };
}

describe("ModelPanel", () => {
  beforeEach(() => {
    vi.mocked(ChatService.listAvailableModels).mockReset();
  });

  it("shows built-in models by default and no API badge", () => {
    const { plugin } = buildPlugin();
    renderPanel(plugin);

    const select = screen.getByDisplayValue("kimi-for-coding") as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toContain("kimi-k2.5");
    expect(screen.queryByText("API")).toBeNull();
    expect(screen.queryByTitle("恢复内置模型列表")).toBeNull();
  });

  it("refreshes the model list from the API and keeps a valid current model", async () => {
    vi.mocked(ChatService.listAvailableModels).mockResolvedValue(["kimi-latest", "kimi-for-coding"]);
    const { plugin } = buildPlugin();
    const onModelChange = vi.fn();

    renderPanel(plugin, { onModelChange });

    fireEvent.click(screen.getByTitle(/可用的模型列表/));

    await vi.waitFor(() => {
      expect(plugin.settings.customModels.kimi).toEqual(["kimi-latest", "kimi-for-coding"]);
    });

    // 当前模型 kimi-for-coding 仍在新列表中 → 不强制切换
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("API")).toBeTruthy();
  });

  it("switches to the first fetched model when the current one is gone", async () => {
    vi.mocked(ChatService.listAvailableModels).mockResolvedValue(["kimi-new-a", "kimi-new-b"]);
    const { plugin } = buildPlugin();
    const onModelChange = vi.fn();

    renderPanel(plugin, { onModelChange });

    fireEvent.click(screen.getByTitle(/可用的模型列表/));

    await vi.waitFor(() => {
      expect(onModelChange).toHaveBeenCalledWith("kimi-new-a");
    });
  });

  it("shows an error notice and keeps the list when the API fails", async () => {
    vi.mocked(ChatService.listAvailableModels).mockRejectedValue(new Error("boom"));
    const { plugin } = buildPlugin();

    renderPanel(plugin);

    fireEvent.click(screen.getByTitle(/可用的模型列表/));

    await vi.waitFor(() => {
      expect((screen.getByTitle(/可用的模型列表/) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(plugin.settings.customModels.kimi).toEqual([]);
  });

  it("resets back to the built-in list", async () => {
    const { plugin } = buildPlugin({
      ...DEFAULT_SETTINGS,
      customModels: { ...DEFAULT_SETTINGS.customModels, kimi: ["kimi-only-custom"] },
    });
    const onModelChange = vi.fn();

    renderPanel(plugin, { onModelChange, model: "kimi-only-custom" });

    expect(screen.getByDisplayValue("kimi-only-custom")).toBeTruthy();

    fireEvent.click(screen.getByTitle("恢复内置模型列表"));

    await vi.waitFor(() => {
      expect(plugin.settings.customModels.kimi).toEqual([]);
    });
    expect(onModelChange).toHaveBeenCalledWith("kimi-for-coding");
  });
});

describe("ModelPanel connection test", () => {
  beforeEach(() => {
    vi.mocked(ChatService.listAvailableModels).mockReset();
    vi.mocked(ChatService.testConnection).mockReset();
  });

  it("shows an inline success result with model name and latency", async () => {
    vi.mocked(ChatService.testConnection).mockResolvedValue({ latencyMs: 1234, reply: "pong" });
    const { plugin } = buildPlugin();

    renderPanel(plugin);

    fireEvent.click(screen.getByTitle(/验证可以正常对话/));

    await vi.waitFor(() => {
      expect(screen.getByText(/kimi-for-coding 联通正常/)).toBeTruthy();
    });
    expect(screen.getByTitle(/验证可以正常对话/).textContent).toContain("测试当前模型联通");
  });

  it("shows an inline error result when the test fails", async () => {
    vi.mocked(ChatService.testConnection).mockRejectedValue(new Error("401：invalid api key"));
    const { plugin } = buildPlugin();

    renderPanel(plugin);

    fireEvent.click(screen.getByTitle(/验证可以正常对话/));

    await vi.waitFor(() => {
      expect(screen.getByText(/invalid api key/)).toBeTruthy();
    });
  });

  it("clears the stale result after the model prop changes", async () => {
    vi.mocked(ChatService.testConnection).mockResolvedValue({ latencyMs: 10, reply: "pong" });
    const { plugin } = buildPlugin();

    const { props, rerender } = renderPanel(plugin);

    fireEvent.click(screen.getByTitle(/验证可以正常对话/));
    await vi.waitFor(() => {
      expect(screen.getByText(/联通正常/)).toBeTruthy();
    });

    // 父组件采纳新模型后回传新 prop → 面板清除旧结果
    rerender(<ModelPanel {...props} model="kimi-k2.5" />);

    await vi.waitFor(() => {
      expect(screen.queryByText(/联通正常/)).toBeNull();
    });
  });
});

