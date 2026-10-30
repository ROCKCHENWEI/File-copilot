import { PROVIDERS } from "@/constants";
import type CopilotPlugin from "@/main";
import { ChatService } from "@/llm/ChatService";
import { getDefaultModelForProvider, getModelsForProvider } from "@/settings/model";
import type { ProviderId } from "@/types";
import { ApiKeyField } from "@/ui/ApiKeyField";
import { BoltIcon, RefreshIcon } from "@/ui/icons";
import React, { useEffect, useState } from "react";
import { Notice } from "obsidian";

interface ModelPanelProps {
  plugin: CopilotPlugin;
  providerId: ProviderId;
  model: string;
  isStreaming: boolean;
  onProviderChange: (providerId: ProviderId) => void;
  onModelChange: (model: string) => void;
  /** 面板内改动设置后通知父组件刷新派生状态（如模型栏警示）。 */
  onSettingsChanged: () => void;
}

/**
 * 模型面板：服务商/模型选择 + 「从 API 获取模型列表」刷新 + 内联 API Key。
 * 拉取成功后写入 settings.customModels（覆盖内置列表），可用「重置」恢复内置。
 */
export function ModelPanel({
  plugin,
  providerId,
  model,
  isStreaming,
  onProviderChange,
  onModelChange,
  onSettingsChanged,
}: ModelPanelProps): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const models = getModelsForProvider(providerId, plugin.settings);
  const usingCustom = (plugin.settings.customModels[providerId] ?? []).length > 0;
  const providerLabel = PROVIDERS.find((provider) => provider.id === providerId)?.label ?? providerId;

  async function handleRefreshModels(): Promise<void> {
    if (refreshing) {
      return;
    }

    setRefreshing(true);

    try {
      const fetched = await ChatService.listAvailableModels(plugin.settings, providerId);

      if (!fetched.length) {
        new Notice(`${providerLabel} 未返回任何模型，保留当前列表。`);
        return;
      }

      plugin.settings = {
        ...plugin.settings,
        customModels: { ...plugin.settings.customModels, [providerId]: fetched },
      };
      await plugin.saveSettings();
      onSettingsChanged();

      if (!fetched.includes(model)) {
        onModelChange(fetched[0]);
      }

      new Notice(`已获取 ${providerLabel} 模型列表（${fetched.length} 个）`);
    } catch (error) {
      new Notice(`获取模型列表失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleResetModels(): Promise<void> {
    plugin.settings = {
      ...plugin.settings,
      customModels: { ...plugin.settings.customModels, [providerId]: [] },
    };
    await plugin.saveSettings();
    onSettingsChanged();

    const defaults = getModelsForProvider(providerId, plugin.settings);

    if (!defaults.includes(model)) {
      onModelChange(getDefaultModelForProvider(providerId));
    }

    new Notice(`已恢复 ${providerLabel} 内置模型列表`);
  }

  async function handleTestConnection(): Promise<void> {
    if (testing) {
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { latencyMs } = await ChatService.testConnection(plugin.settings, providerId, model);
      setTestResult({
        ok: true,
        text: `${model} 联通正常（${(latencyMs / 1000).toFixed(1)}s，${providerLabel}）`,
      });
    } catch (error) {
      setTestResult({ ok: false, text: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setTesting(false);
    }
  }

  // 切换服务商 / 模型后清除旧结果
  useEffect(() => {
    setTestResult(null);
  }, [providerId, model]);

  return (
    <div className="copilot-panel">
      <div className="copilot-toolbar-group">
        <label className="copilot-field">
          <span className="copilot-field-label">服务商</span>
          <select
            className="copilot-select"
            value={providerId}
            disabled={isStreaming}
            onChange={(event) => {
              const nextProvider = event.target.value as ProviderId;
              onProviderChange(nextProvider);
              onModelChange(getDefaultModelForProvider(nextProvider, plugin.settings));
            }}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
        <div className="copilot-field">
          <span className="copilot-field-label copilot-model-field-label">
            模型
            <span className="copilot-model-field-tools">
              {usingCustom ? <span className="copilot-model-source-badge">API</span> : null}
              <button
                type="button"
                className="copilot-icon-button copilot-model-refresh"
                title={`从 ${providerLabel} API 获取该 Key 可用的模型列表`}
                aria-label="获取模型列表"
                disabled={refreshing || isStreaming}
                onClick={() => void handleRefreshModels()}
              >
                <RefreshIcon size={13} className={refreshing ? "is-spinning" : undefined} />
              </button>
              {usingCustom ? (
                <button
                  type="button"
                  className="copilot-model-reset"
                  title="恢复内置模型列表"
                  disabled={isStreaming}
                  onClick={() => void handleResetModels()}
                >
                  重置
                </button>
              ) : null}
            </span>
          </span>
          <select
            className="copilot-select"
            value={model}
            disabled={isStreaming}
            onChange={(event) => onModelChange(event.target.value)}
          >
            {models.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="copilot-connection-row">
        <button
          type="button"
          className="copilot-test-button"
          title={`用当前 Key 对「${providerLabel} · ${model}」发一条最小测试消息，验证可以正常对话`}
          disabled={testing || refreshing || isStreaming}
          onClick={() => void handleTestConnection()}
        >
          <BoltIcon size={13} />
          <span>{testing ? "测试中…" : "测试当前模型联通"}</span>
        </button>
        {testResult ? (
          <span className={`copilot-connection-result${testResult.ok ? " is-ok" : " is-error"}`} title={testResult.text}>
            {testResult.ok ? "✓" : "✗"} {testResult.text}
          </span>
        ) : null}
      </div>
      <ApiKeyField
        key={providerId}
        plugin={plugin}
        providerId={providerId}
        onChanged={onSettingsChanged}
      />
      <div className="copilot-panel-version" title="当前加载的插件构建版本；升级文件后需重启插件才会变化">
        v{plugin.manifest?.version ?? "?"}
      </div>
    </div>
  );
}
