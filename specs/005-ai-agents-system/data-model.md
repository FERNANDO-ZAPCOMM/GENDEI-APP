# Data Model: AI Agents System

**Feature**: 005-ai-agents-system
**Date**: 2026-02-04

---

## Python Data Classes

### ConversationContext

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional

@dataclass
class ConversationContext:
    """Context for an ongoing conversation with a user."""

    # Identifiers
    clinic_id: str
    user_phone: str

    # User info (if known)
    user_name: Optional[str] = None
    patient_id: Optional[str] = None

    # Conversation history
    messages: List[Dict[str, Any]] = field(default_factory=list)

    # Agent state
    current_agent: str = "triage"  # triage, greeting, scheduling, reminder
    agent_state: Dict[str, Any] = field(default_factory=dict)

    # OpenAI thread (if using Assistants API)
    thread_id: Optional[str] = None

    # Human takeover
    is_human_takeover: bool = False
    taken_over_at: Optional[datetime] = None
    takeover_reason: Optional[str] = None

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    last_message_at: Optional[datetime] = None

    def add_message(self, role: str, content: str) -> None:
        """Add a message to the conversation history."""
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
        })
        self.last_message_at = datetime.now()
        self.updated_at = datetime.now()

        # Trim to last 50 messages
        if len(self.messages) > 50:
            self.messages = self.messages[-50:]

    def get_messages_for_agent(self, max_messages: int = 20) -> List[Dict[str, str]]:
        """Get messages formatted for the AI agent."""
        recent = self.messages[-max_messages:]
        return [{"role": m["role"], "content": m["content"]} for m in recent]
```

---

### Message Types

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List
from enum import Enum

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    DOCUMENT = "document"
    INTERACTIVE = "interactive"

@dataclass
class IncomingMessage:
    """Parsed incoming WhatsApp message."""
    id: str
    from_phone: str
    timestamp: datetime
    type: MessageType
    text: Optional[str] = None
    media_id: Optional[str] = None
    media_url: Optional[str] = None
    caption: Optional[str] = None
    button_payload: Optional[str] = None
    button_title: Optional[str] = None

    @property
    def content(self) -> str:
        """Get message content for agent."""
        if self.type == MessageType.TEXT:
            return self.text or ""
        elif self.type == MessageType.INTERACTIVE:
            return self.button_title or self.button_payload or ""
        elif self.caption:
            return f"[{self.type.value}] {self.caption}"
        return f"[{self.type.value}]"

@dataclass
class OutgoingMessage:
    """Message to send via WhatsApp."""
    to_phone: str
    type: MessageType
    text: Optional[str] = None
    buttons: Optional[List[Dict[str, str]]] = None
    media_url: Optional[str] = None
```

---

### Agent State

```python
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum

class SchedulingState(str, Enum):
    INITIAL = "initial"
    SELECTING_SERVICE = "selecting_service"
    SELECTING_PROFESSIONAL = "selecting_professional"
    SELECTING_DATE = "selecting_date"
    SELECTING_TIME = "selecting_time"
    CONFIRMING = "confirming"
    COMPLETED = "completed"

@dataclass
class SchedulingAgentState:
    """State for the scheduling agent."""
    state: SchedulingState = SchedulingState.INITIAL
    selected_service_id: Optional[str] = None
    selected_service_name: Optional[str] = None
    selected_professional_id: Optional[str] = None
    selected_professional_name: Optional[str] = None
    selected_date: Optional[str] = None
    selected_time: Optional[str] = None
    available_slots: List[Dict[str, Any]] = field(default_factory=list)
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state.value,
            "selected_service_id": self.selected_service_id,
            "selected_service_name": self.selected_service_name,
            "selected_professional_id": self.selected_professional_id,
            "selected_professional_name": self.selected_professional_name,
            "selected_date": self.selected_date,
            "selected_time": self.selected_time,
            "patient_name": self.patient_name,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SchedulingAgentState":
        return cls(
            state=SchedulingState(data.get("state", "initial")),
            selected_service_id=data.get("selected_service_id"),
            selected_service_name=data.get("selected_service_name"),
            selected_professional_id=data.get("selected_professional_id"),
            selected_professional_name=data.get("selected_professional_name"),
            selected_date=data.get("selected_date"),
            selected_time=data.get("selected_time"),
            patient_name=data.get("patient_name"),
        )
```

