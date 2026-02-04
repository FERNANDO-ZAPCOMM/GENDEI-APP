# Gendei WhatsApp Agent - Claude SDK

## Project Overview
This is the Gendei WhatsApp Agent service built with the Claude Agent SDK. It provides AI-powered appointment scheduling for healthcare clinics via WhatsApp Business API.

## Architecture

### Core Components
- **FastAPI Application** (`src/main.py`): HTTP server handling WhatsApp webhooks
- **Claude Agent SDK**: Powers the AI conversation and tool orchestration
- **MCP Tools Server**: Custom tools for clinic operations (`src/agents/tools.py`)
- **Firestore Database**: Patient data, appointments, clinic configuration

### Message Flow
1. WhatsApp webhook receives patient message
2. Message buffering combines rapid sequential messages
3. Claude Agent processes with clinic context
4. Tools execute actions (book appointments, send messages, etc.)
5. Response sent back to patient via WhatsApp

## Key Files
- `src/main.py` - FastAPI app with Claude Agent integration
- `src/agents/tools.py` - MCP tools for clinic operations
- `src/agents/subagents.py` - Specialized agent definitions
- `src/agents/prompts.py` - System prompts by agent type
- `src/database/firestore.py` - Firestore database operations
- `src/services/appointments.py` - Appointment business logic
- `src/services/availability.py` - Availability checking

## Available Tools
| Tool | Purpose |
|------|---------|
| `send_text_message` | Send WhatsApp message to patient |
| `get_clinic_info` | Get clinic details |
| `get_professionals` | List clinic professionals |
| `get_services` | List services with pricing |
| `get_available_slots` | Check appointment availability |
| `create_appointment` | Book new appointment |
| `send_appointment_confirmation` | Send booking confirmation |
| `get_patient_appointments` | List patient's appointments |
| `cancel_appointment` | Cancel an appointment |
| `reschedule_appointment` | Change appointment time |
| `enable_human_takeover` | Transfer to human agent |

## Language & Locale
- Primary language: Brazilian Portuguese (pt-BR)
- Currency: Brazilian Real (R$)
- Date format: DD/MM/YYYY
- Time format: HH:MM (24-hour)

## Environment Variables
- `ANTHROPIC_API_KEY` - Claude API key
- `META_BISU_ACCESS_TOKEN` - WhatsApp Business API token
- `META_WEBHOOK_VERIFY_TOKEN` - Webhook verification token
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `GENDEI_DOMAIN` - Service domain URL

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
- Professionals, services, and availability configuration
- Appointment data

Clinic lookup happens via `phone_number_id` from webhook metadata.

## Important Behaviors
1. **Message Buffering**: Wait 2-5 seconds to combine rapid messages
2. **Human Takeover**: AI can transfer to human when needed
3. **Duplicate Prevention**: Messages tracked to avoid reprocessing
4. **Context Preservation**: Clinic context loaded for each conversation
