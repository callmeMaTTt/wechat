"""
WeChat Message Listener

Connects to WeChat via wechaty and captures all incoming messages.
Saves them to logs/messages.json for the morning briefing agent.
Also handles voice note transcription for post-call notes.
"""

import os
import sys
import json
import asyncio
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import MY_WECHAT_NAME, MESSAGE_LOG_FILE, LOGS_DIR
from src.transcriber import VoiceTranscriber


class MessageStore:
    """Persists captured messages to disk."""

    def __init__(self):
        self.messages = self._load()

    def _load(self) -> list:
        if os.path.exists(MESSAGE_LOG_FILE):
            with open(MESSAGE_LOG_FILE, "r", encoding="utf-8") as f:
                try:
                    return json.load(f)
                except json.JSONDecodeError:
                    return []
        return []

    def save(self):
        with open(MESSAGE_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(self.messages, f, indent=2, ensure_ascii=False)

    def add(self, message: dict):
        self.messages.append(message)
        self.save()

    def get_since(self, hours: int = 24) -> list:
        """Get messages from the last N hours."""
        cutoff = datetime.now().timestamp() - (hours * 3600)
        return [
            m for m in self.messages
            if m.get("timestamp_unix", 0) > cutoff
        ]

    def clear_old(self, days: int = 7):
        """Remove messages older than N days."""
        cutoff = datetime.now().timestamp() - (days * 86400)
        self.messages = [
            m for m in self.messages
            if m.get("timestamp_unix", 0) > cutoff
        ]
        self.save()


async def start_listener():
    """Start the wechaty listener."""
    try:
        from wechaty import Wechaty, Message, Contact
    except ImportError:
        print("ERROR: wechaty is not installed.")
        print("Install it with: pip install wechaty wechaty-puppet-service")
        print("\nYou also need a wechaty puppet service token.")
        print("See: https://wechaty.js.org/docs/puppet-providers/")
        sys.exit(1)

    store = MessageStore()
    transcriber = VoiceTranscriber()

    print("=" * 50)
    print("  WeChat Message Listener")
    print("=" * 50)
    print(f"  Logging to: {MESSAGE_LOG_FILE}")
    print(f"  Your name: {MY_WECHAT_NAME}")
    print(f"  Whisper model: {'loaded' if transcriber.model else 'not available'}")
    print("=" * 50)

    bot = Wechaty()

    @bot.on("scan")
    async def on_scan(qr_code: str, status: int, data=None):
        print(f"\n{'='*50}")
        print("  Scan this QR code with WeChat on your phone:")
        print(f"  https://wechaty.js.org/qrcode/{qr_code}")
        print(f"{'='*50}\n")

    @bot.on("login")
    async def on_login(contact: Contact):
        print(f"\n[Login] Logged in as: {contact.name}")
        print("[Listener] Now capturing messages. Keep this running.\n")

    @bot.on("logout")
    async def on_logout(contact: Contact):
        print(f"\n[Logout] {contact.name} logged out")
        print("[Listener] Attempting to reconnect...\n")

    @bot.on("message")
    async def on_message(msg: Message):
        try:
            # Skip self-sent messages (except voice notes to self)
            sender = msg.talker()
            sender_name = sender.name if sender else "Unknown"
            room = msg.room()
            room_name = ""
            if room:
                room_name = await room.topic() or "Unknown Group"

            is_self = sender_name == MY_WECHAT_NAME
            msg_type = msg.type().name.lower() if hasattr(msg.type(), 'name') else str(msg.type())

            # Handle voice notes sent to self (post-call notes)
            if is_self and msg_type in ("audio", "voice"):
                print(f"[Voice] Detected self-sent voice note — transcribing...")
                audio_path = os.path.join(LOGS_DIR, f"voice_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3")
                try:
                    file_box = await msg.to_file_box()
                    await file_box.to_file(audio_path)
                    result = transcriber.transcribe(audio_path)
                    if result:
                        contact_name = result.get("contact_name", "Unknown")
                        print(f"[Voice] Transcribed note about {contact_name}: {result['transcript'][:60]}...")
                except Exception as e:
                    print(f"[Voice] Failed to process voice note: {e}")
                return

            # Skip other self-sent messages
            if is_self:
                return

            # Build message record
            content = msg.text() or ""
            if msg_type in ("image", "attachment", "video"):
                content = f"[{msg_type}]"
            elif msg_type in ("audio", "voice"):
                content = "[Voice message]"

            record = {
                "sender": sender_name,
                "content": content,
                "type": msg_type,
                "room": room_name,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "timestamp_unix": datetime.now().timestamp(),
            }

            store.add(record)

            # Log to console
            location = f" in {room_name}" if room_name else ""
            preview = content[:50] + ("..." if len(content) > 50 else "")
            print(f"[{record['timestamp']}] {sender_name}{location}: {preview}")

        except Exception as e:
            print(f"[Error] Failed to process message: {e}")

    @bot.on("error")
    async def on_error(error):
        print(f"[Error] Bot error: {error}")

    # Clean old messages on startup
    store.clear_old(days=7)

    await bot.start()


def main():
    print("\nStarting WeChat listener...")
    print("You will need to scan a QR code with your phone.\n")
    asyncio.run(start_listener())


if __name__ == "__main__":
    main()
