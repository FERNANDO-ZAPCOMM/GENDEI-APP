# Feature 008: Reminders & Notifications

## Spec

### Overview

Reminders & Notifications automatically send appointment reminders via WhatsApp at 24 hours and 2 hours before scheduled appointments. Cloud Scheduler triggers the reminder processing every 15 minutes. Patients can respond to confirm, reschedule, or cancel.

---

### User Stories

#### US-001: 24-Hour Reminder

**As a** patient
**I want to** receive a reminder 24 hours before
**So that** I don't forget my appointment

**Acceptance Criteria:**
- [ ] Sent 23-25 hours before appointment
- [ ] Contains date, time, professional
- [ ] Asks for confirmation
- [ ] Marked as sent in system

#### US-002: 2-Hour Reminder

**As a** patient
**I want to** receive a reminder 2 hours before
**So that** I'm ready on time

**Acceptance Criteria:**
- [ ] Sent 1.5-2.5 hours before appointment
- [ ] Contains time and location
- [ ] Shorter, action-focused message
- [ ] Marked as sent in system

#### US-003: Confirmation Response

**As a** patient
**I want to** confirm my attendance
**So that** the clinic knows I'm coming

**Acceptance Criteria:**
- [ ] Respond with "Confirmo" or similar
- [ ] Status updated to confirmed_presence
- [ ] Confirmation acknowledgment sent

#### US-004: Reschedule Response

**As a** patient
**I want to** reschedule via reminder response
**So that** I can change my appointment

**Acceptance Criteria:**
- [ ] Respond with "Preciso remarcar"
- [ ] AI offers available times
- [ ] New appointment created
- [ ] Old appointment cancelled

#### US-005: Cancel Response

**As a** patient
**I want to** cancel via reminder response
**So that** I free up the slot

**Acceptance Criteria:**
- [ ] Respond with "Cancelar"
- [ ] Confirmation requested
- [ ] Appointment cancelled
- [ ] Slot freed up

#### US-006: Manual Reminder Trigger

**As a** clinic staff
**I want to** manually send a reminder
**So that** I can remind patients immediately

**Acceptance Criteria:**
- [ ] "Send Reminder" button
- [ ] Select appointment
- [ ] Reminder sent
- [ ] Confirmation shown

---

### Functional Requirements

#### FR-001: Reminder Configuration

```python
REMINDER_CONFIG = {
    "24h": {
        "name": "24-Hour Reminder",
        "window": {
            "min_hours": 23,
            "max_hours": 25,
        },
        "flag_field": "reminder24hSent",
    },
    "2h": {
        "name": "2-Hour Reminder",
        "window": {
            "min_hours": 1.5,
            "max_hours": 2.5,
        },
        "flag_field": "reminder2hSent",
    },
}
```

#### FR-002: Reminder Message Templates

```python
REMINDER_24H_TEMPLATE = """
Olá, {patient_name}! 👋

Lembrete: Sua consulta é amanhã!

📅 {date} às {time}
👨‍⚕️ {professional_name}
📍 {clinic_address}

Você confirma sua presença?
"""

REMINDER_2H_TEMPLATE = """
{patient_name}, sua consulta é em 2 horas!

📅 Hoje às {time}
👨‍⚕️ {professional_name}
📍 {clinic_address}

Te esperamos! 😊
"""
```

#### FR-003: Reminder Processing Logic

```python
async def process_reminders():
    """
    Process scheduled reminders.
    Called by Cloud Scheduler every 15 minutes.
    """
    now = datetime.utcnow()

    # Process 24-hour reminders
    await process_reminder_type("24h", now)

    # Process 2-hour reminders
    await process_reminder_type("2h", now)


async def process_reminder_type(reminder_type: str, now: datetime):
    """
    Process reminders of a specific type.
    """
    config = REMINDER_CONFIG[reminder_type]

    min_time = now + timedelta(hours=config["window"]["min_hours"])
    max_time = now + timedelta(hours=config["window"]["max_hours"])

    # Query appointments in the window
    appointments = await db.collection_group("appointments") \
        .where("status", "in", ["pending", "awaiting_confirmation", "confirmed"]) \
        .where(config["flag_field"], "==", False) \
        .get()

    for apt in appointments:
        apt_data = apt.to_dict()
        apt_datetime = parse_appointment_datetime(apt_data["date"], apt_data["time"])

        if min_time <= apt_datetime <= max_time:
            await send_reminder(apt, reminder_type)


async def send_reminder(appointment: dict, reminder_type: str):
    """
    Send reminder for an appointment.
    """
    clinic = await get_clinic(appointment["clinicId"])

    # Build message from template
    if reminder_type == "24h":
        message = REMINDER_24H_TEMPLATE.format(
            patient_name=appointment["patientName"],
            date=format_date_pt_br(appointment["date"]),
            time=appointment["time"],
            professional_name=appointment["professionalName"],
            clinic_address=clinic["address"],
        )
    else:
        message = REMINDER_2H_TEMPLATE.format(
            patient_name=appointment["patientName"],
            time=appointment["time"],
            professional_name=appointment["professionalName"],
            clinic_address=clinic["address"],
        )

    # Send via WhatsApp
    await send_whatsapp_message(
        clinic_id=appointment["clinicId"],
        phone=appointment["patientPhone"],
        message=message,
    )

    # Update appointment flag
    flag_field = REMINDER_CONFIG[reminder_type]["flag_field"]
    await update_appointment(appointment["id"], {
        flag_field: True,
        "status": "awaiting_confirmation" if reminder_type == "24h" else appointment["status"],
    })

    # Log the reminder
    await log_reminder_sent(appointment["id"], reminder_type)
```

