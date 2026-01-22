# Feature 007: AI Agents

## Spec

### Overview

AI Agents power the WhatsApp chatbot experience. The system uses specialized agents for different tasks: Greeting Agent for initial contact, Scheduling Agent for appointment booking, Reminder Agent for handling reminder responses, and Triage Agent for complex routing. Supports both OpenAI GPT-4 and Anthropic Claude.

---

### User Stories

#### US-001: Greeting Agent

**As a** patient
**I want to** receive a friendly greeting
**So that** I feel welcome when contacting the clinic

**Acceptance Criteria:**
- [ ] Fast response to greetings
- [ ] Detect "Oi", "Olá", "Bom dia", etc.
- [ ] Introduce clinic name
- [ ] Ask how to help
- [ ] Natural, warm tone

#### US-002: Scheduling Agent

**As a** patient
**I want to** book an appointment via chat
**So that** I don't need to call

**Acceptance Criteria:**
- [ ] Understand booking intent
- [ ] Ask for specialty if needed
- [ ] Check professional availability
- [ ] Collect patient information
- [ ] Send WhatsApp Flow for booking
- [ ] Confirm appointment details

#### US-003: Reminder Agent

**As a** patient
**I want to** respond to appointment reminders
**So that** I can confirm or reschedule

**Acceptance Criteria:**
- [ ] Understand confirmation phrases
- [ ] Handle "Confirmo", "Preciso remarcar"
- [ ] Update appointment status
- [ ] Offer reschedule options
- [ ] Process cancellations

#### US-004: Triage Agent

**As a** patient
**I want to** get help with complex requests
**So that** my issue is resolved

**Acceptance Criteria:**
- [ ] Route unclear intents
- [ ] Escalate to human when needed
- [ ] Handle edge cases
- [ ] Graceful fallback responses

#### US-005: Multi-Provider Support

**As a** clinic owner
**I want to** choose AI provider
**So that** I can use my preferred service

**Acceptance Criteria:**
- [ ] OpenAI GPT-4 support
- [ ] Anthropic Claude support
- [ ] Switchable via config
- [ ] Consistent behavior

#### US-006: Message Buffering

**As a** system
**I want to** buffer rapid messages
**So that** AI responds to complete thoughts

**Acceptance Criteria:**
- [ ] Combine messages within window
- [ ] Adaptive delays by message type
- [ ] Greeting-only: 5 seconds
- [ ] Short messages: 3.5 seconds
- [ ] Standard: 2 seconds

---

### Functional Requirements

#### FR-001: Agent Architecture

```python
# Agent definitions
AGENTS = {
    "greeting": {
        "name": "Greeting Agent",
        "description": "Welcome patient, detect intent, warm introduction",
        "triggers": ["oi", "olá", "bom dia", "boa tarde", "boa noite"],
        "model": "gpt-4o-mini",  # Fast response
    },
    "scheduling": {
        "name": "Scheduling Agent",
        "description": "Book appointments, check availability, collect info",
        "triggers": ["agendar", "marcar", "consulta", "horário", "disponível"],
        "model": "gpt-4o",  # Complex reasoning
    },
    "reminder": {
        "name": "Reminder Agent",
        "description": "Handle reminder responses, confirmations, reschedules",
        "triggers": ["confirmo", "confirmar", "remarcar", "cancelar", "não posso"],
        "model": "gpt-4o-mini",
    },
    "triage": {
        "name": "Triage Agent",
        "description": "Complex routing, unclear intents, human handoff",
        "triggers": [],  # Fallback agent
        "model": "gpt-4o",
    },
}
```

#### FR-002: Greeting Agent Prompt

```python
GREETING_AGENT_PROMPT = """
Você é a assistente virtual da {clinic_name}, uma clínica de saúde.

Sua tarefa é:
1. Dar as boas-vindas ao paciente de forma calorosa
2. Perguntar como você pode ajudar
3. Detectar a intenção do paciente

Responda sempre em português brasileiro.
Use um tom amigável e profissional.
Não use emojis em excesso (máximo 1-2 por mensagem).

Informações da clínica:
- Nome: {clinic_name}
- Especialidades: {specialties}
- Horário de funcionamento: {opening_hours}

Se o paciente quiser agendar, responda que você pode ajudar e pergunte qual especialidade ele procura.
"""
```

