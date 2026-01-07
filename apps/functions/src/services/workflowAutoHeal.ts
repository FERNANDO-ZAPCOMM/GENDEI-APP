import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Collections, Workflow } from '../types';
import { compileWorkflowForSave } from './workflowCompiler';

export type AutoHealOptions = {
  dryRun?: boolean;
  onlyActive?: boolean;
  creatorId?: string;
  maxCreators?: number;
  maxWorkflows?: number;
};

export type AutoHealResult = {
  scannedCreators: number;
  scannedWorkflows: number;
  updatedWorkflows: number;
  skippedWorkflows: number;
  invalidWorkflows: number;
  warningsCount: number;
  errors: Array<{ creatorId: string; workflowId: string; errors: string[] }>;
};

function toDate(value: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function needsCompile(raw: any): boolean {
  // Fast-path checks to avoid unnecessary writes at scale
  if (!raw) return false;
  if (!raw.schemaVersion) return true;
  if (!raw.revision) return true;
  if (!raw.compiledAt) return true;

  // preset upgrades (behavioral fixes) - force a recompile so we can patch legacy presets safely
  if (raw.presetId === 'free_lead_magnet') {
    const greet = raw.nodes?.greet_and_offer;
    const handoffType = greet?.data?.handoffType;
    if (handoffType === 'free_product') return true;
  }

  const triggers = Array.isArray(raw.triggers) ? raw.triggers : [];
  if (triggers.some((t: any) => t?.type === 'keyword' && Array.isArray(t?.keywords))) return true;

  const edges = Array.isArray(raw.edges) ? raw.edges : [];
  if (edges.some((e: any) => e?.condition)) return true; // legacy field

  const nodes = raw.nodes && typeof raw.nodes === 'object' ? raw.nodes : {};
  for (const node of Object.values(nodes) as any[]) {
    const data = node?.data;
    if (!data) continue;
    if (data.messageTemplate && !data.message) return true;
    if (data.fieldName && !data.storeIn) return true;
  }

  return false;
}

function applyPresetUpgrades(workflow: Partial<Workflow>): Partial<Workflow> {
  // Upgrade legacy preset behaviors that caused bad UX at scale.
  if (workflow.presetId === 'free_lead_magnet') {
    const nodes: any = workflow.nodes && typeof workflow.nodes === 'object' ? workflow.nodes : {};
    const greet = nodes.greet_and_offer;
    if (greet?.type === 'handoff' && greet?.data?.handoffType === 'free_product') {
      nodes.greet_and_offer = {
        ...greet,
        data: {
          ...(greet.data || {}),
          handoffType: 'greeter',
          reason:
            'First-contact greeting (profile-aware). Free gift delivery happens later when the user asks/accepts.',
        },
      };
      return { ...workflow, nodes };
    }
  }
  return workflow;
}

function normalizeForCompile(creatorId: string, workflowId: string, data: any): Partial<Workflow> {
  const createdAt = toDate(data.createdAt) || new Date();
  const updatedAt = toDate(data.updatedAt) || new Date();

  const normalized = {
    ...data,
    id: workflowId,
    creatorId,
    createdAt,
    updatedAt,
    // ensure booleans exist (avoids undefined creeping in)
    isActive: Boolean(data.isActive),
    isDefault: Boolean(data.isDefault),
  } as Partial<Workflow>;

  return applyPresetUpgrades(normalized);
}

export async function autoHealWorkflows(opts: AutoHealOptions = {}): Promise<AutoHealResult> {
  const db = getFirestore();

  const result: AutoHealResult = {
    scannedCreators: 0,
    scannedWorkflows: 0,
    updatedWorkflows: 0,
    skippedWorkflows: 0,
    invalidWorkflows: 0,
    warningsCount: 0,
    errors: [],
  };

  const dryRun = Boolean(opts.dryRun);
  const onlyActive = Boolean(opts.onlyActive);
  const maxCreators = opts.maxCreators ?? 10_000;
  const maxWorkflows = opts.maxWorkflows ?? 100_000;

  const creatorIds: string[] = [];
  if (opts.creatorId) {
    creatorIds.push(opts.creatorId);
  } else {
    // creators is the canonical root collection
    const creatorsSnap = await db.collection(Collections.CREATORS).limit(maxCreators).get();
    creatorsSnap.forEach((doc) => creatorIds.push(doc.id));
  }

  result.scannedCreators = creatorIds.length;

  let batch = db.batch();
  let batchOps = 0;

  async function commitBatchIfNeeded(force = false): Promise<void> {
    if (dryRun) return;
    if (batchOps === 0) return;
    if (!force && batchOps < 450) return; // keep buffer below 500
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  }

  for (const creatorId of creatorIds) {
    if (result.scannedWorkflows >= maxWorkflows) break;

    const workflowsRef = db
      .collection(Collections.CREATORS)
      .doc(creatorId)
      .collection('workflows');

    const query = onlyActive ? workflowsRef.where('isActive', '==', true) : workflowsRef;
    const snap = await query.get();

    for (const doc of snap.docs) {
      if (result.scannedWorkflows >= maxWorkflows) break;

      result.scannedWorkflows += 1;
      const workflowId = doc.id;
      const data = doc.data();

      if (!needsCompile(data)) {
        result.skippedWorkflows += 1;
        continue;
      }

      const normalized = normalizeForCompile(creatorId, workflowId, data);
      const previousRevision = (data as any).revision ?? 0;
      const compiled = compileWorkflowForSave(normalized, {
        preserveCreatedAt: normalized.createdAt as any,
        previousRevision,
      });

      if (compiled.warnings.length) {
        result.warningsCount += compiled.warnings.length;
        console.warn(`[workflow-auto-heal] warnings creator=${creatorId} workflow=${workflowId}`, compiled.warnings);
      }

      if (compiled.errors.length) {
        result.invalidWorkflows += 1;
        result.errors.push({ creatorId, workflowId, errors: compiled.errors });
        console.warn(`[workflow-auto-heal] invalid creator=${creatorId} workflow=${workflowId}`, compiled.errors);
        continue;
      }

      result.updatedWorkflows += 1;
      if (!dryRun) {
        batch.set(doc.ref, compiled.workflow, { merge: true });
        batchOps += 1;
        await commitBatchIfNeeded(false);
      }
    }
  }

  await commitBatchIfNeeded(true);
  return result;
}
