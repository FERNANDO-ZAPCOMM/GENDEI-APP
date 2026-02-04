"""
Data Service - Provides access to creator and product data from Firestore
Adapts NestJS schema to the agent-friendly format
"""

import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class DataService:
    """
    Service that adapts NestJS Firestore data for agent consumption
    Maps between NestJS entities and agent-friendly data structures
    """

    def __init__(
        self,
        preloaded_creator: Optional[Dict[str, Any]] = None,
        preloaded_products: Optional[List[Dict[str, Any]]] = None,
        preloaded_workflow: Optional[Dict[str, Any]] = None
    ):
        """
        initialize data service with preloaded data
        args:
            preloaded_creator: Creator profile from Firestore
            preloaded_products: List of products from Firestore
            preloaded_workflow: Active workflow from Firestore
        """
        self.creator_profile = preloaded_creator or {}
        self.products = preloaded_products or []
        self.active_workflow = preloaded_workflow

        logger.info(
            f"DataService initialized: {len(self.products)} products, "
            f"creator: {self.creator_profile.get('displayName', 'Unknown')}, "
            f"workflow: {self.active_workflow.get('name') if self.active_workflow else 'None'}"
        )

    def refresh_products(self, new_products: List[Dict[str, Any]]) -> None:
        """
        refresh products list with fresh data from Firestore
        args:
            new_products: Fresh list of products from Firestore
        """
        old_count = len(self.products)
        self.products = new_products or []
        logger.info(f"🔄 Products refreshed: {old_count} -> {len(self.products)} products")

    def refresh_creator_profile(self, new_profile: Dict[str, Any]) -> None:
        """
        refresh creator profile with fresh data from Firestore
        args:
            new_profile: Fresh creator profile from Firestore
        """
        self.creator_profile = new_profile or {}
        logger.info(f"🔄 Creator profile refreshed: {self.creator_profile.get('displayName', 'Unknown')}")

    def is_loaded(self) -> bool:
        """
        check if data is loaded
        """
        return bool(self.creator_profile and self.products)


    # ===== CREATOR PROFILE =====
    def get_creator_profile(self) -> Dict[str, Any]:
        """
        get full creator profile
        """
        return self.creator_profile

    def get_creator_name(self) -> str:
        """
        get creator display name
        """
        return self.creator_profile.get('displayName', 'Vendedor')

    def get_creator_bio(self) -> Optional[str]:
        """
        get creator bio/description
        """
        return self.creator_profile.get('bio')

    def get_show_products_in_greeting(self) -> bool:
        """
        whether to mention product titles in the first greeting (default: True)
        """
        value = self.creator_profile.get('showProductsInGreeting')
        if value is None:
            return True
        return bool(value)

    def get_creator_tone(self) -> str:
        """
        get creator tone/voice style
        Maps VoiceStyle enum to Portuguese description
        """
        voice_style = self.get_voice_style()
        tone_map = {
            "friendly_coach": "amigável e motivador, como um coach que quer ajudar",
            "professional_expert": "profissional e especialista, direto e objetivo",
            "casual_friend": "casual e descontraído, como um amigo próximo",
            "formal_consultant": "formal e consultivo, sério e corporativo",
        }
        return tone_map.get(voice_style, tone_map["friendly_coach"])

    def get_voice_style(self) -> str:
        """
        Normalize voiceStyle from Firestore/profile to a known internal key.
        Frontend currently uses: friendly_coach | professional_expert | formal_consultant
        """
        raw = self.creator_profile.get("voiceStyle") or "friendly_coach"
        style = str(raw).strip()

        legacy_map = {
            "casual_influencer": "casual_friend",
            "motivational_mentor": "friendly_coach",
            "educational_teacher": "professional_expert",
        }
        style = legacy_map.get(style, style)

        allowed = {"friendly_coach", "professional_expert", "formal_consultant", "casual_friend"}
        if style in allowed:
            return style
        return "friendly_coach"

    def get_creator_personality_traits(self) -> List[str]:
        """
        get personality traits from tone attributes
        """
        traits = []
        tone_attrs = self.creator_profile.get('toneAttributes', {})

        if tone_attrs.get('formality', 5) > 7:
            traits.append('formal')
        elif tone_attrs.get('formality', 5) < 4:
            traits.append('descontraído')

        if tone_attrs.get('enthusiasm', 5) > 7:
            traits.append('entusiasmado')

        if tone_attrs.get('empathy', 5) > 7:
            traits.append('empático')

        if tone_attrs.get('humor', 5) > 5:
            traits.append('bem-humorado')

        # default traits if none specified
        if not traits:
            traits = ['amigável', 'prestativo', 'profissional']

        return traits

    def get_creator_greeting_style(self) -> str:
        """
        get greeting style
        """
        perspective = self.creator_profile.get('speakingPerspective', 'first_person')

        if perspective == 'first_person':
            return 'Eu sou [nome], como posso ajudar?'
        elif perspective == 'third_person':
            return '[Nome] está aqui para ajudar você!'
        else:
            return 'Como posso ajudar você hoje?'

    def get_creator_emoji_usage(self) -> str:
        """
        get emoji usage preference
        """
        tone_attrs = self.creator_profile.get('toneAttributes', {})
        enthusiasm = tone_attrs.get('enthusiasm', 5)

        if enthusiasm > 7:
            return 'frequente'
        elif enthusiasm > 4:
            return 'moderado'
        else:
            return 'raro'

    def get_creator_response_length(self) -> str:
        """
        get preferred response length
        """
        formality = self.creator_profile.get('toneAttributes', {}).get('formality', 5)

        if formality > 7:
            return 'detalhado'
        else:
            return 'conciso'

    def get_creator_language(self) -> str:
        """
        get primary language
        """
        return self.creator_profile.get('primaryLanguage', 'pt-BR')

    def get_planned_product_types(self) -> List[str]:
        """
        get product types the creator intends to sell (from onboarding/clone page),
        even if products haven't been created yet.
        """
        raw = self.creator_profile.get('productTypes') or []
        if isinstance(raw, list):
            return [str(v) for v in raw if v]
        return []

    def get_planned_product_types_pt(self) -> List[str]:
        """
        map planned product types to Portuguese labels for messaging.
        """
        mapping = {
            'ebook': 'E-book / Templates',
            'templates': 'E-book / Templates',
            'mentoring': 'Mentoria',
            'mentoria': 'Mentoria',
            'community': 'Comunidade',
            'comunidade': 'Comunidade',
            'course': 'Curso',
            'curso': 'Curso',
        }
        out = []
        for t in self.get_planned_product_types():
            out.append(mapping.get(t, t))
        # de-duplicate preserving order
        seen = set()
        deduped = []
        for v in out:
            if v in seen:
                continue
            seen.add(v)
            deduped.append(v)
        return deduped

    def get_creator_key_phrases(self) -> List[str]:
        """
        get key phrases that the creator commonly uses
        """
        return self.creator_profile.get('keyPhrases', [])

    def get_creator_avoid_phrases(self) -> List[str]:
        """
        get phrases to avoid
        """
        return self.creator_profile.get('avoidPhrases', [])

    def get_creator_niche(self) -> str:
        """
        get creator's niche/area of expertise
        """
        return self.creator_profile.get('niche', '')

    # ===== SALES STRATEGY =====
    def get_lead_temperature(self) -> str:
        """
        get lead temperature setting: cold, warm, hot
        affects how the agent introduces itself and builds rapport
        """
        value = self.creator_profile.get('leadTemperature', 'warm')
        # Frontend may store as a numeric slider; normalize to cold/warm/hot
        if isinstance(value, (int, float)):
            # legacy (0-10) scale
            if value <= 10:
                if value <= 3:
                    return "cold"
                if value <= 7:
                    return "warm"
                return "hot"
            # current frontend (0-100) scale
            if value <= 33:
                return "cold"
            if value < 67:
                return "warm"
            return "hot"
        if isinstance(value, str):
            value_lower = value.strip().lower()
            if value_lower in ('cold', 'warm', 'hot'):
                return value_lower
        return 'warm'

    def get_lead_temperature_instructions(self) -> str:
        """
        get specific instructions based on lead temperature
        """
        temp = self.get_lead_temperature()

        instructions = {
            'cold': """
LEAD FRIO - Não me conhece:
- Faça uma introdução mais longa e detalhada
- Apresente suas credenciais e autoridade no assunto
- Compartilhe valor gratuito antes de mencionar produtos
- Construa confiança gradualmente
- Use prova social (resultados, depoimentos)
- Não seja agressivo na venda
""",
            'warm': """
LEAD MORNO - Já ouviu falar:
- Introdução breve, assumindo alguma familiaridade
- Foque em entender a dor/necessidade específica
- Conecte rapidamente com soluções
- Pergunte sobre o que trouxe a pessoa aqui
- Balance valor com direcionamento para produto
""",
            'hot': """
LEAD QUENTE - Já me conhece/segue:
- Introdução mínima, vá direto ao ponto
- Assuma que já conhecem seu trabalho
- Foque em ajudar a tomar a decisão
- Seja direto sobre produtos e ofertas
- Responda objeções rapidamente
"""
        }

        return instructions.get(temp, instructions['warm'])

    def get_sales_approach(self) -> str:
        """
        get sales approach: educational, consultative, direct
        """
        return self.creator_profile.get('salesApproach', 'consultative')

    def get_sales_approach_instructions(self) -> str:
        """
        get specific instructions based on sales approach
        """
        approach = self.get_sales_approach()

        instructions = {
            'educational': """
ABORDAGEM EDUCATIVA:
- Ensine algo valioso antes de vender
- Compartilhe dicas, insights e conhecimento
- Posicione a venda como "próximo passo natural"
- Use exemplos e analogias
- Crie valor percebido através de educação
""",
            'consultative': """
ABORDAGEM CONSULTIVA:
- Faça perguntas para entender a situação
- Descubra a dor/problema principal
- Apresente solução personalizada
- Conecte benefícios do produto com necessidades específicas
- Aja como consultor, não vendedor
""",
            'direct': """
ABORDAGEM DIRETA:
- Apresente o produto rapidamente
- Destaque benefícios principais
- Seja objetivo e claro
- Foque em conversão
- Minimize conversa sem propósito
"""
        }

        return instructions.get(approach, instructions['consultative'])

    # ===== PRODUCT CONTEXT =====
    def get_creator_product_category(self) -> str:
        """
        get creator's default product category: infoproduct, service, community, software
        """
        return self.creator_profile.get('productCategory', 'infoproduct')

    def get_product_category_instructions(self) -> str:
        """
        get specific instructions based on product category
        """
        category = self.get_creator_product_category()

        instructions = {
            'infoproduct': """
TIPO: INFOPRODUTO (ebook, curso, template)
- Destaque a transformação que o conteúdo proporciona
- Enfatize acesso imediato/instantâneo
- Fale sobre metodologia e organização do conteúdo
- Mencione bônus ou materiais complementares
- Entrega digital é uma vantagem
""",
            'service': """
TIPO: SERVIÇO (mentoria, consultoria, coaching)
- Destaque o acompanhamento personalizado
- Enfatize resultados de clientes anteriores
- Explique o processo/metodologia
- Fale sobre suporte e disponibilidade
- Para ticket alto, qualifique bem antes de oferecer
""",
            'community': """
TIPO: COMUNIDADE (grupo, membership)
- Destaque o networking e conexões
- Enfatize conteúdo exclusivo e contínuo
- Fale sobre a comunidade e seus membros
- Mencione eventos e encontros
- Destaque o senso de pertencimento
""",
            'software': """
TIPO: SOFTWARE (SaaS, ferramenta, app)
- Destaque funcionalidades principais
- Enfatize facilidade de uso
- Ofereça demonstração ou trial
- Fale sobre suporte técnico
- Mencione atualizações e melhorias constantes
"""
        }

        return instructions.get(category, instructions['infoproduct'])

    def get_ticket_level(self) -> str:
        """
        get ticket level: low, medium, high
        """
        return self.creator_profile.get('ticketLevel', 'low')

    def get_ticket_level_instructions(self) -> str:
        """
        get specific instructions based on ticket level
        """
        level = self.get_ticket_level()

        instructions = {
            'low': """
TICKET BAIXO (até R$100):
- Venda pode ser rápida, pouca objeção esperada
- Foque em benefícios imediatos
- Decisão de compra é simples
- Não precisa de muita qualificação
- Responda dúvidas e direcione para compra
""",
            'medium': """
TICKET MÉDIO (R$100-500):
- Alguma qualificação necessária
- Entenda se a pessoa tem o problema que você resolve
- Apresente valor claramente antes do preço
- Esteja preparado para responder objeções
- Ofereça garantia ou segurança
""",
            'high': """
TICKET ALTO (R$500+):
- Qualificação completa é essencial
- Entenda orçamento, timing e poder de decisão
- Construa relacionamento e confiança
- Apresente cases e resultados
- Pode sugerir chamada para fechar
- Trate objeções com profundidade
"""
        }

        return instructions.get(level, instructions['low'])

    # ===== LEAD QUALIFICATION =====
    def get_qualification_level(self) -> str:
        """
        get qualification level: none, basic, complete
        """
        return self.creator_profile.get('qualificationLevel', 'basic')

    def get_qualification_questions(self) -> str:
        """
        get custom qualification questions if set
        """
        return self.creator_profile.get('qualificationQuestions', '')

    def get_qualification_instructions(self) -> str:
        """
        get specific instructions based on qualification level
        """
        level = self.get_qualification_level()
        custom_questions = self.get_qualification_questions()

        base_instructions = {
            'none': """
QUALIFICAÇÃO: NENHUMA
- Qualquer lead pode comprar diretamente
- Não faça muitas perguntas
- Direcione rapidamente para o produto
- Facilite a compra ao máximo
""",
            'basic': """
QUALIFICAÇÃO: BÁSICA
- Pergunte qual o interesse/problema principal
- Entenda o que trouxe a pessoa até aqui
- Verifique se o produto é adequado
- Não precisa saber sobre orçamento
""",
            'complete': """
QUALIFICAÇÃO: COMPLETA
- Descubra o problema específico
- Pergunte sobre tentativas anteriores de resolver
- Entenda o orçamento disponível
- Verifique o timing (precisa resolver agora?)
- Confirme quem toma a decisão
- Avalie se é um bom fit antes de oferecer
"""
        }

        instructions = base_instructions.get(level, base_instructions['basic'])

        if custom_questions:
            instructions += f"\n\nPERGUNTAS PERSONALIZADAS DO CRIADOR:\n{custom_questions}"

        return instructions

    # ===== OBJECTIVES =====
    def get_primary_goal(self) -> str:
        """
        get primary goal: sell, schedule, capture, nurture
        """
        return self.creator_profile.get('primaryGoal', 'sell')

    def get_goal_instructions(self) -> str:
        """
        get specific instructions based on primary goal
        """
        goal = self.get_primary_goal()

        instructions = {
            'sell': """
OBJETIVO: VENDER PRODUTO
- Foco em conversão e fechamento
- Direcione conversas para o produto
- Responda objeções e feche a venda
- Use urgência e escassez quando apropriado
- Ofereça PIX e facilite o pagamento
""",
            'schedule': """
OBJETIVO: AGENDAR REUNIÃO/CALL
- Foco em marcar um encontro com o criador
- Qualifique o lead antes de agendar
- Ofereça horários disponíveis
- Confirme o agendamento
- Não tente vender diretamente, direcione para a call
""",
            'capture': """
OBJETIVO: CAPTURAR LEAD
- Foco em coletar informações de contato
- Peça email e/ou telefone
- Ofereça algo de valor em troca (material gratuito)
- Não pressione para venda imediata
- Construa lista para nutrição futura
""",
            'nurture': """
OBJETIVO: EDUCAR E NUTRIR
- Foco em construir relacionamento
- Compartilhe conteúdo valioso
- Não pressione para venda
- Responda dúvidas com profundidade
- Construa autoridade e confiança
- Venda virá naturalmente depois
"""
        }

        return instructions.get(goal, instructions['sell'])

    def get_complete_strategy_context(self) -> str:
        """
        get complete strategy context combining all settings
        """
        return f"""
=== ESTRATÉGIA DO CRIADOR ===

{self.get_lead_temperature_instructions()}

{self.get_sales_approach_instructions()}

{self.get_product_category_instructions()}

{self.get_ticket_level_instructions()}

{self.get_qualification_instructions()}

{self.get_goal_instructions()}
"""


    # ===== PRODUCTS =====
    def get_all_products(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """
        get all products
        args:
            active_only: filter for active products only (not used in nestjs schema)
        returns:
            List of products in agent-friendly format
        """
        return [self._adapt_product_format(p) for p in self.products]

    def get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """
        get product by ID
        """
        for product in self.products:
            if product.get('id') == product_id or product.get('retailerId') == product_id:
                return self._adapt_product_format(product)
        return None

    def get_default_product(self) -> Optional[Dict[str, Any]]:
        """
        get the first product as default
        """
        if self.products:
            return self._adapt_product_format(self.products[0])
        return None

    def _adapt_product_format(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """
        adapt NestJS Product entity to agent-friendly format

        NestJS Product schema:
        - id, creatorId, catalogId, retailerId
        - title, description, price (number), currency
        - category, imageUrl, variants, metadata
        - NEW: mainBenefit, targetAudience, tone, objections, objectionResponses, ragContext

        agent format needs:
        - productId, title, description, price.formatted, price.amount
        - category, features, benefits
        - salesContext (AI sales fields)
        - ragContext (document analysis for answering questions)
        """
        # get metadata for additional fields
        metadata = product.get('metadata', {})

        # format price - prices are stored as actual values (not cents)
        price_amount = product.get('price', 0)
        currency = product.get('currency', 'BRL')

        # format as Brazilian Real
        if currency == 'BRL':
            formatted_price = f"R$ {price_amount:.2f}".replace('.', ',')
        else:
            formatted_price = f"{currency} {price_amount:.2f}"

        # get RAG context (document analysis data)
        rag_context = product.get('ragContext', {})

        # get objection responses
        objection_responses = product.get('objectionResponses', {})

        return {
            'productId': product.get('retailerId') or product.get('id'),
            'id': product.get('id'),
            'title': product.get('title', 'Produto'),
            'description': product.get('description', ''),
            'slug': metadata.get('slug', product.get('id')),
            'category': product.get('category', 'product'),
            'type': product.get('type', 'ebook'),
            'price': {
                'amount': price_amount,
                'currency': currency,
                'formatted': formatted_price
            },
            'imageUrl': product.get('imageUrl') or product.get('thumbnailUrl'),
            'variants': product.get('variants', []),
            'pitch': {
                'oneLiner': metadata.get('oneLiner', product.get('title')),
                'features': metadata.get('features', []),
                'benefits': rag_context.get('benefits', metadata.get('benefits', []))
            },
            'delivery': {
                'type': metadata.get('deliveryType', 'digital'),
                'url': product.get('fileUrl') or metadata.get('deliveryUrl'),
                'instructions': product.get('accessInstructions') or metadata.get('deliveryInstructions')
            },
            # AI Sales Context - collected during product creation
            'salesContext': {
                'mainBenefit': product.get('mainBenefit', ''),
                'targetAudience': product.get('targetAudience', ''),
                'tone': product.get('tone', 'friendly'),
                'objections': product.get('objections', []),
                'objectionResponses': objection_responses
            },
            # RAG Context - document analysis for answering questions
            'ragContext': {
                'summary': rag_context.get('summary', ''),
                'topics': rag_context.get('topics', []),
                'benefits': rag_context.get('benefits', []),
                'faq': rag_context.get('faq', []),
                'contentDetails': rag_context.get('contentDetails', ''),
                'additionalInfo': rag_context.get('additionalInfo', {})
            },
            'active': product.get('isActive', True),
            # Meta Catalog info for WhatsApp templates
            'metaCatalog': product.get('metaCatalog', {})
        }

    # ===== PRODUCT HELPERS =====
    def get_product_title(self, product_id: str) -> str:
        """
        get product title
        """
        product = self.get_product_by_id(product_id)
        return product['title'] if product else 'Produto'

    def get_product_description(self, product_id: str) -> str:
        """
        get product description
        """
        product = self.get_product_by_id(product_id)
        return product['description'] if product else ''

    def get_product_price(self, product_id: str) -> Dict[str, Any]:
        """
        get product price
        """
        product = self.get_product_by_id(product_id)
        return product['price'] if product else {'amount': 0, 'currency': 'BRL', 'formatted': 'R$ 0,00'}

    def get_product_category(self, product_id: str) -> str:
        """
        get product category
        """
        product = self.get_product_by_id(product_id)
        return product['category'] if product else 'product'

    def get_product_features(self, product_id: str) -> List[str]:
        """
        get product features
        """
        product = self.get_product_by_id(product_id)
        return product.get('pitch', {}).get('features', []) if product else []

    def get_product_benefits(self, product_id: str) -> List[str]:
        """
        get product benefits
        """
        product = self.get_product_by_id(product_id)
        return product.get('pitch', {}).get('benefits', []) if product else []


    # ===== RAG CONTEXT HELPERS =====
    def get_product_main_benefit(self, product_id: str) -> str:
        """
        get the main benefit of a product
        """
        product = self.get_product_by_id(product_id)
        return product.get('salesContext', {}).get('mainBenefit', '') if product else ''

    def get_product_target_audience(self, product_id: str) -> str:
        """
        get the target audience for a product
        """
        product = self.get_product_by_id(product_id)
        return product.get('salesContext', {}).get('targetAudience', '') if product else ''

    def get_product_tone(self, product_id: str) -> str:
        """
        get the sales tone for a product
        """
        product = self.get_product_by_id(product_id)
        return product.get('salesContext', {}).get('tone', 'friendly') if product else 'friendly'

    def get_product_objections(self, product_id: str) -> List[str]:
        """
        get common objections for a product
        """
        product = self.get_product_by_id(product_id)
        return product.get('salesContext', {}).get('objections', []) if product else []

    def get_objection_response(self, product_id: str, objection: str) -> Optional[str]:
        """
        get the response for a specific objection
        """
        product = self.get_product_by_id(product_id)
        if not product:
            return None
        responses = product.get('salesContext', {}).get('objectionResponses', {})
        # try exact match first, then partial match
        if objection in responses:
            return responses[objection]
        for key, response in responses.items():
            if objection.lower() in key.lower() or key.lower() in objection.lower():
                return response
        return None

    def get_product_rag_summary(self, product_id: str) -> str:
        """
        get RAG summary for a product
        """
        product = self.get_product_by_id(product_id)
        return product.get('ragContext', {}).get('summary', '') if product else ''

    def get_product_rag_topics(self, product_id: str) -> List[str]:
        """
        get RAG topics for a product
        """
        product = self.get_product_by_id(product_id)
        return product.get('ragContext', {}).get('topics', []) if product else []

    def get_product_rag_faq(self, product_id: str) -> List[Dict[str, str]]:
        """
        get RAG FAQ for a product
        """
        product = self.get_product_by_id(product_id)
        return product.get('ragContext', {}).get('faq', []) if product else []

    def get_product_content_details(self, product_id: str) -> str:
        """
        get content details for a product
        """
        product = self.get_product_by_id(product_id)
        return product.get('ragContext', {}).get('contentDetails', '') if product else ''

    def find_answer_for_question(self, product_id: str, question: str) -> Optional[str]:
        """
        try to find an answer for a customer question using RAG context
        args:
            product_id: Product ID
            question: Customer question
        returns:
            answer if found, None otherwise
        """
        product = self.get_product_by_id(product_id)
        if not product:
            return None

        question_lower = question.lower()

        # check FAQ first
        faq = product.get('ragContext', {}).get('faq', [])
        for item in faq:
            faq_question = item.get('question', '').lower()
            if any(word in question_lower for word in faq_question.split() if len(word) > 3):
                return item.get('answer')

        # check if asking about objection (price, trust, etc.)
        objection_responses = product.get('salesContext', {}).get('objectionResponses', {})
        for objection, response in objection_responses.items():
            if any(word in question_lower for word in objection.lower().split() if len(word) > 3):
                return response

        # check for common question types
        if any(word in question_lower for word in ['benefício', 'beneficio', 'vantagem', 'ganho']):
            main_benefit = product.get('salesContext', {}).get('mainBenefit', '')
            if main_benefit:
                return f"O principal benefício é: {main_benefit}"

        if any(word in question_lower for word in ['quem', 'para quem', 'público', 'indicado']):
            target = product.get('salesContext', {}).get('targetAudience', '')
            if target:
                return f"Este produto é ideal para: {target}"

        if any(word in question_lower for word in ['conteúdo', 'conteudo', 'inclui', 'tem', 'módulo', 'modulo']):
            content = product.get('ragContext', {}).get('contentDetails', '')
            if content:
                return content

        return None

    def format_product_rag_context(self, product_id: str) -> str:
        """
        format RAG context for agent prompts
        args:
            product_id: Product ID
        returns:
            formatted RAG context string
        """
        product = self.get_product_by_id(product_id)
        if not product:
            return ""

        lines = []
        sales_ctx = product.get('salesContext', {})
        rag_ctx = product.get('ragContext', {})

        # MAIN benefit
        if sales_ctx.get('mainBenefit'):
            lines.append(f"**Principal Benefício:** {sales_ctx['mainBenefit']}")

        # TARGET audience
        if sales_ctx.get('targetAudience'):
            lines.append(f"**Público-Alvo:** {sales_ctx['targetAudience']}")

        # SUMMARY
        if rag_ctx.get('summary'):
            lines.append(f"**Resumo:** {rag_ctx['summary']}")

        # TOPICS
        if rag_ctx.get('topics'):
            lines.append(f"**Tópicos:** {', '.join(rag_ctx['topics'][:5])}")

        # BENEFITS
        if rag_ctx.get('benefits'):
            benefits_str = ', '.join(rag_ctx['benefits'][:5])
            lines.append(f"**Benefícios:** {benefits_str}")

        # FAQ
        if rag_ctx.get('faq'):
            lines.append("\n**Perguntas Frequentes:**")
            for faq_item in rag_ctx['faq'][:3]:
                lines.append(f"- P: {faq_item.get('question', '')}")
                lines.append(f"  R: {faq_item.get('answer', '')}")

        # OBJECTION responses
        if sales_ctx.get('objectionResponses'):
            lines.append("\n**Respostas para Objeções:**")
            for obj, resp in list(sales_ctx['objectionResponses'].items())[:3]:
                lines.append(f"- \"{obj}\": {resp[:100]}...")

        return '\n'.join(lines)


    # ===== CATALOG FORMATTING =====
    def format_product_catalog(self) -> str:
        """
        format product catalog for agent prompt
        returns:
            formatted string with all products
        """
        if not self.products:
            return "Nenhum produto disponível no momento."

        catalog_lines = []

        for i, product in enumerate(self.get_all_products(), 1):
            lines = [
                f"\n**Produto {i}: {product['title']}**",
                f"ID: {product['productId']}",
                f"Preço: {product['price']['formatted']}",
                f"Tipo: {product.get('type', 'ebook')}",
            ]

            if product['description']:
                lines.append(f"Descrição: {product['description'][:200]}...")

            # SALES context - main benefit and target audience
            sales_ctx = product.get('salesContext', {})
            if sales_ctx.get('mainBenefit'):
                lines.append(f"Principal Benefício: {sales_ctx['mainBenefit']}")
            if sales_ctx.get('targetAudience'):
                lines.append(f"Para quem: {sales_ctx['targetAudience']}")

            # RAG context - summary and topics
            rag_ctx = product.get('ragContext', {})
            if rag_ctx.get('summary'):
                lines.append(f"Resumo do Conteúdo: {rag_ctx['summary'][:200]}...")
            if rag_ctx.get('topics'):
                topics_str = ', '.join(rag_ctx['topics'][:4])
                lines.append(f"Tópicos: {topics_str}")

            pitch = product.get('pitch', {})
            if pitch.get('benefits'):
                benefits_str = ', '.join(pitch['benefits'][:3])
                lines.append(f"Benefícios: {benefits_str}")

            # OBJECTIONS available
            if sales_ctx.get('objectionResponses'):
                objections = list(sales_ctx['objectionResponses'].keys())[:3]
                lines.append(f"Objeções tratadas: {', '.join(objections)}")

            catalog_lines.append('\n'.join(lines))

        return '\n'.join(catalog_lines)

    def format_product_summary(self, product_id: str) -> str:
        """
        format a single product summary with RAG context
        """
        product = self.get_product_by_id(product_id)
        if not product:
            return "Produto não encontrado."

        lines = [
            f"**{product['title']}**",
            f"Preço: {product['price']['formatted']}",
            f"Tipo: {product.get('type', 'ebook')}",
        ]

        if product['description']:
            lines.append(f"\n{product['description']}")

        # SALES context
        sales_ctx = product.get('salesContext', {})
        if sales_ctx.get('mainBenefit'):
            lines.append(f"\n🎯 **Principal Benefício:** {sales_ctx['mainBenefit']}")

        if sales_ctx.get('targetAudience'):
            lines.append(f"👥 **Ideal para:** {sales_ctx['targetAudience']}")

        # RAG context
        rag_ctx = product.get('ragContext', {})
        if rag_ctx.get('summary'):
            lines.append(f"\n📖 **Sobre o conteúdo:** {rag_ctx['summary']}")

        if rag_ctx.get('topics'):
            lines.append("\n📚 **Tópicos abordados:**")
            for topic in rag_ctx['topics'][:5]:
                lines.append(f"• {topic}")

        pitch = product.get('pitch', {})
        if pitch.get('benefits'):
            lines.append("\n✨ **Benefícios:**")
            for benefit in pitch['benefits'][:5]:
                lines.append(f"• {benefit}")

        # FAQ preview
        if rag_ctx.get('faq'):
            lines.append("\n❓ **Perguntas frequentes:**")
            for faq in rag_ctx['faq'][:2]:
                lines.append(f"• {faq.get('question', '')}")

        return '\n'.join(lines)

    # ===== WORKFLOW METHODS =====
    def has_active_workflow(self) -> bool:
        """
        check if there's an active workflow loaded
        """
        return self.active_workflow is not None and self.active_workflow.get('isActive', False)

    def get_active_workflow(self) -> Optional[Dict[str, Any]]:
        """
        get the active workflow
        """
        return self.active_workflow

    def get_workflow_nodes(self) -> Dict[str, Dict[str, Any]]:
        """
        get all nodes from the active workflow
        """
        if not self.active_workflow:
            return {}
        return self.active_workflow.get('nodes', {})

    def get_workflow_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        """
        get a specific node from the workflow
        """
        nodes = self.get_workflow_nodes()
        return nodes.get(node_id)

    def get_workflow_edges(self) -> List[Dict[str, Any]]:
        """
        get all edges from the active workflow
        """
        if not self.active_workflow:
            return []
        return self.active_workflow.get('edges', [])

    def get_workflow_start_node_id(self) -> Optional[str]:
        """
        get the start node ID for the workflow
        """
        if not self.active_workflow:
            return None
        return self.active_workflow.get('startNodeId')

    def get_workflow_triggers(self) -> List[Dict[str, Any]]:
        """
        get workflow triggers
        """
        if not self.active_workflow:
            return []
        return self.active_workflow.get('triggers', [])

    def get_next_nodes(self, current_node_id: str, condition: Optional[str] = None) -> List[str]:
        """
        get the next node IDs from a given node
        args:
            current_node_id: Current node ID
            condition: Optional condition label to filter edges (e.g., 'true', 'false', 'interested')
        returns:
            List of next node IDs
        """
        edges = self.get_workflow_edges()
        next_nodes = []

        for edge in edges:
            if edge.get('source') != current_node_id:
                continue

            # Canonical TS schema uses `sourceHandle` for condition outcomes (and optional `label`)
            edge_condition = edge.get('sourceHandle') or edge.get('condition') or edge.get('label')

            # if condition specified, filter by it
            if condition:
                if edge_condition == condition:
                    next_nodes.append(edge.get('target'))
            else:
                # No condition specified: prefer edges without an outcome/handle, otherwise take the first edge
                if not edge_condition or edge.get('isDefault', False):
                    next_nodes.append(edge.get('target'))

        # If no matching edge found and condition was specified, try default
        if not next_nodes and condition:
            for edge in edges:
                if edge.get('source') == current_node_id and edge.get('isDefault', False):
                    next_nodes.append(edge.get('target'))

        # final fallback: if still empty, return the first outgoing edge (prevents dead-ends on schema variations)
        if not next_nodes:
            for edge in edges:
                if edge.get('source') == current_node_id:
                    target = edge.get('target')
                    if target:
                        next_nodes.append(target)
                        break

        return next_nodes

    def get_all_edge_conditions(self, node_id: str) -> List[str]:
        """
        get all possible conditions/labels for edges from a node
        """
        edges = self.get_workflow_edges()
        conditions = []

        for edge in edges:
            if edge.get('source') == node_id:
                condition = edge.get('sourceHandle') or edge.get('condition') or edge.get('label')
                if condition:
                    conditions.append(condition)

        return conditions

    def check_workflow_trigger(self, message: str, is_new_conversation: bool = False) -> bool:
        """
        check if a message should trigger the workflow
        args:
            message: User message
            is_new_conversation: Whether this is a new conversation
        returns:
            True if workflow should be triggered
        """
        if not self.has_active_workflow():
            return False

        triggers = self.get_workflow_triggers()
        message_lower = (message or "").lower()

        # simple greeting detector (pt-BR canonical)
        def _looks_like_greeting(text: str) -> bool:
            t = text.strip().lower()
            return any(
                t.startswith(prefix)
                for prefix in (
                    "oi",
                    "olá",
                    "ola",
                    "bom dia",
                    "boa tarde",
                    "boa noite",
                    "tudo bem",
                )
            )

        for trigger in triggers:
            trigger_type = trigger.get('type')

            # Canonical TS trigger types
            if trigger_type == 'greeting':
                if is_new_conversation or _looks_like_greeting(message_lower):
                    return True

            if trigger_type == 'keyword':
                # Canonical TS uses `conditions` (array of strings). Keep legacy `keywords` too.
                keywords = trigger.get('conditions') or trigger.get('keywords') or []
                if any(str(kw).lower() in message_lower for kw in keywords):
                    return True

            if trigger_type == 'always':
                return True

            # Legacy compatibility
            if trigger_type == 'new_conversation' and is_new_conversation:
                return True

        return False

    def get_product_for_offer(self, offer_type: str, product_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        get product for an offer node
        args:
            offer_type: Type of offer (free, paid, upsell, downsell)
            product_id: Specific product ID if specified in node
        returns:
            Product data
        """
        # if specific product ID provided, use it
        if product_id:
            return self.get_product_by_id(product_id)

        # otherwise, find by type
        products = self.get_all_products()

        if offer_type in ('free', 'free_first'):
            # find free product (price = 0 or marked as free)
            for product in products:
                if product.get('price', {}).get('amount', 0) == 0:
                    return product
                if product.get('type') == 'lead_magnet':
                    return product

        elif offer_type == 'paid':
            # find first paid product
            for product in products:
                if product.get('price', {}).get('amount', 0) > 0:
                    return product

        elif offer_type == 'upsell':
            # find highest priced product
            paid_products = [p for p in products if p.get('price', {}).get('amount', 0) > 0]
            if paid_products:
                return max(paid_products, key=lambda p: p.get('price', {}).get('amount', 0))

        elif offer_type == 'downsell':
            # find lowest priced paid product
            paid_products = [p for p in products if p.get('price', {}).get('amount', 0) > 0]
            if paid_products:
                return min(paid_products, key=lambda p: p.get('price', {}).get('amount', 0))

        # default: return first product
        return products[0] if products else None

    def format_workflow_message(self, template: str, variables: Dict[str, Any]) -> str:
        """
        format a workflow message template with variables
        args:
            template: Message template with {{variable}} placeholders
            variables: Dictionary of variable values
        returns:
            Formatted message
        """
        result = template

        # built-in variables
        built_in = {
            'creator_name': self.get_creator_name(),
            'creator_niche': self.get_creator_niche(),
        }

        # add product variables if available
        if 'current_product' in variables and variables['current_product']:
            product = variables['current_product']
            built_in.update({
                'product_name': product.get('title', ''),
                'product_price': product.get('price', {}).get('formatted', ''),
                'product_description': product.get('description', ''),
                'product_benefit': product.get('salesContext', {}).get('mainBenefit', ''),
            })

        # merge with provided variables
        all_vars = {**built_in, **variables}

        # replace placeholders
        for key, value in all_vars.items():
            placeholder = '{{' + key + '}}'
            if isinstance(value, str):
                result = result.replace(placeholder, value)
            elif value is not None:
                result = result.replace(placeholder, str(value))

        return result

    def get_workflow_summary(self) -> str:
        """
        get a summary of the active workflow for agent context
        """
        if not self.active_workflow:
            return "Nenhum workflow ativo."

        workflow = self.active_workflow
        nodes = self.get_workflow_nodes()

        # count node types
        node_types = {}
        for node in nodes.values():
            node_type = node.get('type', 'unknown')
            node_types[node_type] = node_types.get(node_type, 0) + 1

        # format triggers
        triggers = self.get_workflow_triggers()
        trigger_strs = []
        for t in triggers:
            t_type = t.get('type')
            if t_type == 'keyword':
                keywords = t.get('conditions') or t.get('keywords') or []
                trigger_strs.append(f"palavras-chave: {', '.join([str(k) for k in keywords])}")
            elif t_type == 'greeting':
                trigger_strs.append("saudação / nova conversa")
            elif t_type == 'always':
                trigger_strs.append("sempre ativo")

        summary = f"""
**Workflow Ativo: {workflow.get('name', 'Sem nome')}**
Descrição: {workflow.get('description', 'Sem descrição')}

Gatilhos: {', '.join(trigger_strs) if trigger_strs else 'Nenhum'}

Nós: {len(nodes)} total
"""
        for node_type, count in node_types.items():
            summary += f"- {node_type}: {count}\n"

        return summary