#### FR-003: Scheduling Agent Prompt

```python
SCHEDULING_AGENT_PROMPT = """
Você é a assistente de agendamento da {clinic_name}.

Sua tarefa é ajudar o paciente a agendar uma consulta.

Passos:
1. Identificar a especialidade desejada
2. Mostrar profissionais disponíveis
3. Enviar o formulário de agendamento (WhatsApp Flow)
4. Confirmar os dados do agendamento

Profissionais disponíveis:
{professionals_list}

Serviços oferecidos:
{services_list}

Regras importantes:
- NUNCA invente horários. Use apenas a ferramenta de verificação de disponibilidade.
- SEMPRE confirme os dados antes de finalizar o agendamento.
- Se o horário desejado não estiver disponível, ofereça alternativas.

Ferramentas disponíveis:
- check_availability(professional_id, date): Verifica horários disponíveis
- send_booking_flow(patient_phone): Envia formulário de agendamento
- create_appointment(data): Cria o agendamento
"""
```

#### FR-004: Reminder Agent Prompt

```python
REMINDER_AGENT_PROMPT = """
Você está respondendo a um lembrete de consulta.

Consulta marcada:
- Data: {appointment_date}
- Horário: {appointment_time}
- Profissional: {professional_name}
- Serviço: {service_name}

O paciente respondeu ao lembrete. Interprete a resposta:

Se CONFIRMAR (ex: "confirmo", "estarei lá", "ok"):
- Agradeça a confirmação
- Reforce data e horário
- Use a ferramenta update_status("confirmed_presence")

Se REMARCAR (ex: "preciso remarcar", "não posso nesse horário"):
- Pergunte qual horário prefere
- Ofereça alternativas
- Use a ferramenta check_availability()

Se CANCELAR (ex: "cancelar", "não vou mais"):
- Confirme o cancelamento
- Pergunte se deseja reagendar
- Use a ferramenta update_status("cancelled")
"""
```

#### FR-005: Message Buffering Logic

```python
import asyncio
from datetime import datetime, timedelta

class MessageBuffer:
    def __init__(self):
        self.buffers = {}  # conversation_id -> messages[]
        self.timers = {}   # conversation_id -> timer

    async def add_message(self, conversation_id: str, message: str):
        if conversation_id not in self.buffers:
            self.buffers[conversation_id] = []

        self.buffers[conversation_id].append({
            "content": message,
            "timestamp": datetime.utcnow(),
        })

        # Cancel existing timer
        if conversation_id in self.timers:
            self.timers[conversation_id].cancel()

        # Calculate delay based on message type
        delay = self._calculate_delay(message)

        # Set new timer
        self.timers[conversation_id] = asyncio.create_task(
            self._process_after_delay(conversation_id, delay)
        )

    def _calculate_delay(self, message: str) -> float:
        # Greeting-only messages: longer delay
        greetings = ["oi", "olá", "bom dia", "boa tarde", "boa noite"]
        if message.lower().strip() in greetings:
            return 5.0

        # Short messages: medium delay
        if len(message) < 20:
            return 3.5

        # Standard messages: short delay
        return 2.0

    async def _process_after_delay(self, conversation_id: str, delay: float):
        await asyncio.sleep(delay)

        messages = self.buffers.pop(conversation_id, [])
        del self.timers[conversation_id]

        if messages:
            combined = "\n".join(m["content"] for m in messages)
            await process_with_ai(conversation_id, combined)
```

#### FR-006: Deduplication Logic

```python
async def is_message_processed(message_id: str) -> bool:
    """
    Check if message was already processed.
    Uses Firestore for multi-instance support.
    """
    doc_ref = db.collection("gendei_processed_messages").document(message_id)
    doc = await doc_ref.get()

    if doc.exists:
        return True

    # Mark as processed
    await doc_ref.set({
        "processedAt": firestore.SERVER_TIMESTAMP,
        "expiresAt": datetime.utcnow() + timedelta(hours=24),
    })

    return False
```

#### FR-007: Agent Tools

