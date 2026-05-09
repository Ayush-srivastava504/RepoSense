from fastapi import APIRouter, Depends, Request
import stripe
from ..configs.settings import settings

router = APIRouter(prefix="/api/subscription", tags=["subscription"])
stripe.api_key = settings.STRIPE_SECRET_KEY

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        return {"error": "Invalid webhook"}
    if event["type"] == "checkout.session.completed":
        # update user subscription
        pass
    return {"status": "ok"}