// Module: app/components/HeroGraph.tsx
// Defines component(s)/export(s): HeroGraph
//
//

'use client';

import { useEffect, useRef, useState } from 'react';

interface Node {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  label?: string;
  pulse?: boolean;
}

interface Connection {
  from: number;
  to: number;
  strength: number;
}

export default function HeroGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // Center-focused nodes with hub-and-spoke design
  const nodes: Node[] = [
    // Center hub - removed label from node since we'll draw it separately
    { id: 0, x: 50, y: 50, radius: 30, color: 'var(--indigo)', pulse: true },
    
    // Inner ring - core features
    { id: 1, x: 50, y: 20, radius: 14, color: 'var(--green)', label: 'Code' },
    { id: 2, x: 75, y: 35, radius: 14, color: 'var(--blue)', label: 'Review' },
    { id: 3, x: 80, y: 60, radius: 14, color: 'var(--purple)', label: 'Resume' },
    { id: 4, x: 65, y: 78, radius: 14, color: 'var(--orange)', label: 'Jobs' },
    { id: 5, x: 35, y: 78, radius: 14, color: 'var(--pink)', label: 'Connect' },
    { id: 6, x: 20, y: 60, radius: 14, color: 'var(--teal)', label: 'Learn' },
    { id: 7, x: 25, y: 35, radius: 14, color: 'var(--rust)', label: 'Build' },
    
    // Outer ring - secondary features
    { id: 8, x: 50, y: 5, radius: 9, color: 'var(--indigo-soft)' },
    { id: 9, x: 85, y: 20, radius: 9, color: 'var(--green-soft)' },
    { id: 10, x: 92, y: 50, radius: 9, color: 'var(--blue-soft)' },
    { id: 11, x: 78, y: 85, radius: 9, color: 'var(--purple-soft)' },
    { id: 12, x: 22, y: 85, radius: 9, color: 'var(--orange-soft)' },
    { id: 13, x: 8, y: 50, radius: 9, color: 'var(--pink-soft)' },
    { id: 14, x: 15, y: 20, radius: 9, color: 'var(--teal-soft)' },
  ];

  // Connections from center to inner ring, and inner to outer
  const connections: Connection[] = [
    // Center to inner ring
    { from: 0, to: 1, strength: 0.8 },
    { from: 0, to: 2, strength: 0.9 },
    { from: 0, to: 3, strength: 0.8 },
    { from: 0, to: 4, strength: 0.7 },
    { from: 0, to: 5, strength: 0.7 },
    { from: 0, to: 6, strength: 0.8 },
    { from: 0, to: 7, strength: 0.7 },
    
    // Inner ring to outer ring
    { from: 1, to: 8, strength: 0.5 },
    { from: 1, to: 9, strength: 0.4 },
    { from: 2, to: 9, strength: 0.5 },
    { from: 2, to: 10, strength: 0.4 },
    { from: 3, to: 10, strength: 0.5 },
    { from: 3, to: 11, strength: 0.4 },
    { from: 4, to: 11, strength: 0.5 },
    { from: 4, to: 12, strength: 0.4 },
    { from: 5, to: 12, strength: 0.5 },
    { from: 5, to: 13, strength: 0.4 },
    { from: 6, to: 13, strength: 0.5 },
    { from: 6, to: 14, strength: 0.4 },
    { from: 7, to: 14, strength: 0.5 },
    { from: 7, to: 8, strength: 0.4 },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    const width = (rect?.width || 420) * dpr;
    const height = (rect?.height || 420) * dpr;
    
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${rect?.width || 420}px`;
    canvas.style.height = `${rect?.height || 420}px`;

    setDimensions({ width: rect?.width || 420, height: rect?.height || 420 });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Animation variables
    let animationFrame: number;
    let time = 0;

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x, y });
      setIsHovering(true);
    };

    const handleMouseLeave = () => {
      setIsHovering(false);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const draw = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);

      // Calculate positions with slight animation
      const getNodePosition = (node: Node, baseX: number, baseY: number) => {
        const radius = 42; // Base radius for positioning
        const angleOffset = time * 0.1;
        
        // For center node
        if (node.id === 0) {
          return { x: baseX, y: baseY };
        }

        // Determine ring based on node id
        const isInner = node.id >= 1 && node.id <= 7;
        const ringRadius = isInner ? radius : radius * 1.8;
        const index = isInner ? node.id - 1 : node.id - 8;
        const totalInRing = isInner ? 7 : 7;
        const angle = (index / totalInRing) * Math.PI * 2 - Math.PI / 2 + angleOffset * (isInner ? 0.5 : 0.3);
        
        // Add slight random offset for organic feel
        const offset = Math.sin(time * 0.5 + node.id) * 2;
        
        return {
          x: baseX + Math.cos(angle) * (ringRadius + offset),
          y: baseY + Math.sin(angle) * (ringRadius + offset)
        };
      };

      // Center of the canvas (in percentage)
      const centerX = 50;
      const centerY = 50;

      // Calculate node positions
      const nodePositions = nodes.map(node => {
        const pos = getNodePosition(node, centerX, centerY);
        return { ...node, ...pos };
      });

      // Draw connections first (behind nodes)
      connections.forEach(conn => {
        const from = nodePositions.find(n => n.id === conn.from);
        const to = nodePositions.find(n => n.id === conn.to);
        if (!from || !to) return;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate mouse influence
        let mouseInfluence = 1;
        if (isHovering) {
          const mouseDist = Math.sqrt(
            Math.pow((from.x + to.x) / 2 - mousePos.x, 2) + 
            Math.pow((from.y + to.y) / 2 - mousePos.y, 2)
          );
          mouseInfluence =