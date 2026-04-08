#!/bin/bash
# ============================================================
#  Launch the Mac Menu Bar App
# ============================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
NC="\033[0m"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAC_DIR="$ROOT_DIR/mac-app"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found.${NC} Install from https://nodejs.org/"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "$MAC_DIR/node_modules" ]; then
    echo "Installing Mac app dependencies (first time only)..."
    cd "$MAC_DIR"
    npm install --silent 2>&1 | tail -1
    echo -e "${GREEN}✓${NC} Installed"
fi

echo ""
echo -e "${BOLD}Starting WeChat Morning Assistant Mac app...${NC}"
echo ""
echo "  Look for the purple dot in your menu bar (top right)."
echo "  Click it to access all features:"
echo "    • Run Briefing Now"
echo "    • Open Dashboard"
echo "    • Open CRM Spreadsheet"
echo "    • Settings"
echo ""

cd "$MAC_DIR"
npx electron .
