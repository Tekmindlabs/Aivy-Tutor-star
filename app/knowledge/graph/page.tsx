// /app/knowledge/graph/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { KnowledgeGraphVisualization } from '@/components/KnowledgeGraphVisualization';
import { GraphNode, GraphRelationship } from '@/lib/services/knowledge-graph';

export default function KnowledgeGraphPage() {
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    relationships: GraphRelationship[];
  }>({ nodes: [], relationships: [] });

  useEffect(() => {
    fetchGraphData();
  }, []);

  const fetchGraphData = async () => {
    try {
      const response = await fetch('/api/knowledge/graph');
      const data = await response.json();
      setGraphData(data);
    } catch (error) {
      console.error('Error fetching graph data:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Knowledge Graph</h1>
      <KnowledgeGraphVisualization 
        nodes={graphData.nodes}
        relationships={graphData.relationships}
      />
    </div>
  );
}