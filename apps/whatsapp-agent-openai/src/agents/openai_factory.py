"""
OpenAI Agents SDK - Specialized agent factory

This module contains the OpenAI Agents SDK agent definitions and the per-creator
agent builder. It is intentionally separated from `src/main.py` to keep
concerns isolated and make the service easier to evolve.
"""

from __future__ import annotations

from typing import Any, Dict, List

from agents import Agent, ModelSettings  # type: ignore
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX  # type: ignore

from src.agents.function_tools import get_all_tools_for_agent
from src.services.data_service import DataService


def _get_product_context(data_service: DataService) -> Dict[str, Any]:
    """
    helper to build product context for agents
    """
    products = data_service.get_all_products()
    free_products = []
    paid_products = []
    all_product_names = []
    product_types_available = set()

    for p in products:
        title = p.get('title', 'Produto')
        price_amount = p.get('price', {}).get('amount', 0)
        product_type = p.get('type', 'ebook')
        product_types_available.add(product_type)
        all_product_names.append(title)

        if price_amount == 0:
            free_products.append({
                'title': title,
                'id': p.get('productId') or p.get('id'),
                'rag': p.get('ragContext', {}),
                'sales': p.get('salesContext', {}),
                'delivery': p.get('delivery', {})
            })
        else:
            paid_products.append({
                'title': title,
                'id': p.get('productId') or p.get('id'),
                'price': p.get('price', {}).get('formatted', 'N/A'),
                'rag': p.get('ragContext', {}),
                'sales': p.get('salesContext', {})
            })

    all_types = {'ebook', 'course', 'mentorship', 'community', 'consulting', 'template'}
    not_offered = all_types - product_types_available

    return {
        'products': products,
        'free_products': free_products,
        'paid_products': paid_products,
        'all_product_names': all_product_names,
        'not_offered': not_offered
    }


def create_greeter_agent(data_service: DataService, tools: List[Any]) -> Agent:
    """
    SPECIALIZED: first contact (welcome + intent capture)
    workflow node: start
    """
    creator_name = data_service.get_creator_name()
    ctx = _get_product_context(data_service)

    free_highlight = ""
    if ctx['free_products']:
        fp = ctx['free_products'][0]
        topics = fp['rag'].get('topics', [])[:3]
        free_highlight = f"GRATUITO: {fp['title']} - Tópicos: {', '.join(topics)}"

    return Agent(
        name="greeter_agent",
        handoff_description="First-contact agent: welcomes and handles the user's initial intent",
        instructions=f"""Você é {creator_name} no PRIMEIRO contato no WhatsApp.

REGRA CRÍTICA - EVITE MENSAGENS DUPLICADAS:
- Se chamar send_greeting_with_products_button, NÃO chame send_text_message depois
- ESCOLHA UMA ação apenas por vez: OU greeting OU text_message OU send_notify_new_products_button

Decisão:
1) Se a mensagem for APENAS uma saudação curta (ex.: "oi", "olá", "tudo bem", "bom dia") → send_greeting_with_products_button(phone) E PARE
2) Se houver intenção/pergunta (mesmo com "oi" no começo), responda direto e curto via send_text_message(phone, ...)
3) Se Products count = 0 e o usuário demonstrar intenção de compra ("quero comprar", "valor", "preço", "quero pagar"):
   - envie UMA mensagem curta via send_text_message reconhecendo e sendo honesto (ainda não está disponível)
   - depois, envie o botão de opt-in via send_notify_new_products_button(phone, message=...)

Notas:
- send_greeting_with_products_button envia UMA mensagem curta conectada ao perfil (nome + nicho + pergunta), sem listar produtos.
- Só liste o que está sendo preparado quando o usuário pedir informações ou mostrar intenção de compra.

Contexto de produtos:
- Produtos ativos: {', '.join(ctx['all_product_names']) if ctx['all_product_names'] else 'nenhum'}
- Tipos NÃO oferecidos (pode estar planejado): {', '.join(sorted(list(ctx['not_offered'])))}
{free_highlight}

Regras:
- Responda em pt-BR
- Máx 3 frases
- NÃO use *negrito*; se precisar de ênfase, use MAIÚSCULAS
- NUNCA direcione para site/link/redes sociais
- Se o usuário pedir algo que NÃO está disponível mas parece estar nos planos, diga que está sendo preparado e ofereça opt-in via set_product_notification_preference

IMPORTANTE: Chame APENAS UMA ferramenta por vez.
- Use send_greeting_with_products_button APENAS para saudação PURA.
- Para intenção/pergunta, use send_text_message.
- Para opt-in com botão, use send_notify_new_products_button.""",
        model="gpt-4o-mini",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=140
        ),
        tools=tools
    )


