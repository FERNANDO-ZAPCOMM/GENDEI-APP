# Quickstart: Reminder System

**Feature**: 010-reminder-system
**Date**: 2026-02-04

---

## Reminder Worker (Cloud Function)

```typescript
// apps/functions/src/workers/reminderWorker.ts
import * as functions from 'firebase-functions';
import { db, FieldValue, Timestamp } from '../lib/firebase';
import { sendTextMessage } from '../services/whatsapp';
import { getDecryptedTokens } from '../services/encryption';

const BATCH_SIZE = 50;
const RETRY_DELAYS = [5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000];

export const processReminders = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const now = Timestamp.now();

    // Query pending reminders that are due
    const remindersQuery = await db
      .collection('gendei_reminders')
      .where('status', '==', 'pending')
      .where('scheduledFor', '<=', now)
      .orderBy('scheduledFor', 'asc')
      .limit(BATCH_SIZE)
      .get();

    if (remindersQuery.empty) {
      console.log('No reminders to process');
      return;
    }

    console.log(`Processing ${remindersQuery.size} reminders`);

    const results = await Promise.allSettled(
      remindersQuery.docs.map((doc) => processReminder(doc))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`Processed: ${succeeded} succeeded, ${failed} failed`);
  });

async function processReminder(doc: FirebaseFirestore.DocumentSnapshot) {
  const reminder = doc.data()!;
  const reminderRef = doc.ref;

  // Mark as processing
  await reminderRef.update({
    status: 'processing',
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    // Check if appointment still valid (if appointment-based)
    if (reminder.appointmentId) {
      const appt = await db
        .collection('gendei_appointments')
        .doc(reminder.appointmentId)
        .get();

      if (!appt.exists || appt.data()?.status === 'cancelled') {
        await reminderRef.update({
          status: 'skipped',
          errorMessage: 'Appointment cancelled or not found',
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }
    }

    // Get clinic WhatsApp credentials
    const clinicDoc = await db
      .collection('gendei_clinics')
      .doc(reminder.clinicId)
      .get();

    const whatsappConnection = clinicDoc.data()?.whatsappConnection;
    if (!whatsappConnection?.connected) {
      throw new Error('WhatsApp not connected');
    }

    const tokens = await getDecryptedTokens(reminder.clinicId);

    // Build message content
    const content = await buildReminderMessage(reminder);

    // Send WhatsApp message
    const result = await sendTextMessage(
      whatsappConnection.phoneNumberId,
      tokens.accessToken,
      reminder.patientPhone,
      content
    );

    // Update as sent
    await reminderRef.update({
      status: 'sent',
      sentAt: FieldValue.serverTimestamp(),
      waMessageId: result.messages[0].id,
      attempts: FieldValue.increment(1),
      lastAttemptAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Update analytics
    await updateAnalytics(reminder.clinicId, reminder.type, 'sent');

  } catch (error: any) {
    console.error(`Failed to process reminder ${doc.id}:`, error);

    const attempts = reminder.attempts + 1;
    const nextRetry = getNextRetryTime(attempts);

    if (nextRetry) {
      // Schedule retry
      await reminderRef.update({
        status: 'pending',
        attempts,
        lastAttemptAt: FieldValue.serverTimestamp(),
        scheduledFor: Timestamp.fromDate(nextRetry),
        errorCode: error.code || 'UNKNOWN',
        errorMessage: error.message,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Max retries reached
      await reminderRef.update({
        status: 'failed',
        attempts,
        lastAttemptAt: FieldValue.serverTimestamp(),
        errorCode: error.code || 'UNKNOWN',
        errorMessage: error.message,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await updateAnalytics(reminder.clinicId, reminder.type, 'failed');
    }
  }
}

function getNextRetryTime(attempts: number): Date | null {
  if (attempts >= RETRY_DELAYS.length) return null;
  return new Date(Date.now() + RETRY_DELAYS[attempts]);
}

async function buildReminderMessage(reminder: any): Promise<string> {
  // Get template if specified
  if (reminder.templateId) {
    const templateDoc = await db
      .collection('gendei_clinics')
      .doc(reminder.clinicId)
      .collection('reminder_templates')
      .doc(reminder.templateId)
      .get();

    if (templateDoc.exists) {
      return interpolateVariables(templateDoc.data()!.content, reminder.variables);
    }
  }

  // Use default template
  return getDefaultTemplate(reminder.type, reminder.variables);
}

function interpolateVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
}

function getDefaultTemplate(type: string, vars: Record<string, string>): string {
  const templates: Record<string, string> = {
    reminder_24h: `Olá ${vars.patientFirstName}! 👋

