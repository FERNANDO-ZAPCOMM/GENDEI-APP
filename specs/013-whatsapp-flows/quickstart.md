# Quickstart: WhatsApp Flows

**Feature**: 013-whatsapp-flows
**Date**: 2026-02-04

---

## Flow Data Endpoint

```typescript
// apps/functions/src/controllers/flowController.ts
import { db, FieldValue, Timestamp } from '../lib/firebase';
import { decryptFlowToken, encryptFlowToken } from '../services/encryption';

interface FlowDataRequest {
  version: string;
  action: 'ping' | 'INIT' | 'data_exchange';
  screen?: string;
  data?: Record<string, any>;
  flow_token?: string;
}

export async function handleFlowData(req: Request, res: Response) {
  const body: FlowDataRequest = req.body;

  // Handle health check
  if (body.action === 'ping') {
    return res.json({ data: { status: 'active' } });
  }

  // Decrypt flow token
  const tokenData = decryptFlowToken(body.flow_token!);
  if (!tokenData) {
    return res.status(400).json({ error: 'Invalid flow token' });
  }

  const { clinicId, patientPhone, flowType, sessionId } = tokenData;

  // Update or create flow response
  const responseRef = await getOrCreateFlowResponse(
    clinicId,
    flowType,
    sessionId,
    patientPhone
  );

  // Handle INIT action
  if (body.action === 'INIT') {
    return handleFlowInit(res, clinicId, flowType, tokenData);
  }

  // Handle data exchange
  if (body.action === 'data_exchange') {
    return handleDataExchange(
      res,
      clinicId,
      flowType,
      body.screen!,
      body.data!,
      tokenData,
      responseRef
    );
  }

  return res.status(400).json({ error: 'Unknown action' });
}

async function handleFlowInit(
  res: Response,
  clinicId: string,
  flowType: string,
  tokenData: any
) {
  switch (flowType) {
    case 'booking':
      return handleBookingInit(res, clinicId);
    case 'satisfaction':
      return handleSatisfactionInit(res, tokenData);
    default:
      return res.status(400).json({ error: 'Unknown flow type' });
  }
}

async function handleBookingInit(res: Response, clinicId: string) {
  // Get active services
  const servicesSnapshot = await db
    .collection('gendei_clinics')
    .doc(clinicId)
    .collection('services')
    .where('active', '==', true)
    .get();

  const services = servicesSnapshot.docs.map((doc) => ({
    id: doc.id,
    title: doc.data().name,
  }));

  return res.json({
    version: '3.0',
    screen: 'SERVICE_SELECT',
    data: {
      services,
    },
  });
}

async function handleDataExchange(
  res: Response,
  clinicId: string,
  flowType: string,
  screen: string,
  data: Record<string, any>,
  tokenData: any,
  responseRef: FirebaseFirestore.DocumentReference
) {
  // Update flow response with current screen data
  await responseRef.update({
    [`responses.${screen}`]: data,
    screensCompleted: FieldValue.arrayUnion(screen),
    currentScreen: screen,
    lastInteractionAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Route to appropriate handler
  switch (flowType) {
    case 'booking':
      return handleBookingDataExchange(res, clinicId, screen, data, tokenData);
    default:
      return res.status(400).json({ error: 'Unknown flow type' });
  }
}

async function handleBookingDataExchange(
  res: Response,
  clinicId: string,
  screen: string,
  data: Record<string, any>,
  tokenData: any
) {
  switch (screen) {
    case 'SERVICE_SELECT': {
      // Get professionals for selected service
      const serviceDoc = await db
        .collection('gendei_clinics')
        .doc(clinicId)
        .collection('services')
        .doc(data.service_id)
        .get();

      const professionalIds = serviceDoc.data()?.professionalIds || [];

      const professionalsSnapshot = await db
        .collection('gendei_clinics')
        .doc(clinicId)
        .collection('professionals')
        .where('__name__', 'in', professionalIds.slice(0, 10))
        .get();

      const professionals = professionalsSnapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().name,
      }));

      return res.json({
        version: '3.0',
        screen: 'PROFESSIONAL_SELECT',
        data: {
          professionals,
          service_id: data.service_id,
        },
      });
    }

    case 'PROFESSIONAL_SELECT': {
      // Get available dates for professional
      const availableDates = await getAvailableDates(
        clinicId,
        data.professional_id,
        30 // days ahead
      );

      const today = new Date();
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);

      return res.json({
        version: '3.0',
        screen: 'DATE_SELECT',
        data: {
          min_date: today.toISOString().split('T')[0],
          max_date: maxDate.toISOString().split('T')[0],
          unavailable_dates: availableDates.unavailable,
          professional_id: data.professional_id,
        },
      });
    }

    case 'DATE_SELECT': {
      // Get available time slots for selected date
      const timeSlots = await getAvailableTimeSlots(
        clinicId,
        data.professional_id,
        data.date
      );

      return res.json({
        version: '3.0',
        screen: 'TIME_SELECT',
        data: {
          time_slots: timeSlots.map((slot) => ({
            id: slot,
            title: slot,
          })),
          date: data.date,
        },
      });
    }

    case 'TIME_SELECT': {
      // Get confirmation data
      const [serviceDoc, professionalDoc] = await Promise.all([
        db.collection('gendei_clinics').doc(clinicId).collection('services').doc(tokenData.serviceId || data.service_id).get(),
        db.collection('gendei_clinics').doc(clinicId).collection('professionals').doc(data.professional_id).get(),
      ]);

      const date = new Date(data.date);
      const dateFormatted = date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      return res.json({
        version: '3.0',
        screen: 'CONFIRMATION',
        data: {
          service_name: serviceDoc.data()?.name,
          professional_name: professionalDoc.data()?.name,
          date_formatted: dateFormatted,
          time_formatted: data.time,
        },
      });
    }

    default:
      return res.status(400).json({ error: 'Unknown screen' });
  }
}

async function getAvailableDates(
  clinicId: string,
  professionalId: string,
  daysAhead: number
): Promise<{ available: string[]; unavailable: string[] }> {
  const professional = await db
    .collection('gendei_clinics')
    .doc(clinicId)
    .collection('professionals')
    .doc(professionalId)
    .get();

  const workingHours = professional.data()?.workingHours || {};
  const available: string[] = [];
  const unavailable: string[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    if (workingHours[dayOfWeek]?.enabled) {
      available.push(dateStr);
    } else {
      unavailable.push(dateStr);
    }
  }

  return { available, unavailable };
}

async function getAvailableTimeSlots(
  clinicId: string,
  professionalId: string,
  dateStr: string
): Promise<string[]> {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();

  const professional = await db
    .collection('gendei_clinics')
    .doc(clinicId)
    .collection('professionals')
    .doc(professionalId)
    .get();

  const workingHours = professional.data()?.workingHours?.[dayOfWeek];
  if (!workingHours?.enabled) return [];

  // Generate time slots
  const slots: string[] = [];
  const [startHour, startMin] = workingHours.start.split(':').map(Number);
  const [endHour, endMin] = workingHours.end.split(':').map(Number);

  let currentHour = startHour;
  let currentMin = startMin;

  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    slots.push(
      `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`
    );
    currentMin += 30;
    if (currentMin >= 60) {
      currentMin = 0;
      currentHour++;
    }
  }

  // Filter out booked slots
  const startOfDay = new Date(dateStr);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateStr);
  endOfDay.setHours(23, 59, 59, 999);

  const bookedAppointments = await db
    .collection('gendei_appointments')
    .where('clinicId', '==', clinicId)
    .where('professionalId', '==', professionalId)
    .where('startTime', '>=', Timestamp.fromDate(startOfDay))
    .where('startTime', '<=', Timestamp.fromDate(endOfDay))
    .where('status', 'not-in', ['cancelled'])
    .get();

  const bookedSlots = new Set(
    bookedAppointments.docs.map((doc) => {
      const startTime = doc.data().startTime.toDate();
      return `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
    })
  );

  return slots.filter((slot) => !bookedSlots.has(slot));
}

