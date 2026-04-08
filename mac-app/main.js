const { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let tray = null;
let onboardingWindow = null;
let settingsWindow = null;
let listenerProcess = null;
let schedulerProcess = null;

// Paths
const agentDir = app.isPackaged
  ? path.join(process.resourcesPath, "agent")
  : path.join(__dirname, "..", "agent");
const envFile = path.join(agentDir, ".env");
const logsDir = path.join(agentDir, "logs");
const crmDir = path.join(agentDir, "crm");

// Ensure directories exist
[logsDir, crmDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── App lifecycle ────────────────────────────────────────────────

app.dock?.hide(); // Hide from dock — menu bar app only

app.whenReady().then(() => {
  if (!fs.existsSync(envFile)) {
    showOnboarding();
  } else {
    createTray();
    startAgent();
  }
});

app.on("window-all-closed", (e) => e.preventDefault()); // Keep running in tray

// ─── Tray (menu bar) ────────────────────────────────────────────

function createTray() {
  // Use a simple text icon if no icon file exists
  tray = new Tray(getIconPath());
  updateTrayMenu("disconnected");
}

function getIconPath() {
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  if (fs.existsSync(iconPath)) return iconPath;
  // Fallback — create a simple 16x16 icon
  return path.join(__dirname, "assets", "tray-icon.png");
}

function updateTrayMenu(status) {
  const statusLabels = {
    connected: "● Connected to WeChat",
    disconnected: "○ Not connected",
    running: "◉ Briefing in progress...",
  };

  const contextMenu = Menu.buildFromTemplate([
    { label: statusLabels[status] || statusLabels.disconnected, enabled: false },
    { type: "separator" },
    {
      label: "Run Briefing Now",
      click: () => runBriefingNow(),
    },
    {
      label: "Open Dashboard",
      click: () => openDashboard(),
    },
    {
      label: "Open CRM Spreadsheet",
      click: () => {
        const crmFile = path.join(crmDir, "WeChat_CRM.xlsx");
        if (fs.existsSync(crmFile)) {
          shell.openPath(crmFile);
        } else {
          dialog.showMessageBox({ message: "CRM spreadsheet not created yet. Run a briefing first." });
        }
      },
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => showSettings(),
    },
    {
      label: "View Logs",
      click: () => shell.openPath(logsDir),
    },
    { type: "separator" },
    {
      label: "Restart Listener",
      click: () => {
        stopAgent();
        startAgent();
      },
    },
    {
      label: "Quit",
      click: () => {
        stopAgent();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip("WeChat Morning Assistant");
}

// ─── Onboarding ─────────────────────────────────────────────────

function showOnboarding() {
  onboardingWindow = new BrowserWindow({
    width: 560,
    height: 680,
    resizable: false,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  onboardingWindow.loadFile("onboarding.html");
  onboardingWindow.on("closed", () => {
    onboardingWindow = null;
  });
}

// ─── Settings ───────────────────────────────────────────────────

function showSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    resizable: false,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile("settings.html");
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

// ─── Agent processes ────────────────────────────────────────────

function startAgent() {
  // Start listener
  listenerProcess = spawn("python3", ["listener.py"], {
    cwd: agentDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  listenerProcess.stdout.on("data", (data) => {
    const text = data.toString();
    console.log("[Listener]", text.trim());
    if (text.includes("Logged in")) {
      updateTrayMenu("connected");
    }
  });

  listenerProcess.stderr.on("data", (data) => {
    console.error("[Listener Error]", data.toString().trim());
  });

  listenerProcess.on("close", (code) => {
    console.log(`[Listener] Exited with code ${code}`);
    updateTrayMenu("disconnected");
  });

  // Start scheduler
  schedulerProcess = spawn("python3", ["main.py"], {
    cwd: agentDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  schedulerProcess.stdout.on("data", (data) => {
    console.log("[Scheduler]", data.toString().trim());
  });

  schedulerProcess.stderr.on("data", (data) => {
    console.error("[Scheduler Error]", data.toString().trim());
  });

  console.log("[App] Agent processes started");
}

function stopAgent() {
  if (listenerProcess) {
    listenerProcess.kill();
    listenerProcess = null;
  }
  if (schedulerProcess) {
    schedulerProcess.kill();
    schedulerProcess = null;
  }
  console.log("[App] Agent processes stopped");
}

function runBriefingNow() {
  updateTrayMenu("running");
  const proc = spawn("python3", ["main.py", "--now"], {
    cwd: agentDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout.on("data", (data) => console.log("[Briefing]", data.toString().trim()));
  proc.stderr.on("data", (data) => console.error("[Briefing Error]", data.toString().trim()));

  proc.on("close", (code) => {
    console.log(`[Briefing] Finished with code ${code}`);
    updateTrayMenu(listenerProcess ? "connected" : "disconnected");
    if (code === 0) {
      dialog.showMessageBox({
        type: "info",
        title: "Briefing Sent",
        message: "Your morning briefing has been sent to your email!",
      });
    }
  });
}

function openDashboard() {
  const dashboardPath = path.join(agentDir, "..", "dashboard", "public", "index.html");
  if (fs.existsSync(dashboardPath)) {
    shell.openPath(dashboardPath);
  } else {
    // If cloud dashboard is configured, open that
    const env = readEnv();
    if (env.VERCEL_KV_URL && env.CLIENT_ID) {
      shell.openExternal(`https://wechat-assistant.vercel.app/${env.CLIENT_ID}`);
    } else {
      dialog.showMessageBox({ message: "Dashboard not configured yet." });
    }
  }
}

// ─── IPC handlers (for onboarding/settings windows) ─────────────

ipcMain.handle("save-config", async (event, config) => {
  const lines = [
    `ANTHROPIC_API_KEY=${config.apiKey}`,
    `MY_WECHAT_NAME=${config.wechatName}`,
    `DELIVERY_METHOD=email`,
    `EMAIL_FROM=${config.emailFrom}`,
    `EMAIL_TO=${config.emailTo || config.emailFrom}`,
    `EMAIL_APP_PASSWORD=${config.emailPassword}`,
    `BRIEFING_TIME=${config.briefingTime}`,
    `WHISPER_MODEL=${config.whisperModel || "medium"}`,
    `VERCEL_KV_URL=${config.vercelKvUrl || ""}`,
    `CLIENT_ID=${config.clientId || ""}`,
  ];

  fs.writeFileSync(envFile, lines.join("\n"), "utf-8");
  return { success: true };
});

ipcMain.handle("load-config", async () => {
  return readEnv();
});

ipcMain.handle("validate-api-key", async (event, apiKey) => {
  return apiKey && apiKey.startsWith("sk-ant-") && apiKey.length > 20;
});

ipcMain.handle("finish-onboarding", async () => {
  if (onboardingWindow) {
    onboardingWindow.close();
  }
  createTray();
  startAgent();
  return { success: true };
});

ipcMain.handle("install-dependencies", async () => {
  return new Promise((resolve) => {
    const proc = spawn("pip3", ["install", "-r", "requirements.txt"], {
      cwd: agentDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    proc.stdout.on("data", (d) => (output += d.toString()));
    proc.stderr.on("data", (d) => (output += d.toString()));

    proc.on("close", (code) => {
      resolve({ success: code === 0, output });
    });
  });
});

// ─── Helpers ────────────────────────────────────────────────────

function readEnv() {
  if (!fs.existsSync(envFile)) return {};
  const content = fs.readFileSync(envFile, "utf-8");
  const env = {};
  content.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length) {
      env[key.trim()] = valueParts.join("=").trim();
    }
  });
  return env;
}
