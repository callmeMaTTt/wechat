/**
 * The Morning Brief — Hosted Server
 *
 * Clients visit the website, scan a QR code, and get daily briefings.
 * No installation required on their end.
 */

require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const cron = require("node-cron");
const {
  startClient,
  startAllClients,
  getClientConfig,
  saveClientConfig,
  getClientStatus,
  getAllClientIds,
  getClientDataPath,
  getClientError,
  getRecentMessages,
  onQR,
  removeQRListener,
} = require("./clients");
const { runBriefing } = require("./briefing");
const { fetchEmails, fetchAllEmails } = require("./email-listener");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "views")));

// ─── Landing Page ───────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// ─── Login (find your dashboard) ───────────────────────────

app.get("/login", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log In — Morning Brief</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 44px 40px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #555;
      margin-bottom: 5px;
    }
    input {
      width: 100%;
      padding: 12px 16px;
      border: 1.5px solid #e0e0e0;
      border-radius: 10px;
      font-size: 15px;
      margin-bottom: 16px;
      outline: none;
      font-family: inherit;
    }
    input:focus { border-color: #667eea; }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    button:hover { opacity: 0.9; }
    .error { color: #ef4444; font-size: 13px; margin-bottom: 12px; display: none; }
    .signup-link { text-align: center; margin-top: 16px; font-size: 13px; color: #999; }
    .signup-link a { color: #667eea; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome back</h1>
    <p>Enter the email you signed up with to access your dashboard.</p>
    <p class="error" id="error">No account found with that email.</p>
    <form onsubmit="return handleLogin(event)">
      <label for="email">Your email</label>
      <input type="email" id="email" placeholder="you@gmail.com" required>
      <button type="submit">Go to Dashboard</button>
    </form>
    <p class="signup-link">Don't have an account? <a href="/">Sign up</a></p>
  </div>
  <script>
    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const errorEl = document.getElementById("error");
      errorEl.style.display = "none";

      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.clientId) {
          window.location.href = "/dashboard/" + data.clientId;
        } else {
          errorEl.textContent = data.error || "No account found with that email.";
          errorEl.style.display = "block";
        }
      } catch {
        errorEl.textContent = "Something went wrong. Please try again.";
        errorEl.style.display = "block";
      }
      return false;
    }
  </script>
</body>
</html>`);
});

app.post("/api/login", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  // Find client by email
  const clientIds = getAllClientIds();
  for (const id of clientIds) {
    const config = getClientConfig(id);
    if (config && config.email && config.email.toLowerCase() === email.toLowerCase()) {
      return res.json({ clientId: id });
    }
  }

  res.status(404).json({ error: "No account found with that email. Have you signed up yet?" });
});

// ─── Sign Up ────────────────────────────────────────────────

app.post("/signup", (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email required" });
  }

  // Generate a client ID
  const hash = crypto.createHash("md5").update(`${email}-${Date.now()}`).digest("hex").substring(0, 8);
  const clientId = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${hash}`;

  // Save client config
  saveClientConfig(clientId, {
    clientId,
    name,
    email,
    createdAt: new Date().toISOString(),
    status: "pending",
  });

  // Start the WhatsApp client (will generate QR code)
  startClient(clientId);

  res.redirect(`/connect/${clientId}`);
});

// ─── QR Code Connection Page ────────────────────────────────

