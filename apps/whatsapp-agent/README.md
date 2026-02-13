# WhatsApp Agent Service

Multi-clinic WhatsApp AI agent for healthcare appointment scheduling, built with OpenAI Agents SDK and integrated with the Firebase Functions backend via shared Firestore.

> pt-BR is the canonical product language. This README is in English for developer convenience.

## Architecture

This Python microservice handles:
- WhatsApp webhook processing (Meta Cloud API)
- OpenAI Agents SDK (multi-agent orchestration with handoffs)
- Message routing and conversation management
- Appointment scheduling, rescheduling, and cancellation
- Audio transcription (whisper)
- Vertical-aware terminology (per-clinic specialty customization)
- WhatsApp Flows (structured data collection)

The Firebase Functions backend handles:
- User authentication and authorization
- Clinic management and onboarding
- Professional/service CRUD operations
- Dashboard and analytics
- Automated reminders (24h/2h)
- Embedded WhatsApp signup flow

Both services share a single Firestore database.

## Vertical SaaS System

Each clinic belongs to a **vertical** (med, dental, psi, nutri, fisio) that determines how the agent communicates:

| Vertical | Appointment Term | Client Term | Professional Term | Council |
|----------|-----------------|-------------|-------------------|---------|
| `med` | consulta | paciente | medico(a) | CRM |
| `dental` | consulta | paciente | dentista | CRO |
| `psi` | sessao | cliente | psicologo(a) | CRP |
| `nutri` | consulta | cliente | nutricionista | CRN |
| `fisio` | sessao | paciente | fisioterapeuta | CREFITO |

Configuration: `src/vertical_config.py` — defines terminology, feature flags, and specialty mappings per vertical.

Agent prompts use `{placeholders}` that are filled with vertical-specific terms at runtime.

## Quick Start

### Prerequisites

- Python 3.11+
- Google Cloud project with Firestore enabled
- WhatsApp Business Cloud API credentials
- OpenAI API key

### Local Development

1. **Install dependencies**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run the service**:
   ```bash
   python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8080 --reload
   ```

4. **Expose webhook** (for local testing):
   ```bash
   ngrok http 8080
   # Update DOMAIN in .env to your ngrok URL
   ```

### Cloud Run Deployment

1. **Build and deploy**:
   ```bash
   ./deploy.sh
   ```

   Deploy tuning (via env vars used by `deploy.sh`):
   - `CLOUD_RUN_MIN_INSTANCES` (recommended `1` for low latency)
   - `CLOUD_RUN_CONCURRENCY` (recommended `2` initially)
   - `CLOUD_RUN_MAX_INSTANCES` (e.g. `20`)
   - `CLOUD_RUN_CPU`, `CLOUD_RUN_MEMORY`, `CLOUD_RUN_TIMEOUT`

   Or manually:
   ```bash
   docker build -t gcr.io/YOUR_PROJECT_ID/whatsapp-agent:latest .
   docker push gcr.io/YOUR_PROJECT_ID/whatsapp-agent:latest

   gcloud run deploy whatsapp-agent \
     --image gcr.io/YOUR_PROJECT_ID/whatsapp-agent:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
   ```

2. **Set environment variables in Cloud Run**:
   - `OPENAI_API_KEY`
   - `WHATSAPP_TOKEN` (fallback; normally resolved per clinic via Firestore)
   - `WHATSAPP_VERIFY_TOKEN`
   - `GOOGLE_CLOUD_PROJECT`
   - `DOMAIN` (your Cloud Run URL)
   - `STORAGE_BUCKET` (optional, for audio transcription)

3. **Configure WhatsApp webhook**:
   - Go to Meta Developer Console
   - Set webhook URL: `https://your-service-url.run.app/whatsapp`
   - Set verify token: same as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to: `messages`, `message_status`

## Firestore Schema

The service reads and writes to these Firestore collections:

```
gendei_clinics/{clinicId}
├── (doc fields)              # name, description, vertical, operatingHours, paymentSettings, etc.
├── professionals/{id}        # Clinic professionals (read by Python)
├── services/{id}             # Clinic services (read by Python)
├── conversations/{id}        # WhatsApp conversations (read/written by Python)
│   └── messages/{id}         # Individual messages
└── availability/{id}         # Availability config

gendei_appointments/{id}      # Appointments (read/written by Python)
├── clinicId, patientId, professionalId, serviceId
├── date, time, duration, status
└── depositAmount, depositPaid

gendei_patients/{id}          # Patients (read/written by Python)
├── clinicIds[], name, phone
└── totalAppointments, lastAppointmentAt

gendei_whatsapp/{id}          # WhatsApp connections (read by Python)
├── clinicId, phoneNumberId, wabaId
└── accessToken
```

## Multi-Clinic Support

The service automatically routes webhooks to the correct clinic based on `phone_number_id`:

1. Webhook arrives with `phone_number_id`
2. Service looks up the WhatsApp connection in Firestore (`gendei_whatsapp`)
3. Loads clinic-specific data (profile, professionals, services, vertical config)
4. Initializes clinic-specific agents with vertical terminology
5. Processes message in clinic context using `RunContextWrapper[Runtime]`

## Agent Types