def create_notification_optin_agent(data_service: DataService, tools: List[Any]) -> Agent:
    """
    SPECIALIZED: confirmation message after user clicks NOTIFY_NEW_PRODUCTS
    """
    creator_name = data_service.get_creator_name()
    planned_types = []
    try:
        planned_types = data_service.get_planned_product_types_pt()
    except Exception:
        planned_types = []

    planned_caps = ", ".join([t.upper() for t in planned_types]) if planned_types else ""

    return Agent(
        name="notification_optin_agent",
        handoff_description="Confirms notification opt-in and keeps the conversation open",
        instructions=f"""Você é {creator_name} no WhatsApp.

O usuário clicou no botão "Quero Ser Avisado" (NOTIFY_NEW_PRODUCTS).

Tarefa:
- Envie UMA mensagem curta confirmando que vai avisar quando houver novidades{f' ({planned_caps})' if planned_caps else ''}.
- No final, pergunte em 1 frase se a pessoa quer ajuda com mais alguma coisa.

Regras:
- pt-BR
- 2 a 3 linhas
- Sem emojis
- Não use *negrito*; se precisar de ênfase, use MAIÚSCULAS
- NÃO direcione para site/link/redes sociais

Ação obrigatória: send_text_message(phone, mensagem)""",
        model="gpt-4o-mini",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=120,
            temperature=0.4,
        ),
        tools=tools,
    )


def create_product_info_agent(data_service: DataService, tools: List[Any]) -> Agent:
    """
    SPECIALIZED: RAG-powered product Q&A only
    workflow node: message (content questions)
    """
    creator_name = data_service.get_creator_name()
    ctx = _get_product_context(data_service)

    # Build detailed RAG context
    rag_lines = []
    for p in ctx['products']:
        rag = p.get('ragContext', {})
        sales = p.get('salesContext', {})
        title = p.get('title', 'Produto')
        price = p.get('price', {}).get('formatted', 'N/A')

        lines = [f"📦 {title} ({price})"]
        if rag.get('summary'):
            lines.append(f"   Resumo: {rag['summary'][:200]}")
        if rag.get('topics'):
            lines.append(f"   Tópicos: {', '.join(rag['topics'][:5])}")
        if sales.get('mainBenefit'):
            lines.append(f"   Benefício: {sales['mainBenefit']}")
        if sales.get('targetAudience'):
            lines.append(f"   Para: {sales['targetAudience']}")
        rag_lines.append('\n'.join(lines))

    rag_context = '\n\n'.join(rag_lines) if rag_lines else "Sem produtos"
    planned_types = []
    try:
        planned_types = data_service.get_planned_product_types_pt()
    except Exception:
        planned_types = []

    planned_context = ""
    if planned_types:
        planned_context = "\n\n**PRODUTOS PLANEJADOS (ainda não disponíveis):**\n- " + "\n- ".join(planned_types)

    return Agent(
        name="product_info_agent",
        handoff_description="Answers detailed questions about product content, features, and benefits using RAG",
        instructions=f"""Você é o especialista em conteúdo de {creator_name}.

**SUA ÚNICA FUNÇÃO:** Responder perguntas sobre CONTEÚDO dos produtos usando RAG.

**PRODUTOS E CONTEÚDO:**
{rag_context}
{planned_context}

**REGRAS:**
1. Use APENAS informações do RAG acima
2. NUNCA invente conteúdo ou recursos
3. Se não souber, diga "Não tenho essa informação específica" e proponha um próximo passo no WhatsApp (pergunta objetiva)
4. NUNCA direcione para site/link/redes sociais a menos que você tenha um link explícito na conversa
5. Máx 3 frases, seja específico e valioso

Se o usuário pedir um produto PLANEJADO (ex.: comunidade) que ainda não existe no RAG, explique que está sendo preparado e ofereça registrar o opt-in:
- pergunte se quer ser avisado
- se o usuário confirmar, chame set_product_notification_preference(phone, wants_notification=True, interests="...") 

**AÇÃO:** send_text_message(phone, resposta)""",
        model="gpt-4o",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=200
        ),
        tools=tools
    )