Lembrete da sua consulta *${vars.appointmentDay}*:

📅 ${vars.appointmentDate}
⏰ ${vars.appointmentTime}
👨‍⚕️ ${vars.professionalName}
📍 ${vars.clinicName}

Para confirmar, responda *SIM*.
Para reagendar, responda *REAGENDAR*.`,

    reminder_2h: `${vars.patientFirstName}, sua consulta é em *2 horas*! ⏰

📅 Hoje, ${vars.appointmentTime}
👨‍⚕️ ${vars.professionalName}

Lembre-se de chegar com 10 minutos de antecedência.`,

    no_show: `Olá ${vars.patientFirstName},

Sentimos sua falta na consulta de ${vars.appointmentDate}. 😔

Gostaria de reagendar? Responda com *REAGENDAR* e encontraremos um novo horário.

${vars.clinicName}`,

    birthday: `🎂 Feliz Aniversário, ${vars.patientFirstName}! 🎉

A equipe da ${vars.clinicName} deseja a você um dia muito especial!

Aproveite seu dia! 🎈`,
  };

  return templates[type] || vars.customMessage || 'Mensagem de lembrete';
}

async function updateAnalytics(
  clinicId: string,
  type: string,
  result: 'sent' | 'failed'
) {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const analyticsRef = db.collection('gendei_reminder_analytics').doc(`${clinicId}_${period}`);

  await analyticsRef.set(
    {
      clinicId,
      period,
      [`total.${result}`]: FieldValue.increment(1),
      [`byType.${type}.${result}`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
```

---

## Create Reminders on Appointment Confirmation

```typescript
// apps/functions/src/services/reminderService.ts
import { db, FieldValue, Timestamp } from '../lib/firebase';
import { differenceInHours, subHours } from 'date-fns';

export async function createAppointmentReminders(
  appointmentId: string,
  appointmentData: any,
  clinicId: string
) {
  // Get clinic reminder settings
  const clinicDoc = await db.collection('gendei_clinics').doc(clinicId).get();
  const reminderSettings = clinicDoc.data()?.reminderSettings;

  if (!reminderSettings?.enabled) {
    return;
  }

  const appointmentTime = appointmentData.startTime.toDate();
  const now = new Date();
  const hoursUntil = differenceInHours(appointmentTime, now);

  const remindersToCreate: any[] = [];

  // 24h reminder
  if (reminderSettings.reminder24h?.enabled && hoursUntil > 24) {
    const scheduledFor = subHours(appointmentTime, reminderSettings.reminder24h.hoursBefore || 24);
    remindersToCreate.push({
      type: 'reminder_24h',
      scheduledFor,
      templateId: reminderSettings.reminder24h.templateId,
    });
  }

  // 2h reminder
  if (reminderSettings.reminder2h?.enabled && hoursUntil > 2) {
    const scheduledFor = subHours(appointmentTime, reminderSettings.reminder2h.hoursBefore || 2);
    remindersToCreate.push({
      type: 'reminder_2h',
      scheduledFor,
      templateId: reminderSettings.reminder2h.templateId,
    });
  }

  // Build variables
  const variables = await buildReminderVariables(appointmentData, clinicId);

  // Create reminder documents
  const batch = db.batch();

  for (const reminder of remindersToCreate) {
    // Check for duplicates
    const existing = await db
      .collection('gendei_reminders')
      .where('appointmentId', '==', appointmentId)
      .where('type', '==', reminder.type)
      .where('status', 'in', ['pending', 'sent'])
      .limit(1)
      .get();

    if (!existing.empty) continue;

    const reminderRef = db.collection('gendei_reminders').doc();
    batch.set(reminderRef, {
      clinicId,
      appointmentId,
      patientId: appointmentData.patientId,
      patientPhone: appointmentData.patientPhone,
      type: reminder.type,
      category: 'appointment',
      scheduledFor: Timestamp.fromDate(reminder.scheduledFor),
      timezone: 'America/Sao_Paulo',
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      templateId: reminder.templateId,
      variables,
      createdBy: 'system',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
}

async function buildReminderVariables(
  appointmentData: any,
  clinicId: string
): Promise<Record<string, string>> {
  const appointmentTime = appointmentData.startTime.toDate();
  const now = new Date();

  // Get clinic info
  const clinicDoc = await db.collection('gendei_clinics').doc(clinicId).get();
  const clinic = clinicDoc.data()!;

  // Get professional info
  const professionalDoc = await db
    .collection('gendei_clinics')
    .doc(clinicId)
    .collection('professionals')
    .doc(appointmentData.professionalId)
    .get();
  const professional = professionalDoc.data();

  // Determine if tomorrow or today
  const daysDiff = Math.ceil((appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const appointmentDay = daysDiff === 1 ? 'amanhã' : daysDiff === 0 ? 'hoje' : '';

  return {
    patientName: appointmentData.patientName,
    patientFirstName: appointmentData.patientName.split(' ')[0],
    clinicName: clinic.name,
    professionalName: professional?.name || 'Profissional',
    serviceName: appointmentData.serviceName,
    appointmentDate: appointmentTime.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
    }),
    appointmentTime: appointmentTime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    appointmentDay,
  };
}
```

