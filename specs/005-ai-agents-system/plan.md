# Plan: AI Agents System

**Feature**: 005-ai-agents-system
**Status**: Implemented
**Date**: 2026-02-04

---

## Overview

Implement a multi-agent AI system using OpenAI Agents SDK that handles WhatsApp conversations for appointment scheduling. The system uses specialized agents (GREETER, SALES_CLOSER, PAYMENT, PRODUCT_INFO, SUPPORT, TRIAGE) with a deterministic keyword-based orchestrator that routes conversations to the appropriate agent, falling back to TRIAGE for complex/ambiguous messages.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Runtime | Python 3.11+, FastAPI, Uvicorn |
| AI Framework | OpenAI Agents SDK |
| AI Providers | OpenAI gpt-4.1 (complex tasks), gpt-4.1-mini (fast/simple tasks) |
| Database | Firestore (firebase-admin) |
| Deployment | Google Cloud Run (Docker) |
| Messaging | Meta WhatsApp Business API |

---

## Implementation Phases

### Phase 1: Agent Framework Setup
**Duration**: Foundation

**Tasks**:
- [ ] Set up Python project structure
- [ ] Install OpenAI Agents SDK
- [ ] Configure environment variables
- [ ] Set up Firestore connection
- [ ] Create base agent classes

**Files**:
- `apps/agent/requirements.txt`
- `apps/agent/src/config.py`
- `apps/agent/src/lib/firestore.py`
- `apps/agent/src/agents/__init__.py`

**Acceptance Criteria**:
- Project runs locally with FastAPI
- Firestore connection works
- OpenAI API connected

---

### Phase 2: Orchestrator & Routing Logic
**Duration**: Core feature

**Description**: Routing is now deterministic keyword-based, with the TRIAGE agent as a fallback for complex/ambiguous messages. The orchestrator checks message content against keyword patterns before invoking any LLM call.

**Tasks**:
- [x] Implement keyword-based routing in orchestrator
- [x] Define keyword patterns per agent
- [x] Configure TRIAGE agent as fallback for unmatched messages
- [x] Handle conversation context and agent handoff

**Files**:
- `apps/whatsapp-agent-openai/src/orchestrator.py`
- `apps/whatsapp-agent-openai/src/agents/triage_agent.py`
- `apps/whatsapp-agent-openai/src/agents/prompts.py`

**Keyword Routing Rules**:
- Greetings ("oi", "ola", "bom dia") → GREETER
- Scheduling keywords ("agendar", "marcar", "consulta", "horarios") → SALES_CLOSER
- Info keywords ("onde fica", "endereco", "convenio") → PRODUCT_INFO
- Appointment management ("minha consulta", "cancelar", "remarcar") → PAYMENT
- Support ("ajuda", "problema", "humano") → SUPPORT
- Complex/ambiguous messages → TRIAGE (LLM-based classification)

**Acceptance Criteria**:
- Keyword routing resolves >70% of messages without LLM call
- TRIAGE fallback correctly classifies remaining intents
- Routes to appropriate agent
- Handles ambiguous messages gracefully

---

### Phase 3: GREETER Agent
**Duration**: Core feature

**Tasks**:
- [x] Define GREETER agent prompt
- [x] Handle common greetings
- [x] Provide clinic information
- [x] Transfer to scheduling when needed
- [x] Keep responses brief

**Files**:
- `apps/whatsapp-agent-openai/src/agents/greeter_agent.py`

**Acceptance Criteria**:
- GREETER responds naturally to greetings
- Provides helpful clinic info
- Quick response time (< 1s)

---

### Phase 4: SALES_CLOSER Agent
**Duration**: Core feature

**Description**: The SALES_CLOSER agent handles the full booking flow -- from service selection through professional preference, date/time picking, to appointment confirmation.

**Tasks**:
- [x] Define SALES_CLOSER agent prompt
- [x] Implement availability checking tool
- [x] Create appointment creation tool
- [x] Build service/professional selection flow
- [x] Handle date/time parsing
- [x] Generate confirmation messages

**Files**:
- `apps/whatsapp-agent-openai/src/agents/sales_closer_agent.py`
- `apps/whatsapp-agent-openai/src/agents/tools/availability.py`
- `apps/whatsapp-agent-openai/src/agents/tools/appointments.py`

