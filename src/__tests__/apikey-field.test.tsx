// @vitest-environment jsdom
import { ApiKeyField, isProviderKeyMissing } from "@/ui/ApiKeyField";
import { DEFAULT_SETTINGS } from "@/constants";
import type CopilotPlugin from "@/main";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

function buildPlugin(): { plugin: CopilotPlugin; saved: unknown[] } {
  const saved: unknown[] = [];
  const plugin = {
    settings: { ...DEFAULT_SETTINGS },
    saveSettings: async () => {
      saved.push(plugin.settings);
    },
  } as unknown as CopilotPlugin;

  return { plugin, saved };
}

describe("ApiKeyField", () => {
  it("shows 未配置 when the key is empty, and saves trimmed input on change", async () => {
    const { plugin, saved } = buildPlugin();

    render(<ApiKeyField plugin={plugin} providerId="kimi" />);

    expect(screen.getByText("未配置")).toBeTruthy();

    const input = screen.getByPlaceholderText(/输入 Kimi API Key/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  sk-test  " } });

    await vi.waitFor(() => {
      expect(plugin.settings.kimiApiKey).toBe("sk-test");
      expect(saved).toHaveLength(1);
    });
    expect(screen.getByText("已配置")).toBeTruthy();
  });

  it("masks the key by default and toggles visibility", () => {
    const { plugin } = buildPlugin();
    plugin.settings = { ...plugin.settings, glmApiKey: "glm-key" };

    render(<ApiKeyField plugin={plugin} providerId="glm" />);

    const input = screen.getByPlaceholderText(/输入 GLM API Key/) as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByTitle("显示 Key"));
    expect(input.type).toBe("text");
    expect(screen.getByTitle("隐藏 Key")).toBeTruthy();
  });

  it("shows the session-only hint unless keys are persisted locally", () => {
    const { plugin } = buildPlugin();

    const { rerender } = render(<ApiKeyField plugin={plugin} providerId="kimi" />);
    expect(screen.getByText(/仅本次会话有效/)).toBeTruthy();

    plugin.settings = { ...plugin.settings, persistApiKeysLocally: true };
    rerender(<ApiKeyField plugin={plugin} providerId="kimi" />);
    expect(screen.queryByText(/仅本次会话有效/)).toBeNull();
  });
});

describe("isProviderKeyMissing", () => {
  it("reflects whether the current provider has a key", () => {
    const { plugin } = buildPlugin();

    expect(isProviderKeyMissing(plugin, "kimi")).toBe(true);
    plugin.settings = { ...plugin.settings, kimiApiKey: "k" };
    expect(isProviderKeyMissing(plugin, "kimi")).toBe(false);
  });
});
