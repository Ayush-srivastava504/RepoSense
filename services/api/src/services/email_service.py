import asyncio
import boto3
from configs.config import settings

_ses = boto3.client(
    "ses",
    region_name=settings.AWS_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
)


async def send_otp_email(to_email: str, otp: str) -> None:
    await asyncio.to_thread(
        _ses.send_email,
        Source="InternFlow <noreply@intern-flow.in>",
        Destination={"ToAddresses": [to_email]},
        Message={
            "Subject": {"Data": f"{otp} is your InternFlow code"},
            "Body": {
                "Html": {"Data": _html(otp)}
            },
        },
    )


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