# Plan: Payment PIX

**Feature**: 008-payment-pix
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement PIX payment integration for appointment deposits, including PIX key configuration, deposit percentage settings, health insurance (convênio) support, and payment tracking on appointments.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Backend | Firebase Functions |
| Database | Firestore |
| Payment | PIX (static/dynamic codes) |
| Currency | BRL (Brazilian Real) |

---

## Key Features

1. PIX key configuration with double-entry verification
2. Deposit percentage setting (10-100%)
3. Deposit requirement toggle
4. Health insurance (convênio) support
5. Payment tracking on appointments
6. PIX copy-paste code generation

---

## Payment Flow

```
1. Service configured with signalPercentage
2. Appointment created with depositAmount calculated
3. PIX code generated and sent via WhatsApp
4. Patient pays deposit
5. depositPaid flag updated
6. Appointment confirmed
```

---

## Data Model

### Clinic Payment Settings

```typescript
interface PaymentSettings {
  acceptsConvenio: boolean;
  convenioList: string[];
  acceptsParticular: boolean;
  requiresDeposit: boolean;
  depositPercentage: number;  // 10-100
  pix?: {
    type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
    key: string;
    verifiedAt?: Timestamp;
  };
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | /clinics/:id/settings/paymentSettings | Update payment settings |
| GET | /clinics/:id/settings | Get all settings |
| POST | /payments/generate-pix | Generate PIX code for appointment |
| POST | /payments/confirm | Confirm payment received |

---

## PIX Code Generation

```typescript
function generatePixCode(pixKey: string, amount: number, description: string): string {
  // EMV format for PIX
  const payload = [
    '000201',  // Payload format indicator
    '010212',  // Static QR
    `26${formatField('0014br.gov.bcb.pix' + formatField(pixKey))}`,
    `52040000`,  // Merchant Category Code
    '5303986',   // Currency (BRL)
    `54${formatAmount(amount)}`,
    '5802BR',
    `59${formatField('GENDEI')}`,
    `60${formatField('SAO PAULO')}`,
    `62${formatField('05' + formatField(description))}`,
  ].join('');

  const crc = calculateCRC16(payload + '6304');
  return payload + '6304' + crc;
}
```

---

## Success Metrics

- PIX configuration < 1 minute
- Payment confirmation < 5 seconds
- Zero payment discrepancies