```python
# Tools available to AI agents
AGENT_TOOLS = [
    {
        "name": "check_availability",
        "description": "Check available time slots for a professional on a date",
        "parameters": {
            "professional_id": "string",
            "date": "string (YYYY-MM-DD)",
        },
    },
    {
        "name": "create_appointment",
        "description": "Create a new appointment",
        "parameters": {
            "patient_name": "string",
            "patient_phone": "string",
            "professional_id": "string",
            "service_id": "string",
            "date": "string",
            "time": "string",
        },
    },
    {
        "name": "update_appointment_status",
        "description": "Update appointment status",
        "parameters": {
            "appointment_id": "string",
            "status": "string",
        },
    },
    {
        "name": "send_booking_flow",
        "description": "Send WhatsApp Flow for booking",
        "parameters": {
            "patient_phone": "string",
            "flow_type": "string (formulario | agendamento)",
        },
    },
    {
        "name": "get_patient_appointments",
        "description": "Get patient's upcoming appointments",
        "parameters": {
            "patient_phone": "string",
        },
    },
    {
        "name": "handoff_to_human",
        "description": "Transfer conversation to human staff",
        "parameters": {
            "reason": "string",
        },
    },
]
```

---

### API Endpoints

```yaml
# AI Processing (Internal)
POST /whatsapp
  Request:
    (WhatsApp webhook payload)
  Response:
    success: boolean

# Flows Data Exchange
POST /flows
  Request:
    (Encrypted flow data)
  Response:
    (Flow response)

# Agent Status (Internal)
GET /health
  Response:
    status: "ok"
    ai_provider: "openai" | "anthropic"
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────┐
│  WhatsApp - Greeting Flow                                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────┐            │
│  │ Oi!                                           │  10:00    │
│  └────────────────────────────────────────────────┘            │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   10:00   │ Olá! 👋                                        │   │
│    🤖     │                                                │   │
│           │ Sou a assistente virtual da Clínica Saúde     │   │
│           │ Total. Como posso ajudar você hoje?           │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  WhatsApp - Scheduling Flow                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────┐            │
│  │ Quero agendar uma consulta de cardiologia     │  10:05    │
│  └────────────────────────────────────────────────┘            │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   10:05   │ Perfeito! Para cardiologia, temos a Dra.      │   │
│    🤖     │ Maria Silva disponível.                        │   │
│           │                                                │   │
│           │ Vou te enviar um formulário para coletarmos   │   │
│           │ seus dados e você escolher o melhor horário.  │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   10:05   │ [📋 Preencher Formulário]                     │   │
│    🤖     │                                                │   │
│           │ ↳ WhatsApp Flow: Formulário de Agendamento    │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
│  (Patient fills WhatsApp Flow)                                 │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   10:08   │ Consulta agendada! ✅                          │   │
│    🤖     │                                                │   │
│           │ 📅 Segunda, 15 de Janeiro de 2024             │   │
│           │ 🕐 14:00 - 14:45                               │   │
│           │ 👩‍⚕️ Dra. Maria Silva                           │   │
│           │ 📍 Av. Paulista, 1000 - São Paulo             │   │
│           │                                                │   │
│           │ Te envio um lembrete 24h antes!               │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  WhatsApp - Reminder Flow                                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   09:00   │ Olá João! 👋                                   │   │
│    🤖     │                                                │   │
│    24h    │ Lembrete: Sua consulta é amanhã!              │   │
│           │                                                │   │
│           │ 📅 Terça, 16 de Janeiro às 14:00              │   │
│           │ 👩‍⚕️ Dra. Maria Silva                           │   │
│           │                                                │   │
│           │ Você confirma sua presença?                    │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────┐            │
│  │ Confirmo!                                      │  09:15    │
│  └────────────────────────────────────────────────┘            │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   09:15   │ Presença confirmada! ✅                        │   │
│    🤖     │                                                │   │
│           │ Te esperamos amanhã às 14:00.                 │   │
│           │ Até lá! 😊                                     │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] Greeting Agent with warm welcome
- [x] Scheduling Agent with booking flow
- [x] Reminder Agent for confirmations
- [x] Triage Agent for complex routing
- [x] OpenAI GPT-4 integration
- [x] Anthropic Claude integration
- [x] Message buffering (adaptive delays)
- [x] Deduplication (Firestore-based)
- [x] Context preservation across messages
- [x] Multi-clinic routing
- [x] Agent tools for actions
