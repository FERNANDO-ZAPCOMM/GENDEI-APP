'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play,
  MessageSquare,
  Gift,
  HelpCircle,
  GitBranch,
  Route,
  Clock,
  Tag,
  UserCheck,
  StopCircle,
} from 'lucide-react';
import type { Workflow, WorkflowNode, WorkflowNodeType } from '@/lib/types';

// Node type configuration
const NODE_CONFIG: Record<WorkflowNodeType, { icon: React.ReactNode; label: string; bgColor: string; borderColor: string }> = {
  start: { icon: <Play className="w-6 h-6" />, label: 'Start', bgColor: 'bg-green-50', borderColor: 'border-green-400' },
  message: { icon: <MessageSquare className="w-6 h-6" />, label: 'Message', bgColor: 'bg-blue-50', borderColor: 'border-blue-400' },
  offer_product: { icon: <Gift className="w-6 h-6" />, label: 'Offer Product', bgColor: 'bg-purple-50', borderColor: 'border-purple-400' },
  collect_info: { icon: <HelpCircle className="w-6 h-6" />, label: 'Collect Info', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-400' },
  condition: { icon: <GitBranch className="w-6 h-6" />, label: 'Condition', bgColor: 'bg-orange-50', borderColor: 'border-orange-400' },
  intent_router: { icon: <Route className="w-6 h-6" />, label: 'Intent Router', bgColor: 'bg-pink-50', borderColor: 'border-pink-400' },
  wait_response: { icon: <Clock className="w-6 h-6" />, label: 'Wait', bgColor: 'bg-gray-50', borderColor: 'border-gray-400' },
  assign_tag: { icon: <Tag className="w-6 h-6" />, label: 'Tag', bgColor: 'bg-teal-50', borderColor: 'border-teal-400' },
  handoff: { icon: <UserCheck className="w-6 h-6" />, label: 'Handoff', bgColor: 'bg-red-50', borderColor: 'border-red-400' },
  end: { icon: <StopCircle className="w-6 h-6" />, label: 'End', bgColor: 'bg-slate-50', borderColor: 'border-slate-400' },
};

// Custom node component - styled like the reference images
function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const config = NODE_CONFIG[data.nodeType as WorkflowNodeType] || NODE_CONFIG.message;
  const isStartOrEnd = data.nodeType === 'start' || data.nodeType === 'end';

  // Start/End nodes are circular
  if (isStartOrEnd) {
    return (
      <div
        className={`w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-lg transition-all ${
          data.nodeType === 'start' ? 'bg-white border-3 border-gray-300' : 'bg-gray-900'
        } ${selected ? 'ring-4 ring-blue-400 ring-offset-2' : ''}`}
      >
        {data.nodeType !== 'start' && (
          <Handle
            type="target"
            position={Position.Top}
            className="w-4 h-4 !bg-gray-400 !border-2 !border-white"
          />
        )}
        <div className={data.nodeType === 'start' ? 'text-gray-600' : 'text-white'}>
          {config.icon}
        </div>
        <span className={`text-sm font-medium mt-1 ${data.nodeType === 'start' ? 'text-gray-600' : 'text-white'}`}>
          {config.label}
        </span>
        {data.nodeType !== 'end' && (
          <Handle
            type="source"
            position={Position.Bottom}
            className="w-4 h-4 !bg-gray-600 !border-2 !border-white"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl bg-white shadow-lg border-2 min-w-[280px] max-w-[360px] transition-all overflow-hidden ${
        selected ? 'ring-4 ring-blue-400 ring-offset-2 border-blue-400' : 'border-gray-200'
      }`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-4 h-4 !bg-gray-400 !border-2 !border-white"
      />

      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-3 border-b ${config.bgColor}`}>
        <div className={`p-2 rounded-full bg-white/80`}>
          {config.icon}
        </div>
        <span className="text-base font-semibold text-gray-800">{config.label}</span>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {/* Message preview for message nodes */}
        {data.nodeType === 'message' && typeof data.message === 'string' && (
          <div className="bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-700 max-h-[100px] overflow-hidden">
            {data.message.substring(0, 120)}{data.message.length > 120 ? '...' : ''}
          </div>
        )}

        {/* Offer product preview */}
        {data.nodeType === 'offer_product' && (
          <div className="text-sm text-gray-600">
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
              {String(data.offerType || 'paid').toUpperCase()}
            </span>
          </div>
        )}

        {/* Collect info preview */}
        {data.nodeType === 'collect_info' && (
          <div className="text-sm text-gray-600">
            Collect: <span className="font-medium">{String(data.fieldName || 'info')}</span>
          </div>
        )}

        {/* Condition preview */}
        {data.nodeType === 'condition' && (
          <div className="text-sm text-gray-600">
            <span className="text-sm">Condition check</span>
          </div>
        )}

        {/* Intent router preview */}
        {data.nodeType === 'intent_router' && (
          <div className="text-sm text-gray-600">
            <span className="text-sm">Route by intent</span>
          </div>
        )}

        {/* Wait response preview */}
        {data.nodeType === 'wait_response' && (
          <div className="text-sm text-gray-600">
            <span className="text-sm">Wait for user response</span>
          </div>
        )}

        {/* Assign tag preview */}
        {data.nodeType === 'assign_tag' && Array.isArray(data.tags) && (
          <div className="flex flex-wrap gap-1">
            {(data.tags as string[]).slice(0, 3).map((tag, i) => (
              <span key={i} className="inline-block px-3 py-1 bg-teal-100 text-teal-700 rounded text-sm">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Handoff preview */}
        {data.nodeType === 'handoff' && (
          <div className="text-sm text-gray-600">
            <span className="text-sm">Transfer to agent</span>
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-4 h-4 !bg-gray-600 !border-2 !border-white"
      />

      {/* Additional handles for condition/router nodes */}
      {(data.nodeType === 'condition' || data.nodeType === 'intent_router') && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="yes"
            className="w-4 h-4 !bg-green-500 !border-2 !border-white"
            style={{ top: '50%' }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="no"
            className="w-4 h-4 !bg-red-500 !border-2 !border-white"
            style={{ top: '50%' }}
          />
        </>
      )}
    </div>
  );
}

const nodeTypes = {
  workflowNode: WorkflowNodeComponent,
};

interface WorkflowVisualEditorProps {
  workflow: Workflow;
  onNodeClick?: (nodeId: string) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function WorkflowVisualEditor({ workflow, onNodeClick, readOnly = true, compact = false }: WorkflowVisualEditorProps) {
  // Convert workflow nodes to React Flow nodes
  const initialNodes = useMemo(() => {
    const entries = Object.entries(workflow.nodes);
    const nodePositions: Record<string, { x: number; y: number }> = {};

    // Track node depths and horizontal positions
    const nodeDepths: Record<string, number> = {};
    const nodeHorizontalIndex: Record<string, number> = {};
    const visited = new Set<string>();

    // BFS for better level assignment
    const queue: { nodeId: string; depth: number; hIndex: number }[] = [];
    queue.push({ nodeId: workflow.startNodeId, depth: 0, hIndex: 0 });

    while (queue.length > 0) {
      const { nodeId, depth, hIndex } = queue.shift()!;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      nodeDepths[nodeId] = depth;
      nodeHorizontalIndex[nodeId] = hIndex;

      // Find children
      const outEdges = workflow.edges.filter((e) => e.source === nodeId);
      const childCount = outEdges.length;

      outEdges.forEach((edge, idx) => {
        // Spread children horizontally based on their index
        const childHIndex = childCount > 1 ? idx - (childCount - 1) / 2 : 0;
        queue.push({ nodeId: edge.target, depth: depth + 1, hIndex: childHIndex });
      });
    }

    // Add unvisited nodes at the end
    for (const [nodeId, node] of entries) {
      if (!(nodeId in nodeDepths)) {
        if (node.type === 'end') {
          const maxDepth = Math.max(...Object.values(nodeDepths), 0);
          nodeDepths[nodeId] = maxDepth + 1;
        } else {
          nodeDepths[nodeId] = Object.keys(nodeDepths).length;
        }
        nodeHorizontalIndex[nodeId] = 0;
      }
    }

    // Group nodes by depth level
    const levels: Record<number, string[]> = {};
    for (const [nodeId, depth] of Object.entries(nodeDepths)) {
      if (!levels[depth]) levels[depth] = [];
      levels[depth].push(nodeId);
    }

    // Sort nodes within each level by their horizontal index
    for (const level of Object.keys(levels)) {
      levels[parseInt(level)].sort((a, b) => nodeHorizontalIndex[a] - nodeHorizontalIndex[b]);
    }

    // Calculate positions - centered layout with better spacing
    const levelSpacing = 160;
    const nodeSpacing = 320;

    for (const [level, nodeIds] of Object.entries(levels)) {
      const levelNum = parseInt(level);
      const count = nodeIds.length;
      // Center nodes horizontally
      const totalWidth = (count - 1) * nodeSpacing;
      const startX = -totalWidth / 2;

      nodeIds.forEach((nodeId, index) => {
        nodePositions[nodeId] = {
          x: startX + index * nodeSpacing,
          y: levelNum * levelSpacing,
        };
      });
    }

    // Convert to React Flow nodes
    return entries.map(([id, node]) => {
      const position = node.position || nodePositions[id] || { x: 0, y: 0 };
      const data = node.data as Record<string, unknown>;

      // Generate preview text based on node type
      let preview = '';
      if (node.type === 'message' && typeof data.message === 'string') {
        preview = data.message.substring(0, 30) + (data.message.length > 30 ? '...' : '');
      } else if (node.type === 'offer_product') {
        preview = String(data.offerType || 'paid');
      } else if (node.type === 'collect_info') {
        preview = String(data.fieldName || 'info');
      }

      return {
        id,
        type: 'workflowNode',
        position,
        data: {
          nodeType: node.type,
          preview,
          ...data,
        },
      } as Node;
    });
  }, [workflow]);

  // Convert workflow edges to React Flow edges
  const initialEdges = useMemo(() => {
    return workflow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      label: edge.label,
      type: 'bezier',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
      },
      style: {
        strokeWidth: 2,
      },
    } as Edge));
  }, [workflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  return (
    <div
      className={`w-full h-full ${compact ? '' : 'min-h-[500px]'}`}
      style={{ background: 'radial-gradient(circle, #f8fafc 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={true}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'bezier',
          style: { strokeWidth: 3, stroke: '#64748b' },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={compact ? 16 : 24} size={1} />
        {!compact && (
          <Controls
            showInteractive={false}
            className="!bg-white !border !border-gray-200 !rounded-lg !shadow-md"
          />
        )}
      </ReactFlow>
    </div>
  );
}
