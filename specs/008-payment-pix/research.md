# Research: Payment System

**Feature**: 008-payment-pix
**Date**: 2026-02-04
**Updated**: 2026-02-15

---

## Technology Decisions

### 1. Primary Payment Provider

**Decision**: PagSeguro (PIX Orders API + Checkout API)

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Static PIX (EMV code) | Simple, no API needed | Manual confirmation | Rejected |
| PagSeguro Orders API | Auto-confirm via webhook, PIX "copia e cola" | API integration | **Selected (primary)** |
| PagSeguro Checkout API | Full payment page, card support | Redirect-based | **Selected (fallback)** |
| Stripe Payments | Global, well-documented | PIX support limited in BR | Future (via Connect) |

**Why PagSeguro**:
- Native PIX support with automatic confirmation via webhooks
- Orders API generates "copia e cola" codes directly (no redirect needed)
- Checkout API provides card payment fallback
- Well-established in Brazilian market
- Webhook signature verification for security

### 2. Split Payment Provider

**Decision**: Stripe Connect Express

**Why Stripe Connect**:
- Express accounts minimize onboarding friction for clinics
- Automatic commission splitting between Gendei and clinic
- Card payment capabilities enabled via Connect
- Account capabilities (`charges_enabled`, `payouts_enabled`) trackable via API
- Future: Can be used for card payments when ready

### 3. Payment Hold Strategy

**Decision**: Auto-cancel after configurable hold period (default 15 minutes)

**Flow**:
```
1. Appointment created with pending status + signalCents > 0
2. Cloud Scheduler runs cleanupExpiredPaymentHolds every 5 minutes
3. Checks: status == 'pending' AND signalCents > 0 AND !signalPaid
4. If createdAt + PAYMENT_HOLD_MINUTES elapsed -> cancel appointment
5. Sync cancellation to conversation context for agent awareness
```

**Why 15 minutes**:
- Short enough to prevent slot hoarding
- Long enough for PIX processing (typically < 30 seconds)
- Configurable via `PAYMENT_HOLD_MINUTES` env var

### 4. Signal vs Deposit Naming

**Decision**: Migrate from `deposit*` to `signal*` field naming

| Legacy Field | Current Field | Notes |
|-------------|---------------|-------|
| `depositAmount` | `signalCents` | Amount in cents |
| `depositPaid` | `signalPaid` | Boolean flag |
| `depositPaidAt` | `signalPaidAt` | Timestamp |
| -- | `signalPaymentId` | New: external reference |
| -- | `totalCents` | New: full service price |

**Backward Compatibility**: Payment holds service checks both `signalCents`/`signalPaid` AND `depositAmount`/`depositPaid` for backward compat.

### 5. WhatsApp Payment Message Format

**Decision**: WhatsApp button messages (not plain text)

**Why Buttons**:
- Better UX: patient taps button to open payment
- Higher conversion than copy-paste PIX codes
- Separate buttons for PIX and card options
- PagSeguro provides URL for both methods

---

## Security Considerations

1. **PagSeguro Webhook**: HMAC-SHA256 signature verification before processing
2. **Stripe API Key**: Stored as environment variable in Cloud Functions
3. **Frontend URL Sanitization**: `sanitizeFrontendBaseUrl()` validates protocol and extracts origin
4. **Clinic Scoping**: All payment endpoints verify `user.clinicId === clinicId`
5. **Amount Validation**: Always recalculated from service price, never trusted from client

---

## References

- [PagSeguro Orders API](https://developer.pagbank.com.br/reference/criar-pedido)
- [PagSeguro Checkout API](https://developer.pagbank.com.br/reference/criar-checkout)
- [Stripe Connect Express](https://stripe.com/docs/connect/express-accounts)
- [Stripe Account Links](https://stripe.com/docs/api/account_links)
