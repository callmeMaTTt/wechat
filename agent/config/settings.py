import os
from dotenv import load_dotenv

load_dotenv()

# Anthropic
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# WeChat
MY_WECHAT_NAME = os.getenv("MY_WECHAT_NAME", "")

# Email
DELIVERY_METHOD = os.getenv("DELIVERY_METHOD", "email")
EMAIL_FROM = os.getenv("EMAIL_FROM", "")
EMAIL_TO = os.getenv("EMAIL_TO", "")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD", "")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

# Schedule
BRIEFING_TIME = os.getenv("BRIEFING_TIME", "07:30")

# Voice transcription
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "medium")

# Cloud sync
VERCEL_KV_URL = os.getenv("VERCEL_KV_URL", "")
CLIENT_ID = os.getenv("CLIENT_ID", "")

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(BASE_DIR, "logs")
CRM_DIR = os.path.join(BASE_DIR, "crm")
CRM_FILE = os.path.join(CRM_DIR, "WeChat_CRM.xlsx")
VOICE_NOTES_FILE = os.path.join(LOGS_DIR, "voice_notes.json")
MESSAGE_LOG_FILE = os.path.join(LOGS_DIR, "messages.json")

# Ensure directories exist
os.makedirs(LOGS_DIR, exist_ok=True)
os.makedirs(CRM_DIR, exist_ok=True)

# Claude system prompts
SUMMARISER_PROMPT = """You are a WeChat assistant for a real estate professional.
You will receive WeChat messages from the past 24 hours.

Your job:
1. Summarise all conversations — group by contact, highlight urgent items
2. Identify action items and follow-ups needed
3. Flag any property-related signals (budget mentions, location preferences, timeline, buying intent)
4. Draft 2 reply options for each conversation that needs a response:
   - Option A: Short and casual
   - Option B: Detailed and professional

Respond in JSON with this structure:
{
  "overview": "Brief overview of all conversations",
  "urgent_items": ["list of urgent things"],
  "conversations": [
    {
      "contact_name": "Name",
      "summary": "What was discussed",
      "action_items": ["things to do"],
      "needs_reply": true,
      "draft_reply_a": "Short casual reply",
      "draft_reply_b": "Detailed professional reply"
    }
  ]
}"""

CRM_EXTRACTION_PROMPT = """You are a CRM data extraction assistant for a real estate professional.
Analyse the following WeChat messages and extract contact information.

For each person mentioned, extract whatever is available:
- name
- phone (if mentioned)
- wechat_id (if mentioned)
- property_type (house, apartment, townhouse, land, commercial)
- budget_min and budget_max (numbers only, in local currency)
- preferred_locations (list of suburbs/areas)
- timeline (when they want to buy/sell)
- lead_status: classify as one of: cold, warm, hot, client
  - cold: just chatting, no clear intent
  - warm: showed some interest, asked questions about properties
  - hot: actively looking, has budget, wants to see properties
  - client: already working together
- notes: any other relevant info
- suggested_followup: what action to take next
- followup_date: suggested date for follow-up (YYYY-MM-DD)

Respond in JSON:
{
  "contacts": [
    {
      "name": "...",
      "phone": "...",
      "wechat_id": "...",
      "property_type": "...",
      "budget_min": null,
      "budget_max": null,
      "preferred_locations": [],
      "timeline": "...",
      "lead_status": "warm",
      "notes": "...",
      "suggested_followup": "...",
      "followup_date": "2026-04-15"
    }
  ]
}"""
