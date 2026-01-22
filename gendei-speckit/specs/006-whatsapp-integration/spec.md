# Feature 006: WhatsApp Integration

## Spec

### Overview

WhatsApp Integration enables clinics to connect their WhatsApp Business account via Meta's Embedded Signup flow. Once connected, patients can book appointments through natural language conversations with an AI chatbot. The system supports WhatsApp Flows for structured data collection.

---

### User Stories

#### US-001: Meta Embedded Signup

**As a** clinic owner
**I want to** connect my WhatsApp Business account
**So that** patients can message me

**Acceptance Criteria:**
- [ ] "Connect WhatsApp" button
- [ ] Meta Business Manager login
- [ ] Authorize Gendei app
- [ ] Phone number selection
- [ ] Verification code (SMS/Voice)
- [ ] Connection confirmed

#### US-002: Phone Verification

**As a** clinic owner
**I want to** verify my phone number
**So that** I can receive messages

**Acceptance Criteria:**
- [ ] Request verification code
- [ ] Enter 6-digit code
- [ ] SMS or voice call option
- [ ] Retry if failed

#### US-003: Connection Status

**As a** clinic owner
**I want to** see my WhatsApp connection status
**So that** I know if it's working

**Acceptance Criteria:**
- [ ] Connected/Disconnected indicator
- [ ] Phone number displayed
- [ ] Quality rating (Green/Yellow/Red)
- [ ] Last message received

#### US-004: Test Message

**As a** clinic owner
**I want to** send a test message
**So that** I verify the integration works

**Acceptance Criteria:**
- [ ] Enter phone number
- [ ] Send test message
- [ ] Confirmation of delivery

#### US-005: Conversation Inbox

**As a** clinic staff
**I want to** see all WhatsApp conversations
**So that** I can monitor patient interactions

**Acceptance Criteria:**
- [ ] List of conversations
- [ ] Patient name and phone
- [ ] Last message preview
- [ ] Conversation state
- [ ] Click to view full conversation

#### US-006: Human Takeover

**As a** clinic staff
**I want to** take over a conversation from the AI
**So that** I can handle complex cases

**Acceptance Criteria:**
- [ ] "Take Over" button
- [ ] AI stops responding
- [ ] Manual message sending
- [ ] Return to AI option

#### US-007: WhatsApp Flows

**As a** clinic owner
**I want to** use structured flows for booking
**So that** patients have a guided experience

**Acceptance Criteria:**
- [ ] Patient info collection flow
- [ ] Appointment booking flow
- [ ] Date picker component
- [ ] Time selection dropdown
- [ ] Data encryption (RSA)

---

### Functional Requirements

#### FR-001: WhatsApp Connection Document

```python
# Collection: gendei_whatsapp/{id}
{
    "id": "wa_123",
    "clinicId": "clinic_abc",

    "phoneNumberId": "1234567890",
    "wabaId": "9876543210",

    "displayPhoneNumber": "+5511999999999",
    "verifiedName": "Clínica Saúde Total",

    "qualityRating": "GREEN",  # GREEN, YELLOW, RED, UNKNOWN

    "accessToken": "encrypted_token_here",

    "status": "connected",  # connected, disconnected, pending_verification

    "createdAt": Timestamp,
    "updatedAt": Timestamp,
}
```

#### FR-002: Conversation Document Structure

```python
# Collection: gendei_clinics/{clinicId}/conversations/{conversationId}
{
    "id": "conv_123",
    "clinicId": "clinic_abc",

    "waUserId": "5511999999999",
    "waUserPhone": "+5511999999999",
    "waUserName": "João Silva",

    "state": "negociando",
    # States: novo, qualificado, negociando, checkout, fechado

    "isHumanTakeover": False,
    "professionalId": None,  # If human took over
    "takenOverAt": None,

    "lastMessageAt": Timestamp,
    "createdAt": Timestamp,
    "updatedAt": Timestamp,
}
```

#### FR-003: Message Document Structure

```python
# Subcollection: gendei_clinics/{clinicId}/conversations/{conversationId}/messages/{messageId}
{
    "id": "msg_456",
    "conversationId": "conv_123",

    "content": "Olá! Quero agendar uma consulta",
    "mediaUrl": None,

    "direction": "incoming",  # incoming, outgoing
    "isFromAI": False,

    "timestamp": Timestamp,
}
```

#### FR-004: Webhook Handler

