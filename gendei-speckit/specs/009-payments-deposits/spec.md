# Feature 009: Payments & Deposits

## Spec

### Overview

Payments & Deposits enables clinics to collect PIX deposits for appointments. Clinics configure their PIX key (with double-entry confirmation to prevent typos), set a deposit percentage, and can track payment status. Integration with PagSeguro handles the actual payment processing.

---

### User Stories

#### US-001: PIX Key Configuration

**As a** clinic owner
**I want to** configure my PIX key
**So that** I can receive deposits

**Acceptance Criteria:**
- [ ] Enter PIX key (CPF, CNPJ, email, phone, or random)
- [ ] Double-entry confirmation
- [ ] Keys must match to save
- [ ] Clear validation errors

#### US-002: Deposit Percentage

**As a** clinic owner
**I want to** set deposit percentage
**So that** I control how much patients pay upfront

**Acceptance Criteria:**
- [ ] Slider or input (0-100%)
- [ ] 0% means no deposit required
- [ ] Show calculated example
- [ ] Apply to all services

#### US-003: Health Insurance Support

**As a** clinic owner
**I want to** accept health insurance
**So that** patients can use their plans

**Acceptance Criteria:**
- [ ] Toggle health insurance support
- [ ] Select accepted insurers
- [ ] Common insurers list
- [ ] Custom insurer option

#### US-004: Payment Link Generation

**As a** system
**I want to** generate PIX payment links
**So that** patients can pay easily

**Acceptance Criteria:**
- [ ] Calculate deposit amount
- [ ] Generate PagSeguro PIX
- [ ] Return QR code and copy-paste code
- [ ] Set expiration time

#### US-005: Payment Confirmation

**As a** system
**I want to** receive payment notifications
**So that** I can update appointment status

**Acceptance Criteria:**
- [ ] Receive PagSeguro webhook
- [ ] Match payment to appointment
- [ ] Update depositPaid = true
- [ ] Update status to confirmed
- [ ] Send confirmation message

#### US-006: Deposit Tracking

**As a** clinic staff
**I want to** see deposit status
**So that** I know which patients paid

**Acceptance Criteria:**
- [ ] Deposit amount on appointment
- [ ] Paid/unpaid indicator
- [ ] Filter by payment status

---

### Functional Requirements

#### FR-001: Payment Settings Structure

```python
# Part of clinic document
{
    "pixKey": "clinica@email.com",
    "pixKeyType": "email",  # cpf, cnpj, email, phone, random

    "depositPercentage": 50,  # 0-100

    "paymentMethods": {
        "particular": True,
        "convenio": True,
    },

    "acceptedInsurers": [
        "unimed",
        "bradesco_saude",
        "sulamerica",
        "amil",
        "hapvida",
        "notredame_intermedica",
    ],
}
```

#### FR-002: Common Health Insurers

```typescript
const HEALTH_INSURERS = [
  { id: "unimed", name: "Unimed" },
  { id: "bradesco_saude", name: "Bradesco Saúde" },
  { id: "sulamerica", name: "SulAmérica" },
  { id: "amil", name: "Amil" },
  { id: "hapvida", name: "Hapvida" },
  { id: "notredame_intermedica", name: "NotreDame Intermédica" },
  { id: "porto_seguro", name: "Porto Seguro Saúde" },
  { id: "prevent_senior", name: "Prevent Senior" },
  { id: "golden_cross", name: "Golden Cross" },
  { id: "cassi", name: "CASSI" },
  { id: "geap", name: "GEAP" },
  { id: "outro", name: "Outro" },
];
```

#### FR-003: PIX Key Validation

```typescript
function validatePixKey(key: string, type: PixKeyType): boolean {
  switch (type) {
    case "cpf":
      return /^\d{11}$/.test(key.replace(/\D/g, ""));
    case "cnpj":
      return /^\d{14}$/.test(key.replace(/\D/g, ""));
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
    case "phone":
      return /^\+?\d{10,13}$/.test(key.replace(/\D/g, ""));
    case "random":
      return /^[a-f0-9-]{36}$/.test(key);
    default:
      return false;
  }
}
```

#### FR-004: Deposit Calculation

```typescript
function calculateDeposit(servicePrice: number, depositPercentage: number): number {
  if (depositPercentage === 0) return 0;
  return Math.round(servicePrice * (depositPercentage / 100) * 100) / 100;
}

// Example:
// Service: R$ 350.00
// Deposit: 50%
// Result: R$ 175.00
```

#### FR-005: PagSeguro PIX Integration

```python
async def generate_pix_payment(
    appointment_id: str,
    amount: float,
    patient_name: str,
    patient_cpf: str,
) -> dict:
    """
    Generate PIX payment via PagSeguro.
    """
    # PagSeguro API request
    response = await pagseguro_client.post("/orders", json={
        "reference_id": appointment_id,
        "customer": {
            "name": patient_name,
            "tax_id": patient_cpf,
        },
        "items": [{
            "reference_id": appointment_id,
            "name": f"Depósito - Consulta",
            "quantity": 1,
            "unit_amount": int(amount * 100),  # Cents
        }],
        "qr_codes": [{
            "amount": {
                "value": int(amount * 100),
            },
            "expiration_date": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
        }],
        "notification_urls": [
            f"{DOMAIN}/api/pagseguro/webhook",
        ],
    })

    qr_code = response["qr_codes"][0]

    return {
        "orderId": response["id"],
        "pixCode": qr_code["text"],
        "qrCodeUrl": qr_code["links"][0]["href"],
        "expiresAt": qr_code["expiration_date"],
    }
```

