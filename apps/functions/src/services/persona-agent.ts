import Anthropic from '@anthropic-ai/sdk';
import { defineSecret } from 'firebase-functions/params';

// Define the Anthropic API key as a secret
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// Lazy initialize Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY || anthropicApiKey.value();
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// Types for persona data
export interface PersonaData {
  displayName?: string;
  niche?: string;
  voiceStyle?: 'friendly_coach' | 'professional_expert' | 'formal_consultant';
  upcomingProducts?: string;
  servicesPreview?: string;
  welcomeMessage?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Tool definitions for the persona agent
const PERSONA_TOOLS: Anthropic.Tool[] = [
  {
    name: 'extract_persona_info',
    description: 'Extract persona information from user message. Call this whenever the user provides any information about themselves, their business, or preferences.',
    input_schema: {
      type: 'object' as const,
      properties: {
        displayName: {
          type: 'string',
          description: 'The name the creator wants to be called (e.g., "João", "Dra. Maria", "Prof. Carlos")',
        },
        niche: {
          type: 'string',
          description: 'The creator\'s area of expertise or business niche (e.g., "fitness", "marketing digital", "nutrição")',
        },
        voiceStyle: {
          type: 'string',
          enum: ['friendly_coach', 'professional_expert', 'formal_consultant'],
          description: 'The tone of voice: friendly_coach (energetic, motivational), professional_expert (direct, technical), formal_consultant (serious, traditional)',
        },
        upcomingProducts: {
          type: 'string',
          description: 'What products/services the creator is preparing (e.g., "e-book sobre emagrecimento", "curso de Excel")',
        },
        servicesPreview: {
          type: 'string',
          description: 'Future services like consultations or mentoring',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_missing_fields',
    description: 'Check which required fields are still missing from the persona profile. Call this to determine what to ask next.',
    input_schema: {
      type: 'object' as const,
      properties: {
        currentData: {
          type: 'object',
          description: 'The current persona data collected so far',
        },
      },
      required: ['currentData'],
    },
  },
  {
    name: 'generate_welcome_message',
    description: 'Generate a personalized welcome message for WhatsApp based on collected persona data. Only call this when all required fields are collected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        personaData: {
          type: 'object',
          description: 'The complete persona data to generate welcome message from',
        },
      },
      required: ['personaData'],
    },
  },
  {
    name: 'complete_onboarding',
    description: 'Mark the onboarding as complete and return final persona data. Call this only after welcome message is generated and user confirms.',
    input_schema: {
      type: 'object' as const,
      properties: {
        finalData: {
          type: 'object',
          description: 'The final persona data including welcome message',
        },
      },
      required: ['finalData'],
    },
  },
];

// System prompt for the persona agent
const PERSONA_AGENT_SYSTEM = `Você é um assistente amigável que ajuda criadores de conteúdo/infoprodutores a configurar seu clone de IA para WhatsApp.

Seu objetivo é coletar informações para criar um assistente personalizado que vai atender leads automaticamente.

INFORMAÇÕES A COLETAR:
1. **displayName** (OBRIGATÓRIO): Nome do criador - para personalizar a saudação
2. **niche** (OBRIGATÓRIO): Área de atuação - para contextualizar as respostas da IA
3. **voiceStyle** (OBRIGATÓRIO): Tom de voz - para definir como a IA vai se comunicar
4. **upcomingProducts** (OPCIONAL): Produtos em desenvolvimento - para mencionar na mensagem
5. **servicesPreview** (OPCIONAL): Consultorias/mentorias - para mencionar na mensagem

PERGUNTAS PADRÃO:

NOME (primeira pergunta):
"Vou te ajudar a criar seu clone de IA! Ele vai responder seus leads automaticamente no WhatsApp. **Qual seu nome?**"

NICHO (após nome):
"Prazer, {nome}! Agora preciso saber sua área de atuação para contextualizar as respostas do seu clone. **Qual seu nicho?** (ex: fitness, marketing, nutrição)"

TOM DE VOZ (após nicho - NÃO liste opções, o frontend mostra cards):
"Perfeito! {nicho} é um ótimo mercado! Agora escolha como seu clone vai se comunicar com seus leads. **Selecione seu tom de voz:**"

PRODUTOS (após tom de voz - frontend mostra botões Sim/Não):
"Agora vou personalizar a mensagem de boas-vindas. **Está preparando algum produto digital?** (e-book, curso, etc)"

Se "Sim" para PRODUTOS:
"Que legal! Vou mencionar isso na sua mensagem de boas-vindas. **Me conta o que está preparando?**"

Se "Não" para PRODUTOS:
(extraia upcomingProducts como "Não" e vá para serviços)

SERVIÇOS (após produtos - frontend mostra botões Sim/Não):
"E **pretende oferecer consultorias ou mentorias?**"

Se "Sim" para SERVIÇOS:
"Ótimo! Vou incluir isso também. **Qual tipo?** (ex: mentoria individual, consultoria)"

Se "Não" para SERVIÇOS:
(extraia servicesPreview como "Não" e gere a mensagem)

FINALIZAÇÃO:
Após coletar tudo, use generate_welcome_message e mostre:
"Pronto! Criei sua mensagem de boas-vindas personalizada:

[mensagem gerada]

Essa é a mensagem que seu clone vai enviar automaticamente para novos leads! Se gostou, clique em **Salvar Clone** abaixo."

IMPORTANTE: Após mostrar a mensagem de boas-vindas, SEMPRE chame a ferramenta complete_onboarding para finalizar.

REGRAS:
- Seja conversacional mas objetivo
- Explique brevemente POR QUE cada informação é útil
- Para TOM DE VOZ: NÃO liste opções (frontend mostra cards)
- Para PRODUTOS/SERVIÇOS: NÃO liste opções (frontend mostra botões)
- Faça UMA pergunta por vez
- SEMPRE use extract_persona_info ao coletar dados
- SEMPRE chame complete_onboarding após mostrar a mensagem final

MENSAGEM INICIAL:
"Oi! 👋 Vou te ajudar a criar seu clone de IA! Ele vai responder seus leads automaticamente no WhatsApp. **Qual seu nome?**"

FLUXO:
1. Pergunte o NOME (já está na mensagem inicial)
2. Pergunte sobre o NICHO (use a pergunta padrão)
3. Pergunte sobre o TOM DE VOZ (use a pergunta padrão - NÃO liste opções)
4. Pergunte sobre PRODUTOS (opcional)
5. Pergunte sobre SERVIÇOS (opcional)
6. Gere e mostre a mensagem de boas-vindas
7. Finalize

Responda SEMPRE em português brasileiro. Seja BREVE.`;

// Tool execution handlers
function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  currentPersonaData: PersonaData
): { result: string; updatedData?: PersonaData; isComplete?: boolean } {
  switch (toolName) {
    case 'extract_persona_info': {
      const updates: Partial<PersonaData> = {};

      if (toolInput.displayName) {
        updates.displayName = String(toolInput.displayName);
      }
      if (toolInput.niche) {
        updates.niche = String(toolInput.niche);
      }
      if (toolInput.voiceStyle) {
        const style = String(toolInput.voiceStyle);
        if (['friendly_coach', 'professional_expert', 'formal_consultant'].includes(style)) {
          updates.voiceStyle = style as PersonaData['voiceStyle'];
        }
      }
      if (toolInput.upcomingProducts) {
        updates.upcomingProducts = String(toolInput.upcomingProducts);
      }
      if (toolInput.servicesPreview) {
        updates.servicesPreview = String(toolInput.servicesPreview);
      }

      const updatedData = { ...currentPersonaData, ...updates };

      return {
        result: JSON.stringify({
          extracted: updates,
          currentData: updatedData,
          message: Object.keys(updates).length > 0
            ? `Extraído com sucesso: ${Object.keys(updates).join(', ')}`
            : 'Nenhuma informação nova extraída',
        }),
        updatedData,
      };
    }

    case 'get_missing_fields': {
      const required = ['displayName', 'niche', 'voiceStyle'];
      const optional = ['upcomingProducts', 'servicesPreview'];

      const missingRequired = required.filter(
        (f) => !currentPersonaData[f as keyof PersonaData]
      );
      const missingOptional = optional.filter(
        (f) => !currentPersonaData[f as keyof PersonaData]
      );

      return {
        result: JSON.stringify({
          missingRequired,
          missingOptional,
          hasAllRequired: missingRequired.length === 0,
          currentData: currentPersonaData,
          nextField: missingRequired[0] || missingOptional[0] || null,
        }),
      };
    }

    case 'generate_welcome_message': {
      const data = currentPersonaData;
      const voiceStyles: Record<string, string> = {
        friendly_coach: 'amigável e motivador com emojis',
        professional_expert: 'profissional e direto',
        formal_consultant: 'sério e respeitoso',
      };

      const tone = voiceStyles[data.voiceStyle || 'friendly_coach'];
      const name = data.displayName || 'eu';
      const products = data.upcomingProducts
        ? `Estou preparando ${data.upcomingProducts}.`
        : '';
      const services = data.servicesPreview
        ? ` E em breve terei ${data.servicesPreview}.`
        : '';

      // Generate welcome message based on voice style
      let welcomeMessage = '';
      switch (data.voiceStyle) {
        case 'friendly_coach':
          welcomeMessage = `Oi! 👋 Que bom ter você aqui! Me chamo ${name} e trabalho com ${data.niche}. ${products}${services} Posso te avisar quando tiver novidades? 🚀`;
          break;
        case 'professional_expert':
          welcomeMessage = `Olá. Sou ${name}, especialista em ${data.niche}. ${products}${services} Gostaria de ser notificado sobre novos conteúdos e ofertas?`;
          break;
        case 'formal_consultant':
          welcomeMessage = `Prezado(a), sou ${name} e atuo na área de ${data.niche}. ${products}${services} Terei prazer em mantê-lo(a) informado(a) sobre novidades.`;
          break;
        default:
          welcomeMessage = `Olá! Me chamo ${name} e trabalho com ${data.niche}. ${products}${services} Posso te avisar quando tiver novidades?`;
      }

      const updatedData = { ...currentPersonaData, welcomeMessage };

      return {
        result: JSON.stringify({
          welcomeMessage,
          tone,
          personaData: updatedData,
        }),
        updatedData,
      };
    }

    case 'complete_onboarding': {
      return {
        result: JSON.stringify({
          success: true,
          finalData: currentPersonaData,
          message: 'Onboarding completo! Perfil configurado com sucesso.',
        }),
        isComplete: true,
      };
    }

    default:
      return { result: JSON.stringify({ error: `Unknown tool: ${toolName}` }) };
  }
}

