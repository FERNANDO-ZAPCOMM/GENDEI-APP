# Gendei WhatsApp Agent - Claude Agent SDK

Healthcare appointment scheduling via WhatsApp using Claude AI and the Claude Agent SDK.

## Overview

This is a migration of the Gendei WhatsApp Agent from OpenAI Agents SDK to Claude Agent SDK, providing:

- **Multi-agent architecture** with specialized subagents for different tasks
- **Custom tools** for clinic operations (scheduling, messaging, etc.)
- **WhatsApp Cloud API integration** for patient communication
- **Firestore database** for persistent storage
- **Message buffering** to combine rapid sequential messages

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp Cloud API                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Webhook Handler                    │
│                    (Message Buffering)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Claude Agent SDK                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Main Scheduling Agent                   │    │
│  │            (Triage + Orchestration)                  │    │
│  └─────────────────────────────────────────────────────┘    │
│       │              │              │              │         │
│       ▼              ▼              ▼              ▼         │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐      │
│  │ Clinic  │   │Schedule │   │Appoint- │   │ Support │      │
│  │  Info   │   │  Agent  │   │  ment   │   │  Agent  │      │
│  │ Agent   │   │         │   │ Manager │   │         │      │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gendei MCP Tools                          │
│  - send_text_message      - get_available_slots              │
│  - get_clinic_info        - create_appointment               │
│  - get_professionals      - cancel_appointment               │
│  - get_services           - reschedule_appointment           │
│  - get_patient_appointments                                  │
│  - enable_human_takeover                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google Cloud Firestore                     │
│              (Clinics, Appointments, Patients)               │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Prerequisites

- Python 3.11+
- Claude Code CLI installed
- Google Cloud credentials
- Meta WhatsApp Business API access

### 2. Installation

```bash
# Clone the repository
cd apps/whatsapp-agent-claude

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt
```

### 3. Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
META_BISU_ACCESS_TOKEN=...
GOOGLE_CLOUD_PROJECT=gendei-prod

# Optional
META_WEBHOOK_VERIFY_TOKEN=gendei_verify_token
GENDEI_DOMAIN=https://gendei.com
```

### 4. Running Locally

```bash
# Development mode
python -m uvicorn src.main:app --reload --port 8080

# Or using the main module
python -m src.main
```

### 5. Testing

Test the agent with a sample message:

```bash
curl -X POST http://localhost:8080/test \
  -H "Content-Type: application/json" \
  -d '{
    "clinic_id": "your-clinic-id",
    "phone": "+5511999999999",
    "message": "Olá, gostaria de agendar uma consulta"
  }'
```

## Deployment

### Docker

```bash
# Build
docker build -t gendei-whatsapp-agent-claude .

# Run
docker run -p 8080:8080 \
  -e ANTHROPIC_API_KEY=... \
  -e META_BISU_ACCESS_TOKEN=... \
  gendei-whatsapp-agent-claude
```

### Google Cloud Run

```bash
# Deploy
gcloud run deploy gendei-whatsapp-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "ANTHROPIC_API_KEY=...,META_BISU_ACCESS_TOKEN=..."
```

## Custom Tools

The agent uses custom MCP tools defined in `src/agents/tools.py`:

| Tool | Description |
|------|-------------|
| `send_text_message` | Send WhatsApp message to patient |
| `get_clinic_info` | Get clinic details (address, hours, etc.) |
| `get_professionals` | List clinic professionals |
| `get_services` | List available services |
| `get_available_slots` | Get appointment availability |
| `create_appointment` | Book a new appointment |
| `send_appointment_confirmation` | Send confirmation message |
| `get_patient_appointments` | List patient's appointments |
| `cancel_appointment` | Cancel an appointment |
| `reschedule_appointment` | Reschedule an appointment |
| `enable_human_takeover` | Transfer to human agent |

## Subagents

The system uses specialized subagents for different tasks:

| Agent | Purpose | Model |
|-------|---------|-------|
| `clinic-info` | Answer clinic questions | Haiku (fast) |
| `scheduling` | Book appointments | Sonnet (capable) |
| `appointment-manager` | Manage existing appointments | Haiku (fast) |
| `support` | Handle complaints, escalate | Haiku (fast) |

## Key Differences from OpenAI Version

1. **SDK**: Uses `claude-agent-sdk` instead of `openai-agents`
2. **Tools**: Uses `@tool` decorator with MCP server pattern
3. **Subagents**: Uses `AgentDefinition` with `agents` parameter
4. **Streaming**: Uses async generators for streaming input
5. **Model Selection**: Haiku for fast tasks, Sonnet for complex reasoning

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/health` | GET | Health check |
| `/whatsapp` | GET | Webhook verification |
| `/whatsapp` | POST | Incoming message handler |
| `/test` | POST | Development testing |

## License

Proprietary - Gendei
