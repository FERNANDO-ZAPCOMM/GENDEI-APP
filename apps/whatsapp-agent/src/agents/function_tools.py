"""
Function Tools - Agent function tools for WhatsApp interactions
Provides tools for messaging, product queries, and order management
"""

import asyncio
import logging
import os
import re
import textwrap
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from agents import function_tool  # type: ignore

from src.utils.messaging import (
    send_whatsapp_text,
    send_whatsapp_button,
    send_whatsapp_buttons,
    send_whatsapp_document,
    send_single_product_message,
    send_multi_product_message,
    send_catalog_message,
)
from src.utils.helpers import ensure_phone_has_plus, format_payment_amount
from src.utils.payment import (
    create_pagseguro_pix_order,
    send_pix_payment_to_customer,
    send_manual_pix_instructions,
    is_pagseguro_configured
)
from src.runtime.context import get_runtime

logger = logging.getLogger(__name__)

# anti-spam tracker
_message_tracker: Dict[str, datetime] = {}

GREETING_COOLDOWN_SECONDS = 1800  # 30 minutes (persisted per phone in conversation state)


def _mark_message_sent(phone: str) -> None:
    """
    track that a message was sent to prevent spam
    """
    runtime = get_runtime()
    key = f"{runtime.creator_id}:{phone}"
    _message_tracker[key] = datetime.now()


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    try:
        if isinstance(value, datetime):
            return value
        if not value:
            return None
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


async def _bump_responses_sent_for_last_user_message(phone: str, increment: int = 1) -> None:
    """
    track how many outbound messages we sent for the current inbound user message.
    this is used to prevent accidental multi-send follow-ups (e.g. greeter + triage).
    """
    try:
        runtime = get_runtime()
        phone = ensure_phone_has_plus(phone)
        state = await runtime.db.load_conversation_state(phone)
        current = int(state.get("responses_sent_for_last_user_message", 0) or 0)
        state["responses_sent_for_last_user_message"] = current + int(increment)
        await runtime.db.save_conversation_state(phone, state)
    except Exception:
        return


# ===== MESSAGING TOOLS =====

PLANNED_PRODUCT_TYPE_PT = {
    'ebook': 'E-book / Templates',
    'templates': 'E-book / Templates',
    'mentoring': 'Mentoria',
    'community': 'Comunidade',
}


def _format_planned_product_types(profile: Dict[str, Any]) -> List[str]:
    raw = profile.get('productTypes') or []
    if not isinstance(raw, list):
        return []
    labels: List[str] = []
    for t in raw:
        if not t:
            continue
        labels.append(PLANNED_PRODUCT_TYPE_PT.get(str(t), str(t)))
    # de-duplicate preserving order
    seen = set()
    out = []
    for v in labels:
        if v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out


def _format_whatsapp_message(text: str, width: int = 76) -> str:
    """
    Format a WhatsApp message with readable line breaks.
    - Preserves paragraph breaks (blank lines)
    - Wraps long paragraphs to a fixed width
    - Keeps the text content unchanged (only whitespace/newlines)
    """
    raw = (text or "").strip()
    if not raw:
        return ""

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw) if p.strip()]
    wrapped: List[str] = []
    for p in paragraphs:
        p = re.sub(r"[ \t]+", " ", p).strip()
        wrapped.append(textwrap.fill(p, width=width, break_long_words=False, break_on_hyphens=False))
    return "\n\n".join(wrapped).strip()

def _build_profile_greeting(
    creator_name: str,
    niche: str,
    voice_style: str,
    lead_temperature: str,
    product_titles: Optional[List[str]] = None,
    show_products_in_greeting: bool = False,
) -> str:
    """
    Build a profile-based greeting with proper WhatsApp formatting.
    Uses line breaks to separate intro, welcome, and question for better readability.
    """
    name = (creator_name or "").strip() or "Eu"
    area = (niche or "").strip()
    vs = (voice_style or "").strip().lower()
    lt = (lead_temperature or "").strip().lower()

    # build intro and welcome based on voice style (face/hand emojis only)
    if vs == "formal_consultant":
        intro = f"Olá! Sou {name}, consultor(a) em {area}." if area else f"Olá! Sou {name}."
        welcome = "Seja bem-vindo(a)!"
        question = "Como posso ajudar você hoje?"
    elif vs == "professional_expert":
        intro = f"Olá! Sou {name}, especialista em {area}." if area else f"Olá! Sou {name}."
        welcome = "👋\n\nQue bom ter você aqui!"
        question = "Como posso te ajudar?"
    elif vs == "casual_friend":
        intro = f"Ei! 😄 Sou {name}" + (f", e curto muito {area}!" if area else "!")
        welcome = "Que bom você ter aparecido!"
        question = "No que posso te ajudar?"
    else:
        # friendly_coach (default)
        intro = f"Olá! Sou {name}" + (f", especialista em {area}." if area else ".")
        welcome = "👋\n\nQue bom ter você aqui!"
        question = "Como posso te ajudar?"

    # adjust question based on lead temperature
    if lt == "hot":
        question = "O que você está buscando agora?"
    elif lt == "cold":
        question = "Como posso te ajudar hoje?"

    # build the full message with proper line breaks
    parts = [f"{intro} {welcome}"]

    # add product mention if showing products
    if show_products_in_greeting and product_titles:
        titles = [t for t in product_titles if t]
        if titles:
            # Mention we have a product to show
            parts.append("TENHO UM PRODUTO INCRÍVEL PARA TE MOSTRAR!")
            question = "Quer conhecer? 👇"

    parts.append(question)

    # join with double line breaks for WhatsApp readability
    return "\n\n".join(parts)


def _planned_types_to_bullets(planned_types: List[str]) -> List[str]:
    parts: List[str] = []
    for label in planned_types:
        if not label:
            continue
        for p in str(label).split("/"):
            p = p.strip()
            if not p:
                continue
            parts.append(p.upper())
    # de-duplicate preserving order
    seen = set()
    out: List[str] = []
    for v in parts:
        if v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out


# NOTE: fast path AI generation functions have been removed.
# all message handling now goes through the multi-agent system for consistency and flexibility.
# the agents handle objections, help requests, product interest, and buy intent directly.


