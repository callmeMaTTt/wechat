#!/bin/bash
# ============================================================
#  WeChat Morning Assistant — Start
#  Just run: bash start.sh
# ============================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m"

AGENT_DIR="$(dirname "$0")/agent"

# Check setup was done
if [ ! -f "$AGENT_DIR/.env" ]; then
    echo -e "${RED}Setup not complete.${NC} Run ${BOLD}bash setup.sh${NC} first."
    exit 1
fi

if [ ! -d "$AGENT_DIR/venv" ]; then
    echo -e "${RED}Setup not complete.${NC} Run ${BOLD}bash setup.sh${NC} first."
    exit 1
fi

cd "$AGENT_DIR"
source venv/bin/activate

clear
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  WeChat Morning Assistant${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

# Get briefing time from .env
BRIEFING_TIME=$(grep BRIEFING_TIME .env | cut -d= -f2)
echo -e "  Morning briefing: ${GREEN}$BRIEFING_TIME${NC}"
echo ""

# Start the scheduler in the background
echo -e "  Starting scheduler..."
python3 main.py &
SCHEDULER_PID=$!

echo -e "  ${GREEN}✓${NC} Scheduler running (PID: $SCHEDULER_PID)"
echo ""

# Start the listener (foreground — needs QR scan)
echo -e "${YELLOW}  Starting WeChat listener...${NC}"
echo "  You'll need to scan a QR code with your phone."
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""
echo "============================================"
echo ""

# Trap Ctrl+C to kill both processes
trap "echo ''; echo 'Stopping...'; kill $SCHEDULER_PID 2>/dev/null; exit 0" INT TERM

python3 listener.py

# If listener exits, also stop scheduler
kill $SCHEDULER_PID 2>/dev/null
