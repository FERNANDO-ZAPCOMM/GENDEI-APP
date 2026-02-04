"""
Gendei WhatsApp Agent Service - Claude Agent SDK
Clinic appointment scheduling via WhatsApp using Claude AI.
"""

import os
import logging
import asyncio
from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.responses import Response, JSONResponse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Claude Agent SDK imports
from claude_agent_sdk import query, ClaudeAgentOptions

# Gendei imports
from src.database.firestore import GendeiDatabase
from src.runtime.context import Runtime, set_runtime, reset_runtime
from src.agents.tools import create_gendei_tools_server, ALL_TOOL_NAMES
from src.agents.subagents import get_agent_definitions
from src.agents.prompts import get_prompt
from src.utils.messaging import set_phone_number_id, mark_message_as_read
from src.utils.helpers import ensure_phone_has_plus

# Environment variables
WHATSAPP_TOKEN = os.getenv("META_BISU_ACCESS_TOKEN", "")
VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "gendei_verify_token")
DOMAIN = os.getenv("GENDEI_DOMAIN", "https://gendei.com")

# Database instance
db: Optional[GendeiDatabase] = None

# Gendei tools MCP server
gendei_tools_server = None


# ============================================
# MESSAGE BUFFERING
# Combines rapid sequential messages before processing
# ============================================
DEFAULT_MESSAGE_BUFFER_SECONDS = 2.0
SHORT_MESSAGE_BUFFER_SECONDS = 3.5
GREETING_MESSAGE_BUFFER_SECONDS = 5.0

message_buffer: Dict[str, List[Dict[str, Any]]] = {}
message_buffer_timers: Dict[str, datetime] = {}
message_buffer_deadlines: Dict[str, datetime] = {}
message_buffer_locks: Dict[str, bool] = {}


