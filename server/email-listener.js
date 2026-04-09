/**
 * Email Listener
 *
 * Connects to a client's email via IMAP and fetches recent messages.
 * Stores them in the same format as WhatsApp messages so the briefing
 * engine treats them identically.
 */

const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const { addMessage, getClientConfig, getAllClientIds, getClientDataPath } = require("./clients");
const fs = require("fs");
const path = require("path");

/**
 * Fetch emails from the last N hours for a client.
 */
async function fetchEmails(clientId, hours = 24) {
  const config = getClientConfig(clientId);
  if (!config || !config.imap) {
    return; // No email config for this client
  }

  const { host, port, user, password } = config.imap;
  if (!host || !user || !password) return;

  console.log(`[Email] ${clientId}: Connecting to ${host}...`);

  const client = new ImapFlow({
    host,
    port: port || 993,
    secure: true,
    auth: { user, pass: password },
    logger: false,
  });

  try {
    await client.connect();

    // Open inbox
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for emails from the last N hours
      const since = new Date(Date.now() - hours * 3600 * 1000);

      const messages = [];
      for await (const msg of client.fetch(
        { since },
        { envelope: true, source: true }
      )) {
        messages.push(msg);
      }

      // Track already-ingested message IDs to avoid duplicates
      const seenPath = path.join(getClientDataPath(clientId), "email_seen.json");
      let seen = new Set();
      if (fs.existsSync(seenPath)) {
        try {
          seen = new Set(JSON.parse(fs.readFileSync(seenPath, "utf-8")));
        } catch {
          seen = new Set();
        }
      }

      let newCount = 0;

      for (const msg of messages) {
        const messageId = msg.envelope.messageId;
        if (seen.has(messageId)) continue;

        // Parse the full email
        const parsed = await simpleParser(msg.source);

        // Skip emails sent by the client themselves (only inbound)
        const fromAddr = parsed.from?.value?.[0]?.address || "";
        if (fromAddr.toLowerCase() === user.toLowerCase()) continue;

        const senderName = parsed.from?.value?.[0]?.name || fromAddr;
        const subject = parsed.subject || "(no subject)";
        const body = parsed.text || "";

        // Truncate very long emails to keep storage manageable
        const truncated = body.length > 2000
          ? body.substring(0, 2000) + "... [truncated]"
          : body;

        const content = `[Subject: ${subject}]\n${truncated}`.trim();
        const timestamp = parsed.date || new Date();

        addMessage(clientId, {
          sender: senderName,
          content,
          type: "email",
          source: "email",
          room: "",
          timestamp: timestamp.toISOString().replace("T", " ").substring(0, 19),
          timestamp_unix: timestamp.getTime() / 1000,
          phone: fromAddr,
        });

        seen.add(messageId);
        newCount++;
      }

      // Save seen IDs (keep last 5000 to prevent unbounded growth)
      const seenArr = [...seen].slice(-5000);
      const dir = getClientDataPath(clientId);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(seenPath, JSON.stringify(seenArr));

      console.log(`[Email] ${clientId}: ${newCount} new email(s) fetched`);
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error(`[Email] ${clientId}: Error:`, err.message);
  }
}

/**
 * Fetch emails for all clients that have IMAP configured.
 */
async function fetchAllEmails(hours = 24) {
  const clientIds = getAllClientIds();
  for (const clientId of clientIds) {
    const config = getClientConfig(clientId);
    if (config?.imap) {
      try {
        await fetchEmails(clientId, hours);
      } catch (err) {
        console.error(`[Email] ${clientId}: Failed:`, err.message);
      }
    }
  }
}

module.exports = { fetchEmails, fetchAllEmails };
