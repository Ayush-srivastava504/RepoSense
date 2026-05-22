# routes/subscription.py

import stripe

from fastapi import APIRouter, Request

from configs.config import settings


router = APIRouter(
    prefix="/api/subscription",
    tags=["subscription"],
)

stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()

    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.STRIPE_WEBHOOK_SECRET,
        )

    except Exception:
        return {"error": "Invalid webhook"}

    # Update subscription after successful checkout
    if event["type"] == "checkout.session.completed":
        pass

    return {"status": "ok"}