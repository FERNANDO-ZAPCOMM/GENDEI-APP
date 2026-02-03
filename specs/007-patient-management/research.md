# Research: Patient Management

**Feature**: 007-patient-management
**Date**: 2026-02-04

---

## Technology Decisions

### 1. Multi-Clinic Support

**Decision**: Array of clinicIds on patient document

**Why**:
- Same patient can visit multiple clinics
- Single patient record (no duplicates)
- Query with array-contains

### 2. Search Strategy

**Decision**: Client-side filtering + prefix search

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Algolia | Fast, full-text | Cost | Future |
| Typesense | Open-source | Setup | Future |
| Firestore prefix | Simple | Limited | **Selected** |

### 3. Statistics Tracking

**Decision**: Denormalized counters updated on appointment changes

**Why**:
- Avoid aggregation queries
- Fast reads
- Update in transaction with appointment

```typescript
// When appointment status changes
async function updatePatientStats(patientId: string, oldStatus: string, newStatus: string) {
  const patientRef = db.collection('gendei_patients').doc(patientId);

  await db.runTransaction(async (transaction) => {
    const patient = await transaction.get(patientRef);

    const updates: any = {};

    if (newStatus === 'completed' && oldStatus !== 'completed') {
      updates.completedAppointments = FieldValue.increment(1);
    }
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      updates.cancelledAppointments = FieldValue.increment(1);
    }
    if (newStatus === 'no_show' && oldStatus !== 'no_show') {
      updates.noShowCount = FieldValue.increment(1);
    }

    transaction.update(patientRef, updates);
  });
}
```

### 4. Phone Number Handling

**Decision**: Store normalized with country code

```typescript
function normalizePhone(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  // Add Brazil country code if missing
  if (digits.length === 10 || digits.length === 11) {
    return '+55' + digits;
  }

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return '+' + digits;
  }

  return '+' + digits;
}
```

### 5. CPF Validation

**Decision**: Validate format and check digits

```typescript
function validateCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;

  // Check digit calculation
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let digit1 = (sum * 10) % 11;
  if (digit1 === 10) digit1 = 0;
  if (digit1 !== parseInt(numbers[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  let digit2 = (sum * 10) % 11;
  if (digit2 === 10) digit2 = 0;
  return digit2 === parseInt(numbers[10]);
}
```

---

## Security Considerations

1. **PII Protection**: Mask CPF and phone in logs
2. **Access Control**: Only clinic members can access their patients
3. **Data Isolation**: Query always includes clinicId filter
4. **LGPD Compliance**: Support data export and deletion