def _looks_like_greeting_only(text: str) -> bool:
    """Check if message is just a greeting."""
    t = (text or "").strip().lower()
    if not t or "?" in t:
        return False
    if any(k in t for k in ("quero", "preciso", "valor", "preço", "agendar", "marcar", "consulta")):
        return False
    return any(
        t.startswith(prefix)
        for prefix in ("oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "tudo bem")
    ) and len(t) <= 25


def _adaptive_buffer_seconds(first_message_text: str) -> float:
    """Choose buffer window based on first message."""
    t = (first_message_text or "").strip()
    if not t:
        return DEFAULT_MESSAGE_BUFFER_SECONDS
    if _looks_like_greeting_only(t):
        return GREETING_MESSAGE_BUFFER_SECONDS
    if len(t) <= 8 and "?" not in t:
        return SHORT_MESSAGE_BUFFER_SECONDS
    return DEFAULT_MESSAGE_BUFFER_SECONDS


def add_to_message_buffer(key: str, message_data: Dict[str, Any]) -> bool:
    """Add message to buffer. Returns True if first message."""
    is_first = key not in message_buffer or len(message_buffer.get(key, [])) == 0
    if key not in message_buffer:
        message_buffer[key] = []
    message_buffer[key].append(message_data)
    if is_first:
        message_buffer_timers[key] = datetime.now()
        seconds = _adaptive_buffer_seconds(message_data.get("text", ""))
        message_buffer_deadlines[key] = message_buffer_timers[key] + timedelta(seconds=seconds)
    return is_first


def get_buffered_messages(key: str) -> List[Dict[str, Any]]:
    """Get and clear all buffered messages."""
    messages = message_buffer.get(key, [])
    message_buffer[key] = []
    if key in message_buffer_timers:
        del message_buffer_timers[key]
    if key in message_buffer_deadlines:
        del message_buffer_deadlines[key]
    return messages


def should_process_buffer(key: str) -> bool:
    """Check if enough time has passed to process the buffer."""
    if key not in message_buffer_deadlines:
        return True
    return datetime.now() >= message_buffer_deadlines[key]


def combine_messages(messages: List[Dict[str, Any]]) -> str:
    """Combine multiple messages into single context string."""
    if not messages:
        return ""
    if len(messages) == 1:
        return messages[0].get('text', '')
    return " ".join(msg.get('text', '') for msg in messages if msg.get('text'))


# ============================================
# CLINIC CONTEXT LOADING
# ============================================

def load_clinic_context(clinic_id: str) -> Dict[str, Any]:
    """Load clinic context for AI prompts."""
    context: Dict[str, Any] = {}

    if not db:
        return context

    try:
        clinic = db.get_clinic(clinic_id)
        if clinic:
            context["clinic"] = {
                "id": clinic.id,
                "name": clinic.name,
                "address": getattr(clinic, 'address', ''),
                "phone": getattr(clinic, 'phone', ''),
                "opening_hours": getattr(clinic, 'opening_hours', ''),
                "payment_settings": getattr(clinic, 'payment_settings', {}),
            }

        professionals = db.get_clinic_professionals(clinic_id)
        context["professionals"] = [
            {
                "id": p.id,
                "name": p.full_name if hasattr(p, 'full_name') else p.name,
                "specialty": getattr(p, 'specialty', ''),
            }
            for p in professionals
        ]

        services = db.get_clinic_services(clinic_id)
        context["services"] = services

    except Exception as e:
        logger.error(f"Error loading clinic context: {e}")

    return context


def format_clinic_context(context: Dict[str, Any]) -> str:
    """Format clinic context as a string for prompts."""
    lines = []

    clinic = context.get("clinic", {})
    if clinic:
        if clinic.get("name"):
            lines.append(f"Nome: {clinic['name']}")
        if clinic.get("address"):
            lines.append(f"Endereço: {clinic['address']}")
        if clinic.get("phone"):
            lines.append(f"Telefone: {clinic['phone']}")
        if clinic.get("opening_hours"):
            lines.append(f"Horário: {clinic['opening_hours']}")

    professionals = context.get("professionals", [])
    if professionals:
        lines.append("\nProfissionais:")
        for p in professionals:
            line = f"  - {p['name']}"
            if p.get('specialty'):
                line += f" ({p['specialty']})"
            lines.append(line)

    services = context.get("services", [])
    if services:
        lines.append("\nServiços:")
        for s in services:
            name = s.get('name', '')
            duration = s.get('duration', 30)
            price = s.get('price', 0)
            line = f"  - {name} ({duration} min)"
            if price:
                line += f" - R$ {price:.2f}".replace('.', ',')
            lines.append(line)

    return "\n".join(lines)


# ============================================
# CLAUDE AGENT INTEGRATION
# ============================================

async def process_with_claude_agent(
    clinic_id: str,
    phone: str,
    message: str,
    phone_number_id: str
) -> Optional[str]:
    """
    Process a message using Claude Agent SDK.

    Args:
        clinic_id: Clinic ID
        phone: Patient phone number
        message: Patient message
        phone_number_id: WhatsApp phone number ID

    Returns:
        Agent response or None if error
    """
    global gendei_tools_server

    try:
        # Load clinic context
        context = load_clinic_context(clinic_id)
        clinic_name = context.get("clinic", {}).get("name", "Clínica")
        clinic_context_str = format_clinic_context(context)

        # Set up runtime context
        runtime = Runtime(
            clinic_id=clinic_id,
            db=db,
            phone_number_id=phone_number_id,
            patient_phone=phone
        )
        token = set_runtime(runtime)

        # Set messaging context
        set_phone_number_id(phone_number_id)

        # Initialize tools server if needed
        if gendei_tools_server is None:
            gendei_tools_server = create_gendei_tools_server()

        # Get agent definitions for this clinic
        agents = get_agent_definitions(clinic_name, clinic_context_str)

        # Build the main agent prompt
        main_prompt = get_prompt("scheduling", clinic_name, clinic_context_str)

        # Add patient context to message
        full_message = f"""Paciente: {phone}

Mensagem do paciente:
{message}

Responda ao paciente usando as ferramentas disponíveis. Use send_text_message para enviar a resposta."""

        # Create async generator for streaming input
        async def message_generator():
            yield {
                "type": "user",
                "message": {
                    "role": "user",
                    "content": full_message
                }
            }

        # Query Claude Agent
        result_text = None

        # Build system prompt with preset for Claude Code capabilities
        # and append clinic-specific context
        system_prompt_config = {
            "type": "preset",
            "preset": "claude_code",
            "append": main_prompt
        }

        async for msg in query(
            prompt=message_generator(),
            options=ClaudeAgentOptions(
                model="sonnet",  # Claude Sonnet for best balance of speed and capability
                mcp_servers={"gendei-clinic-tools": gendei_tools_server},
                allowed_tools=ALL_TOOL_NAMES + ["Task"],
                agents=agents,
                system_prompt=system_prompt_config,
                max_turns=10,
                permission_mode="bypassPermissions",
                setting_sources=["project"]  # Load Skills and CLAUDE.md from .claude/
            )
        ):
            # Extract result from completed query
            if hasattr(msg, 'result'):
                result_text = msg.result
            elif hasattr(msg, 'type') and msg.type == 'result':
                if hasattr(msg, 'subtype') and msg.subtype == 'success':
                    result_text = getattr(msg, 'result', None)

        # Reset runtime context
        reset_runtime(token)

        return result_text

    except Exception as e:
        logger.error(f"❌ Error in Claude agent: {e}", exc_info=True)
        return None


# ============================================
# WHATSAPP WEBHOOK HANDLERS
# ============================================

async def handle_incoming_message(
    clinic_id: str,
    phone_number_id: str,
    phone: str,
    message_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> None:
    """Handle an incoming WhatsApp message."""
    try:
        # Extract message content
        message_type = message_data.get("type", "text")
        message_id = message_data.get("id", "")

        # Get text content
        text = ""
        if message_type == "text":
            text = message_data.get("text", {}).get("body", "")
        elif message_type == "interactive":
            # Button or list reply
            interactive = message_data.get("interactive", {})
            if interactive.get("type") == "button_reply":
                text = interactive.get("button_reply", {}).get("title", "")
            elif interactive.get("type") == "list_reply":
                text = interactive.get("list_reply", {}).get("title", "")

        if not text:
            logger.info(f"Ignoring non-text message type: {message_type}")
            return

        phone = ensure_phone_has_plus(phone)
        buffer_key = f"{clinic_id}:{phone}"

        # Check if message already processed
        if db and db.is_message_processed(clinic_id, message_id):
            logger.info(f"Message {message_id} already processed, skipping")
            return

        # Mark as processed
        if db:
            db.mark_message_processed(clinic_id, message_id)

        # Check for human takeover
        if db and db.is_human_takeover_active(clinic_id, phone):
            logger.info(f"Human takeover active for {phone}, skipping AI")
            return

        # Log incoming message
        if db:
            db.log_conversation_message(
                clinic_id, phone, message_type, text, source="patient"
            )

        # Mark message as read
        await mark_message_as_read(message_id, phone_number_id)

        # Add to buffer
        add_to_message_buffer(buffer_key, {
            "text": text,
            "type": message_type,
            "timestamp": datetime.now().isoformat()
        })

        # Schedule buffer processing
        background_tasks.add_task(
            process_message_buffer,
            buffer_key,
            clinic_id,
            phone,
            phone_number_id
        )

    except Exception as e:
        logger.error(f"Error handling message: {e}", exc_info=True)


async def process_message_buffer(
    buffer_key: str,
    clinic_id: str,
    phone: str,
    phone_number_id: str
) -> None:
    """Process buffered messages after delay."""
    try:
        # Wait for buffer deadline
        deadline = message_buffer_deadlines.get(buffer_key)
        if deadline:
            wait_seconds = (deadline - datetime.now()).total_seconds()
            if wait_seconds > 0:
                await asyncio.sleep(wait_seconds)

        # Check if should process
        if not should_process_buffer(buffer_key):
            return

        # Get buffered messages
        messages = get_buffered_messages(buffer_key)
        if not messages:
            return

        # Combine messages
        combined_text = combine_messages(messages)
        logger.info(f"📨 Processing message from {phone[:8]}...: {combined_text[:50]}...")

        # Process with Claude agent
        await process_with_claude_agent(
            clinic_id,
            phone,
            combined_text,
            phone_number_id
        )

    except Exception as e:
        logger.error(f"Error processing buffer: {e}", exc_info=True)


# ============================================
# FASTAPI APPLICATION
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global db, gendei_tools_server

    # Startup
    logger.info("🚀 Starting Gendei WhatsApp Agent (Claude SDK)...")

    try:
        db = GendeiDatabase()
        logger.info("✅ Firestore connected")
    except Exception as e:
        logger.error(f"❌ Failed to connect to Firestore: {e}")
        raise

    # Initialize tools server
    gendei_tools_server = create_gendei_tools_server()
    logger.info("✅ Gendei tools server initialized")

    logger.info("✅ Gendei WhatsApp Agent ready!")

    yield

    # Shutdown
    logger.info("👋 Shutting down Gendei WhatsApp Agent...")


app = FastAPI(
    title="Gendei WhatsApp Agent - Claude SDK",
    description="Healthcare appointment scheduling via WhatsApp using Claude AI",
    version="2.0.0",
    lifespan=lifespan
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "gendei-whatsapp-agent-claude",
        "version": "2.0.0"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/whatsapp")
async def verify_webhook(request: Request):
    """WhatsApp webhook verification endpoint."""
    params = dict(request.query_params)

    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        logger.info("✅ Webhook verified successfully")
        return Response(content=challenge, media_type="text/plain")
    else:
        logger.warning("❌ Webhook verification failed")
        raise HTTPException(status_code=403, detail="Verification failed")


@app.post("/whatsapp")
async def webhook_handler(request: Request, background_tasks: BackgroundTasks):
    """WhatsApp webhook handler for incoming messages."""
    try:
        body = await request.json()

        # Extract entry data
        entry = body.get("entry", [])
        if not entry:
            return JSONResponse({"status": "ok"})

        for e in entry:
            changes = e.get("changes", [])
            for change in changes:
                value = change.get("value", {})

                # Get phone number ID
                metadata = value.get("metadata", {})
                phone_number_id = metadata.get("phone_number_id", "")

                if not phone_number_id:
                    continue

                # Get clinic by phone number ID
                clinic = db.get_clinic_by_phone_number_id(phone_number_id) if db else None
                if not clinic:
                    logger.warning(f"No clinic found for phone number ID: {phone_number_id}")
                    continue

                # Process messages
                messages = value.get("messages", [])
                for msg in messages:
                    sender = msg.get("from", "")

                    await handle_incoming_message(
                        clinic_id=clinic.id,
                        phone_number_id=phone_number_id,
                        phone=sender,
                        message_data=msg,
                        background_tasks=background_tasks
                    )

        return JSONResponse({"status": "ok"})

    except Exception as e:
        logger.error(f"Webhook error: {e}", exc_info=True)
        return JSONResponse({"status": "error", "message": str(e)})


@app.post("/test")
async def test_message(request: Request):
    """Test endpoint for development."""
    try:
        body = await request.json()
        clinic_id = body.get("clinic_id", "test-clinic")
        phone = body.get("phone", "+5511999999999")
        message = body.get("message", "Olá")
        phone_number_id = body.get("phone_number_id", "test-pnid")

        response = await process_with_claude_agent(
            clinic_id=clinic_id,
            phone=phone,
            message=message,
            phone_number_id=phone_number_id
        )

        return JSONResponse({
            "status": "ok",
            "response": response
        })

    except Exception as e:
        logger.error(f"Test error: {e}", exc_info=True)
        return JSONResponse({"status": "error", "message": str(e)})


# ============================================
# MAIN ENTRY POINT
# ============================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8080))
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENVIRONMENT") == "development"
    )
