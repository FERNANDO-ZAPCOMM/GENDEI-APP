import type {
  WorkflowNodeType,
  WorkflowTriggerType,
  ConditionType,
  ProductOfferType,
  ProductSelectionType,
  CollectInfoField,
  WorkflowPresetCategory,
} from './workflow_contract';

export type {
  WorkflowNodeType,
  WorkflowTriggerType,
  ConditionType,
  ProductOfferType,
  ProductSelectionType,
  CollectInfoField,
  WorkflowPresetCategory,
} from './workflow_contract';

export interface WhatsAppChannel {
  phone_number_id?: string;
  phone_e164?: string;
  business_name?: string;
  status: 'connected' | 'not_connected' | 'pending';
}

export interface PaymentSettings {
  pix_key?: string;
}

// API Response types
export interface ApiError {
  message: string;
  statusCode?: number;
}

export interface ConnectWhatsAppStep1Response {
  pending: true;
}

export interface ConnectWhatsAppStep2Response {
  phone_number_id: string;
  status: 'connected';
}

export interface UpdatePaymentResponse {
  ok: true;
}

// Meta / WhatsApp Connection Types
export interface MetaConnection {
  businessManagerId?: string;
  businessManagerName?: string;
  wabaId?: string;
  wabaName?: string;
  phoneNumberId?: string;
  phoneNumber?: string;
  displayPhoneNumber?: string;
  verifiedName?: string; // WhatsApp display name shown in conversations
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  connectedAt?: string;
  lastSyncedAt?: string;
}

export interface WhatsAppConfig {
  isVerified: boolean;
  verificationMethod?: 'SMS' | 'VOICE';
  verifiedAt?: string;
  testMessageSent?: boolean;
  webhookSubscribed?: boolean;
}

export interface WhatsAppStatus {
  meta?: MetaConnection;
  whatsappStatus: 'DISCONNECTED' | 'CONNECTED' | 'NEEDS_VERIFICATION' | 'READY';
  whatsappConfig?: WhatsAppConfig;
}

// Meta API Request/Response Types
export interface EmbeddedSignupStartRequest {
  redirectUrl: string;
}

export interface EmbeddedSignupStartResponse {
  success: boolean;
  launchUrl: string;
  state: string;
  sessionId?: string;
  mode?: 'graph' | 'oauth';
  redirectUri?: string;
}

export interface RequestVerificationRequest {
  phoneNumberId: string;
  method: 'SMS' | 'VOICE';
}

export interface RequestVerificationResponse {
  success: boolean;
  message: string;
}

export interface RegisterNumberRequest {
  phoneNumberId: string;
  code: string;
}

export interface RegisterNumberResponse {
  success: boolean;
  message: string;
}

export interface TestMessageRequest {
  phoneNumberId: string;
  to: string;
  template?: {
    name: string;
    language: string;
  };
}

export interface TestMessageResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

export interface MetaStatusResponse {
  success: boolean;
  data: WhatsAppStatus;
}

// =============================================================================
// WORKFLOW SYSTEM TYPES
// =============================================================================

// Node Data Types
export interface MessageNodeData {
  message: string;
  delay?: number;
  mediaUrl?: string;
}

export interface OfferProductNodeData {
  productSelection: ProductSelectionType;
  productIds?: string[];
  priceRange?: { min?: number; max?: number };
  productType?: string;
  offerType: ProductOfferType;
  messageTemplate: string;
}

export interface CollectInfoNodeData {
  field: CollectInfoField;
  customFieldName?: string;
  prompt: string;
  validation?: 'email' | 'phone' | 'none';
  storeIn: string;
}

export interface ConditionNodeData {
  conditionType: ConditionType;
  llmPrompt?: string;
  expression?: string;
  outcomes: string[];
}

export interface IntentDefinition {
  name: string;
  description: string;
  keywords?: string[];
}

export interface IntentRouterNodeData {
  intents: IntentDefinition[];
  defaultOutcome: string;
}

export interface WaitResponseNodeData {
  timeout?: number;
  timeoutNodeId?: string;
  variableName: string;
}

export interface AssignTagNodeData {
  tags: string[];
  action: 'add' | 'remove';
}

export interface HandoffNodeData {
  reason?: string;
  notifyTeam: boolean;
  assignTo?: string;
}

export interface EndNodeData {
  message?: string;
}

export type WorkflowNodeData =
  | Record<string, never>  // StartNodeData
  | MessageNodeData
  | OfferProductNodeData
  | CollectInfoNodeData
  | ConditionNodeData
  | IntentRouterNodeData
  | WaitResponseNodeData
  | AssignTagNodeData
  | HandoffNodeData
  | EndNodeData;

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position?: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  conditions?: string[];
  productIds?: string[];
}

export interface Workflow {
  id: string;
  creatorId: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  triggers: WorkflowTrigger[];
  startNodeId: string;
  nodes: Record<string, WorkflowNode>;
  edges: WorkflowEdge[];
  presetId?: string;
  version: number;
  schemaVersion?: number;
  revision?: number;
  compiledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowPreset {
  id: string;
  name: string;
  nameKey: string;
  description: string;
  descriptionKey: string;
  icon: string;
  category: WorkflowPresetCategory;
  triggers: WorkflowTrigger[];
  startNodeId: string;
  nodes: Record<string, WorkflowNode>;
  edges: WorkflowEdge[];
}
