'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Workflow, WorkflowNodeType } from '@/lib/types';

// Simplified node colors for mini preview
const NODE_COLORS: Record<WorkflowNodeType, string> = {
  start: '#22c55e',
  message: '#3b82f6',
  offer_product: '#a855f7',
  collect_info: '#eab308',
  condition: '#f97316',
  intent_router: '#ec4899',
  wait_response: '#6b7280',
  assign_tag: '#14b8a6',
  handoff: '#ef4444',
  end: '#64748b',
};

interface WorkflowMiniPreviewProps {
  workflow: Workflow;
  width?: number;
  height?: number;
}

export function WorkflowMiniPreview({ workflow, width = 200, height = 100 }: WorkflowMiniPreviewProps) {
  // Convert workflow nodes to React Flow nodes (simplified for mini preview)
  const { nodes, edges } = useMemo(() => {
    const entries = Object.entries(workflow.nodes);

    // Simple layout algorithm
    const visited = new Set<string>();
    const queue: { id: string; level: number }[] = [];
    const levels: Record<number, string[]> = {};

    queue.push({ id: workflow.startNodeId, level: 0 });

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      if (!levels[level]) levels[level] = [];
      levels[level].push(id);

      const outEdges = workflow.edges.filter((e) => e.source === id);
      for (const edge of outEdges) {
        if (!visited.has(edge.target)) {
          queue.push({ id: edge.target, level: level + 1 });
        }
      }
    }

    // Add unvisited nodes
    for (const [nodeId] of entries) {
      if (!visited.has(nodeId)) {
        const maxLevel = Math.max(...Object.keys(levels).map(Number), 0);
        if (!levels[maxLevel + 1]) levels[maxLevel + 1] = [];
        levels[maxLevel + 1].push(nodeId);
      }
    }

    // Calculate positions for compact preview
    const levelSpacing = 40;
    const nodeSpacing = 50;
    const nodePositions: Record<string, { x: number; y: number }> = {};

    for (const [level, nodeIds] of Object.entries(levels)) {
      const levelNum = parseInt(level);
      const count = nodeIds.length;
      const startX = -(count - 1) * nodeSpacing / 2 + 100;

      nodeIds.forEach((nodeId, index) => {
        nodePositions[nodeId] = {
          x: startX + index * nodeSpacing,
          y: levelNum * levelSpacing + 20,
        };
      });
    }

    // Create simplified nodes (just small colored circles)
    const flowNodes: Node[] = entries.map(([id, node]) => {
      const position = node.position || nodePositions[id] || { x: 100, y: 50 };
      const color = NODE_COLORS[node.type as WorkflowNodeType] || '#94a3b8';

      return {
        id,
        position,
        data: { label: '' },
        style: {
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: color,
          border: 'none',
          padding: 0,
        },
      };
    });

    // Create simplified edges
    const flowEdges: Edge[] = workflow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      type: 'smoothstep',
      style: {
        strokeWidth: 1.5,
        stroke: '#94a3b8',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 8,
        height: 8,
        color: '#94a3b8',
      },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [workflow]);

  return (
    <div
      style={{ width, height }}
      className="rounded-md overflow-hidden bg-slate-50 border"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={8} size={1} />
      </ReactFlow>
    </div>
  );
}
