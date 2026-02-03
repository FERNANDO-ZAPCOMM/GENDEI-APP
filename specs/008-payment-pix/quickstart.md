# Quickstart: Payment PIX

**Feature**: 008-payment-pix
**Date**: 2026-02-04

---

## PIX Code Generation

```typescript
// apps/functions/src/services/pix.ts

function calculateCRC16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

export function generatePixCode(
  pixKey: string,
  amountCents: number,
  txId: string,
  merchantName: string = 'GENDEI',
  city: string = 'SAO PAULO'
): string {
  const amount = (amountCents / 100).toFixed(2);

  let payload = '';
  payload += tlv('00', '01');                                      // Payload format
  payload += tlv('01', '12');                                      // Static QR
  payload += tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', pixKey));  // PIX account
  payload += tlv('52', '0000');                                    // MCC
  payload += tlv('53', '986');                                     // Currency (BRL)
  payload += tlv('54', amount);                                    // Amount
  payload += tlv('58', 'BR');                                      // Country
  payload += tlv('59', merchantName.substring(0, 25));             // Merchant name
  payload += tlv('60', city.substring(0, 15));                     // City
  payload += tlv('62', tlv('05', txId.substring(0, 25)));          // TxID

  const crcPayload = payload + '6304';
  const crc = calculateCRC16(crcPayload);

  return crcPayload + crc;
}
```

---

## Payment Controller

```typescript
// apps/functions/src/controllers/paymentController.ts
import { generatePixCode } from '../services/pix';

export async function generatePixForAppointment(req: Request, res: Response) {
  const clinicId = req.clinicId!;
  const { appointmentId } = req.body;

  // Get appointment
  const appointmentDoc = await db.collection('gendei_appointments').doc(appointmentId).get();
  if (!appointmentDoc.exists) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  const appointment = appointmentDoc.data()!;

  // Verify clinic owns appointment
  if (appointment.clinicId !== clinicId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Get clinic PIX config
  const clinicDoc = await db.collection('gendei_clinics').doc(clinicId).get();
  const paymentSettings = clinicDoc.data()?.paymentSettings;

  if (!paymentSettings?.pix?.key) {
    return res.status(400).json({ error: 'PIX not configured' });
  }

  // Generate PIX code
  const txId = `GENDEI${appointmentId.substring(0, 15)}`;
  const pixCode = generatePixCode(
    paymentSettings.pix.key,
    appointment.depositAmount,
    txId
  );

  // Update appointment with PIX code
  await appointmentDoc.ref.update({
    pixCode,
    pixCodeGeneratedAt: FieldValue.serverTimestamp(),
  });

  return res.json({
    pixCode,
    amount: appointment.depositAmount,
    amountFormatted: formatPrice(appointment.depositAmount),
  });
}

export async function confirmPayment(req: Request, res: Response) {
  const { appointmentId, method = 'pix' } = req.body;

  const appointmentRef = db.collection('gendei_appointments').doc(appointmentId);

  await appointmentRef.update({
    depositPaid: true,
    depositPaidAt: FieldValue.serverTimestamp(),
    depositPaymentMethod: method,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return res.json({ success: true });
}
```

---

## Payment Settings Form

```typescript
// apps/web/src/components/settings/PaymentSettingsForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { paymentSettingsSchema } from '@/schemas/payment.schema';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

export function PaymentSettingsForm({ defaultValues, onSubmit }) {
  const form = useForm({
    resolver: zodResolver(paymentSettingsSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Deposit settings */}
        <FormField
          control={form.control}
          name="requiresDeposit"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <FormLabel>Exigir sinal (depósito)</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch('requiresDeposit') && (
          <FormField
            control={form.control}
            name="depositPercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Porcentagem do sinal: {field.value}%</FormLabel>
                <FormControl>
                  <Slider
                    value={[field.value]}
                    onValueChange={([v]) => field.onChange(v)}
                    min={10}
                    max={100}
                    step={5}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        {/* PIX configuration */}
        <div className="space-y-4">
          <h3 className="font-medium">Chave PIX</h3>

          <FormField
            control={form.control}
            name="pix.type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de chave</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pix.key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chave PIX</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit">Salvar configurações</Button>
      </form>
    </Form>
  );
}
```

---

## Send PIX to WhatsApp

```python
# apps/agent/src/utils/payment.py
async def send_pix_payment_request(
    phone_number_id: str,
    access_token: str,
    to: str,
    amount_cents: int,
    pix_code: str,
    appointment_date: str,
    appointment_time: str,
):
    """Send PIX payment request via WhatsApp."""
    amount_formatted = f"R$ {amount_cents / 100:.2f}".replace('.', ',')

    message = f"""💰 *Sinal para Consulta*

Para confirmar seu agendamento:
📅 {appointment_date} às {appointment_time}

Valor do sinal: *{amount_formatted}*

Copie o código PIX abaixo e cole no seu app de banco:

```
{pix_code}
```

Após o pagamento, sua consulta será confirmada automaticamente. ✅"""

    await send_text_message(phone_number_id, access_token, to, message)
```