# underlying callable function (no decorator)
async def _send_greeting_with_products_button_impl(
    phone: str,
    skip_greeting: bool = False,
    show_product_immediately: bool = False
) -> str:
    """
    profile-connected greeting for first contact.
    LOGIC:
    1. If welcomeMessage is configured in profile, USE IT (priority)
    2. Otherwise, send a short profile greeting (name + niche + question)

    Args:
        phone: Customer phone number
        skip_greeting: If True, skip the greeting message and go straight to product
        show_product_immediately: If True, send product without 45-second delay
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service
        phone = ensure_phone_has_plus(phone)

        profile = data_service.get_creator_profile()
        creator_name = profile.get('displayName') or profile.get('name', '')
        niche = data_service.get_creator_niche()
        voice_style = data_service.get_voice_style() if hasattr(data_service, "get_voice_style") else profile.get("voiceStyle", "friendly_coach")
        lead_temperature = data_service.get_lead_temperature() if hasattr(data_service, "get_lead_temperature") else "warm"
        show_products_in_greeting = (
            data_service.get_show_products_in_greeting()
            if hasattr(data_service, "get_show_products_in_greeting")
            else bool(profile.get("showProductsInGreeting", True))
        )
        products = data_service.get_all_products()
        product_titles = [p.get("title") for p in products if p.get("title")]

        # prevent repeat greetings (workflow may suggest greeter more than once)
        # NOTE: we still show buttons and send template even during cooldown
        is_cooldown = False
        try:
            state = await runtime.db.load_conversation_state(phone)
            last = _parse_iso_datetime(state.get("last_greeting_at"))
            if last and (datetime.now(timezone.utc) - last).total_seconds() < GREETING_COOLDOWN_SECONDS:
                is_cooldown = True
                logger.info(f"🕒 Greeting cooldown active for {phone}, but will still send buttons + template")
        except Exception:
            pass

        # ===== SKIP GREETING IF REQUESTED (user clicked "Sim, Quero Ver") =====
        if not skip_greeting:
            # ===== CHECK FOR CUSTOM WELCOME MESSAGE =====
            # Use custom welcome message ONLY when there are NO products
            # When products exist, use the dynamic greeting that can show them
            welcome_message = profile.get('welcomeMessage', '').strip()
            if welcome_message and not products:
                logger.info(f"📝 Using configured welcome message for {phone} (no products)")
                await send_whatsapp_text(phone, welcome_message)
                _mark_message_sent(phone)
                runtime.db.log_interaction(phone, "text", welcome_message, source="agent", metadata={"type": "custom_welcome"})
                return f"Custom welcome message sent to {phone}"
            elif welcome_message and products:
                logger.info(f"📝 Skipping custom welcome message - using dynamic greeting with products")

            # ===== PROFILE GREETING (ALL CASES) =====
            greeting = _build_profile_greeting(
                creator_name=creator_name,
                niche=niche,
                voice_style=voice_style,
                lead_temperature=lead_temperature,
                product_titles=product_titles,
                show_products_in_greeting=show_products_in_greeting and bool(products),
            )

            # send greeting with buttons if we have products to show
            if products and show_products_in_greeting:
                # send greeting with Yes/No buttons
                buttons = [
                    {"id": "show_product_yes", "title": "Sim, Quero Ver"},
                    {"id": "show_product_no", "title": "Agora Não"}
                ]
                await send_whatsapp_buttons(phone, greeting, buttons)
                runtime.db.log_interaction(phone, "interactive", greeting, source="agent", metadata={"type": "greeting_with_buttons"})
                logger.info(f"💬 Sent greeting with buttons to {phone}")
            else:
                # no products - send plain text greeting
                await send_whatsapp_text(phone, greeting)
                runtime.db.log_interaction(phone, "text", greeting, source="agent", metadata={"type": "greeting_profile"})
                logger.info(f"💬 Sent greeting to {phone}")

        # if we have products, send product (with or without delay)
        product_sent = False  # Track if product was successfully sent (to avoid duplicates)
        if products and (show_products_in_greeting or show_product_immediately):
            # wait 45 seconds before sending product UNLESS show_product_immediately is True
            if not show_product_immediately:
                logger.info(f"⏳ Waiting 45 seconds before sending product to {phone}")
                await asyncio.sleep(45)

                # AFTER 45s wait, check if user is now in checkout state OR product was already sent OR user declined
                try:
                    state = await runtime.db.load_conversation_state(phone)
                    if state.get('state') == 'checkout':
                        logger.info(f"⏭️ Skipping product send - user {phone} is already in checkout")
                        return "User already in checkout, skipping product template"

                    # Check if user clicked "Agora Não" (declined to see product)
                    if state.get('declined_product_preview'):
                        logger.info(f"⏭️ Skipping product send - user {phone} clicked 'Agora Não'")
                        return "User declined product preview, skipping product template"

                    # Check if product was already sent (e.g., user clicked "Sim, Quero Ver" button)
                    last_product_sent = _parse_iso_datetime(state.get("last_product_sent_at"))
                    if last_product_sent and (datetime.now(timezone.utc) - last_product_sent).total_seconds() < 120:
                        logger.info(f"⏭️ Skipping product send - already sent to {phone} at {last_product_sent}")
                        return "Product already sent recently, skipping duplicate"
                except Exception:
                    pass
            else:
                logger.info(f"🚀 Showing product immediately for {phone} (user clicked button)")

            # collect products with Meta catalog info
            products_with_catalog = []
            catalog_id = None
            product_still_indexing = False  # Track if any product is still being indexed by Meta

            for p in products:
                meta_catalog = p.get('metaCatalog', {})
                cat_id = meta_catalog.get('catalogId')
                ret_id = meta_catalog.get('retailerId') or p.get('productId')

                # Check if product was synced less than 10 minutes ago (Meta needs time to index)
                synced_at = _parse_iso_datetime(meta_catalog.get('syncedAt'))
                if synced_at:
                    minutes_since_sync = (datetime.now(timezone.utc) - synced_at).total_seconds() / 60
                    if minutes_since_sync < 10:
                        logger.info(f"⏳ Product '{p.get('title')}' synced {minutes_since_sync:.1f} min ago - still indexing")
                        product_still_indexing = True

                if cat_id and ret_id:
                    if not catalog_id:
                        catalog_id = cat_id  # use first catalog_id found
                    products_with_catalog.append({
                        'retailer_id': ret_id,
                        'title': p.get('title', 'Produto')
                    })

            product_sent = False

            # If product is still being indexed by Meta, send a "processing" message
            if product_still_indexing and len(products_with_catalog) > 0:
                first_product = products[0]
                product_title = first_product.get('title', 'Produto')

                indexing_msg = (
                    f"*{product_title}*\n\n"
                    f"Seu produto está sendo preparado e estará disponível em alguns minutos!\n\n"
                    f"Por favor, aguarde um pouquinho e me mande uma mensagem novamente. 😊"
                )

                logger.info(f"⏳ Product still indexing, sending wait message to {phone}")
                await send_whatsapp_text(phone, indexing_msg)
                product_sent = True
                runtime.db.log_interaction(phone, "text", indexing_msg, source="agent", metadata={"type": "product_indexing_wait"})

            # OPTION 1: multiple products with catalog → FREE Interactive Multi-Product Message
            elif len(products_with_catalog) > 1 and catalog_id:
                logger.info(f"🎠 Sending interactive MPM with {len(products_with_catalog)} products (FREE)")
                # Build sections for MPM (max 30 products)
                retailer_ids = [p['retailer_id'] for p in products_with_catalog[:30]]
                sections = [{
                    "title": "Nossos Produtos",
                    "product_retailer_ids": retailer_ids
                }]
                result = await send_multi_product_message(
                    phone=phone,
                    header_text="Confira nossos produtos!",
                    body_text="Toque em um produto para ver detalhes 👇",
                    sections=sections,
                    catalog_id=catalog_id
                )
                if "successfully" in result.lower():
                    product_sent = True
                    runtime.db.log_interaction(phone, "interactive", f"MPM sent: {len(products_with_catalog)} products", source="agent", metadata={"type": "greeting_product_mpm", "catalog_id": catalog_id})
                    logger.info(f"✅ Interactive MPM sent to {phone}: {result}")

            # OPTION 2: single product with catalog → FREE Interactive Single Product Message
            elif not product_sent and len(products_with_catalog) == 1 and catalog_id:
                retailer_id = products_with_catalog[0]['retailer_id']
                logger.info(f"📦 Sending interactive SPM: catalog={catalog_id}, retailer={retailer_id} (FREE)")
                result = await send_single_product_message(
                    phone=phone,
                    product_retailer_id=retailer_id,
                    catalog_id=catalog_id,
                    body_text="Confira este produto! 👇"
                )
                if "successfully" in result.lower():
                    product_sent = True
                    runtime.db.log_interaction(phone, "interactive", f"SPM sent: {retailer_id}", source="agent", metadata={"type": "greeting_product_spm", "catalog_id": catalog_id, "retailer_id": retailer_id})
                    logger.info(f"✅ Interactive SPM sent to {phone}: {result}")

            # NO FALLBACK - SPM template must work for all products (paid and free)
            # If template failed, log the error but don't send image
            if not product_sent:
                logger.error(f"❌ SPM template failed for {phone} - NO FALLBACK, check Meta catalog connection")

            # === FOLLOW-UP MESSAGE AFTER PRODUCT ===
            # send explanation message after showing the product
            # Skip follow-up when product is still indexing (user already received "aguarde" message)
            if product_sent and not product_still_indexing:
                await asyncio.sleep(3)  # Brief pause before follow-up

                # get product info for personalized message
                first_product = products[0]
                product_title = first_product.get('title', 'meu produto')
                product_desc = first_product.get('description', '')

                # Extract price - handle dict format like {"amount": 1.99, "currency": "BRL"}
                raw_price = first_product.get('price', 0)
                if isinstance(raw_price, dict):
                    product_price = raw_price.get('amount', 0)
                    # Handle nested dict case
                    if isinstance(product_price, dict):
                        product_price = 0
                else:
                    product_price = float(raw_price) if raw_price else 0

                # get sales and RAG context for personalized message
                sales_context = first_product.get('salesContext', {})
                rag_context = first_product.get('ragContext', {})

                # Priority for product pitch:
                # 1. mainBenefit (can be at top level OR inside salesContext)
                # 2. ragContext.summary (AI-generated summary of the content)
                # 3. truncated description as fallback
                main_benefit = (
                    first_product.get('mainBenefit', '') or  # top level (new schema)
                    sales_context.get('mainBenefit', '') or  # inside salesContext (old schema)
                    rag_context.get('additionalInfo', {}).get('mainBenefit', '')  # inside ragContext
                )
                rag_summary = rag_context.get('summary', '')

                # build product pitch with best available content
                if main_benefit:
                    product_pitch = main_benefit
                elif rag_summary:
                    # AI-generated summary - use up to 150 chars
                    product_pitch = rag_summary[:150] + "..." if len(rag_summary) > 150 else rag_summary
                elif product_desc:
                    # truncate description at a natural break point (sentence or word boundary)
                    if len(product_desc) > 120:
                        # try to find a sentence break
                        break_point = product_desc[:120].rfind('.')
                        if break_point < 50:  # if no good sentence break, find word break
                            break_point = product_desc[:120].rfind(' ')
                        if break_point > 50:
                            product_pitch = product_desc[:break_point + 1].strip()
                        else:
                            product_pitch = product_desc[:120].strip() + "..."
                    else:
                        product_pitch = product_desc
                else:
                    product_pitch = "Ele vai te ajudar a transformar seus resultados."

                # build follow-up message
                if product_price == 0:
                    # FREE PRODUCT
                    followup_msg = (
                        f"👆 Esse é o *{product_title}*!\n\n"
                        f"📌 {product_pitch}\n\n"
                        f"É *100% GRATUITO* 🎁\n\n"
                        f"Clica no produto acima para ver os detalhes e garantir o seu!"
                    )
                else:
                    # paid product - format price correctly
                    # If price > 100, assume it's in cents and convert to reais
                    # Otherwise assume it's already in reais
                    if product_price > 100:
                        price_reais = product_price / 100
                    else:
                        price_reais = product_price
                    price_str = f"R$ {price_reais:.2f}".replace('.', ',')

                    followup_msg = (
                        f"👆 Esse é o *{product_title}*!\n\n"
                        f"📌 {product_pitch}\n\n"
                        f"💳 Valor: *{price_str}*\n\n"
                        f"Clica em *Ver* → *Adicionar ao carrinho* → *Ver carrinho* → *Fazer pedido* → escolhe *PIX* e após o pagamento você recebe na hora! 🚀"
                    )

                await send_whatsapp_text(phone, followup_msg)
                runtime.db.log_interaction(phone, "text", followup_msg, source="agent", metadata={"type": "greeting_product_followup"})
                logger.info(f"💬 Follow-up message sent to {phone}")

        await _bump_responses_sent_for_last_user_message(phone, 1)

        # persist greeting marker and product sent timestamp (used to avoid repeat greets and duplicate products)
        try:
            state = await runtime.db.load_conversation_state(phone)
            state["state"] = state.get("state") or "navegando"
            state["last_greeting_at"] = datetime.now(timezone.utc).isoformat()
            if product_sent:
                state["last_product_sent_at"] = datetime.now(timezone.utc).isoformat()
            await runtime.db.save_conversation_state(phone, state)
        except Exception:
            pass

        _mark_message_sent(phone)
        return f"Greeting sent to {phone}"

    except Exception as e:
        logger.error(f"Error in send_greeting_with_products_button: {e}")
        return f"Error: {str(e)}"


async def _set_product_notification_preference_impl(
    phone: str,
    wants_notification: bool = True,
    interests: str = "",
) -> str:
    try:
        runtime = get_runtime()
        phone = ensure_phone_has_plus(phone)
        ok = await runtime.db.update_contact_notification_preference(
            phone=phone,
            wants_notification=bool(wants_notification),
            interests=(interests.strip() or None),
        )
        if not ok:
            return "Desculpe, não consegui registrar agora. Pode tentar novamente?"

        if wants_notification:
            text = "Perfeito — vou te avisar assim que eu liberar novidades por aqui no WhatsApp."
        else:
            text = "Certo — não vou te enviar avisos de novidades."

        await send_whatsapp_text(phone, text)
        runtime.db.log_interaction(phone, "text", text, source="agent", metadata={"type": "notification_preference"})
        _mark_message_sent(phone)
        return "Notification preference updated"
    except Exception as e:
        logger.error(f"Error updating notification preference: {e}")
        return f"Error: {str(e)}"


@function_tool
async def set_product_notification_preference(
    phone: str,
    wants_notification: bool = True,
    interests: str = "",
) -> str:
    """
    Register user's preference to be notified about new products/community launches.

    Use ONLY when the user explicitly opts in (e.g., "quero ser avisado", "me avisa").

    Args:
        phone: Customer phone number in E.164 format (e.g., +5511999999999).
        wants_notification: True to enable notifications, False to disable.
        interests: Optional interests/topics the user mentioned.

    Returns:
        Success or error message.
    """
    return await _set_product_notification_preference_impl(phone, wants_notification, interests)


@function_tool
async def send_greeting_with_products_button(phone: str) -> str:
    """
    Send welcome greeting with button to show products.

    Use this when greeting a new customer for the first time.

    Args:
        phone: Customer phone number in E.164 format (e.g., +5511999999999).

    Returns:
        Success or error message.
    """
    return await _send_greeting_with_products_button_impl(phone)


# ===== NO-PRODUCTS OPT-IN (BUTTON) =====
async def _send_notify_new_products_button_impl(phone: str, message: str = "") -> str:
    """
    Sends a single interactive message with a NOTIFY_NEW_PRODUCTS button, intended for cases where:
    - the creator has no active products, but the user shows buying intent or asks for something planned.
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service
        phone = ensure_phone_has_plus(phone)

        profile = data_service.get_creator_profile()
        planned_types = _format_planned_product_types(profile)
        bullets = _planned_types_to_bullets(planned_types) or ["NOVIDADES"]
        bullets_text = "\n".join([f" - {b}" for b in bullets])

        preface = _format_whatsapp_message(message, width=68).strip()
        preface = preface[:420].strip()  # keep WhatsApp bubble short

        if preface:
            body_text = f"{preface}\n\n{bullets_text}\n\nSe quiser que eu te avise quando eu lançar, toque no botão abaixo 👇"
        else:
            body_text = f"Estou preparando:\n{bullets_text}\n\nSe quiser que eu te avise quando eu lançar, toque no botão abaixo 👇"

        result = await send_whatsapp_button(
            phone=phone,
            body_text=body_text,
            button_text="Quero Ser Avisado",
            button_id="NOTIFY_NEW_PRODUCTS",
            header_text=None,
        )
        runtime.db.log_interaction(
            phone,
            "interactive",
            body_text,
            source="agent",
            metadata={"type": "button", "button_text": "Quero Ser Avisado", "button_id": "NOTIFY_NEW_PRODUCTS", "flow": "no_products_optin"},
        )
        await _bump_responses_sent_for_last_user_message(phone, 1)
        _mark_message_sent(phone)
        return result or "Opt-in button sent"
    except Exception as e:
        logger.error(f"Error in send_notify_new_products_button: {e}")
        return f"Error: {str(e)}"