```python
async def handle_whatsapp_webhook(payload: dict):
    """
    Process incoming WhatsApp messages.
    """
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            if change["field"] == "messages":
                value = change["value"]
                phone_number_id = value["metadata"]["phone_number_id"]

                # Find clinic by phone number ID
                clinic = await get_clinic_by_phone_number_id(phone_number_id)
                if not clinic:
                    continue

                for message in value.get("messages", []):
                    await process_message(clinic, message)


async def process_message(clinic: dict, message: dict):
    """
    Process a single WhatsApp message.
    """
    sender_phone = message["from"]
    message_id = message["id"]
    message_type = message["type"]

    # Deduplication check
    if await is_message_processed(message_id):
        return

    # Get or create conversation
    conversation = await get_or_create_conversation(
        clinic_id=clinic["id"],
        wa_user_phone=sender_phone,
    )

    # Extract content based on message type
    if message_type == "text":
        content = message["text"]["body"]
    elif message_type == "interactive":
        content = extract_interactive_response(message)
    else:
        content = f"[{message_type} message]"

    # Save incoming message
    await save_message(conversation["id"], {
        "content": content,
        "direction": "incoming",
        "isFromAI": False,
    })

    # Check if human takeover is active
    if conversation["isHumanTakeover"]:
        return  # Don't process with AI

    # Forward to AI agent
    await forward_to_ai_agent(clinic, conversation, content)
```

#### FR-005: WhatsApp Flows Configuration

```python
# Flow 1: Patient Info Collection (Formulário)
FORMULARIO_FLOW = {
    "screens": [
        {
            "id": "specialty",
            "title": "Especialidade",
            "data": {
                "type": "dropdown",
                "options": ["Cardiologia", "Clínico Geral", ...],
            },
        },
        {
            "id": "service_type",
            "title": "Tipo de Atendimento",
            "data": {
                "type": "radio",
                "options": ["Particular", "Convênio"],
            },
        },
        {
            "id": "insurance",
            "title": "Convênio",
            "condition": "service_type == 'Convênio'",
            "data": {
                "type": "dropdown",
                "options": ["Unimed", "Bradesco Saúde", ...],
            },
        },
        {
            "id": "patient_data",
            "title": "Seus Dados",
            "data": {
                "fields": ["name", "phone", "email", "cpf"],
            },
        },
    ],
}

# Flow 2: Appointment Booking (Agendamento)
AGENDAMENTO_FLOW = {
    "screens": [
        {
            "id": "date_selection",
            "title": "Escolha a Data",
            "data": {
                "type": "date_picker",
                "min_date": "today",
                "max_date": "+30days",
            },
        },
        {
            "id": "time_selection",
            "title": "Escolha o Horário",
            "data": {
                "type": "dropdown",
                "options": [],  # Dynamic based on availability
            },
        },
    ],
}
```

#### FR-006: Flow Data Encryption

```python
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
import base64

def decrypt_flow_data(encrypted_data: str, private_key_pem: str) -> dict:
    """
    Decrypt WhatsApp Flow data using RSA-2048.
    """
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode(),
        password=None,
    )

    encrypted_bytes = base64.b64decode(encrypted_data)

    decrypted_bytes = private_key.decrypt(
        encrypted_bytes,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    return json.loads(decrypted_bytes.decode())
```

---

### API Endpoints

