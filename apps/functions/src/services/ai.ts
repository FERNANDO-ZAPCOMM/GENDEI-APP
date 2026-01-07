import OpenAI from 'openai';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';

// Define the OpenAI API key as a secret
const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Lazy initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY || openaiApiKey.value();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

interface ProductContext {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  productType?: string;
  niche?: string;
  targetAudience?: string;
  mainBenefit?: string;
  objections?: string[];
  objectionResponses?: Record<string, string>;
  tone?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `Você é um assistente especializado em ajudar vendedores a cadastrar produtos para venda via WhatsApp.

Seu papel é:
1. Ser amigável e profissional
2. Fazer perguntas claras e diretas
3. Ajudar o usuário a descrever seu produto de forma atraente
4. Sugerir melhorias quando apropriado
5. Gerar respostas para objeções comuns de vendas

Contexto atual do produto:
{{PRODUCT_CONTEXT}}

Responda sempre em português brasileiro, de forma natural e conversacional.
Use emojis com moderação para tornar a conversa mais leve.`;

/**
 * Generate AI response for product chat
 */
export async function generateProductChatResponse(
  userMessage: string,
  productContext: ProductContext,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const contextJson = JSON.stringify(productContext, null, 2);
  const systemPrompt = SYSTEM_PROMPT.replace('{{PRODUCT_CONTEXT}}', contextJson);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Erro ao gerar resposta. Tente novamente.');
  }
}

/**
 * Generate objection responses based on product info
 */
export async function generateObjectionResponses(
  productContext: ProductContext,
  objections: string[]
): Promise<Record<string, string>> {
  const prompt = `Você é um especialista em vendas. Baseado nas informações do produto abaixo, gere respostas persuasivas para cada objeção listada.

Produto: ${productContext.name || 'Não informado'}
Descrição: ${productContext.description || 'Não informada'}
Benefício principal: ${productContext.mainBenefit || 'Não informado'}
Preço: ${productContext.price ? `R$ ${productContext.price}` : 'Não informado'}
Tipo: ${productContext.productType || 'Não informado'}
Nicho: ${productContext.niche || 'Não informado'}
Tom: ${productContext.tone || 'profissional'}

Objeções a responder:
${objections.map((o, i) => `${i + 1}. "${o}"`).join('\n')}

Gere respostas curtas (máximo 3 frases), persuasivas e amigáveis para cada objeção.
Retorne no formato JSON: { "objeção": "resposta" }`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um assistente de vendas. Responda apenas com JSON válido.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Error generating objection responses:', error);

    // Return default responses if AI fails
    const defaults: Record<string, string> = {};
    for (const objection of objections) {
      defaults[objection] = `Entendo sua preocupação! ${productContext.mainBenefit || 'Nosso produto oferece grande valor.'} Posso explicar melhor?`;
    }
    return defaults;
  }
}

/**
 * Extract clean value from conversational text
 * E.g., "Eu acho que o melhor nome seria Super Agentes" -> "Super Agentes"
 */
