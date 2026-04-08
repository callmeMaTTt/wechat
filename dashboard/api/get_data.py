"""Vercel serverless function — fetch CRM data from KV store."""
import os
import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Return CRM data for a given client ID."""
        # Parse client_id from query string
        query = self.path.split("?", 1)[1] if "?" in self.path else ""
        params = dict(p.split("=", 1) for p in query.split("&") if "=" in p)
        client_id = params.get("client_id", "")

        if not client_id:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "client_id required"}).encode())
            return

        try:
            import requests

            kv_url = os.environ.get("KV_REST_API_URL", "")
            kv_token = os.environ.get("KV_REST_API_TOKEN", "")

            if not kv_url or not kv_token:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "KV not configured"}).encode())
                return

            # Fetch from Vercel KV
            resp = requests.get(
                f"{kv_url}/get/crm:{client_id}",
                headers={"Authorization": f"Bearer {kv_token}"},
                timeout=10,
            )

            if resp.status_code == 200:
                data = resp.json()
                result = data.get("result")
                if result:
                    crm_data = json.loads(result) if isinstance(result, str) else result
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(json.dumps(crm_data).encode())
                    return

            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "No data found"}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
