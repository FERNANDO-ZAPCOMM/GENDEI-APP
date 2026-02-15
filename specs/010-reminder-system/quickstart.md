# Quickstart: Reminder System

**Feature**: 010-reminder-system
**Date**: 2026-02-04
**Updated**: 2026-02-15

---

## Reminder Service (Cloud Function)

```typescript
// apps/functions/src/services/reminders.ts

export async function sendScheduledReminders(): Promise<ReminderResult> {
  const now = new Date();

  // 24h window: appointments between 23-25 hours from now
  const reminder24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const reminder24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // 2h window: appointments between 1.5-2.5 hours from now
  const reminder2hStart = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
  const reminder2hEnd = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

  // Query confirmed appointments in each window (skip already-sent)
  const appointments24h = await getAppointmentsInWindow(
    reminder24hStart, reminder24hEnd, 'reminder24hSent'
  );
  const appointments2h = await getAppointmentsInWindow(
    reminder2hStart, reminder2hEnd, 'reminder2hSent'
  );

  // Send each reminder via WhatsApp Agent
  for (const apt of appointments24h) {
    await sendReminder(apt, '24h');
  }
  for (const apt of appointments2h) {
    await sendReminder(apt, '2h');
  }
}
```

---

## Vertical-Aware Message Formatting

```typescript
// apps/functions/src/services/reminders.ts

function formatReminderMessage(type, patientName, professionalName, date, time, address, appointmentTerm, professionalEmoji, showArriveEarlyTip) {
  const firstName = patientName.split(' ')[0];
  // Parse date for display (DD/MM + day name)

  if (type === '24h') {
    return `Oi, *${firstName}*!\n\n` +
      `Passando pra lembrar que sua ${appointmentTerm} e *amanha*:\n\n` +
      `Data: *${dayName}, ${formattedDate}* as *${time}*\n` +
      `${professionalEmoji} *${professionalName}*\n` +
      `Endereco: *${address}*\n\n` +
      `Voce confirma presenca?`;
  } else {
    return `Oi, *${firstName}*!\n\n` +
      `Sua ${appointmentTerm} e daqui a *2 horas*!\n\n` +
      `Hoje as ${time}\n` +
      `${professionalEmoji} *${professionalName}*\n` +
      `Te esperamos!${showArriveEarlyTip ? ' Lembre-se de chegar 15 minutos antes.' : ''}`;
  }
}
```

---

## Vertical Terms Configuration

```typescript
// apps/functions/src/services/verticals.ts

const VERTICAL_TERMS: Record<string, VerticalTerms> = {
  med:    { appointmentTerm: 'consulta', professionalEmoji: 'doctor', showArriveEarlyTip: true },
  dental: { appointmentTerm: 'consulta', professionalEmoji: 'tooth',  showArriveEarlyTip: true },
  psi:    { appointmentTerm: 'sessao',   professionalEmoji: 'brain',  showArriveEarlyTip: false },
  nutri:  { appointmentTerm: 'consulta', professionalEmoji: 'salad',  showArriveEarlyTip: false },
  fisio:  { appointmentTerm: 'sessao',   professionalEmoji: 'muscle', showArriveEarlyTip: true },
};

export function getVerticalTerms(verticalSlug?: string): VerticalTerms {
  if (!verticalSlug || verticalSlug === 'geral') return DEFAULT_TERMS;
  return VERTICAL_TERMS[verticalSlug] || DEFAULT_TERMS;
}
```

---

## API Routes

```typescript
// apps/functions/src/routes/reminders.ts

// POST /reminders/trigger - Cloud Scheduler entry point (every 15 min)
router.post('/trigger', async (req, res) => {
  const result = await sendScheduledReminders();
  res.json({ success: true, result, timestamp: new Date().toISOString() });
});

// POST /reminders/send/:appointmentId - Manual send for testing
router.post('/send/:appointmentId', async (req, res) => {
  const { type = '24h' } = req.body;  // '24h' or '2h'
  const success = await sendSingleReminder(appointmentId, type);
  res.json({ success });
});
```

---

## Send via WhatsApp Agent

```typescript
// apps/functions/src/services/reminders.ts

await axios.post(`${WHATSAPP_AGENT_URL}/api/send-reminder`, {
  clinicId,
  phoneNumberId: clinic.whatsappPhoneNumberId,
  accessToken,
  patientPhone,
  message,           // pre-formatted message string
  reminderType: type,
  appointmentId: appointment.id
});

// After successful send, update appointment flags:
await db.collection('gendei_appointments').doc(appointment.id).update({
  [type === '24h' ? 'reminder24hSent' : 'reminder2hSent']: true,
  [type === '24h' ? 'reminder24hAt' : 'reminder2hAt']: FieldValue.serverTimestamp(),
  ...(type === '24h' ? { status: 'awaiting_confirmation' } : {})
});
```

---

## Environment Setup

```bash
# Firebase Functions (.env)
WHATSAPP_AGENT_URL=https://gendei-whatsapp-agent-818713106542.us-central1.run.app
```
