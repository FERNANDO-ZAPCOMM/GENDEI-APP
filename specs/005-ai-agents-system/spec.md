# Feature Specification: AI Agents System

**Feature Branch**: `005-ai-agents-system`
**Created**: 2026-02-04
**Updated**: 2026-02-16
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Patient Greets and Gets Routed (Priority: P1)

A patient sends a WhatsApp message to the clinic. The Triage agent classifies the intent and routes to the appropriate specialized agent (Greeter, Scheduling, Appointment Manager, Clinic Info, Support).

**Why this priority**: Intent classification and routing is the foundation of the entire agent system.

**Independent Test**: Send "Oi" via WhatsApp → verify the Triage agent routes to the Greeter → verify a welcome message is received.

**Acceptance Scenarios**:

1. **Given** a patient sends "Oi" or "Bom dia", **When** the Triage agent processes it, **Then** the message is routed to the Greeter agent.
2. **Given** a patient sends "Quero agendar uma consulta", **When** the Triage agent processes it, **Then** the message is routed to the Scheduling agent.
3. **Given** a patient sends "Quero cancelar minha consulta", **When** the Triage agent processes it, **Then** the message is routed to the Appointment Manager agent.
4. **Given** a patient asks "Qual o endereço da clínica?", **When** the Triage agent processes it, **Then** the message is routed to the Clinic Info agent.
5. **Given** an ambiguous message, **When** confidence is low, **Then** the Triage asks a clarifying question before routing.

---

### User Story 2 - Patient Books an Appointment (Priority: P1)

A patient goes through the full scheduling flow: selecting a service, optionally a professional, a date, and a time slot, resulting in a confirmed appointment.

**Why this priority**: Appointment booking is the core business value of the system.

**Independent Test**: Send scheduling intent → select service → select date → select time → verify appointment created in Firestore.

**Acceptance Scenarios**:

1. **Given** a patient wants to schedule, **When** the Scheduling agent engages, **Then** it presents available services as WhatsApp buttons.
2. **Given** a service is selected, **When** the patient picks a professional (or accepts "any"), **Then** the agent checks availability using the `check_availability` tool.
3. **Given** available time slots, **When** the patient selects a slot, **Then** the agent creates the appointment using the `create_appointment` tool.
4. **Given** an appointment is created, **When** the booking is complete, **Then** the patient receives a confirmation message with date, time, professional, and service details.
5. **Given** no availability on the requested date, **When** the agent checks, **Then** it suggests alternative dates.

---

### User Story 3 - Patient Responds to Reminder (Priority: P2)

A patient who received an appointment reminder responds to confirm or cancel their attendance.

**Why this priority**: Reminder responses directly affect no-show rates — a key business metric.

**Independent Test**: Receive reminder → reply "Confirmo" → verify appointment status changes to "confirmed".

**Acceptance Scenarios**:

1. **Given** a patient received a 24h reminder, **When** they reply "Confirmo" or click the confirm button, **Then** the appointment status is updated to `confirmed` via the `confirm_appointment` tool.
2. **Given** a patient wants to cancel, **When** they reply "Cancelar", **Then** the `cancel_appointment` tool is called and the patient receives a cancellation confirmation.
3. **Given** a patient wants to reschedule, **When** they reply "Remarcar", **Then** the conversation is handed off to the Scheduling agent.

---

### User Story 4 - Conversation Context Persistence (Priority: P2)

The agent maintains conversation context across multiple messages, so the patient doesn't have to repeat information.

**Why this priority**: Stateless conversations create a poor user experience.

**Independent Test**: Start a scheduling flow → send a second message continuing the flow → verify the agent remembers the prior context.

**Acceptance Scenarios**:

1. **Given** a patient is mid-booking with the Scheduling agent, **When** they send a follow-up message, **Then** the agent remembers the selected service and professional.
2. **Given** a conversation is idle for 30+ minutes, **When** the patient sends a new message, **Then** the context is still available but the agent may ask for re-confirmation.
3. **Given** rapid sequential messages (2-5 second gap), **When** the buffer window elapses, **Then** all messages are combined and processed as one.

---

### User Story 5 - Human Takeover (Priority: P3)

When the agent cannot handle a request (complaint, complex query, technical issue), it transfers the conversation to a human staff member.

**Why this priority**: Safety net for edge cases the AI cannot resolve.

**Independent Test**: Send a complaint message → verify the agent triggers human takeover → verify the conversation is marked for human attention in the dashboard.

