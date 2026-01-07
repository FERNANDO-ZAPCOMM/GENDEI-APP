// =============================================================================
// FIRESTORE SCHEMA v2 - Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Collection Names (Constants)
// -----------------------------------------------------------------------------
export const Collections = {
  // Main collections
  CREATORS: 'creators',

  // Creator subcollections
  PRODUCTS: 'products',
  CONTACTS: 'contacts',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  ORDERS: 'orders',
  TEAM: 'team',
  CHANNELS: 'channels',
  SETTINGS: 'settings',
  WORKFLOWS: 'workflows',
  TEAM_INVITATIONS: 'team_invitations',

  // Root-level collections (not under creators)
  SCHEDULED_TASKS: 'scheduled_tasks',

  // Server-only collections (root level, prefixed with _)
  TOKENS: '_tokens',
  OAUTH: '_oauth',
  WEBHOOKS: '_webhooks',
  AUDIT: '_audit',

  // Platform admin collections
  PLATFORM: '_platform',
} as const;

// -----------------------------------------------------------------------------
// Creator (Main Entity - replaces "Creator")
// -----------------------------------------------------------------------------
export enum CreatorStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export enum CreatorPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum VoiceStyle {
  FRIENDLY_COACH = 'friendly_coach',
  PROFESSIONAL_EXPERT = 'professional_expert',
  CASUAL_FRIEND = 'casual_friend',
  FORMAL_CONSULTANT = 'formal_consultant',
}

export enum SpeakingPerspective {
  FIRST_PERSON = 'first_person',
  THIRD_PERSON = 'third_person',
}

export interface CreatorProfile {
  displayName: string;
  voiceStyle: VoiceStyle;
  speakingPerspective: SpeakingPerspective;
  language: string;
  // AI persona fields (set during onboarding)
  niche?: string;                    // Area of expertise
  sampleResponses?: string;          // Example responses for AI training
  welcomeMessage?: string;           // AI-generated welcome message
  isOnboardingComplete?: boolean;    // Whether profile chat flow is completed
  showProductsInGreeting?: boolean;  // Show product titles in greeting when available
}

export enum WhatsAppStatus {
  DISCONNECTED = 'disconnected',
  CONNECTED = 'connected',
  READY = 'ready',
}

export interface CreatorWhatsApp {
  status: WhatsAppStatus;
  phoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
  wabaName?: string;
  businessManagerId?: string;
  qualityRating?: string;
  connectedAt?: Date;
  lastSyncedAt?: Date;
}

export interface Creator {
  id: string;
  name: string;
  slug?: string;
  status: CreatorStatus;
  plan: CreatorPlan;
  profile: CreatorProfile;
  whatsapp: CreatorWhatsApp;
  // Onboarding tracking
  onboardingStep?: number;           // Current step (0-3)
  onboardingCompleted?: boolean;     // Full onboarding complete
  createdAt: Date;
  updatedAt: Date;
}

// -----------------------------------------------------------------------------
// Products
// -----------------------------------------------------------------------------
export enum ProductType {
  EBOOK = 'ebook',
  COURSE = 'course',
  MENTORSHIP = 'mentorship',
  COMMUNITY = 'community',
  CONSULTING = 'consulting',
  TEMPLATE = 'template',
  SOFTWARE = 'software',
  SERVICE = 'service',
  OTHER = 'other',
}

export interface Product {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  price: number;                   // 0 for free products
  currency: string;
  type: ProductType;
  fileUrl?: string;                // Main downloadable file
  thumbnailUrl?: string;           // Product image for catalog
  isActive: boolean;
  salesCount: number;
  totalRevenue: number;
  // AI Sales Agent fields
  mainBenefit?: string;            // Primary value proposition
  targetAudience?: string;         // Who this product is for
  tone?: 'friendly' | 'professional' | 'empathetic' | 'casual' | 'urgent';
  objections?: string[];
  objectionResponses?: Record<string, string>;
  // RAG context (populated by AI during product creation)
  ragContext?: {
    summary?: string;              // AI-generated summary
    topics?: string[];             // Main topics covered
    benefits?: string[];           // List of benefits
    contentDetails?: string;       // Detailed content for AI
  };
  // Delivery configuration (REQUIRED for free products)
  delivery?: {
    url?: string;                  // Download URL or access link
    message?: string;              // Custom delivery message
  };
  createdAt: Date;
  updatedAt: Date;
}

// -----------------------------------------------------------------------------
// Contacts (CRM)
// -----------------------------------------------------------------------------
export enum ContactSource {
  WHATSAPP = 'whatsapp',
  MANUAL = 'manual',
  IMPORT = 'import',
}

export interface ContactStats {
  totalOrders: number;
  totalSpent: number;
  lastOrderAt?: Date;
  conversationCount: number;
  lastMessageAt?: Date;
}

