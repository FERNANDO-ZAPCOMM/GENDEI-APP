// =============================================================================
// WORKFLOW SYSTEM - Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------
import {
  WorkflowNodeType,
  WorkflowTriggerType,
  ConditionType,
  ProductOfferType,
  ProductSelectionType,
  CollectInfoField,
  WorkflowPresetCategory,
} from './workflow_contract';

export {
  WorkflowNodeType,
  WorkflowTriggerType,
  ConditionType,
  ProductOfferType,
  ProductSelectionType,
  CollectInfoField,
  WorkflowPresetCategory,
};

// -----------------------------------------------------------------------------
// Node Data Types
// -----------------------------------------------------------------------------
export interface StartNodeData {
  // Start node has no special data
}

export interface MessageNodeData {
  message: string;              // Message template with {{variables}}
  delay?: number;               // Delay before sending (ms)
  mediaUrl?: string;            // Optional image/video
}

export interface OfferProductNodeData {
  productSelection: ProductSelectionType;
  productIds?: string[];        // For 'specific' selection
  priceRange?: {
    min?: number;
    max?: number;
  };                            // For 'by_price'
  productType?: string;         // For 'by_type' (e.g., 'ebook', 'consulting')
  offerType: ProductOfferType;
  messageTemplate: string;      // Message when offering
}

export interface CollectInfoNodeData {
  field: CollectInfoField;
  customFieldName?: string;     // For 'custom' field
  prompt: string;               // Question to ask
  validation?: 'email' | 'phone' | 'none';
  storeIn: string;              // Variable name to store value
}

export interface ConditionNodeData {
  conditionType: ConditionType;
  // For LLM condition (natural language)
  llmPrompt?: string;           // "Did the user express interest?"
  // For expression condition
  expression?: string;          // "{{price}} > 50"
  // Possible outcomes (for edge connections)
  outcomes: string[];           // ['yes', 'no'] or ['interested', 'not_sure', 'no']
}

export interface IntentDefinition {
  name: string;                 // 'price_inquiry', 'purchase_intent'
  description: string;          // For LLM to understand
  keywords?: string[];          // Trigger keywords
}

export interface IntentRouterNodeData {
  intents: IntentDefinition[];
  defaultOutcome: string;       // If no intent matched
}

export interface WaitResponseNodeData {
  timeout?: number;             // Seconds to wait
  timeoutNodeId?: string;       // Where to go on timeout
  variableName: string;         // Store response as variable
}

export interface AssignTagNodeData {
  tags: string[];               // Tags to assign
  action: 'add' | 'remove';
}

export interface HandoffNodeData {
  reason?: string;              // Why handoff
  notifyTeam: boolean;
  assignTo?: string;            // Specific team member
}

export interface EndNodeData {
  message?: string;             // Optional closing message
}

// Union type for all node data
export type WorkflowNodeData =
  | StartNodeData
  | MessageNodeData
  | OfferProductNodeData
  | CollectInfoNodeData
  | ConditionNodeData
  | IntentRouterNodeData
  | WaitResponseNodeData
  | AssignTagNodeData
  | HandoffNodeData
  | EndNodeData;

// -----------------------------------------------------------------------------
// Node and Edge Types
// -----------------------------------------------------------------------------
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position?: { x: number; y: number };  // For visual builder (future)
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;               // Source node ID
  target: string;               // Target node ID
  sourceHandle?: string;        // For condition nodes (outcome name)
  label?: string;               // Optional label for the edge
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  conditions?: string[];        // Keywords or intent names
  productIds?: string[];        // Products that trigger this workflow
}

// -----------------------------------------------------------------------------
// Main Workflow Type
// -----------------------------------------------------------------------------
export interface Workflow {
  id: string;
  creatorId: string;
  name: string;
  description?: string;
  isActive: boolean;            // Only one active workflow per creator
  isDefault: boolean;           // Default workflow for new conversations

  // Trigger Configuration
  triggers: WorkflowTrigger[];

  // Workflow Structure
  startNodeId: string;          // Entry point node ID
  nodes: Record<string, WorkflowNode>;  // Node ID -> Node definition
  edges: WorkflowEdge[];        // Connections between nodes

  // Metadata
  presetId?: string;            // If created from preset
  version: number;              // Schema version (deprecated alias)
  schemaVersion?: number;       // Schema version (canonical)
  revision?: number;            // Incremented on each update
  compiledAt?: Date;            // When Functions normalized/compiled it
  createdAt: Date;
  updatedAt: Date;
}

// -----------------------------------------------------------------------------
// Workflow Preset Type
// -----------------------------------------------------------------------------
export interface WorkflowPreset {
  id: string;
  name: string;
  nameKey: string;              // Translation key for name
  description: string;
  descriptionKey: string;       // Translation key for description
  icon: string;                 // Icon name (lucide icon)
  category: WorkflowPresetCategory;

  // Template structure (without creatorId and dates)
  triggers: WorkflowTrigger[];
  startNodeId: string;
  nodes: Record<string, WorkflowNode>;
  edges: WorkflowEdge[];
}

// -----------------------------------------------------------------------------
// Workflow Execution Context
// -----------------------------------------------------------------------------
export interface WorkflowExecution {
  workflowId: string;
  currentNodeId: string;
  variables: Record<string, unknown>;  // Collected data, product info, etc.
  startedAt: Date;
  lastNodeExecutedAt: Date;
}

// -----------------------------------------------------------------------------
// API Types
// -----------------------------------------------------------------------------
export interface CreateWorkflowRequest {
  presetId?: string;            // Create from preset
  workflow?: Partial<Workflow>; // Custom workflow data
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  triggers?: WorkflowTrigger[];
  nodes?: Record<string, WorkflowNode>;
  edges?: WorkflowEdge[];
}
