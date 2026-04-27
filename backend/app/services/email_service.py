import smtplib
from email.mime.text import MIMEText
import os


async def send_reset_link(to_email: str, reset_link: str):
    email_from = os.getenv("EMAIL_FROM")
    password = os.getenv("APP_PASSWORD")
    smtp_host = os.getenv("SMTP_HOST")
    subject = "Reset your password"
    smtp_port = int(os.getenv("SMTP_PORT"))

    body = f"""Hello,

Click the link below to reset your password:
{reset_link}

If you did not request this, you can ignore this email.
"""

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = email_from
    msg["To"] = to_email

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(email_from, password)
            server.send_message(msg)
        
        return "success"

    except Exception as e:
        return str(e)