/**
 * Client Manager
 *
 * Manages multiple WhatsApp connections — one per client.
 * Each client gets their own whatsapp-web.js session with persistent auth.
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");
const { transcribeVoiceMessage } = require("./transcriber");
const QRCode = require("qrcode");

const DATA_DIR = path.join(__dirname, "data");

// Active WhatsApp clients
const clients = new Map();

// Event listeners for QR codes (used by the web UI)
const qrListeners = new Map();

function getClientDataPath(clientId) {
  return path.join(DATA_DIR, clientId);
}

function getClientConfig(clientId) {
  const configPath = path.join(getClientDataPath(clientId), "config.json");
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
  return null;
}

function saveClientConfig(clientId, config) {
  const dir = getClientDataPath(clientId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config, null, 2));
}

function getMessages(clientId) {
  const msgPath = path.join(getClientDataPath(clientId), "messages.json");
  if (fs.existsSync(msgPath)) {
    try {
      return JSON.parse(fs.readFileSync(msgPath, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function addMessage(clientId, record) {
  const dir = getClientDataPath(clientId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const msgPath = path.join(dir, "messages.json");
  const messages = getMessages(clientId);
  messages.push(record);
  fs.writeFileSync(msgPath, JSON.stringify(messages, null, 2));
}

function getRecentMessages(clientId, hours = 24) {
  const cutoff = Date.now() / 1000 - hours * 3600;
  return getMessages(clientId).filter((m) => (m.timestamp_unix || 0) > cutoff);
}

function getAllClientIds() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => {
      const configPath = path.join(DATA_DIR, f, "config.json");
      return fs.existsSync(configPath);
    });
}

function getClientStatus(clientId) {
  const client = clients.get(clientId);
  if (!client) return "disconnected";
  if (client._failed) return "failed";
  if (client._ready) return "connected";
  return "connecting";
}

function getClientError(clientId) {
  const client = clients.get(clientId);
  return client?._error || null;
}

/**
 * Create and start a WhatsApp client for a given client ID.
 */
function startClient(clientId) {
  if (clients.has(clientId)) {
    console.log(`[${clientId}] Client already running`);
    return;
  }

  const config = getClientConfig(clientId);
  if (!config) {
    console.log(`[${clientId}] No config found`);
    return;
  }

  console.log(`[${clientId}] Starting WhatsApp client...`);

  const puppeteerArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--single-process",
  ];

  // Use system Chromium if available (Linux servers)
  const chromePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_BIN ||
    null;

  const puppeteerConfig = {
    headless: true,
    args: puppeteerArgs,
    ...(chromePath && { executablePath: chromePath }),
  };

  const waClient = new Client({
    authStrategy: new LocalAuth({
      clientId: clientId,
      dataPath: path.join(DATA_DIR, ".wwebjs_auth"),
    }),
    puppeteer: puppeteerConfig,
  });

  waClient._ready = false;
  waClient._clientId = clientId;

  waClient.on("qr", async (qr) => {
    console.log(`[${clientId}] QR code generated`);
    const qrDataUrl = await QRCode.toDataURL(qr, { width: 300 });
    const listener = qrListeners.get(clientId);
    if (listener) listener(qrDataUrl);
  });

  waClient.on("authenticated", () => {
    console.log(`[${clientId}] Authenticated`);
  });

  waClient.on("ready", () => {
    console.log(`[${clientId}] Connected and ready`);
    waClient._ready = true;
    saveClientConfig(clientId, { ...config, status: "connected", connectedAt: new Date().toISOString() });
  });

  waClient.on("message", async (msg) => {
    try {
      const contact = await msg.getContact();
      const senderName = contact.pushname || contact.name || contact.number || "Unknown";
      if (msg.fromMe) return;

      const chat = await msg.getChat();
      const isGroup = chat.isGroup;
      const groupName = isGroup ? chat.name : "";

      let msgType = "text";
      let content = msg.body || "";

      if (msg.hasMedia) {
        if (msg.type === "ptt" || msg.type === "audio") {
          msgType = "voice";
          content = await transcribeVoiceMessage(msg, clientId);
        } else if (msg.type === "image") {
          msgType = "image";
          content = "[Image]";
        } else if (msg.type === "video") {
          msgType = "video";
          content = "[Video]";
        } else {
          content = `[${msg.type}]`;
        }
      }

      const now = new Date();
      addMessage(clientId, {
        sender: senderName,
        content,
        type: msgType,
        source: "whatsapp",
        room: groupName,
        timestamp: now.toISOString().replace("T", " ").substring(0, 19),
        timestamp_unix: now.getTime() / 1000,
        phone: contact.number || "",
      });

      const location = groupName ? ` in ${groupName}` : "";
      const preview = content.length > 50 ? content.substring(0, 50) + "..." : content;
      console.log(`[${clientId}] ${senderName}${location}: ${preview}`);
    } catch (err) {
      console.error(`[${clientId}] Message error:`, err.message);
    }
  });

  waClient.on("disconnected", (reason) => {
    console.log(`[${clientId}] Disconnected: ${reason}`);
    waClient._ready = false;
    clients.delete(clientId);
    waClient.destroy().catch(() => {});
    // Auto-reconnect after a short delay — the saved session is reused,
    // so this recovers from transient drops without a new QR scan.
    setTimeout(() => {
      if (!clients.has(clientId)) {
        console.log(`[${clientId}] Attempting reconnect...`);
        startClient(clientId);
      }
    }, 10000);
  });

  clients.set(clientId, waClient);
  waClient.initialize().catch((err) => {
    console.error(`[${clientId}] WhatsApp failed to start:`, err.message);
    waClient._failed = true;
    waClient._error = err.message;
  });
}

/**
 * Force-restart a client: tear down any existing (possibly hung or failed)
 * WhatsApp session and start fresh. The saved auth is reused, so this does
 * not require a new QR scan unless the session was invalidated.
 */
async function restartClient(clientId) {
  const existing = clients.get(clientId);
  if (existing) {
    clients.delete(clientId);
    try {
      await existing.destroy();
    } catch (err) {
      console.log(`[${clientId}] Destroy during restart: ${err.message}`);
    }
  }
  startClient(clientId);
}

/**
 * Start all existing clients on server boot.
 */
function startAllClients() {
  const clientIds = getAllClientIds();
  console.log(`[Boot] Found ${clientIds.length} client(s) to connect`);
  for (const id of clientIds) {
    startClient(id);
  }
}

/**
 * Register a QR code listener for the onboarding flow.
 */
function onQR(clientId, callback) {
  qrListeners.set(clientId, callback);
}

function removeQRListener(clientId) {
  qrListeners.delete(clientId);
}

module.exports = {
  startClient,
  restartClient,
  startAllClients,
  getClientConfig,
  saveClientConfig,
  getClientStatus,
  getClientError,
  getRecentMessages,
  getAllClientIds,
  getMessages,
  getClientDataPath,
  onQR,
  removeQRListener,
  clients,
};