**Acceptance Scenarios**:

1. **Given** a patient sends a complaint or the agent is unsure, **When** the `enable_human_takeover` tool is called, **Then** the conversation is marked as `isHumanTakeover: true` in Firestore.
2. **Given** a human takeover is triggered, **When** a staff member opens the conversation in the dashboard, **Then** they see the full chat history and can respond directly.
3. **Given** a taken-over conversation, **When** the staff member resolves it, **Then** the conversation can be returned to AI mode.

---

### Edge Cases

- What happens when OpenAI API is down? (Fallback message: "Estamos com dificuldades tecnicas, tente novamente em alguns minutos")
- What if a patient sends an audio message? (Transcribe with Whisper, then process as text)
- What if the agent reveals it's AI? (Output guardrail blocks terms like "GPT", "OpenAI", "bot", "IA")
- What if a patient sends a message in English? (Agent responds in Portuguese, the clinic's language)
- What if two messages arrive simultaneously? (Message deduplication via Firestore `processed_messages`)

## Architecture

### Agent Roster

| Agent | Model | Purpose |
|-------|-------|---------|
| Triage | gpt-4o-mini | Intent classification and routing to specialized agents |
| Greeter | gpt-4o-mini | Welcome messages and initial patient engagement |
| Clinic Info | gpt-4o-mini | Answers questions about the clinic (address, hours, services) |
| Scheduling | gpt-4o | Full appointment booking flow with availability checking |
| Appointment Manager | gpt-4o | Manage existing appointments (confirm, cancel, reschedule) |
| Support | gpt-4o-mini | General support and escalation to human staff |

### Deployment

- **Runtime**: Python FastAPI on Google Cloud Run (`apps/whatsapp-agent`)
- **SDK**: OpenAI Agents SDK with native handoff mechanism
- **Context Storage**: Conversation history stored in `chat_history` single document per conversation in Firestore

### Vertical Terminology

The system uses vertical-specific terminology in all agent prompts:

| Vertical | Appointment Term | Client Term | Professional Term |
|----------|-----------------|-------------|-------------------|
| med | consulta | paciente | médico(a) |
| dental | consulta | paciente | dentista |
| psi | sessão | cliente/paciente | psicólogo(a) |
| nutri | consulta | paciente | nutricionista |
| fisio | sessão | paciente | fisioterapeuta |

## Requirements

### Functional Requirements

- **FR-001**: System MUST implement a Triage agent that classifies intent with > 90% accuracy
- **FR-002**: System MUST implement 6 specialized agents: Triage, Greeter, Clinic Info, Scheduling, Appointment Manager, Support
- **FR-003**: System MUST support agent handoffs using OpenAI Agents SDK handoff mechanism
- **FR-004**: System MUST implement function tools: `send_text_message`, `send_whatsapp_buttons`, `check_availability`, `create_appointment`, `confirm_appointment`, `cancel_appointment`, `enable_human_takeover`
- **FR-005**: System MUST buffer rapid sequential messages (2-5 second window) before processing
- **FR-006**: System MUST persist conversation context in Firestore `chat_history` document (last 50 messages)
- **FR-007**: System MUST support human takeover with full chat history visibility
- **FR-008**: System MUST implement input guardrail blocking prompt injection attempts
- **FR-009**: System MUST implement output guardrail blocking AI disclosure terms ("GPT", "OpenAI", "bot", "IA", "inteligencia artificial")
- **FR-010**: System MUST transcribe audio messages using Whisper before processing
- **FR-011**: System MUST use vertical-aware terminology in all prompts (`{appointment_term}`, `{client_term}`, `{professional_term}`)
- **FR-012**: System MUST prevent duplicate message processing via Firestore-based idempotency

### Key Entities

- **ConversationContext**: Clinic ID, user phone, patient ID, message history, current agent, agent state, human takeover flag
- **IncomingMessage**: ID, phone, timestamp, type (text/image/audio/interactive), content
- **OutgoingMessage**: Recipient phone, type, text content, buttons
- **SchedulingAgentState**: Current step, selected service/professional/date/time, available slots

## Success Criteria

### Measurable Outcomes

- **SC-001**: Agent response time < 3 seconds
- **SC-002**: Intent classification accuracy > 90%
- **SC-003**: Appointment completion rate > 70% (of patients who start scheduling)
- **SC-004**: Human takeover rate < 10%
- **SC-005**: Zero AI identity disclosure in production (guardrails block 100%)
