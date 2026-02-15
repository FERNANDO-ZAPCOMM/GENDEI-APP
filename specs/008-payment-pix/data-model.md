# Data Model: Payment System

**Feature**: 008-payment-pix
**Date**: 2026-02-04
**Updated**: 2026-02-15

---

## Payment Settings (on Clinic)

```typescript
interface PaymentSettings {
  // Health insurance
  acceptsConvenio: boolean;
  convenioList: string[];

  // Private payment
  acceptsParticular: boolean;

  // Deposit (signal)
  requiresDeposit: boolean;
  depositPercentage: number;  // 10-100

  // PIX key (planned for self-service config)
  pixKey?: string;
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

  // Stripe Connect
  stripeConnect?: StripeConnectState;
}

interface StripeConnectState {
  accountId?: string;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  country?: string;            // e.g. 'BR'
  defaultCurrency?: string;    // e.g. 'brl'
  updatedAt?: string;          // ISO date
}
```

> **Vertical Feature Flags**: The `has_deposit` feature flag from `vertical_config.py` controls deposit visibility. Verticals like `psi` and `nutri` set `has_deposit: false`, meaning deposit fields are hidden in the UI.

---

## Appointment Signal Fields

```typescript
// Current fields on gendei_appointments
interface AppointmentSignalFields {
  // Payment type
  paymentType: 'particular' | 'convenio';

  // Signal (deposit) tracking
  totalCents: number;          // Full service price in cents
  signalCents: number;         // Signal amount in cents
  signalPaid: boolean;
  signalPaidAt?: Timestamp;
  signalPaymentId?: string;    // External payment reference

  // Legacy fields (backward compatibility)
  depositAmount?: number;      // Replaced by signalCents
  depositPaid?: boolean;       // Replaced by signalPaid
  depositPaidAt?: Timestamp;   // Replaced by signalPaidAt
}
```

---

## Payment Transaction (Orders Subcollection)

**Collection**: `gendei_clinics/{clinicId}/orders/{orderId}`

```typescript
interface PaymentTransaction {
  id: string;
  clinicId: string;
  appointmentId: string;
  patientPhone: string;
  patientName: string;
  amountCents: number;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentMethod: 'pix' | 'card';
  paymentSource: 'pagseguro' | 'stripe';
  transferMode: 'automatic' | 'manual';
  paymentId: string;           // External payment/order ID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  paidAt?: Timestamp;
}
```

---

## Common Health Insurance Providers

```typescript
const COMMON_CONVENIOS = [
  'Unimed',
  'Bradesco Saude',
  'SulAmerica',
  'Amil',
  'NotreDame Intermedica',
  'Hapvida',
  'Sao Francisco',
  'Porto Seguro',
  'Cassi',
  'Caixa Seguradora',
  'Golden Cross',
  'Mediservice',
  'Allianz',
  'Omint',
  'Care Plus',
] as const;
```

---

## Example Documents

### Payment Settings on Clinic

```json
{
  "paymentSettings": {
    "acceptsConvenio": true,
    "convenioList": ["Unimed", "Bradesco Saude", "SulAmerica"],
    "acceptsParticular": true,
    "requiresDeposit": true,
    "depositPercentage": 30,
    "pixKey": "12345678901",
    "pixKeyType": "cpf",
    "stripeConnect": {
      "accountId": "acct_1234567890",
      "onboardingComplete": true,
      "chargesEnabled": true,
      "payoutsEnabled": true,
      "detailsSubmitted": true,
      "country": "BR",
      "defaultCurrency": "brl",
      "updatedAt": "2026-02-15T10:00:00Z"
    }
  }
}
```

### Payment Transaction (Order)

```json
{
  "id": "order_abc123",
  "clinicId": "clinic_xyz",
  "appointmentId": "apt_456",
  "patientPhone": "+5511999998888",
  "patientName": "Maria Silva",
  "amountCents": 6000,
  "paymentStatus": "completed",
  "paymentMethod": "pix",
  "paymentSource": "pagseguro",
  "transferMode": "manual",
  "paymentId": "PAG_ORD_123456",
  "createdAt": "2026-02-15T10:00:00Z",
  "updatedAt": "2026-02-15T10:05:00Z",
  "paidAt": "2026-02-15T10:05:00Z"
}
```

### Appointment with Signal

```json
{
  "id": "apt_456",
  "clinicId": "clinic_xyz",
  "patientPhone": "+5511999998888",
  "patientName": "Maria Silva",
  "professionalId": "prof_001",
  "date": "2026-02-20",
  "time": "14:00",
  "status": "confirmed",
  "paymentType": "particular",
  "totalCents": 20000,
  "signalCents": 6000,
  "signalPaid": true,
  "signalPaidAt": "2026-02-15T10:05:00Z",
  "signalPaymentId": "PAG_ORD_123456"
}
```
