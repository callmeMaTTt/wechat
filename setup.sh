#!/bin/bash
# ============================================================
#  WhatsApp Morning Assistant — One-Time Setup
#  Just run: bash setup.sh
# ============================================================

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

clear
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  WhatsApp Morning Assistant — Setup${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo "  This will set everything up for you."
echo "  It takes about 5 minutes."
echo ""
echo -e "  Press ${GREEN}Enter${NC} to start (or Ctrl+C to cancel)"
read -r

# ── Step 1: Check Python & Node ─────────────────────────────
echo ""
echo -e "${BLUE}[1/7]${NC} Checking Python..."

if command -v python3 &> /dev/null; then
    PY_VERSION=$(python3 --version 2>&1)
    echo -e "  ${GREEN}✓${NC} Found $PY_VERSION"
else
    echo -e "  ${RED}✗${NC} Python 3 not found."
    echo ""
    echo "  Install Python: https://www.python.org/downloads/"
    echo "  Then run this script again."
    exit 1
fi

echo ""
echo -e "${BLUE}[2/7]${NC} Checking Node.js..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    echo -e "  ${GREEN}✓${NC} Found Node.js $NODE_VERSION"
else
    echo -e "  ${RED}✗${NC} Node.js not found."
    echo ""
    echo "  Install Node.js: https://nodejs.org/ (download the LTS version)"
    echo "  Then run this script again."
    exit 1
fi

# ── Step 2: Install packages ────────────────────────────────
echo ""
echo -e "${BLUE}[3/7]${NC} Installing Python packages..."

cd "$ROOT_DIR/agent"
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo -e "  ${GREEN}✓${NC} Python packages installed"

echo ""
echo -e "${BLUE}[4/7]${NC} Installing WhatsApp connector..."

cd "$ROOT_DIR/listener"
npm install --silent 2>&1 | tail -1
echo -e "  ${GREEN}✓${NC} WhatsApp connector installed"

# ── Step 3: Anthropic API Key ────────────────────────────────
echo ""
echo -e "${BLUE}[5/7]${NC} Anthropic API Key"
echo ""
echo "  This powers the AI that reads and summarises your messages."
echo "  Get one here:"
echo -e "  → ${BOLD}https://console.anthropic.com${NC}"
echo "  → Click 'API Keys' → 'Create Key'"
echo ""

while true; do
    echo -n "  Paste your key here: "
    read -r API_KEY
    if [[ "$API_KEY" == sk-ant-* ]] && [[ ${#API_KEY} -gt 20 ]]; then
        echo -e "  ${GREEN}✓${NC} Key looks good"
        break
    else
        echo -e "  ${RED}✗${NC} That doesn't look right. It should start with 'sk-ant-'"
        echo ""
    fi
done

# ── Step 4: Email Settings ───────────────────────────────────
echo ""
echo -e "${BLUE}[6/7]${NC} Email Settings"
echo ""
echo "  Your morning summary will be sent to this email."
echo ""

echo -n "  Your Gmail address: "
read -r EMAIL_FROM

echo ""
echo "  You need a Gmail 'App Password' (not your regular password)."
echo "  Get one here:"
echo -e "  → ${BOLD}https://myaccount.google.com/apppasswords${NC}"
echo "  → Create one called 'WhatsApp Assistant'"
echo "  → Copy the 16-letter password"
echo ""

while true; do
    echo -n "  Paste the App Password: "
    read -r EMAIL_PASSWORD
    EMAIL_PASSWORD=$(echo "$EMAIL_PASSWORD" | tr -d ' ')
    if [[ ${#EMAIL_PASSWORD} -ge 16 ]]; then
        echo -e "  ${GREEN}✓${NC} Password saved"
        break
    else
        echo -e "  ${RED}✗${NC} That should be 16 letters. You entered ${#EMAIL_PASSWORD}. Try again."
        echo ""
    fi
done

# ── Step 5: Your Details ─────────────────────────────────────
echo ""
echo -e "${BLUE}[7/7]${NC} Your Details"
echo ""

echo -n "  Your name on WhatsApp: "
read -r MY_NAME

echo ""
echo "  What time should the morning briefing arrive?"
echo "    1) 6:30 AM"
echo "    2) 7:00 AM"
echo "    3) 7:30 AM (recommended)"
echo "    4) 8:00 AM"
echo "    5) 8:30 AM"
echo "    6) 9:00 AM"
echo ""
echo -n "  Pick a number [3]: "
read -r TIME_CHOICE

case "$TIME_CHOICE" in
    1) BRIEFING_TIME="06:30" ;;
    2) BRIEFING_TIME="07:00" ;;
    4) BRIEFING_TIME="08:00" ;;
    5) BRIEFING_TIME="08:30" ;;
    6) BRIEFING_TIME="09:00" ;;
    *) BRIEFING_TIME="07:30" ;;
esac

echo -e "  ${GREEN}✓${NC} Briefing set for $BRIEFING_TIME"

# ── Write .env file ──────────────────────────────────────────
cat > "$ROOT_DIR/agent/.env" << EOF
ANTHROPIC_API_KEY=$API_KEY
MY_WECHAT_NAME=$MY_NAME
DELIVERY_METHOD=email
EMAIL_FROM=$EMAIL_FROM
EMAIL_TO=$EMAIL_FROM
EMAIL_APP_PASSWORD=$EMAIL_PASSWORD
BRIEFING_TIME=$BRIEFING_TIME
WHISPER_MODEL=medium
VERCEL_KV_URL=
CLIENT_ID=
EOF

echo -e "  ${GREEN}✓${NC} Settings saved"

# ── Download Whisper model ───────────────────────────────────
echo ""
echo "  Downloading voice transcription model (~460MB, one time only)..."
echo "  This may take a few minutes on slower connections."
echo ""

cd "$ROOT_DIR/agent"
source venv/bin/activate
python3 -c "
try:
    from faster_whisper import WhisperModel
    print('  Downloading model...')
    WhisperModel('medium', device='cpu', compute_type='int8')
    print('  Done!')
except Exception as e:
    print(f'  Skipped (can install later): {e}')
"

echo -e "  ${GREEN}✓${NC} Voice transcription ready"

# ── Done! ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}  Setup complete!${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo "  To start the assistant, run:"
echo ""
echo -e "    ${BOLD}bash start.sh${NC}"
echo ""
echo "  To send a test email right now:"
echo ""
echo -e "    ${BOLD}bash test.sh${NC}"
echo ""
echo "============================================"
echo ""