---

### Tool Definitions

```python
from typing import TypedDict, List, Optional

class ToolParameter(TypedDict):
    type: str
    description: str
    enum: Optional[List[str]]

class ToolFunction(TypedDict):
    name: str
    description: str
    parameters: dict

# Check Availability Tool
CHECK_AVAILABILITY_TOOL: ToolFunction = {
    "name": "check_availability",
    "description": "Check available appointment slots for a service on a specific date",
    "parameters": {
        "type": "object",
        "properties": {
            "service_id": {
                "type": "string",
                "description": "The ID of the service to check"
            },
            "professional_id": {
                "type": "string",
                "description": "Optional: specific professional ID"
            },
            "date": {
                "type": "string",
                "description": "Date to check in YYYY-MM-DD format"
            }
        },
        "required": ["service_id", "date"]
    }
}

# Create Appointment Tool
CREATE_APPOINTMENT_TOOL: ToolFunction = {
    "name": "create_appointment",
    "description": "Create a new appointment for the patient",
    "parameters": {
        "type": "object",
        "properties": {
            "service_id": {"type": "string"},
            "professional_id": {"type": "string"},
            "date": {"type": "string", "description": "YYYY-MM-DD"},
            "time": {"type": "string", "description": "HH:MM"},
            "patient_name": {"type": "string"},
            "patient_phone": {"type": "string"},
        },
        "required": ["service_id", "professional_id", "date", "time", "patient_name", "patient_phone"]
    }
}

# Send Text Message Tool
SEND_TEXT_MESSAGE_TOOL: ToolFunction = {
    "name": "send_text_message",
    "description": "Send a text message to the user",
    "parameters": {
        "type": "object",
        "properties": {
            "text": {
                "type": "string",
                "description": "The message text to send"
            }
        },
        "required": ["text"]
    }
}

# Send Buttons Tool
SEND_BUTTONS_TOOL: ToolFunction = {
    "name": "send_buttons",
    "description": "Send a message with interactive buttons",
    "parameters": {
        "type": "object",
        "properties": {
            "body": {
                "type": "string",
                "description": "The message body text"
            },
            "buttons": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "title": {"type": "string", "maxLength": 20}
                    }
                },
                "maxItems": 3
            }
        },
        "required": ["body", "buttons"]
    }
}

# Confirm Appointment Tool
CONFIRM_APPOINTMENT_TOOL: ToolFunction = {
    "name": "confirm_appointment",
    "description": "Confirm the patient's attendance for an appointment",
    "parameters": {
        "type": "object",
        "properties": {
            "appointment_id": {"type": "string"}
        },
        "required": ["appointment_id"]
    }
}

# Cancel Appointment Tool
CANCEL_APPOINTMENT_TOOL: ToolFunction = {
    "name": "cancel_appointment",
    "description": "Cancel an appointment",
    "parameters": {
        "type": "object",
        "properties": {
            "appointment_id": {"type": "string"},
            "reason": {"type": "string"}
        },
        "required": ["appointment_id"]
    }
}

# Human Takeover Tool
HUMAN_TAKEOVER_TOOL: ToolFunction = {
    "name": "enable_human_takeover",
    "description": "Transfer the conversation to a human agent",
    "parameters": {
        "type": "object",
        "properties": {
            "reason": {
                "type": "string",
                "description": "Why human assistance is needed"
            }
        },
        "required": ["reason"]
    }
}
```

---

### Agent Definitions