```yaml
# Meta Embedded Signup
POST /api/meta/embedded-signup/start
  Request:
    clinicId: string
  Response:
    authUrl: string
    state: string

POST /api/meta/embedded-signup/complete
  Request:
    code: string
    state: string
  Response:
    connected: boolean
    phoneNumber: string

# Webhook
GET /api/meta/webhook
  Query:
    hub.mode: string
    hub.verify_token: string
    hub.challenge: string
  Response:
    hub.challenge (plain text)

POST /api/meta/webhook
  Request:
    (WhatsApp webhook payload)
  Response:
    success: boolean

# WhatsApp Configuration
POST /api/whatsapp/request-verification
  Request:
    clinicId: string
    method: "sms" | "voice"
  Response:
    success: boolean

POST /api/whatsapp/register-number
  Request:
    clinicId: string
    code: string
  Response:
    registered: boolean

POST /api/whatsapp/test-message
  Request:
    clinicId: string
    phone: string
  Response:
    sent: boolean
    messageId: string

GET /api/whatsapp/business-profile
  Query:
    clinicId: string
  Response:
    profile: BusinessProfile

POST /api/whatsapp/business-profile
  Request:
    clinicId: string
    about: string
    address: string
    description: string
  Response:
    updated: boolean

# Conversations
GET /api/conversations
  Query:
    clinicId: string
    state?: string
    isHumanTakeover?: boolean
  Response:
    conversations: Conversation[]

GET /api/conversations/:id
  Response:
    conversation: Conversation
    messages: Message[]

PATCH /api/conversations/:id
  Request:
    state?: string
    isHumanTakeover?: boolean
    professionalId?: string
  Response:
    conversation: Conversation

GET /api/conversations/:id/messages
  Query:
    limit?: number
    before?: string
  Response:
    messages: Message[]
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────┐
│  Conectar WhatsApp                                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │                    📱 WhatsApp Business                  │  │
│  │                                                          │  │
│  │    Conecte sua conta do WhatsApp Business para          │  │
│  │    permitir que pacientes agendem consultas             │  │
│  │    automaticamente.                                      │  │
│  │                                                          │  │
│  │              [🔗 Conectar WhatsApp Business]             │  │
│  │                                                          │  │
│  │    Ao conectar, você autoriza o Gendei a:               │  │
│  │    • Receber mensagens dos pacientes                    │  │
│  │    • Enviar mensagens em seu nome                       │  │
│  │    • Gerenciar agendamentos automaticamente             │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  WhatsApp Conectado                                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Status: ✅ Conectado                                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📱 +55 11 99999-9999                                     │  │
│  │    Clínica Saúde Total                                  │  │
│  │                                                          │  │
│  │    Qualidade: 🟢 Verde                                   │  │
│  │    Última mensagem: há 5 minutos                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Testar Conexão                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Telefone: (11) 98888-8888          [Enviar Teste]       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Desconectar WhatsApp]                                        │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Conversas                                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Todas] [Novas] [Em Atendimento] [Human Takeover]            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👤 João Silva                               há 2 min    │  │
│  │    +55 11 99999-9999                                    │  │
│  │    "Quero agendar uma consulta de cardiologia"          │  │
│  │    Estado: 🔵 Negociando                                │  │
│  │                                               [Abrir →]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👤 Maria Santos                             há 15 min   │  │
│  │    +55 21 88888-8888                                    │  │
│  │    "Confirmo minha presença"                            │  │
│  │    Estado: ✅ Fechado                                    │  │
│  │                                               [Abrir →]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👤 Pedro Lima                               há 1 hora   │  │
│  │    +55 31 77777-7777                                    │  │
│  │    "Preciso remarcar minha consulta"                    │  │
│  │    Estado: 🟡 Human Takeover                            │  │
│  │                                               [Abrir →]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Conversa: João Silva                     [Assumir Conversa]  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────┐            │
│  │ Olá! Quero agendar uma consulta              │  10:28    │
│  └────────────────────────────────────────────────┘            │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   10:28   │ Olá João! 👋                                   │   │
│    🤖     │                                                │   │
│           │ Sou a assistente virtual da Clínica Saúde     │   │
│           │ Total. Ficarei feliz em ajudá-lo a agendar    │   │
│           │ sua consulta!                                  │   │
│           │                                                │   │
│           │ Qual especialidade você procura?              │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────┐            │
│  │ Cardiologia                                    │  10:29    │
│  └────────────────────────────────────────────────┘            │
│                                                                 │
│           ┌────────────────────────────────────────────────┐   │
│   10:29   │ Ótima escolha! 👨‍⚕️                            │   │
│    🤖     │                                                │   │
│           │ Temos a Dra. Maria Silva disponível.          │   │
│           │ Vou te enviar o formulário para coletarmos    │   │
│           │ seus dados e escolher o melhor horário.       │   │
│           │                                                │   │
│           │ [📋 Preencher Formulário]                     │   │
│           └────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Digite uma mensagem...                          [Enviar] │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] Meta Embedded Signup integration
- [x] Phone number registration and verification
- [x] Webhook message receiving
- [x] Message sending API
- [x] Connection status display
- [x] Quality rating display
- [x] Test message sending
- [x] Business profile configuration
- [x] WhatsApp Flows for structured data
- [x] Flow data encryption (RSA)
- [x] Template messages
- [x] Conversation inbox
- [x] Human takeover mode
- [x] Conversation state management
