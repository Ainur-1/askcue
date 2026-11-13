import { app, BrowserWindow } from "electron"
import { initializeIpcHandlers } from "../ipc"
import { KeybindManager } from "../services/KeybindManager"
import { SettingsManager } from "../services/SettingsManager"
import { OllamaManager } from "../services/OllamaManager"
import { AppState } from "../main"
import { initializeSystemProxy } from "../services/SystemProxyManager"
import { stopOpenCode } from '../services/OpenCodeManager';
import { initializeAIDiagnostics } from './aiDiagnostics';

export async function initializeApp() {
  // A normal close hides AskCue to the tray. A later launch must explicitly show
  // that hidden window; focus() alone is a no-op for an invisible BrowserWindow.
  app.on('second-instance', () => {
    const appState = AppState.getInstance();
    const mainWin = appState.getMainWindow();
    if (!mainWin || mainWin.isDestroyed()) {
      appState.createWindow();
      return;
    }
    if (mainWin.isMinimized()) mainWin.restore();
    appState.centerAndShowWindow();
    mainWin.show();
    mainWin.focus();
  });

  // 2. Wait for app to be ready
  await app.whenReady()
  initializeAIDiagnostics()
  await initializeSystemProxy()

  // 2b. PRE-EMPTIVE dock hide: must happen before ANY operation that causes macOS to
  // register a dock entry (app.setName, BrowserWindow creation, etc.).
  // We read isUndetectable directly from settings here — AppState singleton isn't
  // constructed yet, so we cannot call appState.getUndetectable().
  if (process.platform === 'darwin') {
    // SettingsManager is already statically imported — no require() needed.
    const isUndetectableOnStartup = SettingsManager.getInstance().get('isUndetectable') ?? false;
    if (isUndetectableOnStartup) {
      app.dock.hide();
    }
  }

  // 3. Initialize Managers
  // Initialize CredentialsManager and load keys explicitly
  // This fixes the issue where keys (especially in production) aren't loaded in time for RAG/LLM
  const { CredentialsManager } = require('../services/CredentialsManager');
  CredentialsManager.getInstance().init();

  // 4. Initialize State
  const appState = AppState.getInstance()

  // Explicitly load credentials into helpers
  appState.processingHelper.loadStoredCredentials();

  // Initialize IPC handlers before window creation
  initializeIpcHandlers(appState)

  // Apply the full disguise payload (names, dock icon, AUMID) early
  appState.applyInitialDisguise();

  // NOTE: CredentialsManager.init() and loadStoredCredentials() are already called
  // above before this block — do NOT call them again here to avoid double key-load.

  // Anonymous install ping - one-time, non-blocking
  // See electron/services/InstallPingManager.ts for privacy details
  const { sendAnonymousInstallPing } = require('../services/InstallPingManager');
  sendAnonymousInstallPing();

  // Load stored Google Service Account path (for Speech-to-Text)
  const storedServiceAccountPath = CredentialsManager.getInstance().getGoogleServiceAccountPath();
  if (storedServiceAccountPath) {
    console.log("[Init] Loading stored Google Service Account path");
    appState.updateGoogleCredentials(storedServiceAccountPath);
  }

  console.log("App is ready")

  appState.createWindow()

  // Apply initial stealth state based on isUndetectable setting.
  // NOTE: app.dock.hide() was already called pre-emptively before createWindow()
  // when isUndetectable=true. Here we only need to initialize the tray for non-stealth mode.
  if (!appState.getUndetectable()) {
    // Normal mode: show tray (dock is already showing — no need to call dock.show() again)
    appState.showTray();
  }
  // Stealth mode: dock is already hidden, tray stays hidden, no action needed here.
  // Register global shortcuts using KeybindManager
  KeybindManager.getInstance().registerGlobalShortcuts()

  const initializeAfterFirstPaint = () => {
    setTimeout(() => {
      appState.initializeDeferredSubsystems().catch(console.error)

      try {
        const { CalendarManager } = require('../services/CalendarManager');
        const calMgr = CalendarManager.getInstance();
        calMgr.init();
        calMgr.on('start-meeting-requested', (event: any) => {
          appState.centerAndShowWindow();
          appState.startMeeting({ title: event.title, calendarEventId: event.id, source: 'calendar' });
        });
        calMgr.on('open-requested', () => appState.centerAndShowWindow());
      } catch (e) {
        console.error('[Main] Failed to initialize CalendarManager:', e);
      }

      appState.getIntelligenceManager().recoverUnprocessedMeetings().catch(err => {
        console.error('[Main] Failed to recover unprocessed meetings:', err);
      });
    }, 500)
  }
  appState.getWindowHelper().getLauncherWindow()?.once('ready-to-show', initializeAfterFirstPaint)

  // Note: We do NOT force dock show here anymore, respecting stealth mode.

  app.on("activate", () => {
    console.log("App activated")
    if (process.platform === 'darwin') {
      // Do NOT call dock.show() while a meeting is running — the dock icon
      // appearing mid-meeting is a critical stealth failure.
      if (!appState.getUndetectable() && !appState.getIsMeetingActive()) {
        app.dock.show();
      }
    }

    // If no window exists, create it
    if (appState.getMainWindow() === null) {
      appState.createWindow()
    } else {
      // If the window exists but is hidden, clicking the dock icon should restore it
      if (!appState.isVisible()) {
        appState.toggleMainWindow();
      }
    }
  })

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })

  // Scrub API keys from memory on quit to minimize exposure window
  app.on("before-quit", (event) => {
    console.log("App is quitting, cleaning up resources...");
    appState.setQuitting(true);

    // Dispose CropperWindowHelper to clean up IPC listeners and prevent memory leaks
    // This is critical to prevent resource leaks and ensure proper cleanup
    if (appState?.cropperWindowHelper) {
      appState.cropperWindowHelper.dispose();
    }

    // Kill Ollama if we started it
    OllamaManager.getInstance().stop();
    stopOpenCode();

    try {
      const { CredentialsManager } = require('../services/CredentialsManager');
      CredentialsManager.getInstance().scrubMemory();
      appState.processingHelper.getLLMHelper().scrubKeys();
      console.log('[Main] Credentials scrubbed from memory on quit');
    } catch (e) {
      console.error('[Main] Failed to scrub credentials on quit:', e);
    }
  })



  // app.dock?.hide() // REMOVED: User wants Dock icon visible
  app.commandLine.appendSwitch("disable-background-timer-throttling")
}

// initializeApp() is called from main.ts — do not call here to avoid double invocation