@function_tool
async def send_notify_new_products_button(phone: str, message: str = "") -> str:
    """
    Send a NOTIFY_NEW_PRODUCTS opt-in button (no header), optionally with a short preface message.
    Use when the user wants to buy/enter something not yet available (no active products).
    """
    return await _send_notify_new_products_button_impl(phone, message)


# underlying implementation (no decorator) for direct calling
async def _send_text_message_impl(phone: str, text: str) -> str:
    """
    implementation of send_text_message - can be called directly
    """
    try:
        phone = ensure_phone_has_plus(phone)
        runtime = get_runtime()

        # GUARD: Never send HANDOFF instructions to user - these are internal routing commands
        if "[HANDOFF:" in text.upper():
            logger.info(f"⚠️ Blocking HANDOFF instruction from being sent to user: {text[:50]}...")
            return "Handoff instruction blocked - not sent to user"

        # GUARD: Prevent duplicate greetings in same turn
        # if greeting was already sent (responses > 0) and this looks like a greeting, skip it
        state = await runtime.db.load_conversation_state(phone)
        responses_sent = state.get("responses_sent_for_last_user_message", 0)

        if responses_sent > 0:
            text_lower = text.lower().strip()
            # check if this looks like a greeting/duplicate message
            greeting_patterns = ["oi!", "olá", "oi,", "tudo bem?", "estou aqui para", "posso te ajudar", "estou à disposição"]
            is_greeting_like = any(pattern in text_lower for pattern in greeting_patterns)

            if is_greeting_like:
                logger.info(f"⚠️ Skipping duplicate greeting-like message (already sent {responses_sent} message(s))")
                return "Message skipped - greeting already sent"

        # apply output guardrails before sending (tools bypass main's guarded sender)
        try:
            from src.agents.guardrails import run_output_guardrails
            text = run_output_guardrails(text)
        except Exception:
            pass

        result = await send_whatsapp_text(phone, text)
        _mark_message_sent(phone)

        # update message counter (reload state since it may have changed)
        state = await runtime.db.load_conversation_state(phone)
        responses_sent = state.get("responses_sent_for_last_user_message", 0)
        state["responses_sent_for_last_user_message"] = responses_sent + 1
        await runtime.db.save_conversation_state(phone, state)

        # log agent message to Firestore
        runtime.db.log_interaction(phone, "text", text, source="agent")

        return result

    except Exception as e:
        logger.error(f"Error in send_text_message: {e}")
        return f"Error: {str(e)}"