**Agent Tools**:
- `get_services` - List available services
- `get_professionals` - List professionals
- `get_available_slots` - Check open slots
- `create_appointment` - Book appointment
- `send_appointment_confirmation` - Send WhatsApp confirmation

**Acceptance Criteria**:
- Natural conversation flow for full booking
- Accurate availability checking
- Appointments created correctly

---

### Phase 5: PAYMENT Agent (Appointment Manager)
**Duration**: Core feature

**Description**: The PAYMENT agent handles viewing, cancelling, and rescheduling existing appointments (not just reminders). It manages all post-booking appointment interactions.

**Tasks**:
- [x] Define PAYMENT agent prompt
- [x] Implement appointment lookup tool
- [x] Create cancellation tool
- [x] Create reschedule tool
- [x] Handle reschedule requests
- [x] Update appointment status

**Files**:
- `apps/whatsapp-agent-openai/src/agents/payment_agent.py`
- `apps/whatsapp-agent-openai/src/agents/tools/appointments.py`

**Agent Tools**:
- `get_patient_appointments` - View patient's existing appointments
- `cancel_appointment` - Cancel booking
- `reschedule_appointment` - Reschedule appointment
- `send_text_message` - Send WhatsApp text message

**Acceptance Criteria**:
- Retrieves and displays patient appointments
- Processes cancellation requests
- Handles reschedule flows
- Updates appointment status correctly

---

### Phase 5B: PRODUCT_INFO Agent
**Duration**: Core feature

**Description**: Handles clinic information questions: address, hours, services offered, pricing, and insurance/convenio acceptance.

**Tasks**:
- [x] Define PRODUCT_INFO agent prompt
- [x] Implement clinic info retrieval tools
- [x] Handle common questions about location, hours, services

**Files**:
- `apps/whatsapp-agent-openai/src/agents/product_info_agent.py`

**Agent Tools**:
- `get_clinic_info` - Fetch clinic details (name, address, hours, services)
- `get_services` - List services for a clinic
- `get_professionals` - List professionals for a clinic

**Acceptance Criteria**:
- Answers clinic info questions accurately
- Provides address, hours, and service details
- Handles convenio/insurance queries

---

### Phase 5C: SUPPORT Agent
**Duration**: Core feature

**Description**: Handles escalation to human staff, complaints, and complex issues that other agents cannot resolve.

**Tasks**:
- [x] Define SUPPORT agent prompt
- [x] Implement human takeover tool
- [x] Handle complaint and escalation flows

**Files**:
- `apps/whatsapp-agent-openai/src/agents/support_agent.py`

**Agent Tools**:
- `enable_human_takeover` - Escalate conversation to human staff
- `send_text_message` - Send WhatsApp text message

**Acceptance Criteria**:
- Escalates to human staff when needed
- Handles complaints professionally
- Provides clear handoff messaging

---

### Phase 6: Tool Definitions
**Duration**: Core feature

**Tasks**:
- [ ] Create base tool interface
- [ ] Implement send_text_message tool
- [ ] Implement send_buttons tool
- [ ] Create human_takeover tool
- [ ] Add tool error handling

**Files**:
- `apps/agent/src/agents/tools/__init__.py`
- `apps/agent/src/agents/tools/messaging.py`
- `apps/agent/src/agents/tools/handoff.py`

**Acceptance Criteria**:
- Tools execute correctly
- Error handling works
- Messages send to WhatsApp

---

### Phase 7: Message Buffer
**Duration**: Enhancement

**Tasks**:
- [ ] Implement message buffering
- [ ] Set 5-second buffer window
- [ ] Combine multi-message bursts
- [ ] Handle typing indicators
- [ ] Process buffer on timeout

**Files**:
- `apps/agent/src/services/buffer.py`

**Acceptance Criteria**:
- Messages buffer correctly
- Buffer flushes after 5 seconds
- Combined messages processed once

---

### Phase 8: Conversation Context
**Duration**: Enhancement

**Tasks**:
- [ ] Store conversation history in Firestore
- [ ] Load context for agent
- [ ] Manage context window size
- [ ] Track conversation state
- [ ] Handle session expiry

