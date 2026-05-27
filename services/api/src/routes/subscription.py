# services/api/src/routes/subscription.py
import razorpay
import hmac
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from configs.config import settings
from configs.db import get_db_pool
from middleware.auth import verify_token

router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# Initialize Razorpay client
client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

PLANS = {
    "pro":        {"amount": 99900, "currency": "INR", "interval": "monthly", "name": "Pro"},        # 999 INR/month
    "enterprise": {"amount": 299900, "currency": "INR", "interval": "monthly", "name": "Enterprise"},  # 2999 INR/month
}


@router.post("/create-checkout")
async def create_checkout_session(
    plan: str,
    user=Depends(verify_token),
):
    """Create a Razorpay order for the given plan.
    
    Initiates a Razorpay payment flow for the authenticated user to subscribe
    to a paid plan. Creates a Razorpay order and returns order details for
    the frontend to initialize the Razorpay checkout modal.
    
    Args:
        plan: One of 'pro' or 'enterprise' from PLANS dict.
        user: Authenticated user from verify_token dependency.
        
    Returns:
        Dictionary with order details: 'order_id', 'amount', 'currency', 'key_id'.
        
    Raises:
        HTTPException: 400 if plan is not recognized.
        HTTPException: 503 if database is unavailable.
    """
    if plan not in PLANS:
        raise HTTPException(400, f"Unknown plan: {plan}")

    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    row = await pool.fetchrow(
        "SELECT email FROM users WHERE id = $1",
        user["sub"],
    )

    if not row:
        raise HTTPException(404, "User not found")

    plan_details = PLANS[plan]
    
    # Create Razorpay order
    order_data = {
        "amount": plan_details["amount"],  # Amount in paise
        "currency": plan_details["currency"],
        "receipt": f"user_{user['sub']}_{int(datetime.now().timestamp())}",
        "notes": {
            "user_id": str(user["sub"]),
            "plan": plan,
            "email": row["email"]
        }
    }
    
    try:
        order = client.order.create(data=order_data)
    except Exception as e:
        raise HTTPException(500, f"Failed to create order: {str(e)}")
    
    # Store order details in database
    await pool.execute(
        """
        INSERT INTO subscriptions (user_id, razorpay_order_id, status, plan)
        VALUES ($1, $2, 'pending', $3)
        ON CONFLICT (user_id) DO UPDATE SET
            razorpay_order_id = EXCLUDED.razorpay_order_id,
            status = 'pending',
            plan = EXCLUDED.plan
        """,
        user["sub"], order["id"], plan,
    )

    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": settings.RAZORPAY_KEY_ID,
        "user_email": row["email"],
    }


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhook events.
    
    Receives Razorpay events and processes subscription state changes.
    Handles payment events:
    1. payment.authorized - Activate subscription after successful payment
    2. payment.failed - Mark subscription inactive on payment failure
    
    Verifies webhook signature using RAZORPAY_KEY_SECRET.
    
    Args:
        request: FastAPI Request object containing raw payload and headers.
        
    Returns:
        Dictionary with 'status' key for successful processing.
        
    Raises:
        HTTPException: 400 if signature verification fails.
        HTTPException: 503 if database is unavailable.
    """
    payload = await request.body()
    sig_header = request.headers.get("x-razorpay-signature")

    # Verify webhook signature
    try:
        expected_signature = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_signature, sig_header or ""):
            raise HTTPException(400, "Invalid webhook signature")
    except Exception as e:
        raise HTTPException(400, f"Webhook signature verification failed: {str(e)}")

    # Parse webhook data
    import json
    try:
        event_data = json.loads(payload)
    except:
        raise HTTPException(400, "Invalid JSON payload")

    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    event_type = event_data.get("event")
    payload_data = event_data.get("payload", {})

    if event_type == "payment.authorized":
        payment = payload_data.get("payment", {}).get("entity", {})
        order_id = payment.get("order_id")
        payment_id = payment.get("id")
        
        if order_id and payment_id:
            # Get order details to find user_id and plan
            row = await pool.fetchrow(
                "SELECT user_id, plan FROM subscriptions WHERE razorpay_order_id = $1",
                order_id,
            )
            
            if row:
                user_id = row["user_id"]
                plan = row["plan"]
                
                # Calculate period end (30 days from now)
                period_end = datetime.utcnow() + timedelta(days=30)
                
                # Update subscription as active
                await pool.execute(
                    """
                    UPDATE subscriptions
                    SET status = 'active', 
                        razorpay_payment_id = $1,
                        current_period_end = $2
                    WHERE razorpay_order_id = $3
                    """,
                    payment_id, period_end, order_id,
                )
                
                # Update user tier
                await pool.execute(
                    "UPDATE users SET subscription_tier = $1 WHERE id = $2",
                    plan, user_id,
                )

    elif event_type == "payment.failed":
        payment = payload_data.get("payment", {}).get("entity", {})
        order_id = payment.get("order_id")
        
        if order_id:
            # Mark subscription as inactive
            await pool.execute(
                """
                UPDATE subscriptions SET status = 'inactive'
                WHERE razorpay_order_id = $1
                """,
                order_id,
            )
            
            # Get user_id and downgrade tier
            row = await pool.fetchrow(
                "SELECT user_id FROM subscriptions WHERE razorpay_order_id = $1",
                order_id,
            )
            if row:
                await pool.execute(
                    "UPDATE users SET subscription_tier = 'free' WHERE id = $1",
                    row["user_id"],
                )

    return {"status": "ok"}


@router.get("/status")
async def get_subscription_status(user=Depends(verify_token)):
    """Retrieve the current user's subscription info.
    
    Returns subscription tier, status, and renewal period for the authenticated
    user. If no subscription exists, returns 'free' tier with 'none' status.
    
    Args:
        user: Authenticated user from verify_token dependency.
        
    Returns:
        Dictionary with 'tier', 'status', and 'current_period_end' keys.
        
    Raises:
        HTTPException: 404 if user not found.
        HTTPException: 503 if database unavailable.
    """
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    row = await pool.fetchrow(
        """
        SELECT s.status, s.current_period_end, u.subscription_tier
        FROM users u
        LEFT JOIN subscriptions s ON s.user_id = u.id
        WHERE u.id = $1
        """,
        user["sub"],
    )
    if not row:
        raise HTTPException(404, "User not found")

    return {
        "tier":               row["subscription_tier"],
        "status":             row["status"] or "none",
        "current_period_end": row["current_period_end"],
    }