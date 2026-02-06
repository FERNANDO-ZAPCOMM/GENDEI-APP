"""
Creator runtime management

Owns:
- `CreatorRuntime` dataclass
- Per-creator runtime cache
- Loading creator profile/products/workflows from Firestore
- Building agent runtimes using OpenAI Agents SDK

This is extracted from `src/main.py` to keep the entrypoint small.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Dict, Optional, Any, Union

from src.adapters.firestore import FirestoreAdapter
from src.services.data_service import DataService
from src.services.scheduler import SchedulerService
from src.utils.messaging import send_whatsapp_text
from src.utils.storage import StorageAdapter
from src.workflows import WorkflowExecutor
from src.workflows.contract import NodeType

# Provider abstraction imports
from src.providers.factory import ProviderFactory, get_provider_type
from src.providers.base import BaseAgentFactory, BaseAgent, AgentType
from src.providers.tools.base import register_tool_implementations, get_tool_registry
from src.agents.definitions import get_all_agent_definitions

# Legacy import for backward compatibility
from src.agents.openai_factory import build_agents_for_creator

logger = logging.getLogger(__name__)

# ===== ENVIRONMENT VARIABLES (runtime-scoped) =====
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")

# shared storage adapter
STORAGE_ADAPTER = StorageAdapter()

# Flag to track if tool implementations have been registered
_tools_registered = False


def _ensure_tools_registered():
    """Ensure tool implementations are registered (called once)."""
    global _tools_registered
    if not _tools_registered:
        register_tool_implementations()
        _tools_registered = True
        logger.info("✅ Tool implementations registered")


@dataclass
class CreatorRuntime:
    """
    Runtime context for a creator's WhatsApp agent.
    Uses OpenAI Agents SDK for AI capabilities.
    """
    creator_id: str
    phone_number_id: Optional[str]
    access_token: Optional[str]
    data_service: DataService
    db: FirestoreAdapter
    storage: StorageAdapter
    agents: Dict[str, Any]  # OpenAI Agent instances
    creator_context: str
    product_context: str
    workflow_executor: Optional[WorkflowExecutor] = None
    scheduler: Optional[SchedulerService] = None
    agent_factory: Optional[BaseAgentFactory] = None
    abstracted_agents: Dict[AgentType, BaseAgent] = field(default_factory=dict)


# cache for creator runtimes
creator_runtime_cache: Dict[str, CreatorRuntime] = {}


def _build_creator_context_strings(data_service: DataService) -> tuple[str, str]:
    """
    build context strings for agent prompts
    """
    products = data_service.get_all_products()
    product_types = set()
    product_titles = []
    free_products = []
    paid_products = []

    for p in products:
        product_types.add(p.get('type', 'ebook'))
        product_titles.append(p.get('title', 'Produto'))
        if p.get('price', {}).get('amount', 0) == 0:
            free_products.append(p.get('title', 'Produto'))
        else:
            paid_products.append(
                f"{p.get('title', 'Produto')} ({p.get('price', {}).get('formatted', 'N/A')})"
            )

    # build explicit "what we DON'T offer" list
    all_possible_types = {
        'ebook',
        'course',
        'mentorship',
        'community',
        'consulting',
        'template',
        'software',
        'service',
    }
    types_not_offered = all_possible_types - product_types

    creator_context = f"""
**PERSONALIDADE DO CRIADOR:**
- Nome: {data_service.get_creator_name()}
- Tom: {data_service.get_creator_tone()}
- Traços: {', '.join(data_service.get_creator_personality_traits())}
- Idioma: {data_service.get_creator_language()}
- Nicho: {data_service.get_creator_niche()}

**PRODUTOS DISPONÍVEIS (APENAS ESTES):**
{chr(10).join([f"• {t}" for t in product_titles]) if product_titles else "• Nenhum produto cadastrado"}

**PRODUTOS GRATUITOS:** {', '.join(free_products) if free_products else 'Nenhum'}
**PRODUTOS PAGOS:** {', '.join(paid_products) if paid_products else 'Nenhum'}

