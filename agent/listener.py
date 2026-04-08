"""
WhatsApp Message Listener (Python wrapper)

The actual listener runs in Node.js (../listener/index.js) using whatsapp-web.js.
This file provides the MessageStore class used by main.py to read captured messages,
and can also be run directly to start the Node listener.
"""

import os
import sys
import json
import subprocess
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import MESSAGE_LOG_FILE


class MessageStore:
    """Reads messages captured by the Node.js WhatsApp listener."""

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
        with open(MESSAGE_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(self.messages, f, indent=2, ensure_ascii=False)


def start_node_listener():
    """Start the Node.js WhatsApp listener."""
    listener_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "listener")

    if not os.path.exists(os.path.join(listener_dir, "node_modules")):
        print("[Listener] Installing WhatsApp dependencies...")
        subprocess.run(["npm", "install"], cwd=listener_dir, check=True)

    print("[Listener] Starting WhatsApp listener...")
    subprocess.run(["node", "index.js"], cwd=listener_dir)


if __name__ == "__main__":
    start_node_listener()
