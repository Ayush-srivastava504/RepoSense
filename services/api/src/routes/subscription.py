# Module: src/routes/subscription.py
# Defines function(s): create_checkout_session, razorpay_webhook, get_subscription_status
#
#

import razorpay
import hmac
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from configs.config import settings
from configs.db import get_db_pool
from middleware.auth import verify_token
router = APIRouter(prefix='/api/subscription', tags=['subscription'])
client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
PLANS = {'pro': {'amount': 99900, 'currency': 'INR', 'interval': 'monthly', 'name': 'Pro'}, 'enterprise': {'amount': 299900, 'currency': 'INR', 'interval': 'monthly', 'name': 'Enterprise'}}

@router.post('/create-checkout')
async def create_checkout_session(plan: str, user=Depends(verify_token)):
    if plan not in PLANS:
        raise HTTPException(400, f'Unknown plan: {plan}')
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    row = await pool.fetchrow('SELECT email FROM users WHERE id = $1', user['sub'])
    if not row:
        raise HTTPException(404, 'User not found')
    plan_details = PLANS[plan]
    order_data = {'amount': plan_details['amount'], 'currency': plan_details['currency'], 'receipt': f'user_{user['sub']}_{int(datetime.now().timestamp())}', 'notes': {'user_id': str(user['sub']), 'plan': plan, 'email': row['email']}}
    try:
        order = client.order.create(data=order_data)
    except Exception as e:
        raise HTTPException(500, f'Failed to create order: {str(e)}')
    await pool.execute("\n        INSERT INTO subscriptions (user_id, razorpay_order_id, status, plan)\n        VALUES ($1, $2, 'pending', $3)\n        ON CONFLICT (user_id) DO UPDATE SET\n            razorpay_order_id = EXCLUDED.razorpay_order_id,\n            status = 'pending',\n            plan = EXCLUDED.plan\n        ", user['sub'], order['id'], plan)
    return {'order_id': order['id'], 'amount': order['amount'], 'currency': order['currency'], 'key_id': settings.RAZORPAY_KEY_ID, 'user_email': row['email']}

@router.post('/webhook')
async def razorpay_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('x-razorpay-signature')
    try:
        expected_signature = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(), payload, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_signature, sig_header or ''):
            raise HTTPException(400, 'Invalid webhook signature')
    except Exception as e:
        raise HTTPException(400, f'Webhook signature verification failed: {str(e)}')
    import json
    try:
        event_data = json.loads(payload)
    except:
        raise HTTPException(400, 'Invalid JSON payload')
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    event_type = event_data.get('event')
    payload_data = event_data.get('payload', {})
    if event_type == 'payment.authorized':
        payment = payload_data.get('payment', {}).get('entity', {})
        order_id = payment.get('order_id')
        payment_id = payment.get('id')
        if order_id and payment_id:
            row = await pool.fetchrow('SELECT user_id, plan FROM subscriptions WHERE razorpay_order_id = $1', order_id)
            if row:
                user_id = row['user_id']
                plan = row['plan']
                period_end = datetime.utcnow() + timedelta(days=30)
                await pool.execute("\n                    UPDATE subscriptions\n                    SET status = 'active', \n                        razorpay_payment_id = $1,\n                        current_period_end = $2\n                    WHERE razorpay_order_id = $3\n                    ", payment_id, period_end, order_id)
                await pool.execute('UPDATE users SET subscription_tier = $1 WHERE id = $2', plan, user_id)
    elif event_type == 'payment.failed':
        payment = payload_data.get('payment', {}).get('entity', {})
        order_id = payment.get('order_id')
        if order_id:
            await pool.execute("\n                UPDATE subscriptions SET status = 'inactive'\n                WHERE razorpay_order_id = $1\n                ", order_id)
            row = await pool.fetchrow('SELECT user_id FROM subscriptions WHERE razorpay_order_id = $1', order_id)
            if row:
                await pool.execute("UPDATE users SET subscription_tier = 'free' WHERE id = $1", row['user_id'])
    return {'status': 'ok'}

@router.get('/status')
async def get_subscription_status(user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    row = await pool.fetchrow('\n        SELECT s.status, s.current_period_end, u.subscription_tier\n        FROM users u\n        LEFT JOIN subscriptions s ON s.user_id = u.id\n        WHERE u.id = $1\n        ', user['sub'])
    if not row:
        raise HTTPException(404, 'User not found')
    return {'tier': row['subscription_tier'], 'status': row['status'] or 'none', 'current_period_end': row['current_period_end']}
