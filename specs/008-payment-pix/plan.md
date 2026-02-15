# Plan: Payment System

**Feature**: 008-payment-pix
**Status**: Implemented
**Date**: 2026-02-04
**Updated**: 2026-02-15

---

## Overview

Implement a multi-provider payment system for appointment deposits (signals), including PagSeguro PIX/card integration, Stripe Connect onboarding for split payments, payment hold auto-cancellation, and transaction tracking.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Backend API | Firebase Functions (Node.js 20, Express.js) |
| WhatsApp Agent | Python 3.11+, FastAPI (Cloud Run) |
| Database | Firestore |
| Primary Payment | PagSeguro (PIX Orders API + Checkout API) |
| Split Payments | Stripe Connect Express |
| Scheduler | Google Cloud Scheduler (every 5 min for holds) |
| Currency | BRL (Brazilian Real, stored in cents) |

---

## Key Features

1. Deposit (signal) percentage configuration (10-100%)
2. PagSeguro PIX payment generation via Orders API
3. PagSeguro Checkout fallback for card payments
4. PagSeguro webhook verification and auto-confirmation
5. Stripe Connect Express onboarding for clinics
6. Payment hold auto-cancellation (15-min default)
7. Payment transaction history (orders subcollection)
8. Health insurance (convenio) support

---

## Payment Flow

### PagSeguro PIX (Primary)
```
1. Appointment created with signalCents calculated
2. WhatsApp agent calls create_pagseguro_pix_order()
3. PagSeguro returns PIX "copia e cola" code
4. Agent sends payment via WhatsApp button message
5. Patient pays in banking app
6. PagSeguro webhook fires -> signature verified -> payment confirmed
7. Appointment signalPaid = true, confirmation message sent
```

### PagSeguro Card (Fallback)
```
1. Agent calls create_pagseguro_checkout()
2. PagSeguro returns checkout URL
3. Agent sends card payment link via WhatsApp button
4. Patient completes checkout
5. PagSeguro webhook confirms payment
```

### Payment Hold
```
1. Pending appointment with signalCents > 0, signalPaid = false
2. Cloud Scheduler runs cleanupExpiredPaymentHolds every 5 min
3. If createdAt + PAYMENT_HOLD_MINUTES (15) elapsed -> auto-cancel
4. Conversation context synced with cancellation
```

### Stripe Connect Onboarding
```
1. Clinic owner clicks "Conectar com Stripe"
2. Backend creates Stripe Express account (country: BR)
3. Account link generated -> owner redirected to Stripe onboarding
4. On return, capabilities refreshed from Stripe API
5. StripeConnect state persisted in paymentSettings.stripeConnect
```

---

## API Endpoints

### Firebase Functions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /payments/clinic/:clinicId | List payment transactions |
| GET | /payments/stripe-connect/:clinicId/status | Get Stripe Connect status (refreshes from Stripe) |
| POST | /payments/stripe-connect/:clinicId/start | Create Express account + onboarding link |
| POST | /payments/stripe-connect/:clinicId/refresh | Generate new onboarding link |
| POST | /reminders/cleanup-payment-holds | Manual hold cleanup trigger |

### WhatsApp Agent (Cloud Run)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /pagseguro/webhook | PagSeguro payment webhook |

---

## Environment Variables

### Firebase Functions
| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_CONNECT_CLIENT_ID` | Stripe Connect OAuth client ID |
| `GENDEI_FRONTEND_URL` | Frontend URL for Stripe return/refresh URLs |
| `PAYMENT_HOLD_MINUTES` | Hold duration before auto-cancel (default: 15) |

### WhatsApp Agent
| Variable | Description |
|----------|-------------|
| `PAGSEGURO_TOKEN` | PagSeguro API authentication token |
| `PAGSEGURO_EMAIL` | PagSeguro account email |
| `PAGSEGURO_ENVIRONMENT` | `production` or `sandbox` |
| `PAGSEGURO_WEBHOOK_SECRET` | Webhook signature verification secret |

---

## Success Metrics

- PagSeguro webhook processing < 5 seconds
- Payment hold enforcement: 100% of expired holds auto-cancelled
- Stripe Connect onboarding link generation < 3 seconds
- Zero payment tracking discrepancies

> **Vertical Feature Flags**: The `has_deposit` feature flag from `vertical_config.py` controls whether deposits are required. Verticals like `psi` and `nutri` have `has_deposit: false`.
