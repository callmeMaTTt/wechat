import json
import requests
from config.settings import VERCEL_KV_URL, CLIENT_ID
from src.crm import export_crm_json


def sync_to_cloud():
    """Push CRM data to Vercel KV for the hosted web dashboard."""
    if not VERCEL_KV_URL or not CLIENT_ID:
        print("[Sync] Cloud sync not configured (VERCEL_KV_URL or CLIENT_ID missing). Skipping.")
        return False

    try:
        crm_data = export_crm_json()
        payload = json.dumps(crm_data, ensure_ascii=False, default=str)

        # Vercel KV REST API — SET key value
        url = f"{VERCEL_KV_URL}/set/crm:{CLIENT_ID}"
        response = requests.post(
            url,
            json={"value": payload},
            headers={"Content-Type": "application/json"},
            timeout=15
        )

        if response.status_code == 200:
            print(f"[Sync] CRM data synced to cloud for client {CLIENT_ID}")
            return True
        else:
            print(f"[Sync] Failed to sync: {response.status_code} {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print("[Sync] No internet connection. Will retry next briefing.")
        return False
    except Exception as e:
        print(f"[Sync] Error: {e}")
        return False
