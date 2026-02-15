# Quickstart: Payment System

**Feature**: 008-payment-pix
**Date**: 2026-02-04
**Updated**: 2026-02-15

---

## PagSeguro PIX Payment (WhatsApp Agent)

```python
# apps/whatsapp-agent/src/utils/payment.py

async def create_pagseguro_pix_order(
    amount_cents: int,
    patient_name: str,
    patient_phone: str,
    appointment_id: str,
    clinic_id: str,
) -> dict:
    """Generate PIX order via PagSeguro Orders API."""
    url = "https://api.pagseguro.com/orders"
    headers = {
        "Authorization": f"Bearer {PAGSEGURO_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "reference_id": appointment_id,
        "customer": {
            "name": patient_name,
            "phones": [{"type": "MOBILE", "number": patient_phone}],
        },
        "items": [{
            "name": "Sinal - Consulta",
            "quantity": 1,
            "unit_amount": amount_cents,
        }],
        "qr_codes": [{
            "amount": {"value": amount_cents},
            "expiration_date": "...",  # 15 min from now
        }],
    }
    # Returns: { id, qr_codes[0].text (copia e cola), qr_codes[0].links[0].href (QR image) }
```

---

## Send Payment via WhatsApp Button

```python
# apps/whatsapp-agent/src/utils/payment.py

async def send_pix_payment_to_customer(
    phone_number_id: str,
    access_token: str,
    to: str,
    amount_cents: int,
    payment_url: str,
    appointment_date: str,
    appointment_time: str,
):
    """Send PIX payment as WhatsApp button message."""
    amount_formatted = f"R$ {amount_cents / 100:.2f}".replace('.', ',')

    body = f"Para confirmar seu agendamento ({appointment_date} as {appointment_time}), "
    body += f"realize o pagamento do sinal de *{amount_formatted}*."

    # Sends as interactive button message (not plain text)
    await send_button_message(
        phone_number_id, access_token, to,
        body=body,
        buttons=[{"type": "url", "url": payment_url, "title": "Pagar com PIX"}],
    )
```

---

## Payment Hold Cleanup

```typescript
// apps/functions/src/services/payment-holds.ts

export async function cleanupExpiredPaymentHolds(): Promise<PaymentHoldCleanupResult> {
  // Query all pending appointments across clinics
  const docs = await db.collectionGroup('appointments')
    .where('status', '==', 'pending')
    .get();

  // For each: check if signalCents > 0 && !signalPaid && createdAt + 15min elapsed
  // If expired: cancel with reason, sync to conversation context
  return processPendingHoldDocs(docs.docs);
}
```

---

## Stripe Connect Onboarding

```typescript
// apps/functions/src/routes/payments.ts

// 1. Create Express account
const account = await stripeRequest<{ id: string }>('/accounts', {
  method: 'POST',
  body: new URLSearchParams({
    type: 'express',
    country: 'BR',
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
    'metadata[clinicId]': clinicId,
  }),
});

// 2. Generate onboarding link
const link = await stripeRequest<{ url: string }>('/account_links', {
  method: 'POST',
  body: new URLSearchParams({
    account: account.id,
    type: 'account_onboarding',
    refresh_url: `${frontendUrl}/payments?stripe=refresh`,
    return_url: `${frontendUrl}/payments?stripe=success`,
  }),
});

// 3. Redirect clinic owner to link.url
```

---

## Frontend Stripe Hook

```typescript
// apps/frontend/hooks/use-stripe-connect.ts

export function useStripeConnect(clinicId: string) {
  // statusQuery: GET /payments/stripe-connect/:clinicId/status (30s stale)
  // startMutation: POST /payments/stripe-connect/:clinicId/start
  // refreshMutation: POST /payments/stripe-connect/:clinicId/refresh
  // All mutations invalidate status query on success
  return {
    ...statusQuery,
    startOnboarding: startMutation.mutateAsync,
    refreshOnboarding: refreshMutation.mutateAsync,
    isStarting: startMutation.isPending,
    isRefreshing: refreshMutation.isPending,
  };
}
```

---

## Environment Setup

```bash
# Firebase Functions (.env)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_CONNECT_CLIENT_ID=ca_...
GENDEI_FRONTEND_URL=https://app.gendei.com
PAYMENT_HOLD_MINUTES=15

# WhatsApp Agent (.env)
PAGSEGURO_TOKEN=...
PAGSEGURO_EMAIL=...
PAGSEGURO_ENVIRONMENT=production
PAGSEGURO_WEBHOOK_SECRET=...
```
