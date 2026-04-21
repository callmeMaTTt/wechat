# The Morning Brief

AI-powered daily briefings for busy professionals. The Morning Brief reads your WhatsApp and email every morning, summarises what matters, flags urgent items, and drafts replies — all delivered to your inbox before your first coffee.

## What it does

Every day at a time you pick (in your local timezone), The Morning Brief:

1. **Summarises** every WhatsApp conversation and inbound email from the last 24 hours
2. **Flags urgent items** that need action today
3. **Drafts replies** (casual + professional) for messages that need a response
4. **Tracks contacts** in a lightweight CRM — lead status, budget, timeline, follow-ups

Built for real estate agents, sales teams, and anyone who lives in their messages.

## Architecture

```
morning-brief/
└── server/            Node.js web app — the whole product
    ├── index.js       Express server, routes, cron scheduler
    ├── clients.js     WhatsApp client manager (whatsapp-web.js)
    ├── briefing.js    Claude-powered summariser + email sender
    ├── email-listener.js   IMAP poller for inbound emails
    ├── transcriber.js Voice-note transcription (OpenAI Whisper)
    ├── views/         Landing page + dashboard
    ├── setup-digitalocean.sh   One-command server setup
    └── package.json
```

## Deploy in one command

Spin up a DigitalOcean droplet (Ubuntu 22.04 or 24.04, 2GB+ RAM), SSH in as root, and run:

```bash
curl -fsSL https://raw.githubusercontent.com/callmeMaTTt/morning-brief/main/server/setup-digitalocean.sh | bash
```

The script installs Node, Chromium, PM2, Nginx, optionally grabs a free Let's Encrypt SSL cert, and starts the app. It'll ask for:

- Your Anthropic API key (for Claude summarisation)
- A Gmail address + [App Password](https://myaccount.google.com/apppasswords) (to send briefings)
- Optional: OpenAI API key for voice-note transcription
- Optional: a domain name (otherwise it runs on the droplet's IP)

## How users sign up

1. Visit your deployed URL
2. Enter name + email
3. Scan the WhatsApp QR code on their phone
4. Connect their email inbox (Gmail / Outlook / Yahoo / custom IMAP)
5. Pick a briefing time and timezone in Settings
6. Receive the first briefing the next morning

## Key features

- **Per-user scheduling** — each user picks their own briefing time and timezone
- **Timezone-aware** — the 5-min scheduler fires each client's briefing at their local time
- **Preview mode** — generate a briefing without emailing, to tune contacts before committing
- **Onboarding checklist** — the dashboard walks new users through setup
- **Multi-client** — one server hosts many users, each with their own dashboard

## Local development

```bash
cd server
npm install
cp .env.example .env    # fill in API keys
npm start
```

Then visit http://localhost:3000.

## Ops

```bash
pm2 status                         # process state
pm2 logs morningbrief --lines 50   # recent logs
pm2 restart morningbrief           # restart after env changes
cd /app && git pull && pm2 restart morningbrief   # pull updates
```

## License

MIT
