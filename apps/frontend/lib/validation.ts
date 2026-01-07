import { z } from 'zod';

export const PhoneE164Schema = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Número inválido');

export const VerifyCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Código deve ter 6 dígitos');

export const PriceBRLSchema = z.coerce
  .number()
  .nonnegative('Preço não pode ser negativo');

export const PixKeySchema = z
  .string()
  .min(5, 'Informe a chave PIX');

// Tone options for AI sales agent
export const ToneSchema = z.enum(['friendly', 'professional', 'empathetic', 'casual', 'urgent']).optional();

// RAG context schema for AI to answer customer questions
export const RagContextSchema = z.object({
  summary: z.string().optional(),
  topics: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  faq: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  contentDetails: z.string().optional(),
  additionalInfo: z.record(z.string(), z.string()).optional(),
}).optional();

// Simplified schema for product creation - backend will transform to full Product
export const ProductSchema = z.object({
  title: z.string().min(2, 'Título deve ter ao menos 2 caracteres'),
  description: z.string().min(1, 'Descrição é obrigatória').max(750, 'Descrição muito longa'),
  price: PriceBRLSchema,
  fileUrl: z.union([z.string().url('URL inválida'), z.literal('')]).optional(),
  thumbnailUrl: z.union([z.string().url('URL inválida'), z.literal('')]).optional(),
  active: z.boolean().default(true),
  type: z.string().optional(),
  // AI Sales Agent fields
  mainBenefit: z.string().max(500, 'Benefício muito longo').optional(),
  targetAudience: z.string().max(300, 'Público-alvo muito longo').optional(),
  tone: ToneSchema,
  objections: z.array(z.string()).optional(),
  objectionResponses: z.record(z.string(), z.string()).optional(),
  // RAG context for AI conversations
  ragContext: RagContextSchema,
});

export const PhoneConnectSchema = z.object({
  phone_e164: PhoneE164Schema,
});

export const PhoneVerifySchema = z.object({
  phone_e164: PhoneE164Schema,
  verify_code: VerifyCodeSchema,
});

export const PixSettingsSchema = z
  .object({
    pix_key: PixKeySchema,
    confirm_pix_key: PixKeySchema,
  })
  .refine((data) => data.pix_key === data.confirm_pix_key, {
    message: 'As chaves PIX não coincidem',
    path: ['confirm_pix_key'],
  });