export async function extractCleanValue(
  rawInput: string,
  fieldType: 'name' | 'description' | 'benefit' | 'objection',
  context?: { productName?: string }
): Promise<{ cleanValue: string; wasConversational: boolean }> {
  // If input is short and doesn't look conversational, return as-is
  const conversationalPatterns = [
    /^(eu acho|acho que|pode ser|seria|talvez|penso que|quero|gostaria)/i,
    /^(o nome|a descrição|o benefício|o produto)/i,
    /(melhor|ideal|bom|ótimo|perfeito) (nome|título|descrição)/i,
  ];

  const looksConversational = conversationalPatterns.some(p => p.test(rawInput));

  if (!looksConversational && rawInput.length < 100) {
    return { cleanValue: rawInput, wasConversational: false };
  }

  const fieldInstructions: Record<string, string> = {
    name: 'Extraia apenas o NOME do produto (máximo 5 palavras, sem explicações)',
    description: 'Extraia apenas a DESCRIÇÃO do produto (máximo 2 frases)',
    benefit: 'Extraia apenas o BENEFÍCIO principal (máximo 1 frase)',
    objection: 'Extraia apenas a OBJEÇÃO mencionada (máximo 1 frase)',
  };

  const prompt = `O usuário digitou o seguinte texto ao preencher um formulário de cadastro de produto:

"${rawInput}"

${fieldInstructions[fieldType]}

Retorne APENAS o valor extraído, sem aspas, explicações ou formatação adicional. Se não conseguir extrair, retorne o texto original limpo.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você extrai informações de texto conversacional. Responda apenas com o valor extraído, nada mais.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const cleanValue = completion.choices[0]?.message?.content?.trim() || rawInput;
    return { cleanValue, wasConversational: true };
  } catch (error) {
    console.error('Error extracting clean value:', error);
    return { cleanValue: rawInput, wasConversational: false };
  }
}

/**
 * Analyze uploaded product file and extract info
 */
export async function analyzeProductFile(
  fileUrl: string,
  fileType: string
): Promise<{
  suggestedName?: string;
  suggestedDescription?: string;
  suggestedBenefits?: string[];
  suggestedObjections?: string[];
}> {
  // For now, return placeholder - PDF analysis would require additional processing
  // In production, you'd use Vision API or document processing

  const prompt = `Baseado no tipo de arquivo (${fileType}), sugira perguntas relevantes que o vendedor deve responder sobre seu produto para criar uma boa descrição de vendas.

Responda em JSON com campos:
- suggestedQuestions: array de perguntas relevantes
- tips: dicas para o vendedor descrever melhor o produto`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um consultor de vendas. Responda apenas com JSON válido.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error analyzing product file:', error);
  }

  return {
    suggestedName: undefined,
    suggestedDescription: undefined,
    suggestedBenefits: [],
    suggestedObjections: ['Está caro', 'Preciso pensar', 'Vou ver depois'],
  };
}

/**
 * Generate WhatsApp preview messages
 */
export async function generateWhatsAppPreview(
  productContext: ProductContext
): Promise<Array<{ who: 'customer' | 'bot'; text: string }>> {
  const prompt = `Você é um bot de vendas do WhatsApp. Simule uma conversa natural entre um cliente interessado e o bot, baseado no produto abaixo.

Produto: ${productContext.name || 'Produto'}
Descrição: ${productContext.description || 'Não informada'}
Benefício: ${productContext.mainBenefit || 'Não informado'}
Preço: ${productContext.price ? `R$ ${productContext.price}` : 'Não informado'}
Tom: ${productContext.tone || 'profissional'}

Gere uma conversa curta (4-6 mensagens) mostrando:
1. Cliente perguntando sobre o produto
2. Bot respondendo de forma natural
3. Cliente perguntando preço
4. Bot informando e incentivando a compra

Retorne JSON: { "messages": [{ "who": "customer|bot", "text": "mensagem" }] }`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Gere conversas naturais de WhatsApp. Responda apenas com JSON válido.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return parsed.messages || [];
    }
  } catch (error) {
    console.error('Error generating WhatsApp preview:', error);
  }

  // Fallback messages
  return [
    { who: 'customer', text: `Oi, quero saber mais sobre ${productContext.name || 'o produto'}` },
    { who: 'bot', text: `Olá! 👋 ${productContext.mainBenefit || 'Esse produto é incrível!'} Posso te ajudar?` },
  ];
}

interface DocumentAnalysisResult {
  suggestedName?: string;
  suggestedDescription?: string;
  suggestedBenefits?: string[];
  suggestedPrice?: number;
  topics?: string[];
  targetAudience?: string;
  summary?: string;
}

// Import pdf-parse for fast local text extraction
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

/**
 * Analyze and summarize an uploaded PDF file using OpenAI
 * FAST VERSION: Extracts text locally with pdf-parse, then uses direct chat completion
 * ~5-10x faster than the previous Assistants API approach
 *
 * @param fileUrl - URL to download file from (used if fileContent not provided)
 * @param fileName - Original file name
 * @param fileType - MIME type of the file
 * @param fileContent - Base64 encoded file content (optional, for faster processing)
 */
export async function analyzeAndSummarizeFile(
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileContent?: string // base64 encoded content for faster processing
): Promise<DocumentAnalysisResult> {
  const startTime = Date.now();

  // Clean filename for context
  const cleanName = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\d{10,}/g, '')
    .trim();

  try {
    let buffer: Buffer;

    if (fileContent) {
      // Use provided base64 content directly - no download needed!
      console.log('📄 Using provided file content (base64), skipping download');
      buffer = Buffer.from(fileContent, 'base64');
    } else {
      // Fallback: download from URL
      console.log('📥 Downloading PDF from:', fileUrl);
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    console.log(`📄 PDF size: ${(buffer.length / 1024).toFixed(1)} KB`);

    // Extract text from PDF locally (FAST - no API call)
    console.log('📝 Extracting text from PDF...');
    const pdfData = await pdfParse(buffer);
    const extractedText = pdfData.text || '';
    const pageCount = pdfData.numpages || 0;

    console.log(`✅ Extracted ${extractedText.length} chars from ${pageCount} pages`);

    if (!extractedText.trim()) {
      console.log('⚠️ No text extracted from PDF, using filename-based analysis');
      return analyzeByFilename(cleanName);
    }

    // Truncate text to fit in context window (keep first ~12000 chars for gpt-4o-mini)
    const maxChars = 12000;
    const truncatedText = extractedText.length > maxChars
      ? extractedText.substring(0, maxChars) + '\n\n[... conteúdo truncado ...]'
      : extractedText;

    // Direct chat completion - MUCH faster than Assistants API
    console.log('🤖 Analyzing with GPT-4o-mini (direct chat)...');
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em análise de produtos digitais e infoprodutos brasileiros.
Analise o conteúdo do documento e extraia informações estruturadas para ajudar o vendedor a cadastrar seu produto.
IMPORTANTE: Responda APENAS com JSON válido, sem markdown ou explicações.`
        },
        {
          role: 'user',
          content: `Analise este documento chamado "${cleanName}" e retorne um JSON com esta estrutura:

{
  "suggestedName": "Nome sugerido para o produto (curto e atraente, máximo 5 palavras)",
  "suggestedDescription": "Descrição curta do que o produto oferece (1-2 frases)",
  "suggestedBenefits": ["Benefício 1 específico", "Benefício 2 específico", "Benefício 3 específico"],
  "suggestedPrice": null,
  "topics": ["Tópico 1", "Tópico 2", "Tópico 3", "Tópico 4", "Tópico 5"],
  "targetAudience": "Descrição do público-alvo ideal",
  "summary": "Resumo geral do produto em 2-3 frases"
}

Seja específico e baseie-se no conteúdo real do documento. O nome deve ser curto e memorável. Os benefícios devem ser resultados concretos que o cliente terá.

CONTEÚDO DO DOCUMENTO:
${truncatedText}`
        },
      ],
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        const elapsed = Date.now() - startTime;
        console.log(`✅ Analysis complete in ${elapsed}ms: "${parsed.suggestedName}"`);

        return {
          suggestedName: parsed.suggestedName || undefined,
          suggestedDescription: parsed.suggestedDescription || undefined,
          suggestedBenefits: parsed.suggestedBenefits || [],
          suggestedPrice: parsed.suggestedPrice || undefined,
          topics: parsed.topics || [],
          targetAudience: parsed.targetAudience || undefined,
          summary: parsed.summary || undefined,
        };
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
      }
    }

  } catch (error: any) {
    console.error('Error analyzing PDF:', error?.message || error);
  }

  // Fallback to filename-based analysis
  return analyzeByFilename(cleanName);
}