@function_tool
async def send_text_message(phone: str, text: str) -> str:
    """
    Send a text message to the customer via WhatsApp.

    This is the primary tool for communicating with customers.
    Use for responses, questions, and any text-based communication.

    Args:
        phone: Customer phone number in E.164 format (e.g., +5511999999999).
        text: Message text to send. Supports WhatsApp formatting (*bold*, _italic_).

    Returns:
        Success or error message.
    """
    return await _send_text_message_impl(phone, text)


# ===== CATALOG PRODUCT MESSAGES =====
# default shared Meta Catalog ID for all creators
DEFAULT_CATALOG_ID = "1169583811909920"


def _get_catalog_id_from_products(data_service) -> str:
    """
    extract catalog_id from products' metaCatalog field, fallback to default
    """
    products = data_service.get_all_products()
    for product in products:
        meta_catalog = product.get('metaCatalog', {})
        if meta_catalog.get('catalogId'):
            return meta_catalog['catalogId']
    # fallback to shared platform catalog
    logger.info(f"No catalog ID in products, using default: {DEFAULT_CATALOG_ID}")
    return DEFAULT_CATALOG_ID


# underlying implementations (no decorator) for direct calling
async def _send_product_card_impl(phone: str, product_id: str, body_text: Optional[str] = None) -> str:
    """
    implementation of send_product_card - can be called directly
    """
    try:
        runtime = get_runtime()
        phone = ensure_phone_has_plus(phone)

        # get catalog_id from products (always returns a value with fallback)
        catalog_id = _get_catalog_id_from_products(runtime.data_service)

        # build retailer_id: creatorId_productId
        retailer_id = f"{runtime.creator_id}_{product_id}"

        result = await send_single_product_message(
            phone=phone,
            product_retailer_id=retailer_id,
            catalog_id=catalog_id,
            body_text=body_text
        )

        _mark_message_sent(phone)
        runtime.db.log_interaction(
            phone, "product", body_text or "Product card sent",
            source="agent", metadata={"product_id": product_id, "type": "single_product"}
        )

        return result

    except Exception as e:
        logger.error(f"Error in send_product_card: {e}")
        return f"Error: {str(e)}"


async def _send_product_catalog_list_impl(
    phone: str,
    header_text: str,
    body_text: str,
    product_ids: Optional[List[str]] = None
) -> str:
    """
    implementation of send_product_catalog_list - can be called directly
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service
        phone = ensure_phone_has_plus(phone)

        # get catalog_id from products (always returns a value with fallback)
        catalog_id = _get_catalog_id_from_products(data_service)

        # get products
        if product_ids:
            products = [data_service.get_product_by_id(pid) for pid in product_ids]
            products = [p for p in products if p]  # filter out None
        else:
            products = data_service.get_all_products()

        if not products:
            return "No products available to send"

        # build retailer_ids
        retailer_ids = [f"{runtime.creator_id}_{p['productId']}" for p in products]

        # group into one section
        sections = [{
            "title": "Produtos",
            "product_retailer_ids": retailer_ids[:30]  # max 30 products
        }]

        result = await send_multi_product_message(
            phone=phone,
            header_text=header_text,
            body_text=body_text,
            sections=sections,
            catalog_id=catalog_id
        )

        _mark_message_sent(phone)
        runtime.db.log_interaction(
            phone, "product", body_text,
            source="agent", metadata={"product_count": len(retailer_ids), "type": "multi_product"}
        )

        return result

    except Exception as e:
        logger.error(f"Error in send_product_catalog_list: {e}")
        return f"Error: {str(e)}"


async def _send_full_catalog_impl(phone: str, body_text: str) -> str:
    """
    implementation of send_full_catalog - can be called directly
    """
    try:
        runtime = get_runtime()
        phone = ensure_phone_has_plus(phone)

        # get catalog_id from products (always returns a value with fallback)
        catalog_id = _get_catalog_id_from_products(runtime.data_service)

        result = await send_catalog_message(
            phone=phone,
            body_text=body_text,
            catalog_id=catalog_id
        )

        _mark_message_sent(phone)
        runtime.db.log_interaction(
            phone, "catalog", body_text,
            source="agent", metadata={"type": "catalog_message"}
        )

        return result

    except Exception as e:
        logger.error(f"Error in send_full_catalog: {e}")
        return f"Error: {str(e)}"


@function_tool
async def send_product_card(phone: str, product_id: str, body_text: Optional[str] = None) -> str:
    """
    Send a single product card from the catalog via WhatsApp.

    Shows the product with image, title, price and a "View" button.
    Use when highlighting a specific product to the customer.

    Args:
        phone: Customer phone number in E.164 format (e.g., +5511999999999).
        product_id: Product ID from the catalog.
        body_text: Optional message text to accompany the product card.

    Returns:
        Success or error message.
    """
    return await _send_product_card_impl(phone, product_id, body_text)


@function_tool
async def send_product_catalog_list(
    phone: str,
    header_text: str,
    body_text: str,
    product_ids: Optional[List[str]] = None
) -> str:
    """
    Send a multi-product catalog message via WhatsApp.

    Shows up to 30 products in a scrollable list.
    Use when displaying multiple products for the customer to browse.

    Args:
        phone: Customer phone number in E.164 format (e.g., +5511999999999).
        header_text: Header text for the message (e.g., "Nossos Produtos").
        body_text: Body text describing the products.
        product_ids: Optional list of specific product IDs. If not provided, sends all products.

    Returns:
        Success or error message.
    """
    return await _send_product_catalog_list_impl(phone, header_text, body_text, product_ids)


@function_tool
async def send_full_catalog(phone: str, body_text: str) -> str:
    """
    Send a catalog message that opens the full WhatsApp catalog.

    Customer can browse all products in the native WhatsApp catalog view.
    Use when the customer wants to see all available products.

    Args:
        phone: Customer phone number in E.164 format (e.g., +5511999999999).
        body_text: Message text inviting to browse the catalog.

    Returns:
        Success or error message.
    """
    return await _send_full_catalog_impl(phone, body_text)


# ===== PRODUCT TOOLS =====
# underlying implementations (no decorator) for direct calling
def _get_product_info_impl(product_identifier: Optional[str] = None) -> str:
    """
    implementation of get_product_info - can be called directly
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service

        if not product_identifier:
            product = data_service.get_default_product()
        else:
            # try by ID first
            product = data_service.get_product_by_id(product_identifier)

            # try by title if not found
            if not product:
                products = data_service.get_all_products()
                for p in products:
                    if product_identifier.lower() in p['title'].lower():
                        product = p
                        break

        if not product:
            return "Produto não encontrado."

        return data_service.format_product_summary(product['productId'])

    except Exception as e:
        logger.error(f"Error in get_product_info: {e}")
        return f"Error getting product info: {str(e)}"


