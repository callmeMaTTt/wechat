#!/bin/bash
# ============================================================
#  WhatsApp Morning Assistant — Start
#  Just run: bash start.sh
# ============================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$ROOT_DIR/agent"
LISTENER_DIR="$ROOT_DIR/listener"

# Check setup was done
if [ ! -f "$AGENT_DIR/.env" ]; then
    echo -e "${RED}Setup not complete.${NC} Run ${BOLD}bash setup.sh${NC} first."
    exit 1
fi

if [ ! -d "$LISTENER_DIR/node_modules" ]; then
    echo -e "${RED}Setup not complete.${NC} Run ${BOLD}bash setup.sh${NC} first."
    exit 1
fi

# Get briefing time from .env
BRIEFING_TIME=$(grep BRIEFING_TIME "$AGENT_DIR/.env" | cut -d= -f2)

clear
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  WhatsApp Morning Assistant${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo -e "  Morning briefing: ${GREEN}$BRIEFING_TIME${NC}"
echo ""

# Start the Python scheduler in the background
echo "  Starting scheduler..."
cd "$AGENT_DIR"
source venv/bin/activate
python3 main.py &
SCHEDULER_PID=$!
echo -e "  ${GREEN}✓${NC} Scheduler running"
echo ""

# Start the WhatsApp listener (foreground — needs QR scan)
echo -e "${YELLOW}  Starting WhatsApp listener...${NC}"
echo "  You'll need to scan a QR code with your phone."
echo "  (WhatsApp → Settings → Linked Devices → Link a Device)"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""
echo "============================================"
echo ""

# Trap Ctrl+C to kill both processes
trap "echo ''; echo 'Stopping...'; kill $SCHEDULER_PID 2>/dev/null; exit 0" INT TERM

cd "$LISTENER_DIR"
node index.js

# If listener exits, also stop scheduler
kill $SCHEDULER_PID 2>/dev/null
