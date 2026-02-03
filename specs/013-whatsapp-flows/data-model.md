# Data Model: WhatsApp Flows

**Feature**: 013-whatsapp-flows
**Date**: 2026-02-04

---

## Collections Overview

```
gendei_flows (top-level)
├── {flowId}

gendei_flow_responses (top-level)
├── {responseId}

gendei_flow_analytics (top-level)
├── {clinicId}_{period}
```

---

## Flow Definition Document

**Collection**: `gendei_flows`

```typescript
interface Flow {
  // Identity
  id: string;
  clinicId: string;
  whatsappFlowId: string;  // ID from Meta

  // Flow info
  type: FlowType;
  name: string;
  description?: string;
  version: string;

  // Status
  status: 'draft' | 'published' | 'deprecated';
  publishedAt?: Timestamp;

  // Configuration
  config: FlowConfig;

  // Analytics
  stats: {
    totalStarted: number;
    totalCompleted: number;
    completionRate: number;
    averageDurationSeconds: number;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type FlowType =
  | 'booking'
  | 'registration'
  | 'intake'
  | 'satisfaction'
  | 'reschedule'
  | 'cancellation'
  | 'custom';

interface FlowConfig {
  // Booking flow specific
  booking?: {
    defaultServiceId?: string;
    defaultProfessionalId?: string;
    maxDaysAhead: number;
    slotDurationMinutes: number;
    requireDeposit: boolean;
  };

  // Satisfaction flow specific
  satisfaction?: {
    sendAfterHours: number;
    ratingScale: 5 | 10;
    includeNps: boolean;
  };

  // Custom fields
  customFields?: FlowCustomField[];
}

interface FlowCustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect';
  required: boolean;
  options?: string[];  // For select/multiselect
}
```

---

## Flow Response Document

**Collection**: `gendei_flow_responses`

```typescript
interface FlowResponse {
  // Identity
  id: string;
  clinicId: string;
  flowId: string;
  flowType: FlowType;

  // Patient info
  patientPhone: string;
  patientId?: string;

  // Session
  sessionId: string;
  flowToken: string;  // Encrypted

  // Response data
  responses: Record<string, any>;
  screensCompleted: string[];
  currentScreen?: string;

  // Status
  status: FlowResponseStatus;
  startedAt: Timestamp;
  lastInteractionAt: Timestamp;
  completedAt?: Timestamp;
  abandonedAt?: Timestamp;

  // Timing
  durationSeconds?: number;

  // Related entities
  appointmentId?: string;
  conversationId?: string;

  // Error tracking
  errors?: FlowError[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type FlowResponseStatus =
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'expired'
  | 'error';

interface FlowError {
  screen: string;
  error: string;
  timestamp: Timestamp;
}
```

---

## Flow Analytics Document

**Collection**: `gendei_flow_analytics`

**Document ID**: `{clinicId}_{YYYY-MM}`

```typescript
interface FlowAnalytics {
  clinicId: string;
  period: string;  // YYYY-MM

  // Overall stats
  overall: {
    totalStarted: number;
    totalCompleted: number;
    totalAbandoned: number;
    completionRate: number;
    averageDurationSeconds: number;
  };

  // By flow type
  byType: Record<FlowType, {
    started: number;
    completed: number;
    abandoned: number;
    completionRate: number;
    averageDurationSeconds: number;
  }>;

  // Drop-off analysis
  dropOff: Record<string, {  // flowId
    byScreen: Record<string, number>;  // screen -> abandonment count
    mostCommonDropScreen: string;
  }>;

  // Satisfaction flow specific
  satisfaction?: {
    averageRating: number;
    npsScore: number;
    totalResponses: number;
    ratingDistribution: Record<string, number>;  // rating -> count
  };

  updatedAt: Timestamp;
}
```

---

## Flow Token (Encrypted Payload)

