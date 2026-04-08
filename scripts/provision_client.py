#!/usr/bin/env python3
"""
Provision a new client for the WeChat Morning Assistant.

Usage:
    python3 provision_client.py "Client Name"

This generates:
    - A unique client ID
    - The dashboard URL
    - The .env values they need
"""

import sys
import hashlib
from datetime import datetime


def provision(name: str):
    # Generate a URL-safe client ID from their name
    raw = f"{name.lower()}-{datetime.now().strftime('%Y%m%d')}"
    short_hash = hashlib.md5(raw.encode()).hexdigest()[:6]
    client_id = f"{name.lower().replace(' ', '-')}-{short_hash}"

    print(f"""
{'='*60}
  New Client Provisioned
{'='*60}

  Name:       {name}
  Client ID:  {client_id}
  Created:    {datetime.now().strftime('%Y-%m-%d %H:%M')}

{'='*60}
  DASHBOARD URL
{'='*60}

  https://YOUR-VERCEL-APP.vercel.app/?client_id={client_id}

  (Replace YOUR-VERCEL-APP with your actual Vercel domain)

{'='*60}
  VERCEL ENVIRONMENT VARIABLE
{'='*60}

  No per-client Vercel config needed — the client ID is in the URL.

{'='*60}
  VALUES FOR THEIR .env FILE
{'='*60}

  CLIENT_ID={client_id}
  VERCEL_KV_URL=<your Vercel KV REST URL>

  (Add these to the .env on their Mac, or enter them in
   Settings within the desktop app)

{'='*60}
  NEXT STEPS
{'='*60}

  1. Send them the WeChat Morning Assistant .dmg
  2. Book a 20-minute Zoom call
  3. Walk them through the onboarding wizard
  4. In Settings, add the CLIENT_ID and VERCEL_KV_URL above
  5. Bookmark their dashboard URL on their phone

{'='*60}
""")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 provision_client.py \"Client Name\"")
        print("Example: python3 provision_client.py \"Sarah Chen\"")
        sys.exit(1)

    provision(sys.argv[1])
