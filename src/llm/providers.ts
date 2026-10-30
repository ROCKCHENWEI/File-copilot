import { PROVIDERS } from "@/constants";
import { getDefaultModelForProvider, resolveKnownModelForProvider } from "@/settings/model";
import type { CopilotSettings, ProviderDefinition, ProviderId } from "@/types";

export function listProviders(): ProviderDefinition[] {
  return PROVIDERS;
}

export function getProviderById(providerId: ProviderId): ProviderDefinition {
  const provider = PROVIDERS.find((item) => item.id === providerId);

  if (!provider) {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  return provider;
}

export function getProviderApiKey(settings: CopilotSettings, providerId: ProviderId): string {
  const provider = getProviderById(providerId);
  return settings[provider.apiKeySettingKey];
}

export function resolveProviderModel(providerId: ProviderId, candidate?: string, settings?: Pick<CopilotSettings, "customModels">): string {
  return (
    resolveKnownModelForProvider(providerId, candidate, settings?.customModels?.[providerId]) ??
    getDefaultModelForProvider(providerId, settings)
  );
}

export function clampTemperature(providerId: ProviderId, value: number): number {
  const provider = getProviderById(providerId);
  return Math.min(Math.max(value, provider.minTemperature), provider.maxTemperature);
}
