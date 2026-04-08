import json
from datetime import datetime
import anthropic
from config.settings import ANTHROPIC_API_KEY, SUMMARISER_PROMPT, CRM_EXTRACTION_PROMPT
from src.crm import update_contacts, load_contacts, export_crm_json
from src.email_sender import send_briefing_email, format_briefing_html
from src.cloud_sync import sync_to_cloud


class WeChatAgent:
    """Orchestrates the daily briefing: summarise, extract CRM data, email."""

    def __init__(self, transcriber=None):
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.transcriber = transcriber

    def run_briefing(self, messages: list[dict]):
        """
        Run the full morning briefing pipeline.

        Args:
            messages: list of dicts with keys: sender, content, timestamp, type
        """
        print(f"\n{'='*60}")
        print(f"[Agent] Running morning briefing — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        print(f"[Agent] Processing {len(messages)} messages")
        print(f"{'='*60}\n")

        # 1. Include voice notes
        voice_context = ""
        if self.transcriber:
            voice_notes = self.transcriber.get_unprocessed_notes()
            if voice_notes:
                voice_context = "\n\n--- POST-CALL VOICE NOTES ---\n"
                for note in voice_notes:
                    contact = note.get("contact_name", "Unknown contact")
                    voice_context += f"\n[Voice note about {contact}]: {note['transcript']}\n"
                print(f"[Agent] Including {len(voice_notes)} voice notes")

        # 2. Format messages for Claude
        message_text = self._format_messages(messages)
        if not message_text and not voice_context:
            print("[Agent] No messages or voice notes to process")
            self._send_empty_briefing()
            return

        full_text = message_text + voice_context

        # 3. Get summary and draft replies
        print("[Agent] Generating summary and draft replies...")
        briefing = self._summarise(full_text)

        # 4. Extract CRM data
        print("[Agent] Extracting CRM data...")
        crm_data = self._extract_crm_data(full_text)

        # 5. Update CRM spreadsheet
        crm_updates = []
        if crm_data and "contacts" in crm_data:
            crm_updates = update_contacts(crm_data["contacts"])
            print(f"[Agent] CRM updates: {len(crm_updates)}")

        # 6. Mark voice notes as processed
        if self.transcriber:
            self.transcriber.mark_notes_processed()

        # 7. Add CRM updates to briefing
        briefing["crm_updates"] = crm_updates

        # 8. Send email
        print("[Agent] Sending briefing email...")
        today = datetime.now().strftime("%A, %d %B %Y")
        subject = f"WeChat Morning Briefing — {today}"
        html = format_briefing_html(briefing)
        send_briefing_email(subject, html, attach_crm=True)

        # 9. Sync to cloud dashboard
        sync_to_cloud()

        print(f"\n[Agent] Briefing complete!\n")

    def _format_messages(self, messages: list[dict]) -> str:
        """Format message list into text for Claude."""
        if not messages:
            return ""

        grouped = {}
        for msg in messages:
            sender = msg.get("sender", "Unknown")
            if sender not in grouped:
                grouped[sender] = []
            timestamp = msg.get("timestamp", "")
            content = msg.get("content", "")
            msg_type = msg.get("type", "text")
            if msg_type == "voice":
                content = f"[Voice message — {content}]"
            elif msg_type == "image":
                content = "[Image sent]"
            elif msg_type == "file":
                content = f"[File: {content}]"
            grouped[sender].append(f"  [{timestamp}] {content}")

        text = ""
        for sender, msgs in grouped.items():
            text += f"\n--- {sender} ---\n"
            text += "\n".join(msgs)
            text += "\n"

        return text

    def _summarise(self, message_text: str) -> dict:
        """Call Claude to summarise messages and draft replies."""
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                system=SUMMARISER_PROMPT,
                messages=[{
                    "role": "user",
                    "content": f"Here are the WeChat messages from the past 24 hours:\n\n{message_text}"
                }]
            )

            text = response.content[0].text
            # Try to parse JSON from the response
            return self._parse_json_response(text)

        except Exception as e:
            print(f"[Agent] Summarisation error: {e}")
            return {
                "overview": f"Error generating summary: {str(e)}",
                "urgent_items": [],
                "conversations": []
            }

    def _extract_crm_data(self, message_text: str) -> dict:
        """Call Claude to extract contact/CRM data from messages."""
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                system=CRM_EXTRACTION_PROMPT,
                messages=[{
                    "role": "user",
                    "content": f"Extract contact data from these messages:\n\n{message_text}"
                }]
            )

            text = response.content[0].text
            return self._parse_json_response(text)

        except Exception as e:
            print(f"[Agent] CRM extraction error: {e}")
            return {"contacts": []}

    def _parse_json_response(self, text: str) -> dict:
        """Parse JSON from Claude's response, handling markdown code blocks."""
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code block
        import re
        match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Last resort — find first { to last }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass

        print(f"[Agent] Warning: Could not parse JSON response")
        return {"overview": text, "urgent_items": [], "conversations": []}

    def _send_empty_briefing(self):
        """Send a briefing email with no messages."""
        today = datetime.now().strftime("%A, %d %B %Y")
        briefing = {
            "overview": "No new messages in the last 24 hours.",
            "urgent_items": [],
            "conversations": [],
            "crm_updates": []
        }
        subject = f"WeChat Morning Briefing — {today}"
        html = format_briefing_html(briefing)
        send_briefing_email(subject, html, attach_crm=True)
        sync_to_cloud()
