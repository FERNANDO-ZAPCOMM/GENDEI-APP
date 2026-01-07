import {
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType,
  WorkflowTrigger,
  WorkflowTriggerType,
} from '../types';

export const WORKFLOW_SCHEMA_VERSION = 1;

export class WorkflowValidationError extends Error {
  statusCode = 400;
  details: string[];

  constructor(details: string[]) {
    super('Invalid workflow');
    this.details = details;
  }
}

type CompileResult<T> = { workflow: T; warnings: string[]; errors: string[] };

function asRecord(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, any>;
}

function ensureArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function ensureString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function ensureBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isWorkflowNodeType(value: unknown): value is WorkflowNodeType {
  return typeof value === 'string' && (Object.values(WorkflowNodeType) as string[]).includes(value);
}

function isWorkflowTriggerType(value: unknown): value is WorkflowTriggerType {
  return typeof value === 'string' && (Object.values(WorkflowTriggerType) as string[]).includes(value);
}

function normalizeTrigger(trigger: any, warnings: string[]): WorkflowTrigger {
  const typeRaw = trigger?.type;
  const type = isWorkflowTriggerType(typeRaw) ? typeRaw : WorkflowTriggerType.ALWAYS;
  if (typeRaw && !isWorkflowTriggerType(typeRaw)) warnings.push(`trigger.type inválido: ${String(typeRaw)}`);

  if (type === WorkflowTriggerType.KEYWORD) {
    const conditions = ensureArray(trigger?.conditions?.length ? trigger.conditions : trigger?.keywords).map((v) =>
      String(v)
    );
    return { type, conditions };
  }

  if (type === WorkflowTriggerType.PRODUCT_MENTION) {
    const productIds = ensureArray(trigger?.productIds).map((v) => String(v));
    return { type, productIds };
  }

  return { type };
}

function normalizeEdge(edge: any, warnings: string[]): WorkflowEdge {
  const id = ensureString(edge?.id);
  const source = ensureString(edge?.source);
  const target = ensureString(edge?.target);
  const sourceHandle = ensureString(edge?.sourceHandle || edge?.condition || '', '') || undefined;
  const label = ensureString(edge?.label || '', '') || undefined;
  const normalized: WorkflowEdge = {
    id: id || `${source}->${target}${sourceHandle ? `:${sourceHandle}` : ''}`,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(label ? { label } : {}),
  };

  if (!source) warnings.push(`edge sem source: ${normalized.id}`);
  if (!target) warnings.push(`edge sem target: ${normalized.id}`);
  return normalized;
}

function normalizeNode(nodeId: string, node: any, warnings: string[]): WorkflowNode {
  const typeRaw = node?.type;
  const type = isWorkflowNodeType(typeRaw) ? typeRaw : WorkflowNodeType.MESSAGE;
  if (typeRaw && !isWorkflowNodeType(typeRaw)) warnings.push(`node.type inválido em ${nodeId}: ${String(typeRaw)}`);

  const data = asRecord(node?.data) || {};
  const normalizedData: WorkflowNodeData = normalizeNodeData(type, data, warnings, nodeId);

  return {
    id: ensureString(node?.id, nodeId) || nodeId,
    type,
    ...(node?.position ? { position: node.position } : {}),
    data: normalizedData,
  };
}