```python
from dataclasses import dataclass
from typing import List

@dataclass
class AgentDefinition:
    """Definition of an AI agent."""
    name: str
    system_prompt: str
    tools: List[ToolFunction]
    model: str = "gpt-4o-mini"
    temperature: float = 0.7

# Agent definitions
TRIAGE_AGENT = AgentDefinition(
    name="triage",
    system_prompt="""Você é um agente de triagem para um chatbot de clínica médica.
Seu trabalho é classificar a intenção do usuário e direcionar para o agente apropriado.

Intenções:
- greeting: Saudações simples como "oi", "olá", "bom dia"
- scheduling: Quer agendar, remarcar ou verificar disponibilidade
- confirmation: Respondendo a lembrete de consulta (confirmar/cancelar)
- other: Não está claro ou precisa de ajuda humana

Responda APENAS com JSON: {"intent": "...", "confidence": 0.0-1.0}""",
    tools=[],
    temperature=0.3,
)

GREETING_AGENT = AgentDefinition(
    name="greeting",
    system_prompt="""Você é um assistente amigável da {clinic_name}.
Responda saudações de forma breve e ofereça ajuda para agendamentos.
Use português brasileiro, seja cordial mas objetivo.""",
    tools=[SEND_TEXT_MESSAGE_TOOL],
)

SCHEDULING_AGENT = AgentDefinition(
    name="scheduling",
    system_prompt="""Você é um assistente de agendamento da {clinic_name}.
Ajude pacientes a marcar consultas com nossos profissionais.

Serviços disponíveis: {services}
Profissionais: {professionals}
Horário de funcionamento: {operating_hours}

Guie o paciente:
1. Seleção do serviço
2. Preferência de profissional (opcional)
3. Data e horário
4. Confirmação

Use as ferramentas para verificar disponibilidade e criar agendamentos.
Seja amigável e profissional. Use português brasileiro.""",
    tools=[
        CHECK_AVAILABILITY_TOOL,
        CREATE_APPOINTMENT_TOOL,
        SEND_TEXT_MESSAGE_TOOL,
        SEND_BUTTONS_TOOL,
    ],
)

REMINDER_AGENT = AgentDefinition(
    name="reminder",
    system_prompt="""Você é um assistente de confirmação da {clinic_name}.
O paciente está respondendo a um lembrete de consulta.

Consulta: {appointment_details}

Se o paciente confirmar presença, use confirm_appointment.
Se quiser cancelar, use cancel_appointment e pergunte o motivo.
Se quiser remarcar, transfira para agendamento.""",
    tools=[
        CONFIRM_APPOINTMENT_TOOL,
        CANCEL_APPOINTMENT_TOOL,
        SEND_TEXT_MESSAGE_TOOL,
        SEND_BUTTONS_TOOL,
    ],
)
```

---

### Firestore Collections

#### Conversation Document

**Path**: `gendei_clinics/{clinicId}/conversations/{userPhone}`

```python
# Firestore document structure
conversation_doc = {
    "clinicId": "clinic_abc",
    "userPhone": "+5511999998888",
    "userName": "João Silva",
    "patientId": "patient_xyz",  # If linked to patient record

    # Messages (last 50)
    "messages": [
        {
            "role": "user",
            "content": "Oi, quero marcar uma consulta",
            "timestamp": "2026-02-04T10:00:00Z"
        },
        {
            "role": "assistant",
            "content": "Olá! Claro, posso ajudar...",
            "timestamp": "2026-02-04T10:00:02Z"
        }
    ],

    # Agent state
    "currentAgent": "scheduling",
    "agentState": {
        "state": "selecting_date",
        "selected_service_id": "svc_123",
        "selected_service_name": "Consulta Geral"
    },

    # Thread ID (OpenAI Assistants)
    "threadId": "thread_abc123",

    # Human takeover
    "isHumanTakeover": False,
    "takenOverAt": None,
    "takeoverReason": None,

    # Metadata
    "createdAt": "2026-02-04T09:00:00Z",
    "updatedAt": "2026-02-04T10:00:02Z",
    "lastMessageAt": "2026-02-04T10:00:00Z"
}
```

---

### Tool Execution Results

```python
from dataclasses import dataclass
from typing import Any, Optional

@dataclass
class ToolResult:
    """Result of a tool execution."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        if self.success:
            return {"success": True, "data": self.data}
        return {"success": False, "error": self.error}

# Example tool results
availability_result = ToolResult(
    success=True,
    data={
        "available": True,
        "date": "2026-02-05",
        "slots": [
            {"time": "09:00", "professional": "Dr. João", "professional_id": "prof_1"},
            {"time": "10:00", "professional": "Dr. João", "professional_id": "prof_1"},
            {"time": "14:00", "professional": "Dra. Maria", "professional_id": "prof_2"},
        ]
    }
)

appointment_result = ToolResult(
    success=True,
    data={
        "appointment_id": "apt_xyz123",
        "date": "2026-02-05",
        "time": "09:00",
        "professional": "Dr. João",
        "service": "Consulta Geral",
        "deposit_amount": 5000,  # R$ 50,00
    }
)
```
