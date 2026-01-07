import OpenAI from 'openai';

// Lazy initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Types for persona data
export interface PersonaData {
  displayName?: string;
  niche?: string;
  voiceStyle?: 'friendly_coach' | 'professional_expert' | 'casual_friend' | 'formal_consultant';
  upcomingProducts?: string;
  servicesPreview?: string;
  welcomeMessage?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
}

// Tool definitions for OpenAI function calling
const PERSONA_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'extract_persona_info',
      description: 'Extract persona information from user message. Call this whenever the user provides any information about themselves, their business, or preferences.',
      parameters: {
        type: 'object',
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
            enum: ['friendly_coach', 'professional_expert', 'casual_friend', 'formal_consultant'],
            description: 'The tone of voice: friendly_coach (energetic, motivational), professional_expert (direct, technical), casual_friend (relaxed, informal), formal_consultant (serious, traditional)',
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
  },
  {
    type: 'function',
    function: {
      name: 'get_missing_fields',
      description: 'Check which required fields are still missing from the persona profile. Call this to determine what to ask next.',
      parameters: {
        type: 'object',
        properties: {
          currentData: {
            type: 'object',
            description: 'The current persona data collected so far',
          },
        },
        required: ['currentData'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_welcome_message',
      description: 'Generate a personalized welcome message for WhatsApp based on collected persona data. Only call this when all required fields are collected.',
      parameters: {
        type: 'object',
        properties: {
          personaData: {
            type: 'object',
            description: 'The complete persona data to generate welcome message from',
          },
        },
        required: ['personaData'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_onboarding',
      description: 'Mark the onboarding as complete and return final persona data. Call this only after welcome message is generated and user confirms.',
      parameters: {
        type: 'object',
        properties: {
          finalData: {
            type: 'object',
            description: 'The final persona data including welcome message',
          },
        },
        required: ['finalData'],
      },
    },
  },
];

// System prompt for the persona agent
const PERSONA_AGENT_SYSTEM = `Você é um assistente amigável que ajuda criadores de conteúdo/infoprodutores a configurar seu perfil de clone de IA para WhatsApp.

Seu objetivo é coletar as seguintes informações de forma conversacional e natural:

1. **displayName** (OBRIGATÓRIO): Como o criador quer ser chamado
2. **niche** (OBRIGATÓRIO): Área de atuação/expertise
3. **voiceStyle** (OBRIGATÓRIO): Tom de voz preferido
4. **upcomingProducts** (OPCIONAL): O que está preparando para vender
5. **servicesPreview** (OPCIONAL): Se pretende oferecer consultorias/mentorias

REGRAS IMPORTANTES:
- Seja amigável, use emojis com moderação
- Faça UMA pergunta por vez
- Quando o usuário responder, SEMPRE use a ferramenta extract_persona_info para extrair e salvar as informações
- Use get_missing_fields para verificar o que falta
- Não repita perguntas sobre informações já coletadas
- Quando tiver displayName, niche e voiceStyle, pergunte sobre produtos/serviços opcionais
- Quando tiver todas as informações necessárias, use generate_welcome_message
- Após mostrar a mensagem de boas-vindas, use complete_onboarding

FLUXO IDEAL:
1. Cumprimente e pergunte o nome
2. Pergunte sobre a área de atuação
3. Pergunte sobre o tom de voz preferido (dê opções claras)
4. Pergunte sobre produtos que está preparando (opcional)
5. Pergunte sobre serviços futuros (opcional)
6. Gere e mostre a mensagem de boas-vindas
7. Pergunte se está tudo certo e finalize

Responda SEMPRE em português brasileiro.`;

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
        if (['friendly_coach', 'professional_expert', 'casual_friend', 'formal_consultant'].includes(style)) {
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
        casual_friend: 'descontraído e informal',
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
        case 'casual_friend':
          welcomeMessage = `E aí! 😄 Sou o ${name}, tamo junto na área de ${data.niche}! ${products}${services} Bora trocar uma ideia? Me conta o que você procura!`;
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

// Main agent function using OpenAI
export async function runPersonaAgentOpenAI(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  currentPersonaData: PersonaData
): Promise<{
  response: string;
  updatedPersonaData: PersonaData;
  isComplete: boolean;
  extractedFields?: string[];
}> {
  const client = getOpenAI();

  // Build messages array for OpenAI
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: PERSONA_AGENT_SYSTEM },
    ...conversationHistory.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.tool_call_id || '',
        };
      }
      return {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      };
    }),
    { role: 'user', content: userMessage },
  ];

  let personaData = { ...currentPersonaData };
  let isComplete = false;
  const extractedFields: string[] = [];

  // Agentic loop - keep processing until we get a final response
  let continueLoop = true;
  let finalResponse = '';
  let loopCount = 0;
  const maxLoops = 10;

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages,
      tools: PERSONA_TOOLS,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    const message = choice.message;

    // Check if there are tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Add assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.tool_calls,
      });

      // Process each tool call
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        let toolInput: Record<string, unknown> = {};

        try {
          toolInput = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error('Error parsing tool arguments:', e);
        }

        const toolResult = executeTool(toolName, toolInput, personaData);

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

        // Add tool result to messages
        messages.push({
          role: 'tool',
          content: toolResult.result,
          tool_call_id: toolCall.id,
        });
      }
    } else {
      // No tool calls - this is the final response
      finalResponse = message.content || '';
      continueLoop = false;
    }

    // Check finish reason
    if (choice.finish_reason === 'stop') {
      if (!finalResponse && message.content) {
        finalResponse = message.content;
      }
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

// Initialize conversation with greeting using OpenAI
export async function initializePersonaConversationOpenAI(): Promise<{
  response: string;
  initialData: PersonaData;
}> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 512,
    messages: [
      { role: 'system', content: PERSONA_AGENT_SYSTEM },
      { role: 'user', content: 'Olá, quero configurar meu perfil de clone de IA.' },
    ],
  });

  const greeting = response.choices[0]?.message?.content ||
    'Olá! Vou te ajudar a configurar seu clone de IA. Como você gostaria de ser chamado?';

  return {
    response: greeting,
    initialData: {},
  };
}