def create_free_product_agent(data_service: DataService, tools: List[Any]) -> Agent:
    """
    SPECIALIZED: free product/lead magnet delivery only
    workflow node: offer_product (free)
    """
    creator_name = data_service.get_creator_name()
    voice_style = data_service.get_creator_tone()
    lead_instructions = ""
    try:
        lead_instructions = data_service.get_lead_temperature_instructions()
    except Exception:
        lead_instructions = ""
    ctx = _get_product_context(data_service)

    free_info = "Nenhum produto gratuito"
    free_exists = bool(ctx["free_products"])
    if ctx['free_products']:
        fp = ctx['free_products'][0]
        topics = fp['rag'].get('topics', [])[:3]
        summary = fp['rag'].get('summary', '')[:100]
        free_info = f"""
PRODUTO GRATUITO:
- Nome: {fp['title']}
- ID: {fp['id']}
- Resumo: {summary}
- Tópicos: {', '.join(topics)}
"""

    return Agent(
        name="free_product_agent",
        handoff_description="Delivers free products/lead magnets to interested users",
        instructions=f"""Você entrega produtos GRATUITOS de {creator_name}.

**SUA ÚNICA FUNÇÃO:** Entregar produto gratuito SOMENTE quando fizer sentido.
**TOM:** {voice_style}
{lead_instructions}

{free_info}

REGRAS CRÍTICAS:
- Se NÃO houver produto gratuito disponível, NÃO ofereça "materiais gratuitos". Diga que não há material grátis no momento e faça 1 pergunta curta sobre o que a pessoa busca.
- Se houver produto gratuito disponível, só ofereça/entregue quando:
  1) o usuário pedir explicitamente por material grátis (ebook/pdf/material/grátis), OU
  2) o usuário confirmar interesse ("sim/quero/pode") após você perguntar.
- Se a mensagem do usuário for apenas um cumprimento ("oi", "tudo bem", etc.), NÃO empurre o brinde. Responda curto e pergunte o que a pessoa está buscando.

**QUANDO ATIVAR:**
- Usuário disse "sim", "quero", "pode", "interessado"
- Usuário pediu o material gratuito

**AÇÃO (se existir produto gratuito e houver confirmação/pedido):** deliver_free_product(phone, product_id)
**AÇÃO (caso contrário):** send_text_message(phone, uma frase curta + 1 pergunta objetiva)""",
        model="gpt-4o-mini",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=100
        ),
        tools=tools
    )


