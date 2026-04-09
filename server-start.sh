#!/bin/bash
# ─────────────────────────────────────────────────
#  Morning Brief (morningbrief.ai) — Start Server
# ─────────────────────────────────────────────────

cd "$(dirname "$0")/server"

if [ ! -f .env ]; then
  echo "ERROR: Run 'bash server-setup.sh' first to configure."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "=========================================="
echo "  Starting Morning Brief..."
echo "=========================================="
echo ""

node index.js