| Agent | Purpose | Model |
|-------|---------|-------|
| **Triage** | Routes messages to appropriate agent | gpt-4o-mini |
| **Greeter** | Welcome and intent capture | gpt-4o-mini |
| **Clinic Info** | Clinic details, services, professionals | gpt-4o-mini |
| **Scheduling** | Appointment booking workflow | gpt-4o |
| **Appointment Manager** | View/cancel/reschedule appointments | gpt-4o |
| **Support** | Help and human escalation | gpt-4o-mini |

## Message Flow

```
1. WhatsApp webhook receives patient message
2. Message buffering combines rapid sequential messages (2-5 sec)
3. Runtime context loaded (clinic data, vertical config, conversation history)
4. Triage agent classifies intent and handoffs to specialized agent
5. Agent uses @function_tool tools to execute actions
6. Response sent back to patient via WhatsApp Cloud API
```

## API Endpoints

- `POST /whatsapp` - WhatsApp webhook (receives messages)
- `GET /whatsapp` - Webhook verification
- `GET /health` - Health check
- `GET /` - Service info
- `POST /flows` - WhatsApp Flows endpoint (structured data collection)

## Code Layout

```
src/
├── main.py                    # FastAPI app, webhook handlers
├── vertical_config.py         # Per-vertical terminology, features, specialties
├── agents/
│   ├── definitions.py         # Agent definitions using OpenAI Agents SDK
│   ├── function_tools.py      # @function_tool implementations (WhatsApp, scheduling)
│   ├── prompts.py             # System prompts (pt-BR) with {vertical_placeholders}
│   ├── orchestrator.py        # Agent routing and execution via Runner.run()
│   └── guardrails.py          # Input/output validation (prompt injection, AI disclosure)
├── providers/
│   ├── base.py                # Abstract provider interface
│   ├── factory.py             # Provider factory
│   ├── types.py               # Shared types
│   ├── openai/
│   │   ├── factory.py         # OpenAI-specific agent creation
│   │   ├── runner.py          # OpenAI Agents SDK runner
│   │   ├── session.py         # Session management
│   │   └── tools.py           # Tool bridge for OpenAI SDK
│   └── tools/
│       ├── base.py            # Tool base classes
│       └── definitions.py     # Tool definitions
├── runtime/
│   ├── context.py             # Runtime dataclass (clinic, patient, conversation state)
│   └── creator_runtime.py     # Per-clinic runtime/cache loading from Firestore
├── adapters/
│   └── firestore.py           # Firestore data adapters
├── database/
│   └── firestore.py           # Firestore client and queries
├── flows/
│   ├── crypto.py              # WhatsApp Flows encryption/decryption
│   ├── handler.py             # Flow response handlers
│   └── manager.py             # Flow lifecycle management
├── scheduler/
│   ├── appointments.py        # Appointment CRUD operations
│   ├── availability.py        # Availability checking logic
│   ├── models.py              # Scheduler data models
│   └── reminders.py           # Reminder scheduling
├── services/
│   ├── data_service.py        # Data access service layer
│   └── scheduler.py           # Scheduling service
├── utils/
│   ├── helpers.py             # General utilities
│   ├── messaging.py           # WhatsApp message sending
│   ├── payment.py             # PIX payment utilities
│   ├── storage.py             # Cloud Storage utilities
│   └── transcription.py       # Audio transcription (Whisper)
└── workflows/
    ├── contract.py            # Workflow contract enums
    └── executor.py            # Workflow execution engine
```

## Guardrails

- **Input validation**: Blocks prompt injection attempts
- **Output validation**: Blocks AI disclosure terms
- Never reveals: "GPT", "OpenAI", "bot", "IA", "inteligencia artificial"

## Typing Indicator

For text messages, the service marks the message as read and shows the typing indicator using the WhatsApp Cloud API `messages` endpoint with:
- `status: "read"`
- `message_id: "<wamid...>"`
- `typing_indicator: { "type": "text" }`

## Troubleshooting

### Messages not being received

- Check WhatsApp webhook configuration in Meta Developer Console
- Verify `WHATSAPP_VERIFY_TOKEN` matches
- Check Cloud Run logs for errors
- Ensure webhook URL is publicly accessible

### Agent not responding

- Check OpenAI API key is valid
- Check Firestore permissions
- Verify clinic data exists in Firestore (professionals, services, operating hours)
- Check Cloud Run logs for agent errors

### Duplicate replies

In production, WhatsApp webhooks can be retried and Cloud Run can scale to multiple instances. To prevent double-processing:
- Collection: `processed_messages/{messageId}`
- Write pattern: atomic `create()` (first writer wins)
- Escape hatch: set env `FIRESTORE_DEDUP_ENABLED=false` to fall back to in-memory only (not recommended)

### Firestore permission errors

- Ensure service account has Firestore read/write permissions
- Check `GOOGLE_APPLICATION_CREDENTIALS` is set correctly
- Verify `GOOGLE_CLOUD_PROJECT` matches your project

## Development Tips

- Use `LOG_LEVEL=DEBUG` for verbose logging
- Test agents locally before deploying
- Use ngrok for local webhook testing
- Monitor Cloud Run logs in real-time during development
- Use `python3` (not `python`) on macOS

## License

Proprietary - All rights reserved