function normalizeNodeData(
  type: WorkflowNodeType,
  data: Record<string, any>,
  warnings: string[],
  nodeId: string
): WorkflowNodeData {
  if (type === WorkflowNodeType.MESSAGE) {
    const message = ensureString(data.message || data.messageTemplate, '');
    if (!message) warnings.push(`message node sem mensagem: ${nodeId}`);
    return { message, ...(data.delay != null ? { delay: Number(data.delay) } : {}), ...(data.mediaUrl ? { mediaUrl: String(data.mediaUrl) } : {}) };
  }

  if (type === WorkflowNodeType.OFFER_PRODUCT) {
    const productSelection = ensureString(data.productSelection, 'specific');
    const offerType = ensureString(data.offerType, 'paid');
    const messageTemplate = ensureString(data.messageTemplate || data.message, '');
    if (!messageTemplate) warnings.push(`offer_product sem messageTemplate: ${nodeId}`);
    return {
      productSelection: productSelection as any,
      ...(Array.isArray(data.productIds) ? { productIds: data.productIds.map((v: any) => String(v)) } : {}),
      ...(data.priceRange ? { priceRange: data.priceRange } : {}),
      ...(data.productType ? { productType: String(data.productType) } : {}),
      offerType: offerType as any,
      messageTemplate,
    } as any;
  }

  if (type === WorkflowNodeType.COLLECT_INFO) {
    const prompt = ensureString(data.prompt, '');
    const storeIn = ensureString(data.storeIn || data.fieldName, '');
    if (!prompt) warnings.push(`collect_info sem prompt: ${nodeId}`);
    if (!storeIn) warnings.push(`collect_info sem storeIn: ${nodeId}`);
    return {
      field: (data.field || data.fieldName || 'custom') as any,
      ...(data.customFieldName ? { customFieldName: String(data.customFieldName) } : {}),
      prompt,
      ...(data.validation ? { validation: data.validation } : {}),
      storeIn,
    } as any;
  }

  if (type === WorkflowNodeType.CONDITION) {
    const conditionType = ensureString(data.conditionType, 'llm');
    const outcomes = Array.isArray(data.outcomes) && data.outcomes.length ? data.outcomes.map((v: any) => String(v)) : ['true', 'false'];
    return {
      conditionType: conditionType as any,
      ...(data.llmPrompt ? { llmPrompt: String(data.llmPrompt) } : {}),
      ...(data.expression ? { expression: String(data.expression) } : {}),
      outcomes,
    } as any;
  }

  if (type === WorkflowNodeType.INTENT_ROUTER) {
    const intents = ensureArray(data.intents).map((i) => ({
      name: String(i?.name || i?.id || ''),
      description: String(i?.description || ''),
      ...(i?.keywords ? { keywords: ensureArray(i.keywords).map((v) => String(v)) } : {}),
    }));
    const defaultOutcome = ensureString(data.defaultOutcome, 'unknown');
    return { intents, defaultOutcome } as any;
  }

  if (type === WorkflowNodeType.WAIT_RESPONSE) {
    const variableName = ensureString(data.variableName || data.storeIn, '');
    if (!variableName) warnings.push(`wait_response sem variableName: ${nodeId}`);
    return {
      ...(data.timeout != null ? { timeout: Number(data.timeout) } : {}),
      ...(data.timeoutNodeId ? { timeoutNodeId: String(data.timeoutNodeId) } : {}),
      variableName,
    } as any;
  }

  if (type === WorkflowNodeType.ASSIGN_TAG) {
    const tags = ensureArray(data.tags).map((v) => String(v));
    const action = ensureString(data.action, 'add');
    return { tags, action: action as any } as any;
  }

  if (type === WorkflowNodeType.HANDOFF) {
    return {
      ...(data.reason ? { reason: String(data.reason) } : {}),
      notifyTeam: ensureBoolean(data.notifyTeam, false),
      ...(data.assignTo ? { assignTo: String(data.assignTo) } : {}),
    } as any;
  }

  if (type === WorkflowNodeType.END) {
    return { ...(data.message ? { message: String(data.message) } : {}) } as any;
  }

  return data as any;
}

