# WeChat Morning Assistant

AI-powered WeChat message summariser and CRM for real estate professionals.

## What it does

Every morning, this agent:
1. **Summarises** all WeChat messages from the past 24 hours
2. **Drafts replies** for conversations that need a response
3. **Extracts CRM data** — detects potential clients, property preferences, budgets
4. **Updates a spreadsheet** — colour-coded lead tracking with follow-up reminders
5. **Emails the briefing** with the CRM attached
6. **Syncs to a web dashboard** accessible from any device

## Architecture

```
agent/              Python backend (the brain)
├── listener.py     Connects to WeChat, captures messages 24/7
├── main.py         Scheduler — triggers briefing each morning
├── config/         Settings and Claude prompts
├── src/
│   ├── agent.py    Orchestrator (Claude API calls)
│   ├── crm.py      Excel CRM read/write
│   ├── transcriber.py  Voice note transcription (local Whisper)
│   ├── email_sender.py Morning briefing email
│   └── cloud_sync.py   Sync CRM to Vercel KV
├── logs/           Message cache + voice notes
└── crm/            WeChat_CRM.xlsx

mac-app/            Electron desktop app
├── main.js         Menu bar app + process manager
├── onboarding.html 5-step setup wizard
├── settings.html   Settings window
└── preload.js      IPC bridge

dashboard/          Web dashboard (deploy to Vercel)
├── public/
│   └── index.html  Single-page app (contacts, follow-ups, pipeline)
├── api/
│   └── get_data.py Vercel serverless function
└── vercel.json     Routing config

scripts/
└── provision_client.py  Generate client IDs + URLs
```

## Quick Start (Development)

### 1. Python Agent

```bash
cd agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Anthropic API key, Gmail App Password, etc.

# Test the briefing
python3 main.py --now

# Start the listener (needs WeChat QR scan)
python3 listener.py

# Start the scheduler
python3 main.py
```

### 2. Electron Mac App

```bash
cd mac-app
npm install
npm start          # Dev mode
npm run build      # Build .dmg
```

### 3. Web Dashboard

```bash
cd dashboard
# Local preview
npx serve public

# Deploy to Vercel
npx vercel --prod
```

Then add **Vercel KV** storage in the Vercel dashboard and set:
- `KV_REST_API_URL` — auto-populated by Vercel KV
- `KV_REST_API_TOKEN` — auto-populated by Vercel KV

### 4. Provision a Client

```bash
python3 scripts/provision_client.py "Sarah Chen"
```

## Prerequisites

- **Python 3.10+** with pip
- **Node.js 18+** with npm (for Electron app)
- **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com)
- **Gmail App Password** from [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- **WeChat account** with web login enabled (test at [web.wechat.com](https://web.wechat.com))

## Cost

| Item | Monthly Cost |
|------|-------------|
| Anthropic API (daily briefings) | ~$1–3 |
| Vercel hosting (free tier) | $0 |
| Whisper (runs locally) | $0 |
| **Total** | **~$1–3/month** |

## Onboarding a Client

1. Run `python3 scripts/provision_client.py "Their Name"`
2. Send them the `.dmg` file
3. Book a 20-minute Zoom call
4. Walk them through the onboarding wizard (QR scan needs their phone)
5. Bookmark their dashboard URL on their phone
6. Done — they get daily briefings automatically

## WeChat Web Login Note

The listener uses [wechaty](https://wechaty.js.org/) which connects through WeChat's web interface. If web login is blocked for their account (test at web.wechat.com), the alternatives are:
- **Manual export**: Export chat history as .txt from WeChat desktop
- **WeChat Work (企业微信)**: Has an official API, always works
- **WeChatPYAPI** (Windows only): Hooks into desktop app directly

## Voice Notes

After a WeChat call, send a voice note to yourself describing what was discussed. The agent transcribes it using local Whisper and adds it to the CRM.

Example: *"Called David Lim — he confirmed budget is 2.2 million, wants to view the Clendon Road property this Saturday."*

The contact name is extracted automatically from how you start the note.