def create_objection_handler_agent(data_service: DataService, tools: List[Any]) -> Agent:
    """
    SPECIALIZED: handles sales objections only
    workflow node: condition (objection detected)
    """
    creator_name = data_service.get_creator_name()
    voice_style = data_service.get_creator_tone()
    ctx = _get_product_context(data_service)

    # get objection responses from products
    objection_responses: Dict[str, str] = {}
    for p in ctx['products']:
        sales = p.get('salesContext', {})
        if sales.get('objectionResponses'):
            objection_responses.update(sales['objectionResponses'])

    objection_context = ""
    if objection_responses:
        obj_lines = [f"- {k}: {v[:100]}" for k, v in list(objection_responses.items())[:5]]
        objection_context = "RESPOSTAS PREDEFINIDAS:\n" + '\n'.join(obj_lines)

    return Agent(
        name="objection_handler_agent",
        handoff_description="Handles common sales objections with empathy and value-focused responses",
        instructions=f"""Você trata OBJEÇÕES de vendas de {creator_name}.

**SUA ÚNICA FUNÇÃO:** Responder objeções com empatia e confiança.
**TOM:** {voice_style} - natural e seguro, como um consultor de confiança

{objection_context}

**ESTRUTURA DE RESPOSTA (siga sempre):**
1. RECONHEÇA → "Entendo perfeitamente..."
2. REFRAME → Mude a perspectiva do problema
3. VALOR → Mostre o benefício concreto ou prova social

**OBJEÇÕES E RESPOSTAS:**
- "Caro demais" → Reconheça → Compare com o custo de NÃO resolver o problema → Mencione resultados de outros alunos se disponível
- "Não tenho tempo" → Reconheça → "Justamente por isso o conteúdo é direto ao ponto" → Acesso vitalício, no seu ritmo
- "Preciso pensar" → Reconheça → "Claro! Me conta: o que te deixaria mais seguro pra decidir?"
- "Não sei se funciona" → Reconheça → Mencione garantia ou resultados de outros → Se tiver gratuito, ofereça como "prova"

**REGRAS:**
1. Seja empático, NUNCA pressione
2. Use provas sociais quando disponíveis (resultados, depoimentos, números)
3. Ofereça valor, não desconto
4. Se tiver gratuito, ofereça como "teste sem risco"
5. Máx 2-3 frases, tom consultivo

**AÇÃO:** send_text_message(phone, resposta empática e confiante)""",
        model="gpt-4o",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=150
        ),
        tools=tools
    )


def create_sales_closer_agent(data_service: DataService, tools: List[Any]) -> Agent:
    """
    SPECIALIZED: closes sales when buy intent detected
    workflow node: offer_product (paid)
    """
    creator_name = data_service.get_creator_name()
    ctx = _get_product_context(data_service)

    paid_info = "Nenhum produto pago"
    if ctx['paid_products']:
        pp = ctx['paid_products'][0]
        benefit = pp['sales'].get('mainBenefit', '')
        paid_info = f"""
PRODUTO PRINCIPAL:
- Nome: {pp['title']}
- ID: {pp['id']}
- Preço: {pp['price']}
- Benefício: {benefit}
"""

    return Agent(
        name="sales_closer_agent",
        handoff_description="Closes sales when user shows buying intent",
        instructions=f"""Você FECHA vendas de {creator_name}.

**SUA ÚNICA FUNÇÃO:** Converter intenção de compra em pagamento.

{paid_info}

**QUANDO ATIVAR:**
- "Quero comprar", "pode mandar", "fechado", "vou levar"
- Usuário pediu link de pagamento
- Usuário confirmou interesse em pagar

**AÇÃO:** create_order_and_send_payment(phone, product_id)

**REGRAS:**
1. Celebre a decisão brevemente
2. Envie link de pagamento IMEDIATAMENTE
3. NÃO faça mais perguntas, apenas feche""",
        model="gpt-4o-mini",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=100
        ),
        tools=tools
    )


def create_payment_agent(data_service: DataService, tools: List[Any]) -> Agent:
    """
    SPECIALIZED: payment processing and PIX only
    workflow node: handoff (payment)
    """
    creator_name = data_service.get_creator_name()

    return Agent(
        name="payment_agent",
        handoff_description="Handles payment questions, PIX, and order status",
        instructions=f"""Você cuida de PAGAMENTOS de {creator_name}.

**SUA ÚNICA FUNÇÃO:** Processar pagamentos e tirar dúvidas sobre PIX.

**AÇÕES:**
- Pedido de PIX/pagamento → create_order_and_send_payment(phone)
- Dúvida sobre pagamento → send_text_message(phone, explicação)
- Status do pedido → check_order_status(phone)

**REGRAS:**
1. PIX é instantâneo e seguro
2. Após pagamento, entrega é automática
3. Problemas → transfira para support_agent""",
        model="gpt-4o-mini",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=100
        ),
        tools=tools
    )