#### FR-004: Cloud Scheduler Configuration

```yaml
# Cloud Scheduler Job
name: process-reminders
schedule: "*/15 * * * *"  # Every 15 minutes
timeZone: "America/Sao_Paulo"
httpTarget:
  uri: https://us-central1-gendei-prod.cloudfunctions.net/api/reminders/process
  httpMethod: POST
  headers:
    Content-Type: application/json
  body: "{}"
```

#### FR-005: Confirmation Detection

```python
CONFIRMATION_PHRASES = [
    "confirmo",
    "confirmado",
    "sim",
    "estarei lá",
    "vou",
    "pode confirmar",
    "confirma",
    "ok",
    "tudo certo",
]

RESCHEDULE_PHRASES = [
    "remarcar",
    "mudar horário",
    "não posso nesse horário",
    "alterar",
    "outro dia",
    "outro horário",
]

CANCEL_PHRASES = [
    "cancelar",
    "não vou mais",
    "desistir",
    "cancela",
    "não quero mais",
]


def detect_reminder_intent(message: str) -> str:
    """
    Detect patient's intent from reminder response.
    Returns: 'confirm', 'reschedule', 'cancel', or 'unknown'
    """
    message_lower = message.lower().strip()

    if any(phrase in message_lower for phrase in CONFIRMATION_PHRASES):
        return "confirm"

    if any(phrase in message_lower for phrase in RESCHEDULE_PHRASES):
        return "reschedule"

    if any(phrase in message_lower for phrase in CANCEL_PHRASES):
        return "cancel"

    return "unknown"
```

---

### API Endpoints

```yaml
# Reminder Processing
POST /api/reminders/process
  Request:
    (Called by Cloud Scheduler, no body needed)
  Response:
    processed: number
    sent: number
    errors: number

POST /api/reminders/send-reminder
  Request:
    appointmentId: string
    type: "24h" | "2h"
  Response:
    sent: boolean
    error?: string
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────┐
│  WhatsApp - 24h Reminder                                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   09:00   │ Olá, João! 👋                                  │   │
│    🤖     │                                                │   │
│           │ Lembrete: Sua consulta é amanhã!              │   │
│           │                                                │   │
│           │ 📅 Terça, 16 de Janeiro às 14:00              │   │
│           │ 👩‍⚕️ Dra. Maria Silva                           │   │
│           │ 📍 Av. Paulista, 1000 - São Paulo             │   │
│           │                                                │   │
│           │ Você confirma sua presença?                    │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
│  Possíveis respostas:                                          │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │ "Confirmo!"      │  → Status: confirmed_presence           │
│  └──────────────────┘                                          │
│                                                                 │
│  ┌──────────────────────────────────────────┐                  │
│  │ "Preciso remarcar, posso às 15h?"       │  → Reschedule    │
│  └──────────────────────────────────────────┘                  │
│                                                                 │
│  ┌──────────────────────────────────────────┐                  │
│  │ "Não vou mais conseguir, cancela por favor" │  → Cancel    │
│  └──────────────────────────────────────────┘                  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  WhatsApp - 2h Reminder                                        │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   12:00   │ João, sua consulta é em 2 horas!              │   │
│    🤖     │                                                │   │
│           │ 📅 Hoje às 14:00                               │   │
│           │ 👩‍⚕️ Dra. Maria Silva                           │   │
│           │ 📍 Av. Paulista, 1000 - São Paulo             │   │
│           │                                                │   │
│           │ Te esperamos! 😊                               │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Dashboard - Manual Reminder                                   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Agendamento: João Silva - 16/01/2024 14:00                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Lembretes Enviados:                                      │  │
│  │                                                          │  │
│  │ ⬜ 24h antes (amanhã 14:00)                             │  │
│  │ ⬜ 2h antes (16/01 12:00)                               │  │
│  │                                                          │  │
│  │                           [Enviar Lembrete Manualmente]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  WhatsApp - Reschedule Flow                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────┐            │
│  │ Preciso remarcar, não posso nesse horário     │  09:20    │
│  └────────────────────────────────────────────────┘            │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   09:20   │ Sem problemas! Vou verificar os horários      │   │
│    🤖     │ disponíveis da Dra. Maria Silva.              │   │
│           │                                                │   │
│           │ Horários disponíveis amanhã (16/01):          │   │
│           │ • 09:00                                        │   │
│           │ • 10:00                                        │   │
│           │ • 15:00                                        │   │
│           │ • 16:00                                        │   │
│           │                                                │   │
│           │ Qual horário prefere?                          │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────┐            │
│  │ 15:00                                          │  09:22    │
│  └────────────────────────────────────────────────┘            │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   09:22   │ Pronto! Sua consulta foi remarcada! ✅         │   │
│    🤖     │                                                │   │
│           │ 📅 Terça, 16 de Janeiro às 15:00              │   │
│           │ 👩‍⚕️ Dra. Maria Silva                           │   │
│           │                                                │   │
│           │ Te envio um novo lembrete amanhã!             │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] 24-hour reminder (23-25h window)
- [x] 2-hour reminder (1.5-2.5h window)
- [x] Cloud Scheduler every 15 minutes
- [x] Reminder flag tracking
- [x] Confirmation response handling
- [x] Reschedule via WhatsApp
- [x] Cancel via WhatsApp
- [x] Manual reminder trigger
- [ ] SMS reminders (Planned)