export interface Contact {
  id: string;                        // Same as phone number
  creatorId: string;
  phone: string;
  name?: string;                     // From WhatsApp profile
  tags: string[];                    // CRM tags for segmentation
  source: ContactSource;
  stats: ContactStats;               // Computed from orders/conversations
  firstContactAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// -----------------------------------------------------------------------------
// Conversations
// -----------------------------------------------------------------------------
export enum ConversationState {
  // NOTE: These values reflect what is currently persisted by `apps/whatsapp-agent`
  // and what the frontend funnel UI expects (pt-BR stage names).
  NOVO = 'novo',
  QUALIFICADO = 'qualificado',
  NEGOCIANDO = 'negociando',
  CHECKOUT = 'checkout',
  FECHADO = 'fechado',

  // Internal agent states (also persisted today) — kept pt-BR canonical.
  NAVEGANDO = 'navegando',
  SELECIONANDO_PRODUTO = 'selecionando_produto',
  WORKFLOW_ATIVO = 'workflow_ativo',
}

export enum ConversationHandler {
  AI = 'ai',
  HUMAN = 'human',
}

export interface LastMessage {
  text: string;
  direction: 'in' | 'out';
  timestamp: Date;
}

export interface WorkflowExecutionState {
  workflowId: string;
  currentNodeId: string;
  variables: Record<string, unknown>;
  startedAt: string;  // ISO date string
}

export interface ConversationContext {
  selectedProductId?: string;
  cartItems?: Array<{ productId: string; quantity: number }>;
  collectedInfo?: Record<string, unknown>;
  hasSeenGreeting?: boolean;
  currentIntent?: string;
  // Workflow execution state
  workflowExecution?: WorkflowExecutionState;
}

export interface Conversation {
  id: string;  // Same as phone number for easy lookup
  creatorId: string;
  contactPhone: string;
  contactName?: string;
  state: ConversationState;
  lastMessage?: LastMessage;
  messageCount: number;
  unreadCount: number;
  handledBy: ConversationHandler;
  humanTakeoverAt?: Date;
  humanTakeoverBy?: string;
  aiPaused: boolean;
  context: ConversationContext;
  sessionExpiresAt?: Date;
  isSessionActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Legacy fields for backward compatibility with whatsapp-agent
  waUserId?: string;
  waUserName?: string;
  waUserPhone?: string;
  isHumanTakeover?: boolean;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  lastMessageSnapshot?: {
    text: string;
    type: string;
    direction: string;
    timestamp: Date;
  };
  takenOverAt?: Date;
  takenOverBy?: string;
}

// -----------------------------------------------------------------------------
// Messages
// -----------------------------------------------------------------------------
export enum MessageDirection {
  IN = 'in',
  OUT = 'out',
  // Legacy aliases for backward compatibility
  INBOUND = 'in',
  OUTBOUND = 'out',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document',
  INTERACTIVE = 'interactive',
  TEMPLATE = 'template',
}

export enum MessageStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export enum MessageSender {
  CUSTOMER = 'customer',
  AI = 'ai',
  HUMAN = 'human',
}

export interface Message {
  id: string;
  conversationId: string;
  creatorId: string;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  waMessageId?: string;
  status: MessageStatus;
  sender: MessageSender;
  sentBy?: string;  // userId if sender is HUMAN
  error?: string;
  createdAt: Date;
}

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  // Legacy alias
  COMPLETED = 'paid',
}

export enum OrderStatus {
  CREATED = 'created',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface OrderItem {
  productId: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  creatorId: string;
  contactPhone: string;
  contactName?: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentId?: string;
  status: OrderStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  // Legacy fields for backward compatibility
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

// -----------------------------------------------------------------------------
// Team
// -----------------------------------------------------------------------------
export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  SUPPORT = 'support',
  MARKETING = 'marketing',
}

export enum TeamMemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  REVOKED = 'revoked',
  // Legacy aliases
  ACCEPTED = 'active',
  EXPIRED = 'revoked',
}

