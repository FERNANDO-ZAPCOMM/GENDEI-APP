# Quickstart: AI Agents System

**Feature**: 005-ai-agents-system
**Date**: 2026-02-04

---

## Prerequisites

- Python 3.11+
- OpenAI API key
- Firebase project with Firestore
- WhatsApp Business API connected (004)

---

## Project Setup

### 1. Create Project Structure

```bash
apps/agent/
├── src/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── triage_agent.py
│   │   ├── greeting_agent.py
│   │   ├── scheduling_agent.py
│   │   ├── reminder_agent.py
│   │   ├── prompts.py
│   │   └── tools/
│   │       ├── __init__.py
│   │       ├── definitions.py
│   │       ├── availability.py
│   │       ├── appointments.py
│   │       └── messaging.py
│   ├── adapters/
│   │   ├── __init__.py
│   │   ├── whatsapp_parser.py
│   │   └── whatsapp_sender.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── buffer.py
│   │   └── context.py
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── openai/
│   │   └── anthropic/
│   └── lib/
│       ├── __init__.py
│       └── firestore.py
├── requirements.txt
├── Dockerfile
└── deploy.sh
```

### 2. Install Dependencies

```bash
# requirements.txt
fastapi==0.109.0
uvicorn==0.27.0
openai==1.12.0
anthropic==0.18.0
firebase-admin==6.4.0
aiohttp==3.9.3
python-dotenv==1.0.0
pydantic==2.6.0
```

```bash
pip install -r requirements.txt
```

### 3. Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Firebase
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
FIREBASE_PROJECT_ID=gendei-prod

# WhatsApp
META_APP_SECRET=your_app_secret
WEBHOOK_VERIFY_TOKEN=your_verify_token

# Agent
AI_PROVIDER=openai  # or anthropic
DEFAULT_MODEL=gpt-4o-mini
```

---

## Code Implementation

### 1. Configuration

```python
# src/config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

    # AI Provider
    AI_PROVIDER = os.getenv("AI_PROVIDER", "openai")
    DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-4o-mini")

    # Firebase
    FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")

    # WhatsApp
    META_APP_SECRET = os.getenv("META_APP_SECRET")
    WEBHOOK_VERIFY_TOKEN = os.getenv("WEBHOOK_VERIFY_TOKEN")

    # Buffer
    MESSAGE_BUFFER_SECONDS = 5

config = Config()
```

### 2. Firestore Client

```python
# src/lib/firestore.py
import firebase_admin
from firebase_admin import credentials, firestore

def init_firestore():
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    return firestore.client()

db = init_firestore()
```

### 3. Main FastAPI App

```python
# src/main.py
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import PlainTextResponse
import hmac
import hashlib

from .config import config
from .services.buffer import message_buffer
from .adapters.whatsapp_parser import parse_webhook

