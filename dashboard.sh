#!/bin/bash
# ============================================================
#  Open the CRM Dashboard in your browser
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$ROOT_DIR/agent"
DASHBOARD_DIR="$ROOT_DIR/dashboard/public"

# Export latest CRM data as JSON for the dashboard
cd "$AGENT_DIR"
if [ -d "venv" ]; then
    source venv/bin/activate
fi

python3 -c "
import sys, json
sys.path.insert(0, '.')
from src.crm import export_crm_json, init_crm
init_crm()
data = export_crm_json()
with open('$DASHBOARD_DIR/data.json', 'w') as f:
    json.dump(data, f, indent=2, default=str)
print('CRM data exported to dashboard')
"

# Open in browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$DASHBOARD_DIR/index.html"
elif [[ "$OSTYPE" == "linux"* ]]; then
    xdg-open "$DASHBOARD_DIR/index.html" 2>/dev/null || echo "Open this in your browser: $DASHBOARD_DIR/index.html"
else
    echo "Open this in your browser: $DASHBOARD_DIR/index.html"
fi

echo "Dashboard opened in your browser."
