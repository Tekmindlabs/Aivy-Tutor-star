// components/KnowledgeGraphVisualization.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphRelationship } from '../services/knowledge-graph';

interface Props {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export const KnowledgeGraphVisualization: React.FC<Props> = ({ nodes, relationships }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 600;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(relationships)
        .id((d: any) => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Create links
    const links = svg.append('g')
      .selectAll('line')
      .data(relationships)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-width', 1);

    // Create nodes
    const nodes_g = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g');

    nodes_g.append('circle')
      .attr('r', 5)
      .attr('fill', (d) => getNodeColor(d.type));

    nodes_g.append('text')
      .text((d) => d.label)
      .attr('x', 8)
      .attr('y', 3);

    // Add zoom capabilities
    const zoom = d3.zoom()
      .on('zoom', (event) => {
        svg.selectAll('g').attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Update force simulation
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes_g
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

  }, [nodes, relationships]);

  const getNodeColor = (type: string) => {
    const colors: {[key: string]: string} = {
      'person': '#69b3a2',
      'concept': '#404080',
      'document': '#ff7f0e'
    };
    return colors[type] || '#999';
  };

  return (
    <div className="knowledge-graph-container">
      <svg ref={svgRef}></svg>
    </div>
  );
};