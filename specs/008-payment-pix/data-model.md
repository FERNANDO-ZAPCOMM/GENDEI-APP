# Data Model: Payment PIX

**Feature**: 008-payment-pix
**Date**: 2026-02-04

---

## Payment Settings (on Clinic)

```typescript
interface PaymentSettings {
  // Health insurance
  acceptsConvenio: boolean;
  convenioList: string[];

  // Private payment
  acceptsParticular: boolean;

  // Deposit
  requiresDeposit: boolean;
  depositPercentage: number;  // 10-100

  // PIX
  pix?: PixKeyConfig;
}

interface PixKeyConfig {
  type: PixKeyType;
  key: string;
  verifiedAt?: Timestamp;
}

type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
```

> **Vertical Feature Flags**: The `has_deposit` feature flag from `vertical_config.py` controls deposit visibility. Verticals like `psi` and `nutri` set `has_deposit: false`, meaning deposit fields are hidden in the UI.

---

## Appointment Payment Fields

```typescript
// Fields on gendei_appointments
interface AppointmentPaymentFields {
  // Calculated from service
  depositAmount: number;  // cents

  // Payment status
  depositPaid: boolean;
  depositPaidAt?: Timestamp;
  depositPaymentMethod?: 'pix' | 'card' | 'cash' | 'other';

  // PIX specific
  pixCode?: string;
  pixCodeGeneratedAt?: Timestamp;
  pixTransactionId?: string;

  /** Payment gateway identifier */
  paymentGateway: string;     // 'pagseguro'

  /** PagSeguro API token */
  pagseguroToken?: string;
}
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

const pixKeyTypeSchema = z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']);

export const pixKeySchema = z.object({
  type: pixKeyTypeSchema,
  key: z.string().min(1),
});

export const paymentSettingsSchema = z.object({
  acceptsConvenio: z.boolean(),
  convenioList: z.array(z.string()),
  acceptsParticular: z.boolean(),
  requiresDeposit: z.boolean(),
  depositPercentage: z.number().min(10).max(100),
  pix: pixKeySchema.optional(),
});

// Double-entry verification for PIX key
export const pixKeyVerificationSchema = z.object({
  pixKey: z.string().min(1),
  pixKeyConfirm: z.string().min(1),
  type: pixKeyTypeSchema,
}).refine(data => data.pixKey === data.pixKeyConfirm, {
  message: 'As chaves PIX não conferem',
  path: ['pixKeyConfirm'],
});
```

---

## PIX Key Validation

```typescript
const PIX_KEY_VALIDATORS: Record<PixKeyType, RegExp> = {
  cpf: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  cnpj: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+55\d{10,11}$/,
  random: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
};

function validatePixKey(type: PixKeyType, key: string): boolean {
  return PIX_KEY_VALIDATORS[type].test(key);
}
```

---

## Common Health Insurance Providers

```typescript
const COMMON_CONVENIOS = [
  'Unimed',
  'Bradesco Saúde',
  'SulAmérica',
  'Amil',
  'NotreDame Intermédica',
  'Hapvida',
  'São Francisco',
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

## Example Payment Settings

```json
{
  "acceptsConvenio": true,
  "convenioList": ["Unimed", "Bradesco Saúde", "SulAmérica"],
  "acceptsParticular": true,
  "requiresDeposit": true,
  "depositPercentage": 30,
  "pix": {
    "type": "cnpj",
    "key": "12.345.678/0001-90",
    "verifiedAt": "2026-02-04T10:00:00Z"
  }
}
```