def _list_all_products_impl() -> str:
    """
    implementation of list_all_products - can be called directly
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service

        products = data_service.get_all_products()

        if not products:
            return "Nenhum produto disponível no momento."

        return data_service.format_product_catalog()

    except Exception as e:
        logger.error(f"Error in list_all_products: {e}")
        return f"Error listing products: {str(e)}"


@function_tool
def get_product_info(product_identifier: Optional[str] = None) -> str:
    """
    Get detailed information about a product.

    Use this to retrieve product details for answering customer questions.

    Args:
        product_identifier: Product ID or title. If not provided, returns the default product.

    Returns:
        Product information as formatted text including price, description, and benefits.
    """
    return _get_product_info_impl(product_identifier)


@function_tool
def list_all_products() -> str:
    """
    Get a list of all available products.

    Use this when the customer asks what products are available
    or wants to see all options.

    Returns:
        Formatted list of all products with titles and prices.
    """
    return _list_all_products_impl()


def _get_product_details_impl(product_id: str) -> str:
    """
    implementation of get_product_details - can be called directly
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service

        product = data_service.get_product_by_id(product_id)

        if not product:
            # try to find by title
            products = data_service.get_all_products()
            for p in products:
                if product_id.lower() in p.get('title', '').lower():
                    product = p
                    break

        if not product:
            return "Produto não encontrado."

        # format detailed response
        lines = [
            f"📦 **{product.get('title', 'Produto')}**",
            f"💳 Preço: {product.get('price', {}).get('formatted', 'N/A')}",
            f"📁 Tipo: {product.get('type', 'ebook')}",
        ]

        if product.get('description'):
            lines.append(f"\n📝 **Descrição:**\n{product['description']}")

        # sales context
        sales_ctx = product.get('salesContext', {})
        if sales_ctx.get('mainBenefit'):
            lines.append(f"\n🎯 **Principal Benefício:**\n{sales_ctx['mainBenefit']}")

        if sales_ctx.get('targetAudience'):
            lines.append(f"\n👥 **Público-Alvo:**\n{sales_ctx['targetAudience']}")

        # RAG context
        rag_ctx = product.get('ragContext', {})
        if rag_ctx.get('summary'):
            lines.append(f"\n📖 **Resumo do Conteúdo:**\n{rag_ctx['summary']}")

        if rag_ctx.get('topics'):
            lines.append("\n📚 **Tópicos Abordados:**")
            for topic in rag_ctx['topics']:
                lines.append(f"  • {topic}")

        if rag_ctx.get('benefits'):
            lines.append("\n✨ **Benefícios:**")
            for benefit in rag_ctx['benefits']:
                lines.append(f"  • {benefit}")

        if rag_ctx.get('contentDetails'):
            lines.append(f"\n📄 **Detalhes do Conteúdo:**\n{rag_ctx['contentDetails']}")

        # FAQ
        if rag_ctx.get('faq'):
            lines.append("\n❓ **Perguntas Frequentes:**")
            for faq in rag_ctx['faq'][:5]:
                lines.append(f"  P: {faq.get('question', '')}")
                lines.append(f"  R: {faq.get('answer', '')}")
                lines.append("")

        # objection responses
        if sales_ctx.get('objectionResponses'):
            lines.append("\n🛡️ **Respostas para Objeções:**")
            for obj, resp in sales_ctx['objectionResponses'].items():
                lines.append(f'  "{obj}":')
                lines.append(f"  → {resp}")
                lines.append("")

        return '\n'.join(lines)

    except Exception as e:
        logger.error(f"Error in get_product_details: {e}")
        return f"Error getting product details: {str(e)}"


def _answer_customer_question_impl(product_id: str, question: str) -> str:
    """
    implementation of answer_customer_question - can be called directly
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service

        # try to find answer using RAG context
        answer = data_service.find_answer_for_question(product_id, question)

        if answer:
            return f"✅ Resposta encontrada:\n{answer}"

        # if no direct answer, return product summary
        product = data_service.get_product_by_id(product_id)
        if product:
            sales_ctx = product.get('salesContext', {})
            rag_ctx = product.get('ragContext', {})

            context_parts = []
            if sales_ctx.get('mainBenefit'):
                context_parts.append(f"Benefício principal: {sales_ctx['mainBenefit']}")
            if rag_ctx.get('summary'):
                context_parts.append(f"Resumo: {rag_ctx['summary']}")
            if rag_ctx.get('topics'):
                context_parts.append(f"Tópicos: {', '.join(rag_ctx['topics'][:3])}")

            if context_parts:
                return f"ℹ Não encontrei resposta específica, mas aqui está o contexto:\n" + '\n'.join(context_parts)

        return "❌ Não encontrei informações específicas para responder essa pergunta."

    except Exception as e:
        logger.error(f"Error in answer_customer_question: {e}")
        return f"Error answering question: {str(e)}"


def _get_objection_response_impl(product_id: str, objection: str) -> str:
    """
    implementation of get_objection_response - can be called directly
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service

        response = data_service.get_objection_response(product_id, objection)

        if response:
            return f"✅ Resposta para objeção:\n{response}"

        # try to find in any product
        products = data_service.get_all_products()
        for product in products:
            sales_ctx = product.get('salesContext', {})
            responses = sales_ctx.get('objectionResponses', {})
            for key, resp in responses.items():
                if objection.lower() in key.lower() or key.lower() in objection.lower():
                    return f"✅ Resposta para objeção:\n{resp}"

        return "❌ Não encontrei resposta específica para essa objeção. Tente abordar com empatia e foco nos benefícios."

    except Exception as e:
        logger.error(f"Error in get_objection_response: {e}")
        return f"Error getting objection response: {str(e)}"


@function_tool
def get_product_details(product_id: str) -> str:
    """
    Get detailed information about a product including RAG context.

    Returns comprehensive product information including topics, benefits,
    FAQ, and objection responses. Use for answering detailed questions.

    Args:
        product_id: The product ID to get details for.

    Returns:
        Detailed product information with RAG context, topics, and benefits.
    """
    return _get_product_details_impl(product_id)


@function_tool
def answer_customer_question(product_id: str, question: str) -> str:
    """
    Find an answer for a customer question using RAG context.

    Searches the product's knowledge base to find relevant answers.
    Use when a customer asks specific questions about product content.

    Args:
        product_id: The product ID to search within.
        question: The customer's question to answer.

    Returns:
        Answer if found, or indication that no specific answer is available.
    """
    return _answer_customer_question_impl(product_id, question)


