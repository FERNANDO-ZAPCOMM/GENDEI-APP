import {
  WorkflowPreset,
  WorkflowNodeType,
  WorkflowTriggerType,
  WorkflowPresetCategory,
} from '../types';

/**
 * Workflow Preset Templates
 *
 * Start with a small set of high-level presets that are safe at scale.
 * Most of the "intelligence" lives in the Agents (profile-aware) — presets are strategy selectors.
 */
export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  // =================================
  // PRESET 1: Default Router (Recommended)
  // =================================
  {
    id: 'intent_router',
    name: 'Intent-Based Routing',
    nameKey: 'workflows.presets.intentRouter.name',
    description:
      'Default router: routes every message to triage, which hands off to specialists (greeter, product_info, payment, support, etc.) using the creator profile.',
    descriptionKey: 'workflows.presets.intentRouter.description',
    icon: 'route',
    category: WorkflowPresetCategory.SALES,
    triggers: [{ type: WorkflowTriggerType.ALWAYS }],
    startNodeId: 'start',
    nodes: {
      start: { id: 'start', type: WorkflowNodeType.START, data: {} },
      route: {
        id: 'route',
        type: WorkflowNodeType.HANDOFF,
        data: {
          handoffType: 'triage',
          reason: 'Route to the best specialist agent using profile + products + conversation context',
        },
      },
      end: { id: 'end', type: WorkflowNodeType.END, data: {} },
    },
    edges: [{ id: 'e1', source: 'start', target: 'route' }],
  },

  // =================================
  // PRESET 2: Mentorship / Consulting Booking
  // =================================
  {
    id: 'mentorship_booking',
    name: 'Mentorship Booking',
    nameKey: 'workflows.presets.mentorshipFirst.name',
    description:
      'Routes mentorship/consulting requests to a booking intake agent that escalates to human for scheduling.',
    descriptionKey: 'workflows.presets.mentorshipFirst.description',
    icon: 'users',
    category: WorkflowPresetCategory.HIGH_TICKET,
    triggers: [
      {
        type: WorkflowTriggerType.KEYWORD,
        conditions: ['mentoria', 'consultoria', 'agenda', 'agendar', 'call', 'reunião', 'reuniao'],
      },
    ],
    startNodeId: 'start',
    nodes: {
      start: { id: 'start', type: WorkflowNodeType.START, data: {} },
      handoff: {
        id: 'handoff',
        type: WorkflowNodeType.HANDOFF,
        data: {
          handoffType: 'mentorship_booking',
          reason: 'Mentorship booking intake → collect objective/availability → human scheduling takeover',
        },
      },
      end: { id: 'end', type: WorkflowNodeType.END, data: {} },
    },
    edges: [{ id: 'e1', source: 'start', target: 'handoff' }],
  },
];

/**
 * Get a workflow preset by ID
 */
export function getWorkflowPreset(presetId: string): WorkflowPreset | undefined {
  return WORKFLOW_PRESETS.find((preset) => preset.id === presetId);
}

/**
 * Get all workflow presets grouped by category
 */
export function getWorkflowPresetsByCategory(): Record<WorkflowPresetCategory, WorkflowPreset[]> {
  return WORKFLOW_PRESETS.reduce((acc, preset) => {
    if (!acc[preset.category]) {
      acc[preset.category] = [];
    }
    acc[preset.category].push(preset);
    return acc;
  }, {} as Record<WorkflowPresetCategory, WorkflowPreset[]>);
}

