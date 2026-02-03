# Plan: AI Agents System

**Feature**: 005-ai-agents-system
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement a multi-agent AI system using OpenAI Agents SDK that handles WhatsApp conversations for appointment scheduling. The system uses specialized agents (greeting, scheduling, reminder, triage) with a triage router that directs conversations to the appropriate agent.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Runtime | Python 3.11+, FastAPI, Uvicorn |
| AI Framework | OpenAI Agents SDK |
| AI Providers | OpenAI GPT-4o-mini (default), Anthropic Claude (optional) |
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

### Phase 2: Triage Agent
**Duration**: Core feature

**Tasks**:
- [ ] Define triage agent prompt
- [ ] Implement intent classification
- [ ] Create agent routing logic
- [ ] Handle conversation context
- [ ] Build handoff mechanism

**Files**:
- `apps/agent/src/agents/triage_agent.py`
- `apps/agent/src/agents/prompts.py`

**Intent Categories**:
- `greeting` → Greeting Agent
- `scheduling` → Scheduling Agent
- `confirmation` → Reminder Agent
- `other` → Human takeover

**Acceptance Criteria**:
- Triage correctly classifies intents
- Routes to appropriate agent
- Handles ambiguous messages

---

### Phase 3: Greeting Agent
**Duration**: Core feature

**Tasks**:
- [ ] Define greeting agent prompt
- [ ] Handle common greetings
- [ ] Provide clinic information
- [ ] Transfer to scheduling when needed
- [ ] Keep responses brief

**Files**:
- `apps/agent/src/agents/greeting_agent.py`

**Acceptance Criteria**:
- Responds naturally to greetings
- Provides helpful clinic info
- Quick response time (< 1s)

---

### Phase 4: Scheduling Agent
**Duration**: Core feature

**Tasks**:
- [ ] Define scheduling agent prompt
- [ ] Implement availability checking tool
- [ ] Create appointment creation tool
- [ ] Build service/professional selection flow
- [ ] Handle date/time parsing
- [ ] Generate confirmation messages

**Files**:
- `apps/agent/src/agents/scheduling_agent.py`
- `apps/agent/src/agents/tools/availability.py`
- `apps/agent/src/agents/tools/appointments.py`

**Agent Tools**:
- `check_availability` - Check open slots
- `create_appointment` - Book appointment
- `send_appointment_confirmation` - Send WhatsApp confirmation

**Acceptance Criteria**:
- Natural conversation flow
- Accurate availability checking
- Appointments created correctly

---

### Phase 5: Reminder Agent
**Duration**: Core feature

**Tasks**:
- [ ] Define reminder agent prompt
- [ ] Implement confirmation handling
- [ ] Create cancellation tool
- [ ] Handle reschedule requests
- [ ] Update appointment status

**Files**:
- `apps/agent/src/agents/reminder_agent.py`
- `apps/agent/src/agents/tools/confirmation.py`

**Agent Tools**:
- `confirm_appointment` - Confirm attendance
- `cancel_appointment` - Cancel booking
- `reschedule_appointment` - Request reschedule

**Acceptance Criteria**:
- Processes confirmation responses
- Updates appointment status
- Handles edge cases

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

### Phase 9: Provider Abstraction
**Duration**: Enhancement

**Tasks**:
- [ ] Create provider interface
- [ ] Implement OpenAI provider
- [ ] Implement Anthropic provider
- [ ] Add provider switching logic
- [ ] Per-clinic provider config

**Files**:
- `apps/agent/src/providers/base.py`
- `apps/agent/src/providers/openai/`
- `apps/agent/src/providers/anthropic/`

**Acceptance Criteria**:
- Providers are swappable
- Same tools work with both
- Config per clinic

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
                    │  Triage         │
                    │  Agent          │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
  ┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐
  │   Greeting    │  │  Scheduling   │  │   Reminder    │
  │   Agent       │  │  Agent        │  │   Agent       │
  └───────────────┘  └───────────────┘  └───────────────┘
```

---

## Agent Prompts

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
