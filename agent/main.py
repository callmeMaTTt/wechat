"""
WeChat Morning Assistant — Scheduler

Runs the daily morning briefing at the configured time.
Use --now to run immediately for testing.
"""

import os
import sys
import argparse
import schedule
import time
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import BRIEFING_TIME, ANTHROPIC_API_KEY, EMAIL_APP_PASSWORD
from src.agent import WeChatAgent
from src.transcriber import VoiceTranscriber
from src.crm import init_crm


def run_briefing():
    """Execute the morning briefing."""
    print(f"\n[Scheduler] Triggering briefing at {datetime.now().strftime('%H:%M')}")

    # Load messages from the listener's log
    from listener import MessageStore
    store = MessageStore()
    messages = store.get_since(hours=24)

    if not messages:
        print("[Scheduler] No messages in the last 24 hours")

    # Run the agent
    transcriber = VoiceTranscriber()
    agent = WeChatAgent(transcriber=transcriber)
    agent.run_briefing(messages)


def validate_config():
    """Check that required settings are configured."""
    issues = []
    if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "sk-ant-your-key-here":
        issues.append("ANTHROPIC_API_KEY not set in .env")
    if not EMAIL_APP_PASSWORD or EMAIL_APP_PASSWORD == "xxxx-xxxx-xxxx-xxxx":
        issues.append("EMAIL_APP_PASSWORD not set in .env")

    if issues:
        print("\n[Config] Missing required settings:")
        for issue in issues:
            print(f"  - {issue}")
        print("\nEdit your .env file and try again.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="WeChat Morning Assistant")
    parser.add_argument("--now", action="store_true", help="Run briefing immediately")
    args = parser.parse_args()

    validate_config()
    init_crm()

    if args.now:
        print("[Scheduler] Running briefing now (test mode)...")
        run_briefing()
        return

    print(f"\n{'='*50}")
    print(f"  WeChat Morning Assistant — Scheduler")
    print(f"{'='*50}")
    print(f"  Briefing time: {BRIEFING_TIME}")
    print(f"  Next run: today at {BRIEFING_TIME}" if datetime.now().strftime("%H:%M") < BRIEFING_TIME
          else f"  Next run: tomorrow at {BRIEFING_TIME}")
    print(f"{'='*50}\n")

    schedule.every().day.at(BRIEFING_TIME).do(run_briefing)

    print("[Scheduler] Waiting for scheduled time. Press Ctrl+C to stop.\n")

    try:
        while True:
            schedule.run_pending()
            time.sleep(30)
    except KeyboardInterrupt:
        print("\n[Scheduler] Stopped.")


if __name__ == "__main__":
    main()