**Files**:
- `apps/agent/src/services/context.py`
- `apps/agent/src/runtime/context.py`

**Acceptance Criteria**:
- Context persists across messages
- Agent has conversation history
- Context doesn't grow indefinitely

---

### Phase 9: Provider Configuration
**Duration**: Enhancement

**Tasks**:
- [ ] Create provider configuration per clinic
- [ ] Implement OpenAI model selection (gpt-4.1 vs gpt-4.1-mini)
- [ ] Add per-agent model configuration
- [ ] Per-clinic provider config

**Files**:
- `apps/whatsapp-agent-openai/src/config.py`
- `apps/whatsapp-agent-openai/src/agents/`

**Acceptance Criteria**:
- Model selection works per agent
- Config per clinic
- Easy to switch between gpt-4.1 and gpt-4.1-mini per agent

---

### Phase 10: Deployment
**Duration**: Infrastructure

**Tasks**:
- [ ] Create Dockerfile
- [ ] Configure Cloud Run
- [ ] Set up environment secrets
- [ ] Configure autoscaling
- [ ] Set up monitoring

**Files**:
- `apps/agent/Dockerfile`
- `apps/agent/deploy.sh`
- `cloudbuild.yaml`

**Acceptance Criteria**:
- Deploys to Cloud Run
- Auto-scales with load
- Health checks pass

---

## Agent Architecture

```
                    ┌─────────────────┐
                    │  WhatsApp       │
                    │  Webhook        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Message        │
                    │  Buffer         │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Orchestrator   │
                    │  (keyword       │
                    │   routing)      │
                    └────────┬────────┘
                             │
     ┌───────────┬───────────┼───────────┬───────────┬───────────┐
     │           │           │           │           │           │
┌────▼────┐ ┌───▼─────┐ ┌───▼─────┐ ┌───▼─────┐ ┌───▼─────┐ ┌─▼───────┐
│ GREETER │ │PRODUCT_ │ │ SALES_  │ │ PAYMENT │ │ SUPPORT │ │ TRIAGE  │
│         │ │INFO     │ │ CLOSER  │ │         │ │         │ │(fallback│
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

---

## Agent Prompts

> **Note**: All agent prompts use `{placeholder}` variables for vertical-aware terminology (e.g., `{appointment_term}`, `{client_term}`, `{professional_term}`) from `vertical_config.py`.

### Triage Agent
```
You are a triage agent for a healthcare clinic's WhatsApp bot.
Your job is to classify the user's intent and route to the appropriate agent.

Intents:
- greeting: Simple greetings like "oi", "olá", "bom dia"
- scheduling: Wants to book, reschedule, or check availability
- confirmation: Responding to appointment reminder
- other: Unclear or needs human help

Respond with JSON: {"intent": "...", "confidence": 0.0-1.0}
```

### Scheduling Agent
```
You are a scheduling assistant for {clinic_name}.
Help patients book appointments with our professionals.

Available services: {services}
Available professionals: {professionals}
Clinic hours: {operating_hours}

Guide the patient through:
1. Service selection
2. Professional preference (optional)
3. Date and time selection
4. Confirmation

Use tools to check availability and create appointments.
Be friendly and professional. Use Portuguese (Brazil).
```

---

## Data Model

### Conversation Context (Firestore)

```python
@dataclass
class ConversationContext:
    clinic_id: str
    user_phone: str
    messages: List[Message]
    current_agent: str
    state: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
```

---

## Runtime Context

The `Runtime` dataclass is injected into every agent via `RunContextWrapper[Runtime]`. It provides shared dependencies and metadata for all tool calls and agent logic.

```python
@dataclass
class Runtime:
    clinic_id: str
    db: GendeiDatabase
    phone_number_id: Optional[str] = None
    access_token: Optional[str] = None
    vertical_slug: Optional[str] = None
```

---

## Security Considerations

1. **API Keys**: Stored in Secret Manager
2. **Message Logging**: Sanitize PII before logging
3. **Tool Permissions**: Agents only access their tools
4. **Rate Limiting**: Per-clinic limits
5. **Human Takeover**: Safety net for sensitive topics

---

## Success Metrics

- Agent response time < 3 seconds
- Intent classification accuracy > 90%
- Appointment completion rate > 70%
- Human takeover rate < 10%
