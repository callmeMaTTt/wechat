/**
 * WhatsApp Message Listener
 *
 * Connects to WhatsApp via QR code scan, captures all incoming messages,
 * and saves them to ../agent/logs/messages.json for the AI agent to process.
 *
 * Voice notes sent to yourself are saved as audio files for Whisper transcription.
 */

const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

// Paths
const AGENT_DIR = path.join(__dirname, "..", "agent");
const LOGS_DIR = path.join(AGENT_DIR, "logs");
const MESSAGE_FILE = path.join(LOGS_DIR, "messages.json");

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Read MY_WECHAT_NAME from .env (reused as "my name" for WhatsApp too)
let MY_NAME = "";
const envPath = path.join(AGENT_DIR, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/MY_WECHAT_NAME=(.+)/);
  if (match) MY_NAME = match[1].trim();
}

// ─── Message Store ──────────────────────────────────────────

function loadMessages() {
  if (fs.existsSync(MESSAGE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(MESSAGE_FILE, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function saveMessages(messages) {
  fs.writeFileSync(MESSAGE_FILE, JSON.stringify(messages, null, 2));
}

function addMessage(record) {
  const messages = loadMessages();
  messages.push(record);
  saveMessages(messages);
}

function clearOldMessages(days = 7) {
  const cutoff = Date.now() / 1000 - days * 86400;
  const messages = loadMessages().filter((m) => (m.timestamp_unix || 0) > cutoff);
  saveMessages(messages);
}

// ─── WhatsApp Client ────────────────────────────────────────

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, ".wwebjs_auth") }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

console.log("");
console.log("=".repeat(50));
console.log("  WhatsApp Message Listener");
console.log("=".repeat(50));
console.log("");

client.on("qr", (qr) => {
  console.log("  Scan this QR code with WhatsApp on your phone:");
  console.log("  (WhatsApp → Settings → Linked Devices → Link a Device)");
  console.log("");
  qrcode.generate(qr, { small: true });
  console.log("");
});

client.on("authenticated", () => {
  console.log("[Auth] Authenticated successfully");
});

client.on("ready", () => {
  console.log("");
  console.log("[Ready] Connected to WhatsApp!");
  console.log("[Listener] Now capturing messages. Keep this running.");
  console.log("");

  // Clean old messages on startup
  clearOldMessages(7);
});

client.on("message", async (msg) => {
  try {
    // Get sender info
    const contact = await msg.getContact();
    const senderName = contact.pushname || contact.name || contact.number || "Unknown";
    const isFromMe = msg.fromMe;

    // Get chat info (for group messages)
    const chat = await msg.getChat();
    const isGroup = chat.isGroup;
    const groupName = isGroup ? chat.name : "";

    // Determine message type
    let msgType = "text";
    let content = msg.body || "";

    if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      if (msg.type === "ptt" || msg.type === "audio") {
        msgType = "voice";

        // If it's a voice note FROM ME — save for Whisper transcription
        if (isFromMe) {
          const audioPath = path.join(
            LOGS_DIR,
            `voice_${new Date().toISOString().replace(/[:.]/g, "-")}.ogg`
          );
          fs.writeFileSync(audioPath, Buffer.from(media.data, "base64"));
          console.log(`[Voice] Saved self-sent voice note → ${path.basename(audioPath)}`);

          // Save as a voice note record for the transcriber
          const voiceNotesPath = path.join(LOGS_DIR, "voice_notes.json");
          let voiceNotes = [];
          if (fs.existsSync(voiceNotesPath)) {
            try {
              voiceNotes = JSON.parse(fs.readFileSync(voiceNotesPath, "utf-8"));
            } catch {
              voiceNotes = [];
            }
          }
          voiceNotes.push({
            audio_path: audioPath,
            timestamp: new Date().toISOString(),
            needs_transcription: true,
            processed: false,
          });
          fs.writeFileSync(voiceNotesPath, JSON.stringify(voiceNotes, null, 2));
          return; // Don't log self-sent voice notes as regular messages
        }

        content = "[Voice message]";
      } else if (msg.type === "image") {
        msgType = "image";
        content = "[Image]";
      } else if (msg.type === "video") {
        msgType = "video";
        content = "[Video]";
      } else if (msg.type === "document") {
        msgType = "file";
        content = `[File: ${msg.body || "document"}]`;
      } else {
        content = `[${msg.type}]`;
      }
    }

    // Skip other self-sent messages
    if (isFromMe) return;

    // Build message record
    const now = new Date();
    const record = {
      sender: senderName,
      content: content,
      type: msgType,
      room: groupName,
      timestamp: now.toISOString().replace("T", " ").substring(0, 19),
      timestamp_unix: now.getTime() / 1000,
      phone: contact.number || "",
    };

    addMessage(record);

    // Log to console
    const location = groupName ? ` in ${groupName}` : "";
    const preview = content.length > 50 ? content.substring(0, 50) + "..." : content;
    console.log(`[${record.timestamp}] ${senderName}${location}: ${preview}`);
  } catch (err) {
    console.error("[Error] Failed to process message:", err.message);
  }
});

client.on("disconnected", (reason) => {
  console.log("[Disconnected]", reason);
  console.log("[Listener] Attempting to reconnect...");
  client.initialize();
});

// Start
console.log("Connecting to WhatsApp...");
console.log("(First time takes a moment to set up the browser)");
console.log("");

client.initialize();
