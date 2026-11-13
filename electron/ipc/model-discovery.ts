import { AppState } from "../main"
import { safeHandle, broadcastOpenAICompatibleProvidersChanged } from "./safeHandle"
import { CredentialsManager } from '../services/CredentialsManager';
import { openCodeService, stopOpenCode } from '../services/OpenCodeManager';
import { DEFAULT_OPENCODE_SETTINGS, OPENCODE_GO_API_URL, OPENCODE_GO_SUBSCRIPTION_URL, validateOpenCodeSettings, openCodeProviderForUrl } from '../../shared/opencode';
import { createHash, randomUUID } from 'node:crypto';

export function registerModelDiscoveryHandlers(appState: AppState): void {
  const savedOpenCode = () => {
    const providers = CredentialsManager.getInstance().getOpenAICompatibleProviders()
      .filter(provider => openCodeProviderForUrl(provider.baseUrl) && provider.apiKey.trim());
    return providers.find(provider => openCodeProviderForUrl(provider.baseUrl) === 'opencode-go') || providers[0];
  };
  let importedFingerprint = '';
  let pendingImport: Promise<void> | undefined;
  const connectSaved = async () => {
    const saved = savedOpenCode();
    if (!saved) return;
    const cm = CredentialsManager.getInstance();
    const settings = cm.getOpenCodeSettings();
    if (settings.baseUrl !== DEFAULT_OPENCODE_SETTINGS.baseUrl) return;
    if (!settings.enabled) cm.setOpenCodeSettings({ ...settings, enabled: true });
    const providerID = openCodeProviderForUrl(saved.baseUrl)!;
    const fingerprint = createHash('sha256').update(`${providerID}:${saved.apiKey}`).digest('hex');
    if (importedFingerprint === fingerprint) return;
    if (pendingImport) { await pendingImport; return connectSaved(); }
    pendingImport = openCodeService.connectApiKey(providerID, saved.apiKey)
      .then(() => { importedFingerprint = fingerprint; })
      .finally(() => { pendingImport = undefined; });
    await pendingImport;
  };
  safeHandle('get-opencode-settings', () => {
    const { password, ...settings } = CredentialsManager.getInstance().getOpenCodeSettings();
    const saved = savedOpenCode();
    return {
      ...settings, hasPassword: Boolean(password), canImport: Boolean(saved), hasApiKey: Boolean(saved),
      providerID: saved ? openCodeProviderForUrl(saved.baseUrl)! : 'opencode-go',
      apiUrl: saved?.baseUrl || OPENCODE_GO_API_URL, subscriptionUrl: OPENCODE_GO_SUBSCRIPTION_URL,
    };
  });
  safeHandle('save-opencode-settings', async (_, value: unknown) => {
    try {
      const previous = CredentialsManager.getInstance().getOpenCodeSettings();
      const settings = validateOpenCodeSettings({ ...previous, ...(value as object) });
      stopOpenCode();
      importedFingerprint = '';
      CredentialsManager.getInstance().setOpenCodeSettings(settings);
      broadcastOpenAICompatibleProvidersChanged();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Invalid OpenCode settings' };
    }
  });
  safeHandle('get-opencode-models', async () => {
    try {
      await connectSaved();
      if (!CredentialsManager.getInstance().getOpenCodeSettings().enabled) return { success: true, models: [] };
      return { success: true, models: await openCodeService.models() };
    } catch (error) {
      return { success: false, models: [], error: error instanceof Error ? error.message : 'Cannot connect to OpenCode' };
    }
  });
  safeHandle('save-opencode-api-key', async (_, apiKey: unknown) => {
    try {
      if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('OpenCode API token is required');
      const cm = CredentialsManager.getInstance();
      const saved = savedOpenCode();
      cm.saveOpenAICompatibleProvider({
        ...saved, id: saved?.id || randomUUID(), name: saved?.name || 'OpenCode Go',
        baseUrl: saved?.baseUrl || OPENCODE_GO_API_URL, apiKey: apiKey.trim(),
      });
      if (cm.getOpenCodeSettings().baseUrl !== DEFAULT_OPENCODE_SETTINGS.baseUrl) stopOpenCode();
      cm.setOpenCodeSettings({ ...DEFAULT_OPENCODE_SETTINGS, enabled: true });
      await connectSaved();
      broadcastOpenAICompatibleProvidersChanged();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Cannot save OpenCode API token' };
    }
  });
  safeHandle('import-opencode-connection', async () => {
    try {
      const saved = savedOpenCode();
      if (!saved) throw new Error('No saved OpenCode API connection found');
      const cm = CredentialsManager.getInstance();
      const settings = cm.getOpenCodeSettings();
      if (settings.baseUrl !== 'http://127.0.0.1:4096') throw new Error('Saved keys can only be imported into local OpenCode');
      cm.setOpenCodeSettings({ ...settings, enabled: true });
      await openCodeService.connectApiKey(openCodeProviderForUrl(saved.baseUrl)!, saved.apiKey);
      broadcastOpenAICompatibleProvidersChanged();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Cannot import OpenCode connection' };
    }
  });
  // ==========================================
  // Dynamic Model Discovery Handlers
  // ==========================================

  safeHandle("fetch-provider-models", async (_, provider: 'gemini' | 'groq' | 'openai' | 'claude', apiKey: string) => {
    try {
      // Fall back to stored key if no key was explicitly provided
      let key = apiKey?.trim();
      if (!key) {
        const { CredentialsManager } = require('../services/CredentialsManager');
        const cm = CredentialsManager.getInstance();
        if (provider === 'gemini') key = cm.getGeminiApiKey();
        else if (provider === 'groq') key = cm.getGroqApiKey();
        else if (provider === 'openai') key = cm.getOpenaiApiKey();
        else if (provider === 'claude') key = cm.getClaudeApiKey();
      }

      if (!key) {
        return { success: false, error: 'No API key available. Please save a key first.' };
      }

      const { fetchProviderModels } = require('../utils/modelFetcher');
      const models = await fetchProviderModels(provider, key);
      return { success: true, models };
    } catch (error: any) {
      console.error(`[IPC] Failed to fetch ${provider} models:`, error);
      const msg = error?.response?.data?.error?.message || error.message || 'Failed to fetch models';
      return { success: false, error: msg };
    }
  });

  safeHandle("fetch-openai-compatible-models", async (_, baseUrl: string, apiKey: string) => {
    try {
      const u = (baseUrl || '').trim();
      const k = (apiKey || '').trim();
      if (!u) {
        return { success: false, error: 'Base URL is required' };
      }
      if (!k) {
        return { success: false, error: 'API key is required' };
      }
      const { fetchOpenAICompatibleModels } = require('../utils/modelFetcher');
      const models = await fetchOpenAICompatibleModels(u, k);
      return { success: true, models };
    } catch (error: any) {
      console.error('[IPC] fetch-openai-compatible-models failed:', error);
      const msg = error?.response?.data?.error?.message || error.message || 'Failed to fetch models';
      return { success: false, error: msg };
    }
  });

  safeHandle("get-openai-compatible-providers", async () => {
    try {
      const { CredentialsManager } = require('../services/CredentialsManager');
      return CredentialsManager.getInstance().getOpenAICompatibleProviders();
    } catch (error: any) {
      console.error('[IPC] get-openai-compatible-providers failed:', error);
      return [];
    }
  });

  safeHandle("save-openai-compatible-provider", async (_, provider: unknown) => {
    try {
      if (
        typeof provider !== 'object' || provider === null ||
        typeof (provider as any).id !== 'string' ||
        typeof (provider as any).name !== 'string' ||
        typeof (provider as any).baseUrl !== 'string' ||
        typeof (provider as any).apiKey !== 'string'
      ) {
        return { success: false, error: 'Invalid OpenAI-compatible provider payload' };
      }
      const { CredentialsManager } = require('../services/CredentialsManager');
      const p = provider as { id: string; name: string; baseUrl: string; apiKey: string; preferredModel?: string };
      CredentialsManager.getInstance().saveOpenAICompatibleProvider({
        id: p.id,
        name: p.name.trim(),
        baseUrl: p.baseUrl.trim(),
        apiKey: p.apiKey,
        preferredModel: typeof p.preferredModel === 'string' ? p.preferredModel.trim() : undefined,
      });
      broadcastOpenAICompatibleProvidersChanged();
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] save-openai-compatible-provider failed:', error);
      return { success: false, error: error.message };
    }
  });

  safeHandle("delete-openai-compatible-provider", async (_, id: string) => {
    try {
      const { CredentialsManager } = require('../services/CredentialsManager');
      CredentialsManager.getInstance().deleteOpenAICompatibleProvider(id);
      broadcastOpenAICompatibleProvidersChanged();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  safeHandle("set-provider-preferred-model", async (_, provider: 'gemini' | 'groq' | 'openai' | 'claude', modelId: string) => {
    try {
      const { CredentialsManager } = require('../services/CredentialsManager');
      CredentialsManager.getInstance().setPreferredModel(provider, modelId);
    } catch (error: any) {
      console.error(`[IPC] Failed to set preferred model for ${provider}:`, error);
    }
  });
}
