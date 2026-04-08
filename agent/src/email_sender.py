import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from config.settings import (
    EMAIL_FROM, EMAIL_TO, EMAIL_APP_PASSWORD,
    SMTP_SERVER, SMTP_PORT, CRM_FILE
)


def send_briefing_email(subject: str, html_body: str, attach_crm: bool = True):
    """Send the morning briefing email with optional CRM attachment."""
    msg = MIMEMultipart()
    msg["From"] = EMAIL_FROM
    msg["To"] = EMAIL_TO
    msg["Subject"] = subject

    msg.attach(MIMEText(html_body, "html"))

    # Attach the CRM spreadsheet
    if attach_crm and os.path.exists(CRM_FILE):
        with open(CRM_FILE, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            today = datetime.now().strftime("%Y-%m-%d")
            part.add_header(
                "Content-Disposition",
                f'attachment; filename="WeChat_CRM_{today}.xlsx"'
            )
            msg.attach(part)

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(EMAIL_FROM, EMAIL_APP_PASSWORD)
        server.sendmail(EMAIL_FROM, EMAIL_TO, msg.as_string())

    print(f"[Email] Briefing sent to {EMAIL_TO}")


def format_briefing_html(briefing: dict) -> str:
    """Convert the briefing dict into a formatted HTML email."""
    today = datetime.now().strftime("%A, %d %B %Y")

    conversations_html = ""
    for conv in briefing.get("conversations", []):
        needs_reply = conv.get("needs_reply", False)
        reply_section = ""
        if needs_reply:
            reply_section = f"""
            <div style="background:#f0f7ff;padding:12px;border-radius:8px;margin-top:8px">
                <strong>Draft Reply A (casual):</strong><br>{conv.get('draft_reply_a', 'N/A')}
                <br><br>
                <strong>Draft Reply B (professional):</strong><br>{conv.get('draft_reply_b', 'N/A')}
            </div>"""

        action_items = "".join(
            f"<li>{item}</li>" for item in conv.get("action_items", [])
        )

        conversations_html += f"""
        <div style="border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:12px">
            <h3 style="margin:0 0 8px 0;color:#1a1a2e">{conv.get('contact_name', 'Unknown')}</h3>
            <p style="margin:0 0 8px 0;color:#444">{conv.get('summary', '')}</p>
            {'<ul style="margin:4px 0">' + action_items + '</ul>' if action_items else ''}
            {reply_section}
        </div>"""

    urgent_items = "".join(
        f"<li style='color:#c0392b'>{item}</li>"
        for item in briefing.get("urgent_items", [])
    )

    crm_updates = ""
    for update in briefing.get("crm_updates", []):
        crm_updates += f"<li>{update}</li>"

    html = f"""
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
        <h1 style="color:#1a1a2e;border-bottom:2px solid #667eea;padding-bottom:8px">
            WeChat Morning Briefing
        </h1>
        <p style="color:#666">{today}</p>

        <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin-bottom:20px">
            <h2 style="margin:0 0 8px 0;font-size:16px">Overview</h2>
            <p style="margin:0">{briefing.get('overview', 'No messages to report.')}</p>
        </div>

        {'<div style="background:#fff5f5;padding:16px;border-radius:8px;margin-bottom:20px"><h2 style="margin:0 0 8px 0;font-size:16px;color:#c0392b">Urgent Items</h2><ul style="margin:4px 0">' + urgent_items + '</ul></div>' if urgent_items else ''}

        <h2 style="font-size:16px;color:#1a1a2e">Conversations</h2>
        {conversations_html if conversations_html else '<p style="color:#999">No conversations in the last 24 hours.</p>'}

        {'<div style="background:#f0fff4;padding:16px;border-radius:8px;margin-top:20px"><h2 style="margin:0 0 8px 0;font-size:16px;color:#27ae60">CRM Updates</h2><ul style="margin:4px 0">' + crm_updates + '</ul></div>' if crm_updates else ''}

        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
            The latest CRM spreadsheet is attached. Open it in Excel or Google Sheets.
        </p>
    </body>
    </html>"""

    return html