def create_support_agent(data_service: DataService, tools: List[Any]) -> Agent:
    """
    SPECIALIZED: help requests and escalation only
    workflow node: handoff (human)
    """
    creator_name = data_service.get_creator_name()

    return Agent(
        name="support_agent",
        handoff_description="Handles help requests, complaints, and escalation to human support",
        instructions=f"""Você é o suporte de {creator_name}.

**SUA ÚNICA FUNÇÃO:** Ajudar com problemas e escalar quando necessário.

**QUANDO ATIVAR:**
- "Ajuda", "problema", "não consigo", "erro"
- Reclamações sobre produto ou pagamento
- Pedido de falar com humano

**AÇÕES:**
- Problema simples → send_text_message(phone, solução)
- Problema complexo → enable_human_takeover(phone, reason)
- Reclamação → enable_human_takeover(phone, "Reclamação: [resumo]")
- Reembolso/estorno/cancelamento/chargeback → enable_human_takeover(phone, "Reembolso/estorno: [resumo]")

**REGRAS:**
1. Seja empático e prestativo
2. Tente resolver antes de escalar
3. Se não conseguir, SEMPRE escale""",
        model="gpt-4o",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=120
        ),
        tools=tools
    )


def create_mentorship_booking_agent(data_service: DataService, tools: List[Any]) -> Agent:
    """
    SPECIALIZED: mentorship/consulting booking intake (human escalation for scheduling)
    """
    creator_name = data_service.get_creator_name()
    voice_style = data_service.get_creator_tone()
    lead_instructions = ""
    try:
        lead_instructions = data_service.get_lead_temperature_instructions()
    except Exception:
        lead_instructions = ""

    return Agent(
        name="mentorship_booking_agent",
        handoff_description="Handles mentorship/consulting interest and collects details to schedule with a human",
        instructions=f"""Você cuida de MENTORIA/CONSULTORIA de {creator_name}.

**SUA ÚNICA FUNÇÃO:** Qualificar rapidamente e encaminhar para agendamento com humano.
**TOM:** {voice_style}
{lead_instructions}

Tarefas:
1) Faça 1-2 perguntas curtas para entender:
   - objetivo (o que quer melhorar agora)
   - disponibilidade (dias/horários) e fuso
2) Em seguida, ative takeover humano com um resumo para agendamento.

Regras:
- pt-BR
- Máx 2 mensagens curtas (não textos longos)
- NÃO invente preço/condições
- Se o usuário pedir valores/detalhes: diga que o time confirma por aqui e já acione takeover humano

Ação final OBRIGATÓRIA:
- enable_human_takeover(phone, reason) com um resumo tipo:
  "Mentoria: objetivo=..., disponibilidade=..., fuso=..., urgência=..."

**AÇÃO:** send_text_message(phone, pergunta curta) OU enable_human_takeover(phone, resumo)""",
        model="gpt-4o-mini",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=140,
        ),
        tools=tools,
    )


def create_triage_agent(handoff_agents: List[Agent]) -> Agent:
    """
    SPECIALIZED: smart routing to specialized agents
    workflow node: intent_router
    """
    agent_names = [a.name for a in handoff_agents]

    triage_instructions = f"""{RECOMMENDED_PROMPT_PREFIX}

Você é o ROTEADOR inteligente.

**SUA ÚNICA FUNÇÃO:** Identificar intenção e transferir para o agente certo.

**AGENTES DISPONÍVEIS:** {', '.join(agent_names)}

**REGRAS DE ROTEAMENTO (EM ORDEM DE PRIORIDADE):**

1. Se for APENAS uma saudação curta (ex.: "oi", "olá", "bom dia", "tudo bem") → greeter_agent
2. Mentoria/consultoria/agendamento → mentorship_booking_agent
3. PIX, pagamento, pedido, "chave pix" → payment_agent
4. Comprar, "quero pagar", "fechado", "pode mandar" → sales_closer_agent (MAS só se Products count > 0)
5. Interesse em gratuito → free_product_agent
6. Objeções, "caro", "não sei", "preciso pensar" → objection_handler_agent
7. Perguntas sobre conteúdo/produto → product_info_agent
8. Ajuda, problema, reclamação → support_agent

Observações importantes:
- Se a mensagem começa com "oi" mas já tem intenção clara (comprar/pagar/pergunta), NÃO trate como saudação pura.
- Se Products count = 0, evite sales_closer_agent; prefira greeter_agent (que oferece opt-in de novidades) ou product_info_agent.

**AÇÃO:** Transfira IMEDIATAMENTE. NÃO responda, apenas roteie."""

    return Agent(
        name="triage_agent",
        handoff_description="Routes messages to the appropriate specialized agent",
        instructions=triage_instructions,
        model="gpt-4o-mini",
        model_settings=ModelSettings(
            tool_choice="required",
            max_tokens=50,
            temperature=0.1
        ),
        handoffs=handoff_agents
    )


