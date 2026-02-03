# Research: Payment PIX

**Feature**: 008-payment-pix
**Date**: 2026-02-04

---

## PIX Overview

PIX is Brazil's instant payment system launched by the Central Bank. Key characteristics:
- 24/7/365 availability
- Instant settlement (< 10 seconds)
- Free for individuals
- Low cost for businesses

---

## Technology Decisions

### 1. PIX Implementation

**Decision**: Static PIX codes (copy-paste)

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Static PIX | Simple, no API | Manual confirmation | **Selected** |
| Dynamic PIX (PSP) | Auto-confirm | Cost, integration | Future |
| Payment gateway | Full solution | Cost | Rejected |

**Why Static**:
- No PSP integration needed
- Works with any PIX key
- Patient copies code and pays in their bank app
- Manual confirmation is acceptable for healthcare

### 2. Deposit Calculation

**Decision**: Percentage of service price

```typescript
function calculateDeposit(servicePriceCents: number, depositPercentage: number): number {
  return Math.round((servicePriceCents * depositPercentage) / 100);
}

// Example: R$ 200,00 service, 30% deposit
// calculateDeposit(20000, 30) = 6000 cents = R$ 60,00
```

### 3. PIX Code Format

**Decision**: EMV-style copy-paste code (BR Code)

```typescript
function generatePixCode(
  pixKey: string,
  amount: number,
  txId: string
): string {
  // Simplified EMV format
  const payload = buildEmvPayload({
    pixKey,
    merchantName: 'GENDEI',
    merchantCity: 'SAO PAULO',
    amount: amount / 100,  // Convert cents to reais
    txId,
  });

  return payload;
}

function buildEmvPayload(data: PixPayloadData): string {
  const tlv = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  let payload = '';
  payload += tlv('00', '01');  // Payload format
  payload += tlv('01', '12');  // Static QR
  payload += tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', data.pixKey));
  payload += tlv('52', '0000');  // MCC
  payload += tlv('53', '986');   // Currency (BRL)

  if (data.amount > 0) {
    payload += tlv('54', data.amount.toFixed(2));
  }

  payload += tlv('58', 'BR');
  payload += tlv('59', data.merchantName.substring(0, 25));
  payload += tlv('60', data.merchantCity.substring(0, 15));
  payload += tlv('62', tlv('05', data.txId));

  // CRC16
  const crcPayload = payload + '6304';
  const crc = calculateCRC16(crcPayload);
  return crcPayload + crc.toString(16).toUpperCase().padStart(4, '0');
}
```

### 4. Payment Confirmation

**Decision**: Manual confirmation via dashboard

**Flow**:
1. Clinic receives PIX payment notification in bank app
2. Clinic marks payment as received in Gendei dashboard
3. Appointment status updates

**Future Enhancement**: PSP integration for automatic confirmation

---

## Security Considerations

1. **PIX Key Storage**: Stored in Firestore (not sensitive, but verified)
2. **Double-Entry**: Require key to be entered twice
3. **Amount Validation**: Always recalculate from service price
4. **Audit Trail**: Log all payment confirmations

---

## References

- [PIX - Banco Central](https://www.bcb.gov.br/estabilidadefinanceira/pix)
- [EMV QR Code Specification](https://www.emvco.com/emv-technologies/qrcodes/)