@function_tool
def get_objection_response(product_id: str, objection: str) -> str:
    """
    Get a pre-defined response for a customer objection.

    Use when a customer raises objections like "it's too expensive",
    "I don't have time", "I need to think about it", etc.

    Args:
        product_id: The product ID related to the objection.
        objection: The customer's objection text.

    Returns:
        Empathetic response for handling the objection.
    """
    return _get_objection_response_impl(product_id, objection)


# ===== ORDER & PAYMENT TOOLS =====

# Track recent order creations to prevent duplicates (phone -> timestamp)
_recent_order_tracker: Dict[str, datetime] = {}
ORDER_DEDUP_SECONDS = 30  # Prevent duplicate orders within 30 seconds


async def _create_order_and_send_payment_impl(phone: str, product_id: Optional[str] = None) -> str:
    """
    implementation of create_order_and_send_payment - can be called directly
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service
        db = runtime.db

        phone = ensure_phone_has_plus(phone)

        # === DUPLICATE ORDER PREVENTION ===
        # Check if we already created an order for this user recently
        dedup_key = f"{runtime.creator_id}:{phone}"
        last_order_time = _recent_order_tracker.get(dedup_key)
        if last_order_time and (datetime.now() - last_order_time).total_seconds() < ORDER_DEDUP_SECONDS:
            logger.warning(f"⚠️ Duplicate order prevented for {phone} - order created {(datetime.now() - last_order_time).total_seconds():.0f}s ago")
            msg = "Pedido já foi criado. Aguarde a confirmação do pagamento. ⏳"
            await _send_text_message_impl(phone, msg)
            return msg

        # Also check conversation state for existing pending order
        try:
            state = await db.load_conversation_state(phone)
            existing_order_id = state.get('context', {}).get('order_id')
            if existing_order_id and state.get('state') == 'checkout':
                logger.info(f"📋 User {phone} already has pending order {existing_order_id}")

                # Try to resend the payment link for the existing order
                try:
                    order_ref = db.get_creator_ref().collection("orders").document(existing_order_id)
                    order_doc = order_ref.get()

                    if order_doc.exists:
                        order_data = order_doc.to_dict()
                        payment_link = order_data.get('payment_link')
                        pix_copia_cola = order_data.get('pix_copia_cola')

                        if payment_link or pix_copia_cola:
                            # Resend the payment using send_pix_payment_to_customer
                            from src.utils.payment import send_pix_payment_to_customer
                            payment_info = {
                                'payment_link': payment_link,
                                'qr_code_text': pix_copia_cola,
                                'qr_code': order_data.get('qr_code_url')
                            }
                            amount = order_data.get('totalAmount', 0)
                            product_name = order_data.get('items', [{}])[0].get('title', 'seu produto') if order_data.get('items') else 'seu produto'

                            await send_pix_payment_to_customer(
                                phone=phone,
                                payment_info=payment_info,
                                amount=amount,
                                product_name=product_name,
                                order_id=existing_order_id
                            )

                            # Just resend the link, no extra message
                            logger.info(f"✅ Resent payment link for pending order {existing_order_id}")
                            return "Payment link resent"
                except Exception as resend_error:
                    logger.warning(f"Could not resend payment for order {existing_order_id}: {resend_error}")

                # If we couldn't resend payment link, create a new order instead
                logger.info(f"📋 Creating new order since couldn't resend payment for {existing_order_id}")
                # Fall through to create new order
        except Exception as e:
            logger.debug(f"Could not check existing order state: {e}")

        # get product
        if not product_id:
            product = data_service.get_default_product()
        else:
            product = data_service.get_product_by_id(product_id)

        if not product:
            return "Produto não encontrado."

        # get product price (handle both 'amount' nested and direct formats)
        # NOTE: price in Firestore is stored in REAIS (e.g., 47 = R$ 47.00)
        # PagSeguro and payment functions expect CENTS (e.g., 4700 = R$ 47.00)
        price_data = product.get('price', {})
        if isinstance(price_data, dict):
            product_price_reais = price_data.get('amount', 0)
            price_formatted = price_data.get('formatted', 'Grátis')
            currency = price_data.get('currency', 'BRL')
        else:
            product_price_reais = float(price_data) if price_data else 0
            price_formatted = f"R$ {product_price_reais:.2f}".replace('.', ',') if product_price_reais > 0 else 'Grátis'
            currency = 'BRL'

        # Convert to cents for payment APIs
        product_price_cents = int(product_price_reais * 100)

        # ===== FREE PRODUCT HANDLING =====
        # if product price is 0 OR below PagSeguro minimum (R$ 1.00), deliver immediately without payment
        # PagSeguro requires minimum of 100 cents (R$ 1.00) for PIX
        PAGSEGURO_MIN_CENTS = 100
        if product_price_reais == 0 or product_price_cents < PAGSEGURO_MIN_CENTS:
            is_below_minimum = product_price_cents > 0 and product_price_cents < PAGSEGURO_MIN_CENTS
            if is_below_minimum:
                logger.info(f"💸 LOW-PRICE PRODUCT ({product_price_cents} cents < {PAGSEGURO_MIN_CENTS} cents min): {product['title']} - delivering as free to {phone}")
            else:
                logger.info(f"🎁 FREE PRODUCT: {product['title']} - delivering directly to {phone}")

            # get customer name from conversation state
            state = await db.load_conversation_state(phone)
            customer_name = state.get('customer_name', '')

            # create order marked as completed (no payment needed)
            order_data = {
                'waUserId': phone,
                'customerName': customer_name if customer_name else None,
                'customerPhone': phone,
                'items': [
                    {
                        'productId': product['productId'],
                        'title': product['title'],
                        'productTitle': product['title'],
                        'price': 0,
                        'unitPrice': 0,
                        'totalPrice': 0,
                        'quantity': 1
                    }
                ],
                'totalAmount': 0,
                'currency': currency,
                'paymentStatus': 'completed',  # no payment needed
                'status': 'confirmed',
                'isFree': True
            }

            order_id = db.create_order(order_data)

            # send free product message
            product_title = product.get('title', 'Produto')
            delivery_info = product.get('delivery', {})
            file_url = delivery_info.get('fileUrl') or product.get('fileUrl', '')

            if is_below_minimum:
                free_message = (
                    f"🎁 *{product_title}* - Cortesia!\n\n"
                    f"✅ Aqui está seu acesso:"
                )
            else:
                free_message = (
                    f"🎉 *{product_title}*\n\n"
                    f"Este produto é *gratuito*! Sem nenhum custo para você.\n\n"
                    f"✅ Aqui está seu acesso:"
                )

            await send_whatsapp_text(phone, free_message)
            _mark_message_sent(phone)

            # send the product file/link if available
            if file_url:
                access_message = f"📥 *Acesse aqui:*\n{file_url}"
                await send_whatsapp_text(phone, access_message)
                _mark_message_sent(phone)

            # update conversation state
            state = await db.load_conversation_state(phone)
            state['state'] = 'fechado'
            state['context'] = state.get('context', {})
            state['context']['order_id'] = order_id
            state['context']['product_id'] = product['productId']
            state['context']['is_free'] = True
            await db.save_conversation_state(phone, state)

            # log interaction
            db.log_interaction(phone, "free_product", f"Free product delivered: {product_title}", source="agent", metadata={"order_id": order_id, "product_id": product['productId']})

            return f"Free product '{product_title}' delivered successfully"

        # ===== PAID PRODUCT HANDLING =====
        # get customer name from conversation state (before creating order)
        state = await db.load_conversation_state(phone)
        customer_name = state.get('customer_name', '')

        # create order for paid product (store price in reais for records)
        order_data = {
            'waUserId': phone,
            'customerName': customer_name if customer_name else None,
            'customerPhone': phone,
            'items': [
                {
                    'productId': product['productId'],
                    'title': product['title'],
                    'productTitle': product['title'],
                    'price': product_price_reais,
                    'unitPrice': product_price_reais,
                    'totalPrice': product_price_reais,
                    'quantity': 1
                }
            ],
            'totalAmount': product_price_reais,
            'currency': currency,
            'paymentStatus': 'pending',
            'status': 'pending',
            'productTitle': product.get('title', 'Produto')
        }

        order_id = db.create_order(order_data)

        if not order_id:
            return "Erro ao criar pedido. Tente novamente."

        # Update dedup tracker to prevent duplicate orders
        _recent_order_tracker[dedup_key] = datetime.now()
        logger.info(f"✅ Order {order_id} created for {phone}, dedup tracker updated")

        # Create PagSeguro PIX payment using Orders API (PIX Copia e Cola - better UX)
        payment_created = False

        if is_pagseguro_configured():
            product_title = product.get('title', 'Produto Digital')

            # Use Orders API - returns PIX Copia e Cola code directly (fewer steps for customer)
            logger.info(f"🔄 Creating PIX Copia e Cola for order {order_id}, amount: {product_price_cents} cents (R$ {product_price_reais:.2f})")
            payment_info = await create_pagseguro_pix_order(
                order_id=order_id,
                amount=product_price_cents,  # PagSeguro expects cents
                customer_name=customer_name,
                customer_phone=phone,
                product_name=product_title
            )

            if payment_info:
                # Update order with payment info and PIX code
                db.update_order(order_id, {
                    'paymentId': payment_info['payment_id'],
                    'paymentMethod': 'pix',
                    'qr_code_url': payment_info.get('qr_code'),
                    'qr_code_text': payment_info.get('qr_code_text'),
                    'pix_copia_cola': payment_info.get('qr_code_text')  # Store PIX code for HTML page
                })

                # Send PIX payment to customer (uses custom HTML page with copy button)
                success = await send_pix_payment_to_customer(
                    phone=phone,
                    payment_info=payment_info,
                    amount=product_price_cents,  # expects cents
                    product_name=product_title,
                    order_id=order_id  # needed for PIX HTML page URL
                )

                if success:
                    payment_created = True
                    _mark_message_sent(phone)
                    logger.info(f"✅ PIX Copia e Cola sent for order {order_id}")
                    db.log_interaction(phone, "payment", f"PIX code sent for order {order_id}", source="agent", metadata={"order_id": order_id, "amount": product_price_cents})
                else:
                    logger.warning(f"Failed to send PIX payment to customer for order {order_id}")
            else:
                logger.warning(f"Failed to create PagSeguro PIX order for order {order_id}")

        # FALLBACK: manual PIX instructions
        if not payment_created:
            pix_key = os.getenv("PIX_FALLBACK_KEY", "")

            if pix_key:
                await send_manual_pix_instructions(
                    phone=phone,
                    amount=product_price_cents,  # expects cents
                    pix_key=pix_key
                )
                _mark_message_sent(phone)
                # log agent payment message to Firestore
                db.log_interaction(phone, "payment", f"Manual PIX instructions sent for order {order_id}", source="agent", metadata={"order_id": order_id, "pix_key": pix_key})
            else:
                # generic payment message
                message = (
                    f"✅ *Pedido criado com sucesso!*\n\n"
                    f"📦 Produto: {product['title']}\n"
                    f"💳 Valor: {price_formatted}\n\n"
                    f"🔐 ID do Pedido: `{order_id}`\n\n"
                    f"Para finalizar, faça o pagamento via PIX.\n"
                    f"Após a confirmação, você receberá o produto imediatamente! 🎉"
                )
                await send_whatsapp_text(phone, message)
                _mark_message_sent(phone)
                # log agent payment message to Firestore
                db.log_interaction(phone, "text", message, source="agent", metadata={"order_id": order_id})

        # update conversation state
        state = await db.load_conversation_state(phone)
        state['state'] = 'checkout'
        state['context'] = state.get('context', {})
        state['context']['order_id'] = order_id
        state['context']['product_id'] = product['productId']
        await db.save_conversation_state(phone, state)

        return f"Order {order_id} created and payment instructions sent"

    except Exception as e:
        logger.error(f"Error in create_order_and_send_payment: {e}")
        return f"Error creating order: {str(e)}"


@function_tool
async def create_order_and_send_payment(phone: str, product_id: Optional[str] = None) -> str:
    """
    Create an order and send payment instructions to the customer.

    Creates a new order in the system and sends PIX payment instructions.
    Use when the customer confirms they want to buy.

    Args:
        phone: Customer phone number in E.164 format (e.g., +5511999999999).
        product_id: Product ID to order. If not provided, uses the default product.

    Returns:
        Success message confirming order creation and payment instructions sent.
    """
    return await _create_order_and_send_payment_impl(phone, product_id)


# ===== SUPPORT TOOLS =====
async def _enable_human_takeover_impl(phone: str, reason: str) -> str:
    """
    Enable human takeover for a conversation.

    Args:
        phone: Customer phone number to enable human takeover for.
        reason: Reason for enabling human takeover (e.g., complaint, complex issue).

    Returns:
        Success message confirming human takeover is enabled.
    """
    try:
        runtime = get_runtime()
        phone = ensure_phone_has_plus(phone)

        # enable human takeover in Firestore
        runtime.db.enable_human_takeover(phone, reason)

        # log the handoff
        runtime.db.log_interaction(
            phone, "human_takeover",
            f"Human takeover enabled: {reason}",
            source="agent",
            metadata={"reason": reason}
        )

        # notify the customer
        notification_message = (
            "🙋 Entendi! Vou transferir você para um atendente humano.\n\n"
            "Aguarde um momento que alguém da nossa equipe vai te ajudar em breve!"
        )
        await send_whatsapp_text(phone, notification_message)
        _mark_message_sent(phone)

        logger.info(f"👋 Human takeover enabled for {phone}: {reason}")
        return f"Human takeover enabled for {phone}. Reason: {reason}"

    except Exception as e:
        logger.error(f"Error enabling human takeover: {e}")
        return f"Error enabling human takeover: {str(e)}"


@function_tool
async def enable_human_takeover(phone: str, reason: str) -> str:
    """
    Enable human takeover for a conversation when the AI cannot handle the request.

    Use this when:
    - Customer explicitly asks to speak with a human
    - Complex complaint or issue that requires human judgment
    - Customer is frustrated or angry
    - Technical issues that AI cannot resolve

    Args:
        phone: Customer phone number to enable human takeover for.
        reason: Brief description of why human takeover is needed.

    Returns:
        Success message confirming human takeover is enabled.
    """
    return await _enable_human_takeover_impl(phone, reason)


async def _deliver_free_product_impl(phone: str, product_id: str) -> str:
    """
    Deliver a free product to the customer using WhatsApp templates when available.

    Args:
        phone: Customer phone number to deliver the product to.
        product_id: ID of the free product to deliver.

    Returns:
        Success message with delivery details.
    """
    try:
        runtime = get_runtime()
        data_service = runtime.data_service
        db = runtime.db
        phone = ensure_phone_has_plus(phone)

        # get product
        product = data_service.get_product_by_id(product_id)
        if not product:
            return f"Product {product_id} not found"

        # verify it's actually free
        price_data = product.get('price', {})
        price_amount = price_data.get('amount', 0) if isinstance(price_data, dict) else (price_data or 0)

        if price_amount > 0:
            return f"Product {product.get('title', 'Unknown')} is not free (price: {price_amount})"

        product_title = product.get('title', 'Produto')
        delivery_info = product.get('delivery', {})
        file_url = delivery_info.get('fileUrl') or delivery_info.get('url') or product.get('fileUrl', '')
        delivery_message = delivery_info.get('message', '')

        # check for Meta catalog info (for template)
        meta_catalog = product.get('metaCatalog', {})
        catalog_id = meta_catalog.get('catalogId')
        # retailerId is inside metaCatalog
        retailer_id = meta_catalog.get('retailerId') or product.get('productId')

        # get customer name from conversation state
        state = await db.load_conversation_state(phone)
        customer_name = state.get('customer_name', '')

        # create order marked as completed (no payment needed)
        order_data = {
            'waUserId': phone,
            'customerName': customer_name if customer_name else None,
            'customerPhone': phone,
            'items': [
                {
                    'productId': product_id,
                    'title': product_title,
                    'productTitle': product_title,
                    'price': 0,
                    'unitPrice': 0,
                    'totalPrice': 0,
                    'quantity': 1
                }
            ],
            'totalAmount': 0,
            'currency': 'BRL',
            'paymentStatus': 'completed',
            'status': 'confirmed',
            'isFree': True
        }

        order_id = db.create_order(order_data)

        # === DELIVERY METHOD SELECTION ===
        product_sent = False

        # OPTION 1: use Interactive SPM (FREE - product card from catalog)
        if catalog_id and retailer_id:
            logger.info(f"📦 Delivering via interactive SPM: catalog={catalog_id}, retailer={retailer_id} (FREE)")
            result = await send_single_product_message(
                phone=phone,
                product_retailer_id=retailer_id,
                catalog_id=catalog_id,
                body_text=f"🎁 Aqui está seu {product_title}! 👇"
            )
            if "successfully" in result.lower():
                product_sent = True
                logger.info(f"✅ Interactive SPM sent for {product_title}")

        # OPTION 2: send as document (if it's a file like PDF/ebook)
        if not product_sent and file_url:
            # Check if it's a document type
            doc_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar']
            is_document = any(ext in file_url.lower() for ext in doc_extensions)

            if is_document:
                logger.info(f"📄 Delivering as document: {file_url[:50]}...")
                # send confirmation message first
                confirm_msg = (
                    f"🎉 *Parabéns!*\n\n"
                    f"Seu *{product_title}* está sendo enviado!\n\n"
                    f"{delivery_message}" if delivery_message else f"🎉 *Parabéns!*\n\nSeu *{product_title}* está sendo enviado!"
                )
                await send_whatsapp_text(phone, confirm_msg)
                _mark_message_sent(phone)

                # then send the document
                result = await send_whatsapp_document(
                    phone=phone,
                    document_url=file_url,
                    caption=f"📚 {product_title}",
                    filename=f"{product_title}.pdf"
                )
                if "successfully" in result.lower():
                    product_sent = True
                    logger.info(f"✅ Document sent for {product_title}")

        # OPTION 3: Fallback to text message with link
        if not product_sent:
            confirmation_msg = (
                f"🎉 *Parabéns!*\n\n"
                f"Aqui está seu acesso ao *{product_title}*:\n\n"
            )

            if delivery_message:
                confirmation_msg += f"{delivery_message}\n\n"

            if file_url:
                confirmation_msg += f"📥 *Acesse aqui:*\n{file_url}"
            else:
                confirmation_msg += "✅ Você receberá o acesso em breve!"

            await send_whatsapp_text(phone, confirmation_msg)
            _mark_message_sent(phone)

        # update conversation state
        state = await db.load_conversation_state(phone)
        state['state'] = 'fechado'
        state['context'] = state.get('context', {})
        state['context']['order_id'] = order_id
        state['context']['product_id'] = product_id
        state['context']['is_free'] = True
        await db.save_conversation_state(phone, state)

        # log interaction
        db.log_interaction(
            phone, "free_product",
            f"Free product delivered: {product_title}",
            source="agent",
            metadata={"order_id": order_id, "product_id": product_id}
        )

        logger.info(f"🎁 Free product '{product_title}' delivered to {phone}")
        return f"Free product '{product_title}' delivered successfully to {phone}"

    except Exception as e:
        logger.error(f"Error delivering free product: {e}")
        return f"Error delivering free product: {str(e)}"


@function_tool
async def deliver_free_product(phone: str, product_id: str) -> str:
    """
    Deliver a free product (lead magnet) to the customer.

    Use this when the customer has expressed interest in a free product
    and confirmed they want to receive it.

    Args:
        phone: Customer phone number to deliver the product to.
        product_id: ID of the free product to deliver.

    Returns:
        Success message confirming the product was delivered.
    """
    return await _deliver_free_product_impl(phone, product_id)


async def _check_order_status_impl(phone: str) -> str:
    """
    Check the status of orders for a customer.

    Args:
        phone: Customer phone number to check orders for.

    Returns:
        Order status information.
    """
    try:
        runtime = get_runtime()
        db = runtime.db
        phone = ensure_phone_has_plus(phone)

        # get recent orders for this phone
        orders = db.get_orders_by_phone(phone)

        if not orders:
            return "Não encontrei nenhum pedido para este número. Você já fez alguma compra conosco?"

        # format order information
        order_lines = []
        for order in orders[:3]:  # show last 3 orders
            order_id = order.get('id', 'N/A')
            status = order.get('status', 'unknown')
            payment_status = order.get('paymentStatus', 'unknown')
            product_title = order.get('productTitle', 'Produto')

            # map status to Portuguese
            status_map = {
                'created': 'Aguardando pagamento',
                'pending': 'Pendente',
                'confirmed': 'Confirmado',
                'paid': 'Pago',
                'completed': 'Concluído',
                'cancelled': 'Cancelado',
                'refunded': 'Reembolsado'
            }
            status_pt = status_map.get(status, status)

            payment_map = {
                'pending': '⏳ Aguardando',
                'processing': '🔄 Processando',
                'completed': '✅ Pago',
                'failed': '❌ Falhou',
                'refunded': '↩️ Reembolsado'
            }
            payment_pt = payment_map.get(payment_status, payment_status)

            order_lines.append(
                f"📦 *{product_title}*\n"
                f"   Status: {status_pt}\n"
                f"   Pagamento: {payment_pt}\n"
                f"   ID: `{order_id[:8]}...`"
            )

        result = "📋 *Seus Pedidos:*\n\n" + "\n\n".join(order_lines)

        # add help note
        result += "\n\n💬 Se precisar de ajuda com algum pedido, me avise!"

        return result

    except Exception as e:
        logger.error(f"Error checking order status: {e}")
        return f"Desculpe, houve um erro ao verificar seus pedidos. Tente novamente em alguns instantes."


@function_tool
async def check_order_status(phone: str) -> str:
    """
    Check the status of orders for a customer.

    Use this when the customer asks about their order status,
    payment status, or wants to know if their payment was received.

    Args:
        phone: Customer phone number to check orders for.

    Returns:
        Formatted order status information.
    """
    return await _check_order_status_impl(phone)


# ===== TOOL REGISTRY =====
def get_all_tools_for_agent(agent_type: str) -> List[Any]:
    """
    get the appropriate tools for each agent type
    args:
        agent_type: Type of agent (greeter, sales, payment, etc.)
    returns:
        list of function tools
    """
    tool_map = {
        # greeter = first-contact agent: can greet OR answer the initial intent when a workflow forces "greet"
        'greeter': [
            send_greeting_with_products_button,
            send_notify_new_products_button,
            send_text_message,
            set_product_notification_preference,
        ],
        'sales': [
            send_text_message,
            send_notify_new_products_button,
            get_product_info,
            list_all_products,
            get_product_details,
            answer_customer_question,
            get_objection_response,
            set_product_notification_preference,
            # catalog product messages
            send_product_card,
            send_product_catalog_list,
            send_full_catalog,
        ],
        'payment': [send_text_message, create_order_and_send_payment, check_order_status],
        'delivery': [send_text_message, deliver_free_product],
        'support': [send_text_message, enable_human_takeover, check_order_status, set_product_notification_preference],
        'mentorship_booking': [send_text_message, enable_human_takeover],
        'free_product': [send_text_message, deliver_free_product, get_product_info],
        'acknowledgment': [send_text_message],
    }

    return tool_map.get(agent_type, [send_text_message])
