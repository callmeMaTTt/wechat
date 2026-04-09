#!/bin/bash
# ─────────────────────────────────────────────────
#  WhatsApp Morning Assistant — Server Setup
# ─────────────────────────────────────────────────

set -e

echo ""
echo "=========================================="
echo "  WhatsApp Morning Assistant — Setup"
echo "=========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is required. Install it from https://nodejs.org"
  exit 1
fi
echo "Node.js: $(node -v)"

# Navigate to server directory
cd "$(dirname "$0")/server"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Set up .env if it doesn't exist
if [ ! -f .env ]; then
  echo ""
  echo "─── Configuration ───"
  echo ""

  read -p "Anthropic API key (from console.anthropic.com): " ANTHROPIC_KEY
  read -p "Gmail address (to send briefings from): " EMAIL_FROM
  read -p "Gmail App Password (see: support.google.com/accounts/answer/185833): " EMAIL_PASS
  read -p "Server URL (press Enter for http://localhost:3000): " BASE_URL
  BASE_URL=${BASE_URL:-http://localhost:3000}

  cat > .env << EOF
PORT=3000
BASE_URL=$BASE_URL
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
EMAIL_FROM=$EMAIL_FROM
EMAIL_APP_PASSWORD=$EMAIL_PASS
EOF

  echo ""
  echo "Config saved to server/.env"
else
  echo ""
  echo "Config file already exists (server/.env)"
fi

echo ""
echo "=========================================="
echo "  Setup complete!"
echo "=========================================="
echo ""
echo "  Start the server:  bash server-start.sh"
echo "  Then open:         http://localhost:3000"
echo ""
