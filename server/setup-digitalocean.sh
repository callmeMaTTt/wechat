#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Morning Brief — DigitalOcean Setup Script
#  Run this as root on a fresh Ubuntu 22.04/24.04 droplet
# ─────────────────────────────────────────────────────────────

set -e

echo ""
echo "=========================================="
echo "  Morning Brief — Server Setup"
echo "=========================================="
echo ""

# ── 1. System packages ────────────────────────────────────────
echo "[1/6] Installing system packages..."
apt-get update -qq

# Several libs were renamed with a t64 suffix in Ubuntu 24.04. Try the new
# names first and fall back to the legacy names on older releases.
install_pkg() {
  for pkg in "$@"; do
    if apt-get install -y -qq "$pkg" 2>/dev/null; then
      return 0
    fi
  done
  echo "  WARNING: could not install any of: $*"
  return 1
}

apt-get install -y -qq \
  curl git nginx certbot python3-certbot-nginx \
  libgbm-dev libxkbcommon-dev libglib2.0-0 libnss3 \
  libdrm2 libxcomposite1 libxdamage1 libxrandr2 libxss1 \
  libpango-1.0-0 libcairo2

install_pkg libasound2t64 libasound2
install_pkg libatk1.0-0t64 libatk1.0-0
install_pkg libatk-bridge2.0-0t64 libatk-bridge2.0-0
install_pkg libcups2t64 libcups2

# Chromium: apt package on 22.04, snap-transitional on 24.04. Fall back to
# installing via snap if neither apt package is available.
apt-get install -y -qq chromium-browser 2>/dev/null || \
  apt-get install -y -qq chromium 2>/dev/null || \
  { apt-get install -y -qq snapd && snap install chromium; }

# ── 2. Node.js 20 ─────────────────────────────────────────────
echo "[2/6] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null
apt-get install -y -qq nodejs

# ── 3. PM2 (keeps app running) ─────────────────────────────────
echo "[3/6] Installing PM2..."
npm install -g pm2 > /dev/null

# ── 4. Clone repo ─────────────────────────────────────────────
echo "[4/6] Cloning Morning Brief..."
if [ -d "/app" ]; then
  echo "  /app already exists — pulling latest..."
  cd /app
  git pull origin claude/build-ai-agent-app-kQ5B6
else
  git clone https://github.com/callmeMaTTt/wechat.git /app
  cd /app
  git checkout claude/build-ai-agent-app-kQ5B6
fi

cd /app/server
npm install

# ── 5. Config ──────────────────────────────────────────────────
echo "[5/6] Configuration..."
echo ""

if [ ! -f /app/server/.env ]; then
  read -p "Anthropic API key: " ANTHROPIC_KEY
  read -p "Gmail address (sends briefings): " EMAIL_FROM
  read -s -p "Gmail App Password: " EMAIL_PASS; echo ""
  read -p "OpenAI API key for voice transcription (press Enter to skip): " OPENAI_KEY
  read -p "Your domain (e.g. morningbrief.ai) or press Enter to use IP: " DOMAIN

  if [ -z "$DOMAIN" ]; then
    BASE_URL="http://$(curl -s ifconfig.me)"
  else
    BASE_URL="https://$DOMAIN"
  fi

  cat > /app/server/.env << EOF
PORT=3000
BASE_URL=$BASE_URL
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
EMAIL_FROM=$EMAIL_FROM
EMAIL_APP_PASSWORD=$EMAIL_PASS
OPENAI_API_KEY=$OPENAI_KEY
CHROME_BIN=$(which chromium-browser || which chromium || ls /snap/bin/chromium 2>/dev/null)
PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser || which chromium || ls /snap/bin/chromium 2>/dev/null)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
EOF
  echo ""
  echo "  Config saved."
else
  echo "  .env already exists — skipping."
  DOMAIN=$(grep BASE_URL /app/server/.env | cut -d'/' -f3 | tr -d '\r')
fi

# ── 6. Start app with PM2 ──────────────────────────────────────
echo "[6/6] Starting Morning Brief..."
pm2 stop morningbrief 2>/dev/null || true
pm2 start /app/server/index.js --name morningbrief
pm2 startup | tail -1 | bash 2>/dev/null || true
pm2 save

# ── Nginx config ───────────────────────────────────────────────
if [ ! -z "$DOMAIN" ]; then
  echo ""
  echo "Setting up Nginx for $DOMAIN..."

  cat > /etc/nginx/sites-available/morningbrief << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

  ln -sf /etc/nginx/sites-available/morningbrief /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl restart nginx

  echo ""
  echo "  Getting SSL certificate..."
  certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $EMAIL_FROM 2>/dev/null || \
    echo "  SSL skipped — DNS may not be pointing to this server yet. Run: certbot --nginx -d $DOMAIN"
fi

# ── Done ───────────────────────────────────────────────────────
IP=$(curl -s ifconfig.me)
echo ""
echo "=========================================="
echo "  Setup complete!"
echo "=========================================="
echo ""
if [ ! -z "$DOMAIN" ]; then
  echo "  Site:      https://$DOMAIN"
else
  echo "  Site:      http://$IP:3000"
fi
echo "  Logs:      pm2 logs morningbrief"
echo "  Restart:   pm2 restart morningbrief"
echo "  Status:    pm2 status"
echo ""