---

## Reminder Settings Form

```typescript
// apps/web/src/components/settings/ReminderSettingsForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { reminderSettingsSchema } from '@/schemas/reminder.schema';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';

interface ReminderSettingsFormProps {
  defaultValues: any;
  onSubmit: (data: any) => void;
}

export function ReminderSettingsForm({ defaultValues, onSubmit }: ReminderSettingsFormProps) {
  const form = useForm({
    resolver: zodResolver(reminderSettingsSchema),
    defaultValues,
  });

  const enabled = form.watch('enabled');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Master switch */}
        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Lembretes automáticos</FormLabel>
                <FormDescription>
                  Enviar lembretes de consulta via WhatsApp
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {enabled && (
          <>
            {/* 24h reminder */}
            <div className="rounded-lg border p-4 space-y-4">
              <FormField
                control={form.control}
                name="reminder24h.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Lembrete 24 horas antes</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('reminder24h.enabled') && (
                <FormField
                  control={form.control}
                  name="reminder24h.hoursBefore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas antes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={12}
                          max={72}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* 2h reminder */}
            <div className="rounded-lg border p-4 space-y-4">
              <FormField
                control={form.control}
                name="reminder2h.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Lembrete 2 horas antes</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('reminder2h.enabled') && (
                <FormField
                  control={form.control}
                  name="reminder2h.hoursBefore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas antes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* No-show followup */}
            <div className="rounded-lg border p-4 space-y-4">
              <FormField
                control={form.control}
                name="noShowFollowup.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Acompanhamento de faltas</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('noShowFollowup.enabled') && (
                <FormField
                  control={form.control}
                  name="noShowFollowup.hoursAfter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas após a falta</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={72}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Birthday reminder */}
            <div className="rounded-lg border p-4 space-y-4">
              <FormField
                control={form.control}
                name="birthdayReminder.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Lembrete de aniversário</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('birthdayReminder.enabled') && (
                <FormField
                  control={form.control}
                  name="birthdayReminder.sendTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de envio</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Quiet hours */}
            <div className="rounded-lg border p-4 space-y-4">
              <FormField
                control={form.control}
                name="quietHours.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Horário de silêncio</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('quietHours.enabled') && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quietHours.start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Início</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quietHours.end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fim</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </>
        )}

        <Button type="submit">Salvar configurações</Button>
      </form>
    </Form>
  );
}
```

---

## Cancel Reminders on Appointment Cancellation

```typescript
// apps/functions/src/services/reminderService.ts

export async function cancelAppointmentReminders(appointmentId: string) {
  const remindersQuery = await db
    .collection('gendei_reminders')
    .where('appointmentId', '==', appointmentId)
    .where('status', '==', 'pending')
    .get();

  if (remindersQuery.empty) return;

  const batch = db.batch();

  remindersQuery.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelReason: 'Appointment cancelled',
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}
```
