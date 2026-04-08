#!/bin/bash
# ============================================================
#  WeChat Morning Assistant — Send Test Briefing
#  Just run: bash test.sh
# ============================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
NC="\033[0m"

AGENT_DIR="$(dirname "$0")/agent"

if [ ! -f "$AGENT_DIR/.env" ]; then
    echo -e "${RED}Setup not complete.${NC} Run ${BOLD}bash setup.sh${NC} first."
    exit 1
fi

cd "$AGENT_DIR"
source venv/bin/activate

echo ""
echo -e "${BOLD}Sending a test briefing to your email...${NC}"
echo ""

python3 main.py --now

echo ""
echo -e "${GREEN}Done!${NC} Check your email inbox."
echo ""
