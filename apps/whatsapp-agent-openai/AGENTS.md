# Gendei WhatsApp Agent - OpenAI Agents SDK

## Project Overview
This is the Gendei WhatsApp Agent service built with the OpenAI Agents SDK. It provides AI-powered appointment scheduling for healthcare clinics via WhatsApp Business API.

## Architecture

### Core Components
- **FastAPI Application** (`src/main.py`): HTTP server handling WhatsApp webhooks
- **OpenAI Agents SDK**: Powers the AI conversation with specialized agents
- **Function Tools**: Custom tools decorated with `@function_tool` for clinic operations
- **Firestore Database**: Patient data, appointments, clinic configuration

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
3. Triage agent routes to appropriate specialized agent
4. Agent uses tools to execute actions (book, cancel, etc.)
5. Response sent back to patient via WhatsApp

## Working Agreements

### Code Standards
- All prompts must be in Brazilian Portuguese (pt-BR)
- Use `@function_tool` decorator for all agent tools
- Tools must be async functions
- Always validate phone numbers with `ensure_phone_has_plus()`

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
- Never reveal: "GPT", "OpenAI", "bot", "IA", "inteligência artificial"

## Key Files
| File | Purpose |
|------|---------|
| `src/main.py` | FastAPI app with webhook handlers |
| `src/agents/openai_factory.py` | OpenAI agent definitions |
| `src/agents/function_tools.py` | Tool implementations |
| `src/agents/prompts.py` | System prompts (pt-BR) |
| `src/agents/orchestrator.py` | Agent routing and execution |
| `src/agents/guardrails.py` | Input/output validation |

## Environment Variables
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
GOOGLE_CLOUD_PROJECT=gendei-prod
META_BISU_ACCESS_TOKEN=...
META_WEBHOOK_VERIFY_TOKEN=gendei_verify_token
```

## Development Commands
```bash
# Run locally
python -m uvicorn src.main:app --reload --port 8080

# Deploy to Cloud Run
./deploy.sh

# Run tests
pytest tests/
```

## Multi-Tenant Architecture
Each clinic has its own:
- WhatsApp Business phone number
- Access token (stored in Firestore)
- Professionals, services, and availability
- Appointment data

Clinic lookup via `phone_number_id` from webhook metadata.

## Important Behaviors
1. **Message Buffering**: Wait 2-5 seconds to combine rapid messages
2. **Human Takeover**: Agent can transfer to human when needed
3. **Duplicate Prevention**: Messages tracked to avoid reprocessing
4. **Context Preservation**: Clinic context loaded for each conversation
5. **Agent Handoffs**: OpenAI SDK handles seamless agent transitions