app = FastAPI(title="Gendei AI Agent")

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/whatsapp")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification."""
    if hub_mode == "subscribe" and hub_verify_token == config.WEBHOOK_VERIFY_TOKEN:
        return PlainTextResponse(content=hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")

@app.post("/whatsapp")
async def handle_webhook(request: Request):
    """Handle incoming WhatsApp messages."""
    # Verify signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    body = await request.body()

    expected = "sha256=" + hmac.new(
        config.META_APP_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    # Parse and process
    data = await request.json()
    messages = parse_webhook(data)

    for msg in messages:
        await message_buffer.add(msg.clinic_id, msg.from_phone, msg.content)

    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 4. Message Buffer

```python
# src/services/buffer.py
import asyncio
from collections import defaultdict
from typing import Dict, Any
from datetime import datetime

from ..config import config
from .context import process_message

class MessageBuffer:
    def __init__(self):
        self._buffer: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"messages": [], "task": None}
        )

    async def add(self, clinic_id: str, user_phone: str, message: str):
        """Add message to buffer."""
        key = f"{clinic_id}:{user_phone}"
        buffer = self._buffer[key]

        buffer["messages"].append({
            "content": message,
            "timestamp": datetime.now().isoformat()
        })
        buffer["clinic_id"] = clinic_id
        buffer["user_phone"] = user_phone

        # Cancel existing timer
        if buffer["task"]:
            buffer["task"].cancel()

        # Start new timer
        buffer["task"] = asyncio.create_task(
            self._flush_after_delay(key, config.MESSAGE_BUFFER_SECONDS)
        )

    async def _flush_after_delay(self, key: str, delay: float):
        """Flush buffer after delay."""
        await asyncio.sleep(delay)

        buffer = self._buffer.pop(key, None)
        if not buffer or not buffer["messages"]:
            return

        # Combine messages
        combined = "\n".join(m["content"] for m in buffer["messages"])

        # Process through agent
        await process_message(
            clinic_id=buffer["clinic_id"],
            user_phone=buffer["user_phone"],
            message=combined
        )

message_buffer = MessageBuffer()
```

### 5. Conversation Context

```python
# src/services/context.py
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Dict, Any, Optional

from ..lib.firestore import db
from ..agents import run_agent
from ..adapters.whatsapp_sender import send_typing, send_text

@dataclass
class ConversationContext:
    clinic_id: str
    user_phone: str
    user_name: Optional[str] = None
    messages: List[Dict[str, Any]] = field(default_factory=list)
    current_agent: str = "triage"
    agent_state: Dict[str, Any] = field(default_factory=dict)
    is_human_takeover: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def add_message(self, role: str, content: str):
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
        if len(self.messages) > 50:
            self.messages = self.messages[-50:]
        self.updated_at = datetime.now()

async def get_context(clinic_id: str, user_phone: str) -> ConversationContext:
    """Get or create conversation context."""
    doc_ref = db.collection("gendei_clinics").document(clinic_id)\
        .collection("conversations").document(user_phone)

    doc = doc_ref.get()

    if doc.exists:
        data = doc.to_dict()
        return ConversationContext(
            clinic_id=data["clinic_id"],
            user_phone=data["user_phone"],
            user_name=data.get("user_name"),
            messages=data.get("messages", []),
            current_agent=data.get("current_agent", "triage"),
            agent_state=data.get("agent_state", {}),
            is_human_takeover=data.get("is_human_takeover", False),
        )

    # Create new context
    context = ConversationContext(clinic_id=clinic_id, user_phone=user_phone)
    doc_ref.set(asdict(context))
    return context

async def save_context(context: ConversationContext):
    """Save conversation context."""
    doc_ref = db.collection("gendei_clinics").document(context.clinic_id)\
        .collection("conversations").document(context.user_phone)
    doc_ref.update({
        "messages": context.messages,
        "current_agent": context.current_agent,
        "agent_state": context.agent_state,
        "updated_at": datetime.now(),
    })

async def process_message(clinic_id: str, user_phone: str, message: str):
    """Process a message through the agent system."""
    # Get context
    context = await get_context(clinic_id, user_phone)

    # Check human takeover
    if context.is_human_takeover:
        return  # Don't process, let human handle

    # Send typing indicator
    await send_typing(clinic_id, user_phone)

    # Add user message
    context.add_message("user", message)

    # Run agent
    response = await run_agent(context, message)

    # Add assistant message
    context.add_message("assistant", response)

    # Save context
    await save_context(context)

    # Send response
    await send_text(clinic_id, user_phone, response)
```

### 6. Triage Agent

```python
# src/agents/triage_agent.py
import json
from openai import OpenAI

from ..config import config

client = OpenAI(api_key=config.OPENAI_API_KEY)

TRIAGE_PROMPT = """Você é um agente de triagem para um chatbot de clínica médica.
Classifique a intenção do usuário:

- greeting: Saudações simples ("oi", "olá", "bom dia")
- scheduling: Quer agendar, remarcar ou ver disponibilidade
- confirmation: Respondendo a lembrete (confirmar/cancelar consulta)
- other: Não está claro ou precisa de ajuda humana

Responda APENAS com JSON: {"intent": "...", "confidence": 0.0-1.0}"""

async def classify_intent(message: str) -> dict:
    """Classify user intent."""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": TRIAGE_PROMPT},
            {"role": "user", "content": message}
        ],
        temperature=0.3,
        max_tokens=100,
    )

    try:
        result = json.loads(response.choices[0].message.content)
        return result
    except json.JSONDecodeError:
        return {"intent": "other", "confidence": 0.0}
```

### 7. Scheduling Agent

```python
# src/agents/scheduling_agent.py
from openai import OpenAI
from typing import List, Dict, Any

from ..config import config
from ..services.context import ConversationContext
from .tools.availability import check_availability
from .tools.appointments import create_appointment

client = OpenAI(api_key=config.OPENAI_API_KEY)

SCHEDULING_PROMPT = """Você é um assistente de agendamento da {clinic_name}.
Ajude pacientes a marcar consultas.

Serviços: {services}
Profissionais: {professionals}

Guie o paciente:
1. Qual serviço deseja?
2. Tem preferência de profissional?
3. Qual data/horário?
4. Confirme os dados

Use check_availability para ver horários disponíveis.
Use create_appointment para criar o agendamento.

Seja amigável e profissional. Use português brasileiro."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Verificar horários disponíveis",
            "parameters": {
                "type": "object",
                "properties": {
                    "service_id": {"type": "string"},
                    "professional_id": {"type": "string"},
                    "date": {"type": "string", "description": "YYYY-MM-DD"}
                },
                "required": ["service_id", "date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_appointment",
            "description": "Criar agendamento",
            "parameters": {
                "type": "object",
                "properties": {
                    "service_id": {"type": "string"},
                    "professional_id": {"type": "string"},
                    "date": {"type": "string"},
                    "time": {"type": "string"},
                    "patient_name": {"type": "string"},
                    "patient_phone": {"type": "string"}
                },
                "required": ["service_id", "professional_id", "date", "time", "patient_name", "patient_phone"]
            }
        }
    }
]

async def process(context: ConversationContext, message: str) -> str:
    """Process message with scheduling agent."""
    # Load clinic data
    clinic_data = await load_clinic_data(context.clinic_id)

    # Build prompt with clinic info
    system_prompt = SCHEDULING_PROMPT.format(
        clinic_name=clinic_data["name"],
        services=format_services(clinic_data["services"]),
        professionals=format_professionals(clinic_data["professionals"]),
    )

    # Build messages
    messages = [
        {"role": "system", "content": system_prompt},
        *context.get_messages_for_agent(),
        {"role": "user", "content": message},
    ]

    # Call OpenAI
    response = client.chat.completions.create(
        model=config.DEFAULT_MODEL,
        messages=messages,
        tools=TOOLS,
        tool_choice="auto",
    )

    assistant_message = response.choices[0].message

    # Handle tool calls
    if assistant_message.tool_calls:
        for tool_call in assistant_message.tool_calls:
            result = await execute_tool(
                context,
                tool_call.function.name,
                json.loads(tool_call.function.arguments)
            )

            messages.append(assistant_message)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result)
            })

        # Get final response
        final_response = client.chat.completions.create(
            model=config.DEFAULT_MODEL,
            messages=messages,
        )
        return final_response.choices[0].message.content

    return assistant_message.content

async def execute_tool(context: ConversationContext, name: str, args: dict) -> dict:
    """Execute a tool call."""
    if name == "check_availability":
        return await check_availability(context.clinic_id, **args)
    elif name == "create_appointment":
        return await create_appointment(context.clinic_id, **args)
    return {"error": "Unknown tool"}
```

### 8. Agent Router

```python
# src/agents/__init__.py
from ..services.context import ConversationContext
from .triage_agent import classify_intent
from . import greeting_agent, scheduling_agent, reminder_agent

async def run_agent(context: ConversationContext, message: str) -> str:
    """Route message to appropriate agent."""

    # Classify intent if in triage
    if context.current_agent == "triage":
        result = await classify_intent(message)
        intent = result.get("intent", "other")
        confidence = result.get("confidence", 0)

        if confidence < 0.5:
            intent = "other"

        if intent == "greeting":
            context.current_agent = "greeting"
        elif intent == "scheduling":
            context.current_agent = "scheduling"
        elif intent == "confirmation":
            context.current_agent = "reminder"
        else:
            # Human takeover
            context.is_human_takeover = True
            return "Um momento, vou transferir você para um atendente. 👋"

    # Run appropriate agent
    if context.current_agent == "greeting":
        response = await greeting_agent.process(context, message)
        # After greeting, switch to scheduling for next message
        context.current_agent = "scheduling"
        return response

    elif context.current_agent == "scheduling":
        return await scheduling_agent.process(context, message)

    elif context.current_agent == "reminder":
        return await reminder_agent.process(context, message)

    return "Desculpe, não entendi. Pode repetir?"
```

### 9. WhatsApp Sender

```python
# src/adapters/whatsapp_sender.py
import aiohttp
from ..lib.firestore import db

GRAPH_API_URL = "https://graph.facebook.com/v22.0"

async def get_credentials(clinic_id: str) -> tuple:
    """Get WhatsApp credentials for clinic."""
    # Get connection
    conn_doc = db.collection("gendei_whatsapp").document(clinic_id).get()
    if not conn_doc.exists:
        raise ValueError("WhatsApp not connected")

    phone_number_id = conn_doc.to_dict()["phoneNumberId"]

    # Get token (decrypt)
    token_doc = db.collection("gendei_tokens").document(clinic_id).get()
    access_token = decrypt(token_doc.to_dict()["accessTokenEncrypted"])

    return phone_number_id, access_token

async def send_text(clinic_id: str, to: str, text: str):
    """Send a text message."""
    phone_number_id, access_token = await get_credentials(clinic_id)

    async with aiohttp.ClientSession() as session:
        await session.post(
            f"{GRAPH_API_URL}/{phone_number_id}/messages",
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": text}
            },
            headers={"Authorization": f"Bearer {access_token}"}
        )

async def send_typing(clinic_id: str, to: str):
    """Send typing indicator."""
    phone_number_id, access_token = await get_credentials(clinic_id)

    async with aiohttp.ClientSession() as session:
        await session.post(
            f"{GRAPH_API_URL}/{phone_number_id}/messages",
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "reaction",
                "recipient_type": "individual",
                "status": "typing"
            },
            headers={"Authorization": f"Bearer {access_token}"}
        )
```

---

## Deployment

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

ENV PYTHONPATH=/app

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Deploy to Cloud Run

```bash
# deploy.sh
#!/bin/bash
gcloud run deploy gendei-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "FIREBASE_PROJECT_ID=gendei-prod" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,META_APP_SECRET=meta-app-secret:latest"
```

---

## Testing

```bash
# Run locally
uvicorn src.main:app --reload

# Test health
curl http://localhost:8000/health

# Simulate webhook
curl -X POST http://localhost:8000/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"object":"whatsapp_business_account","entry":[...]}'
```
