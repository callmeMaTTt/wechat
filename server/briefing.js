/**
 * Briefing Runner
 *
 * Calls the Claude API to summarise messages and extract CRM data,
 * then emails the briefing to each client.
 */

const Anthropic = require("@anthropic-ai/sdk").default;
const nodemailer = require("nodemailer");
const { getRecentMessages, getAllClientIds, getClientConfig, getClientDataPath } = require("./clients");
const fs = require("fs");
const path = require("path");

const SUMMARISER_PROMPT = `You are a messaging assistant for a real estate professional.
You will receive messages from the past 24 hours (from WhatsApp, Line, Email, etc.).

Your job:
1. Summarise all conversations — group by contact, highlight urgent items
2. Identify action items and follow-ups needed
3. Flag any property-related signals (budget mentions, location preferences, timeline, buying intent)
4. Draft 2 reply options for each conversation that needs a response:
   - Option A: Short and casual
   - Option B: Detailed and professional

Respond in JSON with this structure:
{
  "overview": "Brief overview of all conversations",
  "urgent_items": ["list of urgent things"],
  "conversations": [
    {
      "contact_name": "Name",
      "summary": "What was discussed",
      "action_items": ["things to do"],
      "needs_reply": true,
      "draft_reply_a": "Short casual reply",
      "draft_reply_b": "Detailed professional reply"
    }
  ],
  "contacts": [
    {
      "name": "Name",
      "phone": "if mentioned",
      "source": "whatsapp/line/email",
      "property_type": "house/apartment/etc",
      "budget": "if mentioned",
      "location": "preferred area",
      "lead_status": "cold/warm/hot/client",
      "notes": "key info",
      "suggested_followup": "what to do next"
    }
  ]
}`;

async function runBriefing(clientId) {
  const config = getClientConfig(clientId);
  if (!config) {
    console.log(`[Briefing] No config for ${clientId}`);
    return;
  }

  const messages = getRecentMessages(clientId, 24);
  console.log(`[Briefing] ${clientId}: ${messages.length} messages in last 24h`);

  if (messages.length === 0) {
    await sendEmail(config, {
      overview: "No new messages in the last 24 hours.",
      urgent_items: [],
      conversations: [],
      contacts: [],
    });
    return;
  }

  // Format messages for Claude
  const grouped = {};
  for (const msg of messages) {
    const sender = msg.sender || "Unknown";
    const source = msg.source || "whatsapp";
    const key = `${sender} (via ${source})`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(`  [${msg.timestamp}] ${msg.content}`);
  }

  let messageText = "";
  for (const [sender, msgs] of Object.entries(grouped)) {
    messageText += `\n--- ${sender} ---\n${msgs.join("\n")}\n`;
  }

  // Call Claude
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SUMMARISER_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here are the messages from the past 24 hours:\n\n${messageText}`,
        },
      ],
    });

    const text = response.content[0].text;
    let briefing;

    try {
      briefing = JSON.parse(text);
    } catch {
      // Try extracting JSON from markdown code block
      const match = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (match) {
        briefing = JSON.parse(match[1]);
      } else {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          briefing = JSON.parse(text.substring(start, end + 1));
        } else {
          briefing = { overview: text, urgent_items: [], conversations: [], contacts: [] };
        }
      }
    }

    // Save contacts to CRM data
    saveCRMData(clientId, briefing.contacts || []);

    // Send email
    await sendEmail(config, briefing);

    console.log(`[Briefing] ${clientId}: Briefing sent to ${config.email}`);
  } catch (err) {
    console.error(`[Briefing] ${clientId}: Error:`, err.message);
  }
}

function saveCRMData(clientId, contacts) {
  const crmPath = path.join(getClientDataPath(clientId), "crm.json");
  let existing = [];
  if (fs.existsSync(crmPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(crmPath, "utf-8"));
    } catch {
      existing = [];
    }
  }

  // Merge new contacts
  for (const contact of contacts) {
    if (!contact.name) continue;
    const idx = existing.findIndex(
      (c) => c.name && c.name.toLowerCase() === contact.name.toLowerCase()
    );
    if (idx >= 0) {
      // Update existing — merge fields, never downgrade lead_status
      const old = existing[idx];
      const statusRank = { cold: 0, warm: 1, hot: 2, client: 3 };
      existing[idx] = {
        ...old,
        ...Object.fromEntries(Object.entries(contact).filter(([, v]) => v)),
        lead_status:
          (statusRank[contact.lead_status] || 0) > (statusRank[old.lead_status] || 0)
            ? contact.lead_status
            : old.lead_status,
        last_contact: new Date().toISOString().substring(0, 10),
      };
    } else {
      existing.push({
        ...contact,
        last_contact: new Date().toISOString().substring(0, 10),
      });
    }
  }

  fs.writeFileSync(crmPath, JSON.stringify(existing, null, 2));
}

async function sendEmail(config, briefing) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build conversations HTML
  let convsHtml = "";
  for (const conv of briefing.conversations || []) {
    let replyHtml = "";
    if (conv.needs_reply) {
      replyHtml = `
        <div style="background:#f0f7ff;padding:12px;border-radius:8px;margin-top:8px">
          <strong>Reply A (casual):</strong><br>${conv.draft_reply_a || ""}
          <br><br><strong>Reply B (professional):</strong><br>${conv.draft_reply_b || ""}
        </div>`;
    }

    const actions = (conv.action_items || []).map((a) => `<li>${a}</li>`).join("");

    convsHtml += `
      <div style="border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:12px">
        <h3 style="margin:0 0 8px 0;color:#1a1a2e">${conv.contact_name || "Unknown"}</h3>
        <p style="margin:0 0 8px 0;color:#444">${conv.summary || ""}</p>
        ${actions ? `<ul style="margin:4px 0">${actions}</ul>` : ""}
        ${replyHtml}
      </div>`;
  }

  const urgentHtml = (briefing.urgent_items || [])
    .map((u) => `<li style="color:#c0392b">${u}</li>`)
    .join("");

  const html = `
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
      <h1 style="color:#1a1a2e;border-bottom:2px solid #667eea;padding-bottom:8px">
        Morning Briefing
      </h1>
      <p style="color:#666">${today}</p>

      <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin-bottom:20px">
        <h2 style="margin:0 0 8px 0;font-size:16px">Overview</h2>
        <p style="margin:0">${briefing.overview || "No messages to report."}</p>
      </div>

      ${urgentHtml ? `<div style="background:#fff5f5;padding:16px;border-radius:8px;margin-bottom:20px"><h2 style="margin:0 0 8px 0;font-size:16px;color:#c0392b">Urgent Items</h2><ul>${urgentHtml}</ul></div>` : ""}

      <h2 style="font-size:16px;color:#1a1a2e">Conversations</h2>
      ${convsHtml || '<p style="color:#999">No conversations in the last 24 hours.</p>'}

      <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
        View your full CRM dashboard at: ${process.env.BASE_URL || "http://localhost:3000"}/dashboard/${config.clientId || ""}
      </p>
    </body>
    </html>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: config.email,
    subject: `Morning Briefing — ${today}`,
    html,
  });
}

/**
 * Run briefings for all connected clients.
 */
async function runAllBriefings() {
  const clientIds = getAllClientIds();
  console.log(`[Briefing] Running briefings for ${clientIds.length} client(s)`);

  for (const clientId of clientIds) {
    try {
      await runBriefing(clientId);
    } catch (err) {
      console.error(`[Briefing] ${clientId} failed:`, err.message);
    }
  }
}

module.exports = { runBriefing, runAllBriefings };