/**
 * Fallback: analyze based on filename only
 */
async function analyzeByFilename(cleanName: string): Promise<DocumentAnalysisResult> {
  try {
    console.log('📝 Using fallback analysis based on filename:', cleanName);
    const fallbackCompletion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente especializado em infoprodutos. Responda apenas com JSON válido.'
        },
        {
          role: 'user',
          content: `Recebi um arquivo PDF chamado "${cleanName}".

Baseado apenas no nome do arquivo, sugira informações para ajudar a cadastrar este produto. Retorne JSON:

{
  "suggestedName": "Nome sugerido baseado no arquivo (curto, máximo 5 palavras)",
  "suggestedDescription": "Possível descrição baseada no nome",
  "suggestedBenefits": ["Possível benefício 1", "Possível benefício 2"],
  "topics": ["Possível tópico 1", "Possível tópico 2"],
  "summary": "Não foi possível analisar o conteúdo do PDF. As sugestões são baseadas apenas no nome do arquivo."
}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const fallbackContent = fallbackCompletion.choices[0]?.message?.content;
    if (fallbackContent) {
      try {
        return JSON.parse(fallbackContent);
      } catch {
        return { summary: fallbackContent };
      }
    }
  } catch (fallbackError) {
    console.error('Fallback also failed:', fallbackError);
  }

  // Ultimate fallback
  return {
    suggestedName: cleanName || undefined,
    summary: `Recebi o arquivo "${cleanName}". Não foi possível analisar automaticamente.`,
  };
}

/**
 * Save conversation to Firestore
 */
export async function saveProductConversation(
  creatorId: string,
  productId: string,
  messages: ChatMessage[],
  productContext: ProductContext
): Promise<void> {
  const db = getFirestore();

  await db.collection('creators')
    .doc(creatorId)
    .collection('productConversations')
    .doc(productId)
    .set({
      messages,
      productContext,
      updatedAt: new Date(),
      createdAt: new Date(),
    }, { merge: true });
}

interface CreatorData {
  displayName?: string;
  niche?: string;
  voiceStyle?: 'friendly_coach' | 'professional_expert' | 'casual_friend' | 'formal_consultant';
  upcomingProducts?: string;
  servicesPreview?: string;
}

/**
 * Generate welcome message for creator profile (when no products exist)
 */
export async function generateCreatorWelcomeMessage(
  creatorData: CreatorData
): Promise<string> {
  const voiceStyleDescriptions: Record<string, string> = {
    friendly_coach: 'amigavel, motivador, com energia positiva e emojis',
    professional_expert: 'profissional, direto e focado em resultados',
    casual_friend: 'descontraido, informal, com girias e leveza',
    formal_consultant: 'serio, respeitoso e tradicional',
  };

  const toneDescription = voiceStyleDescriptions[creatorData.voiceStyle || 'friendly_coach'];

  const prompt = `Voce e um assistente de WhatsApp para um criador de conteudo/infoprodutor. Crie uma mensagem de boas-vindas personalizada para quando um lead enviar mensagem, considerando que o criador AINDA NAO TEM PRODUTOS CADASTRADOS.

Informacoes do criador:
- Nome: ${creatorData.displayName || 'Criador'}
- Nicho/Area: ${creatorData.niche || 'Nao especificado'}
- Tom de voz: ${toneDescription}
- O que esta preparando: ${creatorData.upcomingProducts || 'Nao informado'}
- Servicos futuros: ${creatorData.servicesPreview || 'Nao informado'}

A mensagem deve:
1. Cumprimentar e se apresentar com o nome do criador
2. Mencionar que ainda esta preparando seus produtos/materiais
3. Criar expectativa sobre o que vem por ai (se informado)
4. Perguntar se pode avisar quando tiver novidades
5. Usar o tom de voz especificado
6. Ser curta e natural (maximo 4 frases)
7. Ser uma UNICA mensagem (nao dividir em multiplas)

IMPORTANTE: Retorne APENAS a mensagem, sem aspas, explicacoes ou formatacao adicional.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Voce cria mensagens de WhatsApp naturais e personalizadas. Responda apenas com a mensagem, nada mais.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 200,
    });

    const welcomeMessage = completion.choices[0]?.message?.content?.trim();
    if (welcomeMessage) {
      return welcomeMessage;
    }
  } catch (error) {
    console.error('Error generating welcome message:', error);
  }

  // Fallback message
  const name = creatorData.displayName || 'aqui';
  const upcoming = creatorData.upcomingProducts
    ? ` Estou trabalhando em ${creatorData.upcomingProducts}.`
    : '';

  return `Oi! Me chamo ${name}! Ainda estou preparando meus produtos, mas logo teremos novidades.${upcoming} Posso te avisar quando algo novo estiver disponivel?`;
}
