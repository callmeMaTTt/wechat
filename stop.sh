#!/bin/bash
# ============================================================
#  WeChat Morning Assistant — Stop All Processes
#  Just run: bash stop.sh
# ============================================================

echo "Stopping WeChat Morning Assistant..."

# Kill any running listener or scheduler processes
pkill -f "python3 listener.py" 2>/dev/null
pkill -f "python3 main.py" 2>/dev/null

echo "Stopped."
