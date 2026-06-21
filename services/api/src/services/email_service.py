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