#### FR-006: Payment Webhook Handler

```python
async def handle_pagseguro_webhook(payload: dict):
    """
    Handle PagSeguro payment notification.
    """
    for charge in payload.get("charges", []):
        if charge["status"] == "PAID":
            appointment_id = charge["reference_id"]

            # Update appointment
            appointment = await get_appointment(appointment_id)
            await update_appointment(appointment_id, {
                "depositPaid": True,
                "status": "confirmed",
                "confirmedAt": firestore.SERVER_TIMESTAMP,
            })

            # Send confirmation message
            await send_payment_confirmation(appointment)


async def send_payment_confirmation(appointment: dict):
    """
    Send WhatsApp confirmation after payment.
    """
    message = f"""
Pagamento confirmado! ✅

Sua consulta está garantida:

📅 {format_date_pt_br(appointment["date"])} às {appointment["time"]}
👨‍⚕️ {appointment["professionalName"]}
📍 {appointment["clinicAddress"]}

Te envio um lembrete 24h antes!
"""

    await send_whatsapp_message(
        clinic_id=appointment["clinicId"],
        phone=appointment["patientPhone"],
        message=message,
    )
```

---

### API Endpoints

```yaml
# Payment Settings
GET /api/clinics/:id/settings
  Response:
    pixKey: string
    pixKeyType: string
    depositPercentage: number
    paymentMethods: { particular, convenio }
    acceptedInsurers: string[]

PUT /api/clinics/:id/settings/payment
  Request:
    pixKey: string
    pixKeyConfirm: string
    pixKeyType: string
    depositPercentage: number
    paymentMethods: object
    acceptedInsurers: string[]
  Response:
    updated: boolean

# Payment Generation (Internal)
POST /api/payments/generate-pix
  Request:
    appointmentId: string
  Response:
    pixCode: string
    qrCodeUrl: string
    expiresAt: string

# PagSeguro Webhook
POST /api/pagseguro/webhook
  Request:
    (PagSeguro webhook payload)
  Response:
    success: boolean
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────┐
│  Configurações de Pagamento                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Chave PIX                                                     │
│                                                                 │
│  Tipo de Chave                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ E-mail                                                 ▼ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Chave PIX *                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ clinica@email.com                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Confirme a Chave PIX *                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ clinica@email.com                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ✅ As chaves conferem                                         │
│                                                                 │
│  ──────────────────────────────────────────────────────────   │
│                                                                 │
│  Depósito Antecipado                                           │
│                                                                 │
│  Porcentagem do valor da consulta:                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ●───────────────────────○                          50%   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📌 Exemplo: Para uma consulta de R$ 350,00, o depósito       │
│     será de R$ 175,00                                          │
│                                                                 │
│  ──────────────────────────────────────────────────────────   │
│                                                                 │
│  Formas de Pagamento                                           │
│                                                                 │
│  ☑️ Particular (PIX, cartão, dinheiro)                        │
│  ☑️ Convênio (plano de saúde)                                 │
│                                                                 │
│  Convênios Aceitos                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ☑️ Unimed                                                │  │
│  │ ☑️ Bradesco Saúde                                        │  │
│  │ ☑️ SulAmérica                                            │  │
│  │ ⬜ Amil                                                  │  │
│  │ ⬜ Hapvida                                               │  │
│  │ ⬜ NotreDame Intermédica                                 │  │
│  │ ⬜ Porto Seguro Saúde                                    │  │
│  │ [Ver mais...]                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                                              [Salvar Alterações]│
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  WhatsApp - Payment Flow                                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   14:30   │ Perfeito! Para garantir seu horário, preciso   │   │
│    🤖     │ de um depósito de R$ 175,00 (50% do valor).   │   │
│           │                                                │   │
│           │ 📱 PIX Copia e Cola:                          │   │
│           │ 00020126580014br.gov.bcb.pix...               │   │
│           │                                                │   │
│           │ 🔲 [QR Code Image]                            │   │
│           │                                                │   │
│           │ ⏰ Válido por 2 horas                         │   │
│           │                                                │   │
│           │ Assim que confirmar o pagamento, sua          │   │
│           │ consulta estará garantida! ✅                  │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
│  (After payment confirmed via webhook)                         │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   14:35   │ Pagamento confirmado! ✅                       │   │
│    🤖     │                                                │   │
│           │ Sua consulta está garantida:                  │   │
│           │                                                │   │
│           │ 📅 Segunda, 15 de Janeiro às 14:00            │   │
│           │ 👩‍⚕️ Dra. Maria Silva                          │   │
│           │ 📍 Av. Paulista, 1000 - São Paulo            │   │
│           │                                                │   │
│           │ Te envio um lembrete 24h antes!              │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Agendamento - Deposit Status                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 João Silva                                                 │
│  📅 15/01/2024 14:00 - Dra. Maria Silva                       │
│                                                                 │
│  Valor da Consulta: R$ 350,00                                  │
│                                                                 │
│  Depósito                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Valor: R$ 175,00 (50%)                                   │  │
│  │ Status: ✅ Pago                                          │  │
│  │ Pago em: 14/01/2024 14:35                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Saldo a pagar na consulta: R$ 175,00                         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] PIX key configuration
- [x] Double-entry confirmation for PIX key
- [x] Deposit percentage configuration (0-100%)
- [x] Payment method toggles (particular/convenio)
- [x] Health insurance support with common providers
- [x] PagSeguro integration
- [x] PIX link generation
- [x] Payment webhook handling
- [x] Deposit tracking per appointment
- [x] Payment confirmation message via WhatsApp
