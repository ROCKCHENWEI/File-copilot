import type CopilotPlugin from "@/main";
import { getProviderApiKey } from "@/llm/providers";
import type { CopilotSettings, ProviderId } from "@/types";
import React, { useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/ui/icons";
import { PROVIDERS } from "@/constants";

interface ApiKeyFieldProps {
  plugin: CopilotPlugin;
  providerId: ProviderId;
  /** Key 变化后通知父组件（刷新模型栏的未配置警示）。 */
  onChanged?: () => void;
}

/**
 * 侧边栏内联的 API Key 输入：只显示当前所选服务商的 Key，
 * 写入 plugin.settings 并即时保存（与设置页行为一致）。
 */
export function ApiKeyField({ plugin, providerId, onChanged }: ApiKeyFieldProps): React.JSX.Element {
  // providerId 一定来自 PROVIDERS；兜底取第一个，保证 hooks 无条件执行。
  const provider = PROVIDERS.find((item) => item.id === providerId) ?? PROVIDERS[0];
  const settingKey = provider.apiKeySettingKey;
  const [value, setValue] = useState<string>(plugin.settings[settingKey]);
  const [visible, setVisible] = useState(false);
  const configured = value.trim().length > 0;

  async function handleChange(next: string): Promise<void> {
    setValue(next);
    const patch: Partial<CopilotSettings> = { [settingKey]: next.trim() };
    plugin.settings = {
      ...plugin.settings,
      ...patch,
    };
    await plugin.saveSettings();
    onChanged?.();
  }

  return (
    <div className="copilot-field copilot-apikey-field">
      <span className="copilot-field-label">
        {provider.label} API Key
        <span className={`copilot-apikey-status${configured ? " is-ok" : " is-missing"}`}>
          {configured ? "已配置" : "未配置"}
        </span>
      </span>
      <div className="copilot-apikey-row">
        <input
          className="copilot-apikey-input"
          type={visible ? "text" : "password"}
          placeholder={`输入 ${provider.label} API Key（${provider.description}）`}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => void handleChange(event.target.value)}
        />
        <button
          type="button"
          className="copilot-icon-button copilot-apikey-toggle"
          title={visible ? "隐藏 Key" : "显示 Key"}
          aria-label={visible ? "隐藏 Key" : "显示 Key"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
        </button>
      </div>
      {!plugin.settings.persistApiKeysLocally ? (
        <span className="copilot-apikey-hint">仅本次会话有效；需重启保留请在设置中开启「本地保存 API Key」。</span>
      ) : null}
    </div>
  );
}

/** 模型栏警示：当前服务商 Key 为空时显示。 */
export function isProviderKeyMissing(plugin: CopilotPlugin, providerId: ProviderId): boolean {
  return getProviderApiKey(plugin.settings, providerId).trim().length === 0;
}
