from email.message import EmailMessage
import logging
import os
import smtplib

logger = logging.getLogger(__name__)


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    host = os.getenv("SMTP_HOST", "")
    sender = os.getenv("SMTP_FROM", "")
    if not host or not sender:
        logger.error("Password reset email is not configured: SMTP_HOST and SMTP_FROM are required")
        return

    message = EmailMessage()
    message["Subject"] = "Reset your zCRM password"
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        "A password reset was requested for your zCRM account.\n\n"
        f"Reset your password here: {reset_url}\n\n"
        "This link expires in one hour. If you did not request this, you can ignore this email."
    )

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME", "")
    password = os.getenv("SMTP_PASSWORD", "")
    use_starttls = os.getenv("SMTP_STARTTLS", "true").strip().lower() in {"1", "true", "yes", "on"}
    try:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.ehlo()
            if use_starttls:
                smtp.starttls()
                smtp.ehlo()
            if username:
                smtp.login(username, password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.exception("Password reset email delivery failed")