async function getOrCreateFlowResponse(
  clinicId: string,
  flowType: string,
  sessionId: string,
  patientPhone: string
): Promise<FirebaseFirestore.DocumentReference> {
  const existingQuery = await db
    .collection('gendei_flow_responses')
    .where('sessionId', '==', sessionId)
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    return existingQuery.docs[0].ref;
  }

  const newResponse = await db.collection('gendei_flow_responses').add({
    clinicId,
    flowType,
    sessionId,
    patientPhone,
    responses: {},
    screensCompleted: [],
    status: 'in_progress',
    startedAt: FieldValue.serverTimestamp(),
    lastInteractionAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return newResponse;
}
```

---

## Flow Completion Handler

```typescript
// apps/functions/src/controllers/flowController.ts

export async function handleFlowComplete(req: Request, res: Response) {
  const { flow_token, responses } = req.body;

  const tokenData = decryptFlowToken(flow_token);
  if (!tokenData) {
    return res.status(400).json({ error: 'Invalid flow token' });
  }

  const { clinicId, sessionId, flowType, patientPhone } = tokenData;

  // Find flow response
  const responseQuery = await db
    .collection('gendei_flow_responses')
    .where('sessionId', '==', sessionId)
    .limit(1)
    .get();

  if (responseQuery.empty) {
    return res.status(404).json({ error: 'Flow response not found' });
  }

  const responseDoc = responseQuery.docs[0];
  const startedAt = responseDoc.data().startedAt.toDate();
  const completedAt = new Date();
  const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

  // Update flow response
  await responseDoc.ref.update({
    responses: { ...responseDoc.data().responses, ...responses },
    status: 'completed',
    completedAt: FieldValue.serverTimestamp(),
    durationSeconds,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Handle flow-specific completion
  switch (flowType) {
    case 'booking':
      await handleBookingCompletion(clinicId, responseDoc.id, responseDoc.data(), responses);
      break;
    case 'satisfaction':
      await handleSatisfactionCompletion(clinicId, responseDoc.data(), responses);
      break;
  }

  return res.json({ success: true });
}

async function handleBookingCompletion(
  clinicId: string,
  responseId: string,
  flowData: any,
  finalResponses: any
) {
  // Extract booking data
  const allResponses = { ...flowData.responses, ...finalResponses };
  const serviceId = allResponses.SERVICE_SELECT?.service_id;
  const professionalId = allResponses.PROFESSIONAL_SELECT?.professional_id;
  const date = allResponses.DATE_SELECT?.date;
  const time = allResponses.TIME_SELECT?.time;

  if (!serviceId || !professionalId || !date || !time) {
    console.error('Missing booking data');
    return;
  }

  // Get service details
  const serviceDoc = await db
    .collection('gendei_clinics')
    .doc(clinicId)
    .collection('services')
    .doc(serviceId)
    .get();

  const service = serviceDoc.data()!;

  // Get or create patient
  const patientId = await getOrCreatePatient(clinicId, flowData.patientPhone);

  // Calculate start time
  const [hours, minutes] = time.split(':').map(Number);
  const startTime = new Date(date);
  startTime.setHours(hours, minutes, 0, 0);

  // Calculate end time
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + service.durationMinutes);

  // Create appointment
  const appointmentRef = await db.collection('gendei_appointments').add({
    clinicId,
    patientId,
    patientPhone: flowData.patientPhone,
    professionalId,
    serviceId,
    serviceName: service.name,
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    durationMinutes: service.durationMinutes,
    priceCents: service.priceCents,
    depositAmount: Math.round((service.priceCents * service.signalPercentage) / 100),
    status: 'pending',
    source: 'whatsapp_flow',
    flowResponseId: responseId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Update flow response with appointment ID
  await db.collection('gendei_flow_responses').doc(responseId).update({
    appointmentId: appointmentRef.id,
  });

  // Update flow analytics
  await updateFlowAnalytics(clinicId, 'booking', 'completed');
}

async function handleSatisfactionCompletion(
  clinicId: string,
  flowData: any,
  responses: any
) {
  const rating = responses.rating;
  const npsScore = responses.nps_score;

  // Update analytics
  const period = new Date().toISOString().slice(0, 7);
  const analyticsRef = db.collection('gendei_flow_analytics').doc(`${clinicId}_${period}`);

  await analyticsRef.set(
    {
      clinicId,
      period,
      [`satisfaction.totalResponses`]: FieldValue.increment(1),
      [`satisfaction.ratingSum`]: FieldValue.increment(rating),
      [`satisfaction.npsSum`]: FieldValue.increment(npsScore || 0),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function getOrCreatePatient(clinicId: string, phone: string): Promise<string> {
  const existing = await db
    .collection('gendei_patients')
    .where('phone', '==', phone)
    .where('clinicIds', 'array-contains', clinicId)
    .limit(1)
    .get();

  if (!existing.empty) {
    return existing.docs[0].id;
  }

  const newPatient = await db.collection('gendei_patients').add({
    phone,
    clinicIds: [clinicId],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return newPatient.id;
}

async function updateFlowAnalytics(
  clinicId: string,
  flowType: string,
  result: 'completed' | 'abandoned'
) {
  const period = new Date().toISOString().slice(0, 7);
  const analyticsRef = db.collection('gendei_flow_analytics').doc(`${clinicId}_${period}`);

  await analyticsRef.set(
    {
      clinicId,
      period,
      [`overall.total${result === 'completed' ? 'Completed' : 'Abandoned'}`]: FieldValue.increment(1),
      [`byType.${flowType}.${result}`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
```

---

## Trigger Flow from AI Agent

```python
# apps/agent/src/utils/flows.py
import httpx
from typing import Optional
from ..services.encryption import encrypt_flow_token
import uuid
import time

async def trigger_booking_flow(
    phone_number_id: str,
    access_token: str,
    to: str,
    clinic_id: str,
    flow_id: str,
    patient_id: Optional[str] = None
) -> dict:
    """Trigger the booking flow for a patient."""

    # Create flow token
    flow_token = encrypt_flow_token({
        'clinicId': clinic_id,
        'patientPhone': to,
        'patientId': patient_id,
        'flowType': 'booking',
        'sessionId': str(uuid.uuid4()),
        'timestamp': int(time.time()),
        'expiresAt': int(time.time()) + 3600,  # 1 hour
    })

    message = {
        'messaging_product': 'whatsapp',
        'recipient_type': 'individual',
        'to': to,
        'type': 'interactive',
        'interactive': {
            'type': 'flow',
            'header': {
                'type': 'text',
                'text': 'Agendar Consulta'
            },
            'body': {
                'text': 'Clique no botão abaixo para agendar sua consulta. É rápido e fácil!'
            },
            'footer': {
                'text': 'Gendei - Agendamento Inteligente'
            },
            'action': {
                'name': 'flow',
                'parameters': {
                    'flow_message_version': '3',
                    'flow_token': flow_token,
                    'flow_id': flow_id,
                    'flow_cta': 'Agendar agora',
                    'flow_action': 'navigate',
                    'flow_action_payload': {
                        'screen': 'SERVICE_SELECT'
                    }
                }
            }
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'https://graph.facebook.com/v22.0/{phone_number_id}/messages',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            },
            json=message
        )
        return response.json()
```
