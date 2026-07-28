/**
 * Voice Transcriber
 *
 * Downloads WhatsApp voice notes and transcribes them using
 * OpenAI's Whisper API. Falls back to "[Voice message]" if
 * no OpenAI key is configured.
 */

const fs = require("fs");
const path = require("path");

/**
 * Transcribe a WhatsApp voice message.
 * Downloads the media, sends to Whisper API, returns text.
 */
async function transcribeVoiceMessage(msg, clientId) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "[Voice message — transcription unavailable]";
  }

  // Lazy require: clients.js requires this module, so a top-level require
  // back at clients.js would create a circular dependency and leave
  // getClientDataPath undefined.
  const { getClientDataPath } = require("./clients");

  try {
    // Download media from WhatsApp
    const media = await msg.downloadMedia();
    if (!media || !media.data) {
      return "[Voice message — download failed]";
    }

    // Save to temp file (Whisper needs a file)
    const voiceDir = path.join(getClientDataPath(clientId), "voice");
    if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });

    const ext = media.mimetype?.includes("ogg") ? "ogg" : "webm";
    const tempFile = path.join(voiceDir, `voice_${Date.now()}.${ext}`);
    fs.writeFileSync(tempFile, Buffer.from(media.data, "base64"));

    // Call OpenAI Whisper API
    const FormData = (await import("form-data")).default;
    const fetch = (await import("node-fetch")).default;

    const form = new FormData();
    form.append("file", fs.createReadStream(tempFile));
    form.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const result = await response.json();

    // Clean up temp file
    try { fs.unlinkSync(tempFile); } catch {}

    if (result.text) {
      console.log(`[Whisper] ${clientId}: Transcribed ${result.text.length} chars`);
      return `[Voice message]: "${result.text}"`;
    }

    return "[Voice message — transcription failed]";
  } catch (err) {
    console.error(`[Whisper] ${clientId}: Error:`, err.message);
    return "[Voice message — transcription error]";
  }
}

module.exports = { transcribeVoiceMessage };
