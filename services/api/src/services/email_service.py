import asyncio
import httpx
import boto3
from configs.config import settings

# ── SES client (lazy – only used when EMAIL_PROVIDER=ses) ──────────────────
_ses = None

def _get_ses():
    global _ses
    if _ses is None:
        _ses = boto3.client(
            "ses",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
    return _ses


# ── Provider dispatch ───────────────────────────────────────────────────────
async def send_otp_email(to_email: str, otp: str) -> None:
    provider = getattr(settings, "EMAIL_PROVIDER", "resend").lower()
    if provider == "ses":
        await _send_via_ses(to_email, otp)
    else:
        await _send_via_resend(to_email, otp)


# ── SES ─────────────────────────────────────────────────────────────────────
async def _send_via_ses(to_email: str, otp: str) -> None:
    await asyncio.to_thread(
        _get_ses().send_email,
        Source="InternFlow <noreply@intern-flow.in>",
        Destination={"ToAddresses": [to_email]},
        Message={
            "Subject": {"Data": f"{otp} is your InternFlow code"},
            "Body": {"Html": {"Data": _html(otp)}},
        },
    )


# ── Resend ───────────────────────────────────────────────────────────────────
_RESEND_URL = "https://api.resend.com/emails"

async def _send_via_resend(to_email: str, otp: str) -> None:
    api_key = getattr(settings, "RESEND_API_KEY", "")
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            _RESEND_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": "InternFlow <noreply@intern-flow.in>",
                "to": [to_email],
                "subject": f"{otp} is your InternFlow code",
                "html": _html(otp),
            },
        )
        resp.raise_for_status()


# ── Shared template ──────────────────────────────────────────────────────────
def _html(otp: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1a1a2e">Your InternFlow verification code</h2>
      <p style="font-size:2rem;letter-spacing:.3em;font-weight:700;color:#4f46e5">{otp}</p>
      <p style="color:#6b7280">Expires in 10 minutes. Single use only.</p>
      <p style="color:#6b7280;font-size:.875rem">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """