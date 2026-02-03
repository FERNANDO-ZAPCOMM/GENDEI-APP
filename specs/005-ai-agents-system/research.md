# Research: AI Agents System

**Feature**: 005-ai-agents-system
**Date**: 2026-02-04

---

## Technology Decisions

### 1. AI Framework

**Decision**: OpenAI Agents SDK

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| OpenAI Agents SDK | Official, tools support | OpenAI-focused | **Selected** |
| LangChain | Feature-rich | Complex, heavy | Rejected |
| Custom implementation | Full control | More work | Rejected |
| Autogen | Multi-agent | Overkill | Rejected |

**Why OpenAI Agents SDK**:
- Native tool calling support
- Built-in conversation management
- Easy to add/remove tools
- Production-ready
- Good documentation

**Implementation**:
```python
from openai import OpenAI
from openai.types.beta import Thread, Run

client = OpenAI()

# Create assistant (agent)
assistant = client.beta.assistants.create(
    name="Scheduling Agent",
    instructions=SCHEDULING_PROMPT,
    tools=[
        {"type": "function", "function": check_availability_def},
        {"type": "function", "function": create_appointment_def},
    ],
    model="gpt-4o-mini",
)

# Create thread for conversation
thread = client.beta.threads.create()

# Add message
client.beta.threads.messages.create(
    thread_id=thread.id,
    role="user",
    content="Quero agendar uma consulta",
)

# Run agent
run = client.beta.threads.runs.create(
    thread_id=thread.id,
    assistant_id=assistant.id,
)
```

---

### 2. Model Selection

**Decision**: GPT-4o-mini as default, with optional Anthropic Claude

**Why GPT-4o-mini**:
- Fast response times
- Low cost
- Good Portuguese understanding
- Sufficient for scheduling tasks

**Cost Comparison**:
| Model | Input/1M | Output/1M | Speed |
|-------|----------|-----------|-------|
| GPT-4o-mini | $0.15 | $0.60 | Fast |
| GPT-4o | $5.00 | $15.00 | Fast |
| Claude 3.5 Sonnet | $3.00 | $15.00 | Medium |
| Claude 3 Haiku | $0.25 | $1.25 | Fast |

**Provider Switching**:
```python
# Per-clinic configuration
AI_PROVIDER = os.getenv("AI_PROVIDER", "openai")  # openai or anthropic

def get_provider(clinic_settings: dict) -> AIProvider:
    provider = clinic_settings.get("ai_provider", AI_PROVIDER)
    if provider == "anthropic":
        return AnthropicProvider()
    return OpenAIProvider()
```

---

### 3. Multi-Agent Architecture

**Decision**: Triage router with specialized agents

**Why Multi-Agent**:
- Separation of concerns
- Specialized prompts per task
- Easier to maintain/debug
- Better context management

**Agent Responsibilities**:

| Agent | Responsibility | Tools |
|-------|---------------|-------|
| Triage | Classify intent, route | None |
| Greeting | Handle greetings | send_text |
| Scheduling | Book appointments | check_availability, create_appointment |
| Reminder | Confirm/cancel | confirm, cancel |

**Routing Logic**:
```python
async def route_message(message: str, context: ConversationContext) -> str:
    # Classify intent
    intent = await triage_agent.classify(message)

    # Route to appropriate agent
    if intent == "greeting":
        return await greeting_agent.process(message, context)
    elif intent == "scheduling":
        return await scheduling_agent.process(message, context)
    elif intent == "confirmation":
        return await reminder_agent.process(message, context)
    else:
        return await enable_human_takeover(context)
```

---

### 4. Message Buffering

**Decision**: 5-second in-memory buffer

**Why Buffer**:
- Users often send multiple messages
- Prevents processing partial thoughts
- Reduces API calls
- Better context for agent

**Implementation**:
```python
from asyncio import create_task, sleep
from collections import defaultdict

MESSAGE_BUFFER: dict[str, dict] = defaultdict(lambda: {"messages": [], "task": None})

async def add_to_buffer(user_id: str, message: str):
    buffer = MESSAGE_BUFFER[user_id]
    buffer["messages"].append(message)

    # Cancel existing timer
    if buffer["task"]:
        buffer["task"].cancel()

    # Start new timer
    buffer["task"] = create_task(flush_after_delay(user_id, 5.0))

async def flush_after_delay(user_id: str, delay: float):
    await sleep(delay)
    messages = MESSAGE_BUFFER[user_id]["messages"]
    MESSAGE_BUFFER[user_id] = {"messages": [], "task": None}

    # Process combined messages
    combined = "\n".join(messages)
    await process_message(user_id, combined)
```

---

### 5. Tool Definitions

**Decision**: Function calling with JSON schema

**Tool Pattern**:
```python
check_availability_def = {
    "name": "check_availability",
    "description": "Check available appointment slots for a service and/or professional",
    "parameters": {
        "type": "object",
        "properties": {
            "service_id": {
                "type": "string",
                "description": "Service ID to check availability for"
            },
            "professional_id": {
                "type": "string",
                "description": "Optional: specific professional"
            },
            "date": {
                "type": "string",
                "description": "Date to check (YYYY-MM-DD)"
            }
        },
        "required": ["service_id", "date"]
    }
}

async def check_availability(service_id: str, date: str, professional_id: str = None) -> dict:
    """Execute the check_availability tool."""
    clinic_id = get_current_clinic_id()

    # Query Firestore for available slots
    slots = await get_available_slots(clinic_id, service_id, date, professional_id)

    return {
        "available": len(slots) > 0,
        "slots": [{"time": s.time, "professional": s.professional_name} for s in slots],
        "date": date,
    }
```