// Main agent function
export async function runPersonaAgent(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  currentPersonaData: PersonaData
): Promise<{
  response: string;
  updatedPersonaData: PersonaData;
  isComplete: boolean;
  extractedFields?: string[];
}> {
  const client = getAnthropic();

  // Build messages array
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  let personaData = { ...currentPersonaData };
  let isComplete = false;
  const extractedFields: string[] = [];

  // Agentic loop - keep processing until we get a final response
  let continueLoop = true;
  let finalResponse = '';

  while (continueLoop) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: PERSONA_AGENT_SYSTEM,
      tools: PERSONA_TOOLS,
      messages,
    });

    // Process the response
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let hasToolUse = false;

    for (const block of response.content) {
      if (block.type === 'text') {
        finalResponse = block.text;
      } else if (block.type === 'tool_use') {
        hasToolUse = true;

        const toolResult = executeTool(
          block.name,
          block.input as Record<string, unknown>,
          personaData
        );

        if (toolResult.updatedData) {
          // Track which fields were extracted
          const oldKeys = Object.keys(personaData).filter(k => personaData[k as keyof PersonaData]);
          const newKeys = Object.keys(toolResult.updatedData).filter(k => toolResult.updatedData![k as keyof PersonaData]);
          const newFields = newKeys.filter(k => !oldKeys.includes(k));
          extractedFields.push(...newFields);

          personaData = toolResult.updatedData;
        }

        if (toolResult.isComplete) {
          isComplete = true;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: toolResult.result,
        });
      }
    }

    // If there were tool uses, add them to messages and continue
    if (hasToolUse && toolResults.length > 0) {
      // Add assistant response with tool uses
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      // Add tool results
      messages.push({
        role: 'user',
        content: toolResults,
      });
    } else {
      // No more tool uses, we're done
      continueLoop = false;
    }

    // Safety: stop if we've done too many iterations
    if (messages.length > 20) {
      continueLoop = false;
    }
  }

  return {
    response: finalResponse,
    updatedPersonaData: personaData,
    isComplete,
    extractedFields: [...new Set(extractedFields)],
  };
}

// Initialize conversation with greeting
export async function initializePersonaConversation(): Promise<{
  response: string;
  initialData: PersonaData;
}> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: PERSONA_AGENT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: 'Olá, quero configurar meu perfil de clone de IA.',
      },
    ],
  });

  let greeting = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      greeting = block.text;
    }
  }

  return {
    response: greeting || 'Oi! 👋 Vou te ajudar a criar seu clone de IA! Ele vai responder seus leads automaticamente no WhatsApp. **Qual seu nome?**',
    initialData: {},
  };
}

// Export the secret for use in routes
export { anthropicApiKey };