function validateGraph(
  workflow: Pick<Workflow, 'startNodeId' | 'nodes' | 'edges'>,
  warnings: string[],
  errors: string[]
): void {
  const nodeIds = new Set(Object.keys(workflow.nodes || {}));
  if (!workflow.startNodeId || !nodeIds.has(workflow.startNodeId)) {
    errors.push(`startNodeId inválido: ${String(workflow.startNodeId)}`);
  }
  for (const e of workflow.edges || []) {
    if (e.source && !nodeIds.has(e.source)) errors.push(`edge.source inexistente: ${e.source}`);
    if (e.target && !nodeIds.has(e.target)) errors.push(`edge.target inexistente: ${e.target}`);
  }

  // Validate condition/intent edges against outcomes
  for (const [id, node] of Object.entries(workflow.nodes || {})) {
    if (node.type === WorkflowNodeType.CONDITION) {
      const outcomes = ensureArray((node.data as any)?.outcomes).map((v) => String(v));
      const outgoing = workflow.edges.filter((e) => e.source === id && e.sourceHandle);
      for (const e of outgoing) {
        if (e.sourceHandle && !outcomes.includes(e.sourceHandle)) {
          errors.push(`edge.sourceHandle '${e.sourceHandle}' não existe em outcomes do condition node ${id}`);
        }
      }
    }
    if (node.type === WorkflowNodeType.INTENT_ROUTER) {
      const intents = ensureArray((node.data as any)?.intents).map((i) => String(i?.name || i?.id || ''));
      const defaultOutcome = ensureString((node.data as any)?.defaultOutcome, '');
      const allowed = new Set([...intents, ...(defaultOutcome ? [defaultOutcome] : [])].filter(Boolean));
      const outgoing = workflow.edges.filter((e) => e.source === id && e.sourceHandle);
      for (const e of outgoing) {
        if (e.sourceHandle && !allowed.has(e.sourceHandle)) {
          errors.push(`edge.sourceHandle '${e.sourceHandle}' não existe no intent_router ${id}`);
        }
      }
    }
  }
}

export function compileWorkflowForSave(
  raw: Partial<Workflow>,
  opts?: { preserveCreatedAt?: Date; previousRevision?: number }
): CompileResult<Partial<Workflow>> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const triggers = ensureArray(raw.triggers).map((t) => normalizeTrigger(t, warnings));
  const nodesRaw = asRecord(raw.nodes) || {};
  const nodes: Record<string, WorkflowNode> = {};
  for (const [nodeId, node] of Object.entries(nodesRaw)) {
    nodes[nodeId] = normalizeNode(nodeId, node, warnings);
  }
  const edges = ensureArray(raw.edges).map((e) => normalizeEdge(e, warnings));

  const startNodeId = ensureString(raw.startNodeId, '');
  validateGraph({ startNodeId, nodes, edges }, warnings, errors);

  // Required fields that must be present for safe execution at scale
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.type === WorkflowNodeType.MESSAGE) {
      const message = ensureString((node.data as any)?.message, '');
      if (!message) errors.push(`message node sem mensagem: ${nodeId}`);
    }
    if (node.type === WorkflowNodeType.OFFER_PRODUCT) {
      const messageTemplate = ensureString((node.data as any)?.messageTemplate, '');
      if (!messageTemplate) errors.push(`offer_product sem messageTemplate: ${nodeId}`);
    }
    if (node.type === WorkflowNodeType.COLLECT_INFO) {
      const prompt = ensureString((node.data as any)?.prompt, '');
      const storeIn = ensureString((node.data as any)?.storeIn, '');
      if (!prompt) errors.push(`collect_info sem prompt: ${nodeId}`);
      if (!storeIn) errors.push(`collect_info sem storeIn: ${nodeId}`);
    }
    if (node.type === WorkflowNodeType.WAIT_RESPONSE) {
      const variableName = ensureString((node.data as any)?.variableName, '');
      if (!variableName) errors.push(`wait_response sem variableName: ${nodeId}`);
    }
  }

  const previousRevision = opts?.previousRevision ?? 0;
  const compiled: Partial<Workflow> = {
    ...raw,
    triggers: triggers.length ? triggers : [{ type: WorkflowTriggerType.ALWAYS }],
    nodes,
    edges,
    startNodeId,
    schemaVersion: WORKFLOW_SCHEMA_VERSION as any,
    version: WORKFLOW_SCHEMA_VERSION as any,
    revision: previousRevision + 1,
    compiledAt: new Date() as any,
    ...(opts?.preserveCreatedAt ? { createdAt: opts.preserveCreatedAt as any } : {}),
  } as any;

  return { workflow: compiled, warnings, errors };
}