app.get("/connect/:clientId", (req, res) => {
  const { clientId } = req.params;
  const config = getClientConfig(clientId);

  if (!config) {
    return res.status(404).send("Client not found");
  }

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect WhatsApp</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    h1 { font-size: 22px; color: #1a1a2e; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    .qr-box {
      background: #f8f8f8;
      border-radius: 16px;
      padding: 24px;
      margin: 20px 0;
      min-height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-box img { border-radius: 8px; }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid #e0e0e0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .steps { text-align: left; margin: 16px 0; }
    .steps li { margin: 6px 0; font-size: 14px; color: #555; }
    .success { color: #22c55e; font-size: 18px; font-weight: 600; }
    .success-icon { font-size: 48px; margin-bottom: 12px; }
    a.btn {
      display: inline-block;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 12px 32px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div id="qrState">
      <h1>Hi ${config.name}!</h1>
      <p>Scan this QR code with WhatsApp to connect.</p>
      <ol class="steps">
        <li>Open <strong>WhatsApp</strong> on your phone</li>
        <li>Go to <strong>Settings → Linked Devices</strong></li>
        <li>Tap <strong>Link a Device</strong></li>
        <li>Point your camera at the QR code below</li>
      </ol>
      <div class="qr-box" id="qrBox">
        <div class="spinner"></div>
      </div>
      <p style="color:#999;font-size:12px">QR code loading... this may take a moment.</p>
    </div>
    <div id="successState" style="display:none">
      <div class="success-icon">&#10003;</div>
      <p class="success">Connected!</p>
      <p>You're all set, ${config.name}. Pick your preferred briefing time and timezone in Settings — the default is 07:30.</p>
      <p>Your personal dashboard:</p>
      <a class="btn" href="/dashboard/${clientId}">Open Dashboard</a>
    </div>
  </div>
  <script>
    // Poll for status
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/status/${clientId}");
        const data = await res.json();

        if (data.qr) {
          document.getElementById("qrBox").innerHTML = '<img src="' + data.qr + '" width="260" height="260">';
        }

        if (data.status === "connected") {
          clearInterval(interval);
          document.getElementById("qrState").style.display = "none";
          document.getElementById("successState").style.display = "block";
        }

        if (data.status === "failed") {
          clearInterval(interval);
          document.getElementById("qrBox").innerHTML = \`
            <div style="text-align:center;padding:20px">
              <p style="color:#ef4444;font-weight:600;margin-bottom:8px">WhatsApp failed to start</p>
              <p style="color:#666;font-size:13px;line-height:1.6">\${data.error || "Chromium could not be launched on this server."}</p>
              <p style="color:#666;font-size:13px;margin-top:12px">Please contact support or try again later.</p>
            </div>\`;
        }

        // Show timeout message after 60 seconds of no QR
        if (!data.qr && data.status !== "connected" && Date.now() - startTime > 60000) {
          clearInterval(interval);
          document.getElementById("qrBox").innerHTML = \`
            <div style="text-align:center;padding:20px">
              <p style="color:#f59e0b;font-weight:600;margin-bottom:8px">Taking longer than expected</p>
              <p style="color:#666;font-size:13px;line-height:1.6">The server is having trouble launching WhatsApp. Please refresh the page to try again.</p>
              <button onclick="location.reload()" style="margin-top:12px;padding:10px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">Refresh</button>
            </div>\`;
        }
      } catch {}
    }, 2000);
    const startTime = Date.now();
  </script>
</body>
</html>`);
});

// ─── Status API (polled by QR page) ─────────────────────────

let latestQR = {};

// Listen for QR codes from all clients
app.get("/api/status/:clientId", (req, res) => {
  const { clientId } = req.params;
  const status = getClientStatus(clientId);

  // Register QR listener if not already
  onQR(clientId, (qrDataUrl) => {
    latestQR[clientId] = qrDataUrl;
  });

  res.json({
    status,
    error: getClientError(clientId),
    qr: latestQR[clientId] || null,
  });
});

// ─── Dashboard ──────────────────────────────────────────────

app.get("/dashboard/:clientId", (req, res) => {
  const { clientId } = req.params;
  const config = getClientConfig(clientId);

  if (!config) {
    return res.status(404).send("Client not found");
  }

  // Serve the dashboard HTML with client data embedded
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// Dashboard API — returns CRM + stats for a client
app.get("/api/dashboard/:clientId", (req, res) => {
  const { clientId } = req.params;
  const config = getClientConfig(clientId);

  if (!config) {
    return res.status(404).json({ error: "Client not found" });
  }

  // Load CRM data
  const crmPath = path.join(getClientDataPath(clientId), "crm.json");
  let contacts = [];
  if (fs.existsSync(crmPath)) {
    try {
      contacts = JSON.parse(fs.readFileSync(crmPath, "utf-8"));
    } catch {
      contacts = [];
    }
  }

  // Calculate stats
  const counts = { hot: 0, warm: 0, cold: 0, client: 0 };
  for (const c of contacts) {
    const status = (c.lead_status || "cold").toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
  }

  // Build follow-ups from contacts that have suggested actions
  const followups = contacts
    .filter((c) => c.suggested_followup || c.suggested_follow_up)
    .map((c) => {
      const status = (c.lead_status || "cold").toLowerCase();
      let priority = "later";
      if (status === "hot") priority = "today";
      else if (status === "warm") priority = "this_week";
      else if (status === "client") priority = "this_week";
      return {
        contact_name: c.name,
        action: c.suggested_followup || c.suggested_follow_up,
        due_date: c.follow_up_date || c.last_contact || "—",
        lead_status: c.lead_status,
        priority,
      };
    })
    .sort((a, b) => {
      const rank = { today: 0, this_week: 1, this_month: 2, later: 3 };
      return (rank[a.priority] || 3) - (rank[b.priority] || 3);
    });

  const today = new Date().toISOString().substring(0, 10);
  const followupsDueToday = followups.filter((f) => f.due_date === today).length;

  const onboarding = {
    whatsapp: getClientStatus(clientId) === "connected",
    contacts: contacts.length > 0,
    email: Boolean(config.imap),
    tested: Boolean(config.testBriefingSent),
  };

  res.json({
    name: config.name,
    status: getClientStatus(clientId),
    updated_at: new Date().toISOString(),
    contacts,
    followups,
    onboarding,
    stats: {
      total: contacts.length,
      ...counts,
      followups_due_today: followupsDueToday,
    },
  });
});

// ─── CRM Contacts API (add / edit / delete) ────────────────

function loadContacts(clientId) {
  const crmPath = path.join(getClientDataPath(clientId), "crm.json");
  if (fs.existsSync(crmPath)) {
    try { return JSON.parse(fs.readFileSync(crmPath, "utf-8")); } catch { return []; }
  }
  return [];
}

function saveContacts(clientId, contacts) {
  const dir = getClientDataPath(clientId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "crm.json"), JSON.stringify(contacts, null, 2));
}

// Add a new contact
app.post("/api/contacts/:clientId", (req, res) => {
  const { clientId } = req.params;
  if (!getClientConfig(clientId)) return res.status(404).json({ error: "Client not found" });

  const contact = req.body;
  if (!contact.name) return res.status(400).json({ error: "Name is required" });

  contact.last_contact = contact.last_contact || new Date().toISOString().substring(0, 10);
  contact.source = contact.source || "manual";

  const contacts = loadContacts(clientId);
  contacts.push(contact);
  saveContacts(clientId, contacts);

  res.json({ success: true, index: contacts.length - 1 });
});

// Update a contact
app.put("/api/contacts/:clientId/:index", (req, res) => {
  const { clientId, index } = req.params;
  if (!getClientConfig(clientId)) return res.status(404).json({ error: "Client not found" });

  const contacts = loadContacts(clientId);
  const i = parseInt(index);
  if (i < 0 || i >= contacts.length) return res.status(404).json({ error: "Contact not found" });

  contacts[i] = { ...contacts[i], ...req.body };
  saveContacts(clientId, contacts);

  res.json({ success: true });
});

// Delete a contact
app.delete("/api/contacts/:clientId/:index", (req, res) => {
  const { clientId, index } = req.params;
  if (!getClientConfig(clientId)) return res.status(404).json({ error: "Client not found" });

  const contacts = loadContacts(clientId);
  const i = parseInt(index);
  if (i < 0 || i >= contacts.length) return res.status(404).json({ error: "Contact not found" });

  contacts.splice(i, 1);
  saveContacts(clientId, contacts);

  res.json({ success: true });
});

// ─── Recent Messages API ───────────────────────────────────

app.get("/api/messages/:clientId", (req, res) => {
  const { clientId } = req.params;
  const config = getClientConfig(clientId);
  if (!config) return res.status(404).json({ error: "Client not found" });

  const hours = parseInt(req.query.hours) || 24;
  const messages = getRecentMessages(clientId, hours);

  // Group by sender
  const grouped = {};
  for (const msg of messages) {
    const sender = msg.sender || "Unknown";
    if (!grouped[sender]) grouped[sender] = { sender, source: msg.source || "whatsapp", messages: [] };
    grouped[sender].messages.push(msg);
  }

  res.json({
    total: messages.length,
    conversations: Object.values(grouped),
  });
});

// ─── Email Settings API ────────────────────────────────────

app.post("/api/email-settings/:clientId", (req, res) => {
  const { clientId } = req.params;
  const config = getClientConfig(clientId);

  if (!config) {
    return res.status(404).json({ error: "Client not found" });
  }

  const { host, port, user, password } = req.body;

  if (!host || !user || !password) {
    return res.status(400).json({ error: "Host, user, and password are required" });
  }

  // Save IMAP settings to client config
  saveClientConfig(clientId, {
    ...config,
    imap: { host, port: port || 993, user, password },
  });

  // Fetch emails immediately
  fetchEmails(clientId, 24).then(() => {
    console.log(`[Email] ${clientId}: Initial email fetch complete`);
  });

  res.json({ success: true, message: "Email connected. Fetching messages..." });
});

app.get("/api/email-settings/:clientId", (req, res) => {
  const { clientId } = req.params;
  const config = getClientConfig(clientId);

  if (!config) {
    return res.status(404).json({ error: "Client not found" });
  }

  // Return settings without password
  if (config.imap) {
    res.json({
      configured: true,
      host: config.imap.host,
      port: config.imap.port,
      user: config.imap.user,
    });
  } else {
    res.json({ configured: false });
  }
});

// ─── Admin: trigger briefing manually ───────────────────────

app.post("/api/briefing/:clientId", async (req, res) => {
  const { clientId } = req.params;
  const config = getClientConfig(clientId);
  if (!config) return res.status(404).json({ error: "Client not found" });

  try {
    await fetchEmails(clientId, 24);
    await runBriefing(clientId);
    saveClientConfig(clientId, { ...config, testBriefingSent: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview the briefing without emailing it
app.post("/api/briefing/:clientId/preview", async (req, res) => {
  const { clientId } = req.params;
  if (!getClientConfig(clientId)) return res.status(404).json({ error: "Client not found" });

  try {
    await fetchEmails(clientId, 24);
    const briefing = await runBriefing(clientId, { preview: true });
    res.json({ success: true, briefing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Briefing preferences (schedule + timezone) ────────────

app.get("/api/preferences/:clientId", (req, res) => {
  const { clientId } = req.params;
  const config = getClientConfig(clientId);
  if (!config) return res.status(404).json({ error: "Client not found" });
  res.json({
    briefingTime: config.briefingTime || "07:30",
    timezone: config.timezone || "UTC",
  });
});

app.post("/api/preferences/:clientId", (req, res) => {
  const { clientId } = req.params;
  const config = getClientConfig(clientId);
  if (!config) return res.status(404).json({ error: "Client not found" });

  const { briefingTime, timezone } = req.body;
  if (briefingTime && !/^(\d{1,2}):(\d{2})$/.test(briefingTime)) {
    return res.status(400).json({ error: "Invalid time format (use HH:MM)" });
  }
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    } catch {
      return res.status(400).json({ error: "Unknown timezone" });
    }
  }

  saveClientConfig(clientId, {
    ...config,
    ...(briefingTime && { briefingTime }),
    ...(timezone && { timezone }),
  });
  res.json({ success: true });
});

// ─── Scheduled Tasks ───────────────────────────────────────

// Fetch emails every 30 minutes
cron.schedule("*/30 * * * *", () => {
  console.log("[Cron] Fetching emails...");
  fetchAllEmails(1); // Only last 1 hour to avoid duplicates
});

// Run every 5 minutes and fire briefings for clients whose local time matches
// their configured briefingTime (default 07:30, default tz UTC).
function getLocalHM(timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const o = {};
    for (const p of parts) o[p.type] = p.value;
    return {
      date: `${o.year}-${o.month}-${o.day}`,
      minutes: parseInt(o.hour, 10) * 60 + parseInt(o.minute, 10),
    };
  } catch {
    return null;
  }
}

function parseHM(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || "");
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

cron.schedule("*/5 * * * *", async () => {
  const ids = getAllClientIds();
  for (const clientId of ids) {
    const config = getClientConfig(clientId);
    if (!config) continue;

    const tz = config.timezone || "UTC";
    const target = parseHM(config.briefingTime || "07:30");
    if (target == null) continue;

    const local = getLocalHM(tz);
    if (!local) continue;

    // Fire if we're within this 5-minute window and we haven't already sent today.
    const diff = local.minutes - target;
    if (diff < 0 || diff >= 5) continue;
    if (config.lastBriefingDate === local.date) continue;

    console.log(`[Cron] Firing briefing for ${clientId} (${local.date} ${tz})`);
    saveClientConfig(clientId, { ...config, lastBriefingDate: local.date });

    try {
      await fetchEmails(clientId, 24);
      await runBriefing(clientId);
    } catch (err) {
      console.error(`[Cron] ${clientId} briefing failed:`, err.message);
    }
  }
});

// ─── Start Server ───────────────────────────────────────────

app.listen(PORT, () => {
  console.log("");
  console.log("=".repeat(50));
  console.log("  The Morning Brief");
  console.log("=".repeat(50));
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Briefings: per-user schedule (see client settings)`);
  console.log(`  Email fetch: every 30 minutes`);
  console.log("=".repeat(50));
  console.log("");

  // Reconnect all existing clients
  startAllClients();

  // Initial email fetch
  fetchAllEmails(24);
});
