import { getFirestore } from 'firebase-admin/firestore';
import {
  Workflow,
  WorkflowTriggerType,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
} from '../types';
import { WORKFLOW_PRESETS, getWorkflowPreset } from '../data/workflow-presets';
import { compileWorkflowForSave, WORKFLOW_SCHEMA_VERSION, WorkflowValidationError } from './workflowCompiler';

const db = getFirestore();

// Collection name for workflows
const WORKFLOWS_COLLECTION = 'workflows';

/**
 * Get workflows collection reference for a creator
 * Schema: creators/{creatorId}/workflows
 */
function getWorkflowsCollection(creatorId: string) {
  return db.collection('creators').doc(creatorId).collection(WORKFLOWS_COLLECTION);
}

/**
 * Get all workflow presets
 */
export function getWorkflowPresets() {
  return WORKFLOW_PRESETS;
}

/**
 * Get all workflows for a creator
 */
export async function getWorkflows(creatorId: string): Promise<Workflow[]> {
  const workflowsCollection = getWorkflowsCollection(creatorId);
  const snapshot = await workflowsCollection.orderBy('updatedAt', 'desc').get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
    } as Workflow;
  });
}

/**
 * Get a single workflow
 */
export async function getWorkflow(
  creatorId: string,
  workflowId: string
): Promise<Workflow | null> {
  const workflowRef = getWorkflowsCollection(creatorId).doc(workflowId);
  const doc = await workflowRef.get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
  } as Workflow;
}

/**
 * Get the active workflow for a creator
 */
export async function getActiveWorkflow(creatorId: string): Promise<Workflow | null> {
  const workflowsCollection = getWorkflowsCollection(creatorId);
  const snapshot = await workflowsCollection
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    ...data,
    id: doc.id,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
  } as Workflow;
}

/**
 * Create a new workflow from a preset or custom data
 */
export async function createWorkflow(
  creatorId: string,
  request: CreateWorkflowRequest
): Promise<Workflow> {
  const workflowsCollection = getWorkflowsCollection(creatorId);
  const newWorkflowRef = workflowsCollection.doc();

  let workflowData: Partial<Workflow>;

  if (request.presetId) {
    // Create from preset
    const preset = getWorkflowPreset(request.presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${request.presetId}`);
    }

    workflowData = {
      name: preset.name,
      description: preset.description,
      triggers: preset.triggers,
      startNodeId: preset.startNodeId,
      nodes: preset.nodes,
      edges: preset.edges,
      presetId: preset.id,
      isActive: false,
      isDefault: false,
    };
  } else if (request.workflow) {
    // Create custom workflow
    workflowData = {
      name: request.workflow.name || 'Custom Workflow',
      description: request.workflow.description,
      triggers: request.workflow.triggers || [{ type: WorkflowTriggerType.ALWAYS }],
      startNodeId: request.workflow.startNodeId || 'start',
      nodes: request.workflow.nodes || {},
      edges: request.workflow.edges || [],
      isActive: false,
      isDefault: false,
    };
  } else {
    throw new Error('Either presetId or workflow data is required');
  }

  const workflow: Workflow = {
    id: newWorkflowRef.id,
    creatorId,
    name: workflowData.name!,
    description: workflowData.description,
    isActive: workflowData.isActive || false,
    isDefault: workflowData.isDefault || false,
    triggers: workflowData.triggers!,
    startNodeId: workflowData.startNodeId!,
    nodes: workflowData.nodes!,
    edges: workflowData.edges!,
    presetId: workflowData.presetId,
    version: WORKFLOW_SCHEMA_VERSION,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const compiled = compileWorkflowForSave(workflow, { preserveCreatedAt: workflow.createdAt, previousRevision: 0 });
  if (compiled.errors.length) {
    throw new WorkflowValidationError(compiled.errors);
  }
  if (compiled.warnings.length) {
    // Keep warnings visible in logs to catch invalid workflows early at scale
    console.warn(`[workflows] compile warnings (creator=${creatorId}, workflow=${workflow.id})`, compiled.warnings);
  }

  await newWorkflowRef.set(compiled.workflow);
  return compiled.workflow as Workflow;
}

/**
 * Update a workflow
 */
export async function updateWorkflow(
  creatorId: string,
  workflowId: string,
  updates: UpdateWorkflowRequest
): Promise<Workflow> {
  const existing = await getWorkflow(creatorId, workflowId);
  if (!existing) {
    throw new Error('Workflow not found');
  }

  const workflowRef = getWorkflowsCollection(creatorId).doc(workflowId);

  const next: Partial<Workflow> = {
    ...existing,
    ...updates,
    id: existing.id,
    creatorId: existing.creatorId,
    // preserve createdAt; updatedAt is always now
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  };

  const previousRevision = (existing as any).revision ?? 0;
  const compiled = compileWorkflowForSave(next, { preserveCreatedAt: existing.createdAt, previousRevision });
  if (compiled.errors.length) {
    throw new WorkflowValidationError(compiled.errors);
  }
  if (compiled.warnings.length) {
    console.warn(`[workflows] compile warnings (creator=${creatorId}, workflow=${workflowId})`, compiled.warnings);
  }

  await workflowRef.set(compiled.workflow, { merge: true });

  const updated = await workflowRef.get();
  const data = updated.data()!;
  return {
    ...data,
    id: updated.id,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
  } as Workflow;
}

/**
 * Activate a workflow (deactivates all others)
 */
export async function activateWorkflow(
  creatorId: string,
  workflowId: string
): Promise<void> {
  const workflowsCollection = getWorkflowsCollection(creatorId);

  // Use a batch to ensure atomicity
  const batch = db.batch();

  // First, deactivate all workflows
  const allWorkflows = await workflowsCollection.where('isActive', '==', true).get();
  allWorkflows.docs.forEach((doc) => {
    batch.update(doc.ref, { isActive: false, updatedAt: new Date() });
  });

  // Then, activate the specified workflow
  const workflowRef = workflowsCollection.doc(workflowId);
  batch.update(workflowRef, { isActive: true, isDefault: true, updatedAt: new Date() });

  await batch.commit();
}

/**
 * Deactivate a workflow
 */
export async function deactivateWorkflow(
  creatorId: string,
  workflowId: string
): Promise<void> {
  const workflowRef = getWorkflowsCollection(creatorId).doc(workflowId);
  await workflowRef.update({ isActive: false, updatedAt: new Date() });
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(
  creatorId: string,
  workflowId: string
): Promise<void> {
  const existing = await getWorkflow(creatorId, workflowId);
  if (!existing) {
    throw new Error('Workflow not found');
  }

  const workflowRef = getWorkflowsCollection(creatorId).doc(workflowId);
  await workflowRef.delete();
}

/**
 * Duplicate a workflow
 */
export async function duplicateWorkflow(
  creatorId: string,
  workflowId: string,
  newName?: string
): Promise<Workflow> {
  const existing = await getWorkflow(creatorId, workflowId);
  if (!existing) {
    throw new Error('Workflow not found');
  }

  const workflowsCollection = getWorkflowsCollection(creatorId);
  const newWorkflowRef = workflowsCollection.doc();

  const duplicated: Workflow = {
    ...existing,
    id: newWorkflowRef.id,
    name: newName || `${existing.name} (Copy)`,
    isActive: false,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await newWorkflowRef.set(duplicated);
  return duplicated;
}