```typescript
// This is encrypted and passed as flow_token
interface FlowTokenPayload {
  // Context
  clinicId: string;
  patientPhone: string;
  patientId?: string;

  // Flow info
  flowType: FlowType;
  flowId: string;

  // Session
  sessionId: string;
  conversationId?: string;

  // Timing
  timestamp: number;
  expiresAt: number;

  // Optional context
  appointmentId?: string;  // For reschedule/satisfaction flows
  prefill?: Record<string, any>;  // Prefilled data
}
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

export const flowTypeSchema = z.enum([
  'booking',
  'registration',
  'intake',
  'satisfaction',
  'reschedule',
  'cancellation',
  'custom',
]);

export const flowResponseStatusSchema = z.enum([
  'in_progress',
  'completed',
  'abandoned',
  'expired',
  'error',
]);

export const triggerFlowSchema = z.object({
  flowType: flowTypeSchema,
  patientPhone: z.string(),
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  prefill: z.record(z.any()).optional(),
});

export const flowDataExchangeSchema = z.object({
  version: z.string(),
  action: z.enum(['ping', 'INIT', 'data_exchange']),
  screen: z.string().optional(),
  data: z.record(z.any()).optional(),
  flow_token: z.string().optional(),
});

export const flowCompletionSchema = z.object({
  flow_token: z.string(),
  responses: z.record(z.any()),
});
```

---

## Firestore Indexes

```javascript
// Flow responses by clinic and status
{
  collectionGroup: 'gendei_flow_responses',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'status', order: 'ASCENDING' },
    { fieldPath: 'startedAt', order: 'DESCENDING' }
  ]
}

// Flow responses by patient
{
  collectionGroup: 'gendei_flow_responses',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'patientPhone', order: 'ASCENDING' },
    { fieldPath: 'startedAt', order: 'DESCENDING' }
  ]
}

// Flow responses by flow type
{
  collectionGroup: 'gendei_flow_responses',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'flowType', order: 'ASCENDING' },
    { fieldPath: 'completedAt', order: 'DESCENDING' }
  ]
}

// In-progress flows (for timeout handling)
{
  collectionGroup: 'gendei_flow_responses',
  fields: [
    { fieldPath: 'status', order: 'ASCENDING' },
    { fieldPath: 'lastInteractionAt', order: 'ASCENDING' }
  ]
}
```

---

## Example Documents

### Flow Definition

```json
{
  "id": "flow_booking_001",
  "clinicId": "clinic_xyz",
  "whatsappFlowId": "123456789",
  "type": "booking",
  "name": "Agendamento de Consulta",
  "description": "Fluxo para agendar novas consultas",
  "version": "1.0",
  "status": "published",
  "publishedAt": "2026-02-01T00:00:00Z",
  "config": {
    "booking": {
      "maxDaysAhead": 30,
      "slotDurationMinutes": 30,
      "requireDeposit": false
    }
  },
  "stats": {
    "totalStarted": 150,
    "totalCompleted": 120,
    "completionRate": 0.8,
    "averageDurationSeconds": 145
  },
  "createdAt": "2026-01-15T00:00:00Z",
  "updatedAt": "2026-02-04T00:00:00Z"
}
```

### Flow Response

```json
{
  "id": "resp_abc123",
  "clinicId": "clinic_xyz",
  "flowId": "flow_booking_001",
  "flowType": "booking",
  "patientPhone": "+5511999999999",
  "patientId": "patient_456",
  "sessionId": "session_def789",
  "responses": {
    "service_id": "service_001",
    "professional_id": "prof_002",
    "date": "2026-02-05",
    "time": "14:00"
  },
  "screensCompleted": [
    "SERVICE_SELECT",
    "PROFESSIONAL_SELECT",
    "DATE_SELECT",
    "TIME_SELECT",
    "CONFIRMATION"
  ],
  "status": "completed",
  "startedAt": "2026-02-04T10:00:00Z",
  "lastInteractionAt": "2026-02-04T10:02:30Z",
  "completedAt": "2026-02-04T10:02:30Z",
  "durationSeconds": 150,
  "appointmentId": "appt_ghi012",
  "conversationId": "conv_jkl345",
  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:02:30Z"
}
```

### Satisfaction Response

```json
{
  "id": "resp_sat001",
  "clinicId": "clinic_xyz",
  "flowId": "flow_satisfaction_001",
  "flowType": "satisfaction",
  "patientPhone": "+5511999999999",
  "patientId": "patient_456",
  "sessionId": "session_sat001",
  "responses": {
    "rating": 5,
    "feedback": "Excelente atendimento, muito atencioso!",
    "would_recommend": true,
    "nps_score": 10
  },
  "screensCompleted": [
    "RATING",
    "FEEDBACK",
    "NPS",
    "THANK_YOU"
  ],
  "status": "completed",
  "startedAt": "2026-02-04T16:00:00Z",
  "completedAt": "2026-02-04T16:01:00Z",
  "durationSeconds": 60,
  "appointmentId": "appt_abc123",
  "createdAt": "2026-02-04T16:00:00Z",
  "updatedAt": "2026-02-04T16:01:00Z"
}
```