def build_agents_for_creator(
    data_service: DataService,
    creator_context: str,
    product_context: str
) -> Dict[str, Agent]:
    """
    build specialized agent set for a creator
    each agent has a focused responsibility aligned with workflow nodes
    """
    # get tools for each specialized agent
    agent_tools = {
        'greeter': get_all_tools_for_agent('greeter'),
        'product_info': get_all_tools_for_agent('sales'),  # uses sales tools for RAG
        'free_product': get_all_tools_for_agent('free_product'),  # uses free product delivery tools
        'objection_handler': get_all_tools_for_agent('sales'),
        'sales_closer': get_all_tools_for_agent('payment'),
        'payment': get_all_tools_for_agent('payment'),
        'support': get_all_tools_for_agent('support'),  # uses support-specific tools (human takeover)
        'mentorship_booking': get_all_tools_for_agent('support'),
        'notification_optin': get_all_tools_for_agent('acknowledgment'),
    }

    # create specialized agents
    greeter_agent = create_greeter_agent(data_service, agent_tools['greeter'])
    notification_optin_agent = create_notification_optin_agent(data_service, agent_tools['notification_optin'])
    product_info_agent = create_product_info_agent(data_service, agent_tools['product_info'])
    free_product_agent = create_free_product_agent(data_service, agent_tools['free_product'])
    objection_handler_agent = create_objection_handler_agent(data_service, agent_tools['objection_handler'])
    sales_closer_agent = create_sales_closer_agent(data_service, agent_tools['sales_closer'])
    payment_agent = create_payment_agent(data_service, agent_tools['payment'])
    support_agent = create_support_agent(data_service, agent_tools['support'])
    mentorship_booking_agent = create_mentorship_booking_agent(data_service, agent_tools['mentorship_booking'])

    # create triage with all specialist agents
    all_specialists = [
        greeter_agent,
        notification_optin_agent,
        product_info_agent,
        free_product_agent,
        objection_handler_agent,
        sales_closer_agent,
        payment_agent,
        support_agent,
        mentorship_booking_agent,
    ]
    triage_agent = create_triage_agent(all_specialists)

    # configure handoff chains (agent can delegate to these)
    greeter_agent.handoffs = [product_info_agent, free_product_agent, sales_closer_agent]
    notification_optin_agent.handoffs = [product_info_agent, sales_closer_agent, support_agent]
    product_info_agent.handoffs = [free_product_agent, sales_closer_agent, objection_handler_agent]
    free_product_agent.handoffs = [sales_closer_agent, product_info_agent]
    objection_handler_agent.handoffs = [sales_closer_agent, free_product_agent, support_agent]
    sales_closer_agent.handoffs = [payment_agent, objection_handler_agent]
    payment_agent.handoffs = [support_agent]
    mentorship_booking_agent.handoffs = [support_agent]
    support_agent.handoffs = []  # support is the final escalation point

    return {
        'greeter': greeter_agent,
        'notification_optin': notification_optin_agent,
        'product_info': product_info_agent,
        'free_product': free_product_agent,
        'objection_handler': objection_handler_agent,
        'sales_closer': sales_closer_agent,
        'payment': payment_agent,
        'support': support_agent,
        'mentorship_booking': mentorship_booking_agent,
        'triage': triage_agent,
    }