---

### 6. Conversation Context

**Decision**: Firestore-backed with in-memory cache

**Why Firestore**:
- Persists across agent restarts
- Shared across instances
- Easy queries

**Context Structure**:
```python
@dataclass
class ConversationContext:
    clinic_id: str
    user_phone: str
    user_name: Optional[str]
    messages: List[dict]  # [{role, content, timestamp}]
    current_agent: str  # triage, greeting, scheduling, reminder
    state: dict  # Agent-specific state
    thread_id: Optional[str]  # OpenAI thread ID
    created_at: datetime
    updated_at: datetime

    def add_message(self, role: str, content: str):
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
        })
        # Trim to last 50 messages
        if len(self.messages) > 50:
            self.messages = self.messages[-50:]
```

**Loading Context**:
```python
async def get_or_create_context(clinic_id: str, user_phone: str) -> ConversationContext:
    doc_ref = db.collection("gendei_clinics").document(clinic_id)\
        .collection("conversations").document(user_phone)

    doc = await doc_ref.get()

    if doc.exists:
        data = doc.to_dict()
        return ConversationContext(**data)

    # Create new context
    context = ConversationContext(
        clinic_id=clinic_id,
        user_phone=user_phone,
        messages=[],
        current_agent="triage",
        state={},
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    await doc_ref.set(asdict(context))
    return context
```

---

### 7. Provider Abstraction

**Decision**: Abstract base class with provider implementations

**Interface**:
```python
from abc import ABC, abstractmethod

class AIProvider(ABC):
    @abstractmethod
    async def create_completion(
        self,
        messages: List[dict],
        tools: List[dict] = None,
        model: str = None,
    ) -> str:
        pass

    @abstractmethod
    async def execute_tool_call(
        self,
        tool_name: str,
        arguments: dict,
    ) -> dict:
        pass
```

**OpenAI Implementation**:
```python
class OpenAIProvider(AIProvider):
    def __init__(self):
        self.client = OpenAI()
        self.default_model = "gpt-4o-mini"

    async def create_completion(self, messages, tools=None, model=None):
        response = await self.client.chat.completions.create(
            model=model or self.default_model,
            messages=messages,
            tools=tools,
        )
        return response.choices[0].message
```

**Anthropic Implementation**:
```python
class AnthropicProvider(AIProvider):
    def __init__(self):
        self.client = Anthropic()
        self.default_model = "claude-3-5-sonnet-20241022"

    async def create_completion(self, messages, tools=None, model=None):
        # Convert OpenAI format to Anthropic format
        anthropic_messages = convert_messages(messages)
        anthropic_tools = convert_tools(tools)

        response = await self.client.messages.create(
            model=model or self.default_model,
            messages=anthropic_messages,
            tools=anthropic_tools,
        )
        return convert_response(response)
```

---

### 8. Human Takeover

**Decision**: Flag conversation for human review

**Triggers**:
- User requests human
- Agent confidence < 50%
- Sensitive topics detected
- Multiple failed attempts

**Implementation**:
```python
async def enable_human_takeover(context: ConversationContext, reason: str = None):
    # Update conversation state
    await db.collection("gendei_clinics").document(context.clinic_id)\
        .collection("conversations").document(context.user_phone)\
        .update({
            "isHumanTakeover": True,
            "takenOverAt": datetime.now(),
            "takeoverReason": reason,
        })

    # Send notification to clinic dashboard
    await send_notification(context.clinic_id, {
        "type": "human_takeover_requested",
        "user_phone": context.user_phone,
        "reason": reason,
    })

    # Send message to user
    return "Um momento, vou transferir você para um atendente humano. 👋"
```

---

### 9. Typing Indicators

**Decision**: Send typing before processing

**Implementation**:
```python
async def process_with_typing(user_phone: str, message: str):
    # Send typing indicator immediately
    await send_typing_indicator(user_phone)

    # Process message (may take a few seconds)
    response = await agent.process(message)

    # Send response (clears typing automatically)
    await send_text_message(user_phone, response)
```

---

## Performance Considerations

### Latency Optimization
- Use GPT-4o-mini for speed
- Cache clinic data
- Parallel tool execution
- Connection pooling

### Cost Optimization
- Buffer messages to reduce calls
- Limit context window
- Use cheaper models for triage

### Reliability
- Retry with backoff
- Graceful degradation
- Human fallback

---

## Security Considerations

1. **API Keys**: Secret Manager
2. **PII Logging**: Mask phone numbers
3. **Tool Permissions**: Per-agent tools
4. **Input Validation**: Sanitize user input
5. **Rate Limiting**: Per-user limits

---

## References

- [OpenAI Assistants API](https://platform.openai.com/docs/assistants)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Function Calling](https://platform.openai.com/docs/guides/function-calling)