export interface TeamMember {
  id: string;
  creatorId: string;
  userId: string;
  email: string;
  role: TeamRole;
  displayName?: string;
  status: TeamMemberStatus;
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt?: Date;
  acceptedAt?: Date;  // Legacy field
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamInvitation {
  id: string;
  creatorId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  invitedByEmail: string;
  creatorName: string;
  token: string;
  status: TeamMemberStatus;
  expiresAt: Date;
  createdAt: Date;
}

// -----------------------------------------------------------------------------
// Channels (WhatsApp Numbers)
// -----------------------------------------------------------------------------
export interface Channel {
  id: string;  // Same as phoneNumberId
  creatorId: string;
  phoneNumberId: string;             // Meta phone number ID (same as id)
  wabaId: string;
  phoneNumber: string;               // E.164 format phone number
  displayPhoneNumber?: string;       // Human-readable format
  accessToken?: string;              // Encrypted WhatsApp API token
  isActive: boolean;
  qualityRating?: string;
  createdAt: Date;
  updatedAt: Date;
}

// -----------------------------------------------------------------------------
// Settings (future feature - not currently used)
// -----------------------------------------------------------------------------
export interface CreatorSettings {
  pixKey?: string;                   // PIX key for payments
}

// -----------------------------------------------------------------------------
// Server-Only Types
// -----------------------------------------------------------------------------
export interface TokenDocument {
  creatorId: string;
  accessToken: string;  // Encrypted
  refreshToken?: string;  // Encrypted
  expiresAt?: Date;
  issuedAt: Date;
  lastUsed?: Date;
  usageCount: number;
  status: 'active' | 'revoked';
  updatedAt: Date;
}

export interface OAuthSession {
  id: string;
  creatorId: string;
  state: string;
  redirectUri: string;
  mode: 'graph' | 'oauth';
  createdAt: Date;
  expiresAt: Date;
}

export interface WebhookRecord {
  id: string;
  processedAt: Date;
  expiresAt: Date;
}

// -----------------------------------------------------------------------------
// Role Permissions
// -----------------------------------------------------------------------------
export const ROLE_PERMISSIONS: Record<TeamRole, Record<string, boolean>> = {
  [TeamRole.OWNER]: {
    canViewProducts: true,
    canManageProducts: true,
    canViewOrders: true,
    canManageOrders: true,
    canViewConversations: true,
    canManageConversations: true,
    canViewContacts: true,
    canManageContacts: true,
    canViewTeam: true,
    canManageTeam: true,
    canViewSettings: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canManageBilling: true,
    canDeleteAccount: true,
  },
  [TeamRole.ADMIN]: {
    canViewProducts: true,
    canManageProducts: true,
    canViewOrders: true,
    canManageOrders: true,
    canViewConversations: true,
    canManageConversations: true,
    canViewContacts: true,
    canManageContacts: true,
    canViewTeam: true,
    canManageTeam: true,
    canViewSettings: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canManageBilling: false,
    canDeleteAccount: false,
  },
  [TeamRole.SUPPORT]: {
    canViewProducts: true,
    canManageProducts: false,
    canViewOrders: true,
    canManageOrders: true,
    canViewConversations: true,
    canManageConversations: true,
    canViewContacts: true,
    canManageContacts: true,
    canViewTeam: false,
    canManageTeam: false,
    canViewSettings: false,
    canManageSettings: false,
    canViewAnalytics: false,
    canManageBilling: false,
    canDeleteAccount: false,
  },
  [TeamRole.MARKETING]: {
    canViewProducts: true,
    canManageProducts: true,
    canViewOrders: true,
    canManageOrders: false,
    canViewConversations: true,
    canManageConversations: false,
    canViewContacts: true,
    canManageContacts: false,
    canViewTeam: false,
    canManageTeam: false,
    canViewSettings: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManageBilling: false,
    canDeleteAccount: false,
  },
};

// -----------------------------------------------------------------------------
// API Types
// -----------------------------------------------------------------------------
export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  creatorId: string;
  role?: TeamRole;
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

// -----------------------------------------------------------------------------
// Scheduled Tasks (for follow-ups, cart recovery, re-engagement)
// -----------------------------------------------------------------------------
export enum ScheduledTaskType {
  FOLLOW_UP = 'follow_up',
  CART_RECOVERY = 'cart_recovery',
  RE_ENGAGEMENT = 're_engagement',
  WORKFLOW_TIMER = 'workflow_timer',
  NURTURE = 'nurture',
}

export enum ScheduledTaskStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ScheduledTaskPayload {
  message?: string;                  // Message to send
  productId?: string;                // Related product
  productName?: string;              // Product name for context
  productPrice?: string;             // Formatted price
  workflowId?: string;               // Related workflow
  nodeId?: string;                   // Workflow node to execute
  metadata?: Record<string, unknown>;  // Additional data
}

export interface ScheduledTaskConversationContext {
  stage?: string;                    // Conversation stage
  userName?: string;                 // Contact name
  interests?: string;                // User interests
  tags?: string[];                   // Contact tags
  messageCount?: number;             // Total messages
  lastMessages?: Array<{             // Recent message history
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

export interface ScheduledTask {
  id: string;
  creatorId: string;
  phone: string;                     // Contact phone number
  taskType: ScheduledTaskType;
  scheduledFor: Date;                // When to execute
  status: ScheduledTaskStatus;
  payload: ScheduledTaskPayload;
  // Conversation snapshot for context restoration
  conversationContext?: ScheduledTaskConversationContext;
  lastMessageAt?: Date;              // Last message before scheduling
  // Execution tracking
  createdAt: Date;
  executedAt?: Date;
  errorMessage?: string;             // Error if failed
}

// -----------------------------------------------------------------------------
// Legacy Aliases (for gradual migration)
// -----------------------------------------------------------------------------
/** @deprecated Use Product instead */
export type DigitalProduct = Product;

// -----------------------------------------------------------------------------
// Workflow Types (re-export from workflows.ts)
// -----------------------------------------------------------------------------
export * from './workflows';
