# Gendei WhatsApp Agent - OpenAI Agents SDK

## Project Overview
This is the Gendei WhatsApp Agent service built with the OpenAI Agents SDK. It provides AI-powered appointment scheduling for healthcare clinics via WhatsApp Business API.

## Architecture

### Core Components
- **FastAPI Application** (`src/main.py`): HTTP server handling WhatsApp webhooks
- **OpenAI Agents SDK**: Powers the AI conversation with specialized agents and handoffs
- **Function Tools**: Custom tools decorated with `@function_tool` for clinic operations
- **Firestore Database**: Patient data, appointments, clinic configuration
- **Vertical Config** (`src/vertical_config.py`): Per-vertical terminology, features, and specialties

### Agent Types
| Agent | Purpose | Model |
|-------|---------|-------|
| **Triage** | Routes messages to appropriate agent | gpt-4o-mini |
| **Greeter** | Welcome and intent capture | gpt-4o-mini |
| **Clinic Info** | Clinic details, services, professionals | gpt-4o-mini |
| **Scheduling** | Appointment booking workflow | gpt-4o |
| **Appointment Manager** | View/cancel/reschedule appointments | gpt-4o |
| **Support** | Help and human escalation | gpt-4o-mini |

### Message Flow
1. WhatsApp webhook receives patient message
2. Message buffering combines rapid sequential messages
3. Runtime context loaded (clinic data, vertical config, conversation history)
4. Triage agent routes to appropriate specialized agent
5. Agent uses tools to execute actions (book, cancel, etc.)
6. Response sent back to patient via WhatsApp

## Vertical-Aware Terminology

All agent prompts use `{placeholders}` that are filled with vertical-specific terms at runtime. This means the same agent code serves all verticals with correct terminology:

- `{appointment_term}` - "consulta" (med/dental/nutri) or "sessao" (psi/fisio)
- `{client_term}` - "paciente" (med/dental/fisio) or "cliente" (psi/nutri)
- `{professional_term}` - "medico(a)", "dentista", "psicologo(a)", "nutricionista", "fisioterapeuta"
- `{greeting_context}` - "saude", "saude bucal", "saude mental e bem-estar", "nutricao", "fisioterapia e reabilitacao"

Feature flags also vary per vertical (e.g., `has_convenio`, `has_deposit`, `has_telemedicine`).

## Working Agreements

### Code Standards
- All prompts must be in Brazilian Portuguese (pt-BR)
- Use `@function_tool` decorator for all agent tools
- Tools must be async functions
- Always validate phone numbers with `ensure_phone_has_plus()`
- Use `RunContextWrapper[Runtime]` pattern for tool context

### Tool Usage
- `send_text_message` - Plain text responses
- `send_whatsapp_buttons` - Interactive button menus (PREFERRED for choices)
- Use buttons for: greetings, yes/no questions, menu options

### Agent Handoffs
- Agents can only handoff to agents in their `handoffs` list
- Triage can handoff to any agent
- Support agent cannot handoff (terminal)

### Guardrails
- Input validation blocks prompt injection
- Output validation blocks AI disclosure terms
- Never reveal: "GPT", "OpenAI", "bot", "IA", "inteligencia artificial"

## Key Files
| File | Purpose |
|------|---------|
| `src/main.py` | FastAPI app with webhook handlers |
| `src/vertical_config.py` | Per-vertical terminology, features, specialties |
| `src/agents/definitions.py` | Agent definitions using OpenAI Agents SDK |
| `src/agents/function_tools.py` | Tool implementations |
| `src/agents/prompts.py` | System prompts (pt-BR) with {vertical_placeholders} |
| `src/agents/orchestrator.py` | Agent routing and execution via Runner.run() |
| `src/agents/guardrails.py` | Input/output validation |
| `src/runtime/context.py` | Runtime dataclass (clinic, patient, conversation state) |
| `src/providers/openai/factory.py` | OpenAI-specific agent creation |
| `src/providers/openai/runner.py` | OpenAI Agents SDK runner |

## Environment Variables
```
OPENAI_API_KEY=sk-...
GOOGLE_CLOUD_PROJECT=gendei-prod
WHATSAPP_TOKEN=...
WHATSAPP_VERIFY_TOKEN=gendei_verify_token
```

## Development Commands
```bash
# Run locally
python3 -m uvicorn src.main:app --reload --port 8080

# Deploy to Cloud Run
./deploy.sh

# Run tests
pytest tests/
```

## Multi-Tenant Architecture
Each clinic has its own:
- WhatsApp Business phone number
- Access token (stored in Firestore)
- Vertical configuration (terminology, features)
- Professionals, services, and availability
- Appointment data

Clinic lookup via `phone_number_id` from webhook metadata.

## Important Behaviors
1. **Message Buffering**: Wait 2-5 seconds to combine rapid messages
2. **Human Takeover**: Agent can transfer to human when needed
3. **Duplicate Prevention**: Messages tracked to avoid reprocessing
4. **Context Preservation**: Clinic + vertical context loaded for each conversation
5. **Agent Handoffs**: OpenAI SDK handles seamless agent transitions
