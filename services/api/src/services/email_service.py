# services/email_service.py
#
# Replace the body of send_otp_email with your real provider:
#   - Resend:    https://resend.com/docs/send-with-python
#   - SendGrid:  https://docs.sendgrid.com/for-developers/sending-email/v3-python-code-example
#   - AWS SES:   https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ses.html
#   - SMTP:      use Python's smtplib / email stdlib
#
# The function MUST be async. If your SDK is sync, wrap it with
# asyncio.to_thread() or run it in a thread pool executor.

import asyncio
from configs.config import settings


async def send_otp_email(to_email: str, otp: str) -> None:
    """
    Send a one-time password to `to_email`.

    The OTP is a 6-digit string like "482910".
    Raise an exception if sending fails — the endpoint will return 500.
    """

    # ── Example: Resend ───────────────────────────────────────────────────
    # import resend
    # resend.api_key = settings.RESEND_API_KEY
    # await asyncio.to_thread(
    #     resend.Emails.send,
    #     {
    #         "from": "InternFlow <noreply@intern-flow.in>",
    #         "to": [to_email],
    #         "subject": f"{otp} is your InternFlow code",
    #         "html": _html(otp),
    #     },
    # )

    # ── Example: SendGrid ─────────────────────────────────────────────────
    # import sendgrid
    # from sendgrid.helpers.mail import Mail
    # sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
    # message = Mail(
    #     from_email="noreply@intern-flow.in",
    #     to_emails=to_email,
    #     subject=f"{otp} is your InternFlow code",
    #     html_content=_html(otp),
    # )
    # await asyncio.to_thread(sg.send, message)

    # ── Fallback: print to console (development only) ─────────────────────
    print(f"[DEV] OTP for {to_email}: {otp}")


def _html(otp: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1a1a2e">Your InternFlow verification code</h2>
      <p style="font-size:2rem;letter-spacing:.3em;font-weight:700;color:#4f46e5">{otp}</p>
      <p style="color:#6b7280">This code expires in 10 minutes and can only be used once.</p>
      <p style="color:#6b7280;font-size:.875rem">If you didn't request this, you can safely ignore this email.</p>
    </div>
    """