⚠️ **REGRAS CRÍTICAS - NUNCA VIOLE:**
1. SÓ mencione produtos que estão listados acima
2. NUNCA invente serviços como mentoria, consultoria ou coaching se não existirem
3. Se perguntarem sobre algo que não oferecemos, diga "No momento não temos esse serviço, mas posso te ajudar com [produtos que temos]"
4. Se tiver produto GRATUITO, destaque-o como forma de conhecer nosso trabalho
5. Use as informações do RAG context para responder perguntas detalhadas

**NÃO OFERECEMOS:** {', '.join(types_not_offered) if types_not_offered else 'Oferecemos todos os tipos'}

{data_service.get_complete_strategy_context()}
"""

    product_context = f"""
**CATÁLOGO DE PRODUTOS:**

{data_service.format_product_catalog()}

**Total de produtos:** {len(data_service.get_all_products())}

**LEMBRE-SE:** Responda perguntas usando o RAG context (resumo, tópicos, FAQ) de cada produto.
Quando alguém perguntar sobre o conteúdo, USE as informações acima para dar respostas específicas e valiosas.
"""

    return creator_context, product_context


def _build_provider_context(
    data_service: DataService,
    creator_profile: Dict[str, Any],
    products_data: list
) -> Dict[str, Any]:
    """
    Build context dictionary for provider abstraction.
    This is passed to agent factories for prompt customization.
    """
    products = data_service.get_all_products()
    free_products = []
    paid_products = []

    for p in products:
        price_data = p.get('price', {})
        if isinstance(price_data, dict):
            price_amount = price_data.get('amount', 0)
        else:
            price_amount = float(price_data) if price_data else 0

        if price_amount == 0:
            free_products.append(p)
        else:
            paid_products.append(p)

    return {
        "creator_id": creator_profile.get('id', ''),
        "creator": {
            "name": data_service.get_creator_name(),
            "niche": data_service.get_creator_niche(),
            "tone": data_service.get_creator_tone(),
            "voiceStyle": creator_profile.get('voiceStyle', 'friendly_coach'),
            "language": data_service.get_creator_language(),
        },
        "products": products,
        "free_products": free_products,
        "paid_products": paid_products,
        "product_count": len(products),
    }


def get_runtime_for_creator(creator_id: str, phone_number_id: Optional[str] = None) -> CreatorRuntime:
    """
    get or create runtime for a creator
    args:
        creator_id: creator ID from Firestore
        phone_number_id: WhatsApp phone number ID
    returns:
        CreatorRuntime instance
    """
    if creator_id in creator_runtime_cache:
        runtime = creator_runtime_cache[creator_id]
        if phone_number_id and runtime.phone_number_id != phone_number_id:
            runtime.phone_number_id = phone_number_id
            # update access token if phone_number_id changed
            channel = runtime.db.get_active_channel(phone_number_id) if phone_number_id else None
            if channel:
                runtime.access_token = channel.get('accessToken')

        # ALWAYS refresh products and profile from Firestore to avoid stale cache
        logger.info(f"🔄 Refreshing data from Firestore for creator '{creator_id}'")
        fresh_products = runtime.db.list_active_products()
        runtime.data_service.refresh_products(fresh_products)
        fresh_profile = runtime.db.get_creator_profile()
        if fresh_profile:
            runtime.data_service.refresh_creator_profile(fresh_profile)

        return runtime

    logger.info(f"🧩 Initializing runtime for creator '{creator_id}'")

    # initialize Firestore adapter
    db_instance = FirestoreAdapter(creator_id)

    # load access token from channel (if phone_number_id provided)
    access_token: Optional[str] = None
    if phone_number_id:
        channel = db_instance.get_active_channel(phone_number_id)
        if channel:
            access_token = channel.get('accessToken')
            logger.info(f"✅ Loaded access token from channel for phone_number_id '{phone_number_id}'")
        else:
            logger.warning(f"⚠️ No active channel found for phone_number_id '{phone_number_id}'")

    # fall back to environment variable if no channel found
    if not access_token:
        access_token = WHATSAPP_TOKEN
        logger.info("⚠️ Using WHATSAPP_TOKEN from environment (no channel found)")

    # load creator profile and products
    creator_profile = db_instance.get_creator_profile()
    products_data = db_instance.list_active_products()

    # load active workflow (validated defensively to avoid runtime failures at scale)
    active_workflow = db_instance.get_active_workflow()
    if active_workflow:
        schema_version = active_workflow.get('schemaVersion', active_workflow.get('version', 1))
        try:
            schema_version_int = int(schema_version or 1)
        except Exception:
            schema_version_int = 1

        if schema_version_int > 1:
            logger.warning(
                f"⚠️ Unsupported workflow schemaVersion={schema_version_int} for creator '{creator_id}'. "
                "Falling back to agent-only routing."
            )
            active_workflow = None
        else:
            nodes = active_workflow.get('nodes') if isinstance(active_workflow.get('nodes'), dict) else {}
            start_node_id = active_workflow.get('startNodeId')
            if not start_node_id or start_node_id not in nodes:
                logger.warning(
                    f"⚠️ Invalid active workflow for creator '{creator_id}' (missing/invalid startNodeId). "
                    "Falling back to agent-only routing."
                )
                active_workflow = None
            else:
                start_node = nodes.get(start_node_id, {})
                start_type = start_node.get('type')
                try:
                    NodeType(start_type)
                except Exception:
                    logger.warning(
                        f"⚠️ Unknown start node type '{start_type}' in workflow for creator '{creator_id}'. "
                        "Falling back to agent-only routing."
                    )
                    active_workflow = None
                else:
                    logger.info(f"🔄 Loaded active workflow: {active_workflow.get('name', 'Unnamed')}")
    if not active_workflow:
        logger.info(f"📋 No active workflow found for creator '{creator_id}'")

    if not creator_profile:
        logger.warning(f"No creator profile found for creator {creator_id}, using defaults")
        creator_profile = {
            'displayName': 'Vendedor',
            'voiceStyle': 'friendly_coach',
            'primaryLanguage': 'pt-BR',
            'showProductsInGreeting': True,
        }

    # initialize data service with workflow
    data_service = DataService(
        preloaded_creator=creator_profile,
        preloaded_products=products_data,
        preloaded_workflow=active_workflow
    )

    # build contexts
    creator_context, product_context = _build_creator_context_strings(data_service)

    # Ensure tool implementations are registered
    _ensure_tools_registered()

    # Build agents using OpenAI (single agent creation path)
    agent_factory = None
    abstracted_agents = {}

    # Build context for provider abstraction
    provider_context = _build_provider_context(data_service, creator_profile, products_data)

    # Use OpenAI factory
    logger.info(f"Building OpenAI agents for creator '{creator_id}'")
    agents = build_agents_for_creator(data_service, creator_context, product_context)

    # create workflow executor if workflow is active
    workflow_executor = None
    if data_service.has_active_workflow():
        workflow_executor = WorkflowExecutor(
            data_service=data_service,
            firestore_adapter=db_instance,
            send_message_fn=send_whatsapp_text
        )
        logger.info(f"🔄 Created workflow executor for creator '{creator_id}'")

    # create scheduler service
    scheduler = SchedulerService(
        firestore_adapter=db_instance,
        send_message_fn=send_whatsapp_text,
        creator_id=creator_id
    )
    logger.info(f"⏰ Created scheduler service for creator '{creator_id}'")

    # create runtime
    runtime = CreatorRuntime(
        creator_id=creator_id,
        phone_number_id=phone_number_id,
        access_token=access_token,
        data_service=data_service,
        db=db_instance,
        storage=STORAGE_ADAPTER,
        agents=agents,
        creator_context=creator_context,
        product_context=product_context,
        workflow_executor=workflow_executor,
        scheduler=scheduler,
        agent_factory=agent_factory,
        abstracted_agents=abstracted_agents,
    )

    creator_runtime_cache[creator_id] = runtime
    logger.info(f"✅ Runtime ready for creator '{creator_id}' with {len(agents)} agent(s) [openai]")
    return runtime
