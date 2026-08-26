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
          mouseInfluence = Math.max(0.3, 1 - mouseDist / 30);
        }

        const opacity = (0.15 + 0.35 * conn.strength) * mouseInfluence;
        const lineWidth = 0.8 + 1.2 * conn.strength;
        const pulse = 0.8 + 0.2 * Math.sin(time * 0.5 + conn.from + conn.to);

        ctx.beginPath();
        ctx.moveTo(
          from.x / 100 * width,
          from.y / 100 * height
        );
        ctx.lineTo(
          to.x / 100 * width,
          to.y / 100 * height
        );
        ctx.strokeStyle = `rgba(99, 102, 241, ${opacity * pulse})`;
        ctx.lineWidth = lineWidth * pulse;
        ctx.stroke();
      });

      // Draw nodes
      nodePositions.forEach(node => {
        const x = node.x / 100 * width;
        const y = node.y / 100 * height;
        const radius = (node.radius / 100) * Math.min(width, height) / 1.2;
        
        // Mouse hover effect
        let scale = 1;
        let glowIntensity = 1;
        if (isHovering) {
          const dist = Math.sqrt(
            Math.pow(x - mousePos.x / 100 * width, 2) + 
            Math.pow(y - mousePos.y / 100 * height, 2)
          );
          const threshold = 80;
          if (dist < threshold) {
            scale = 1 + (1 - dist / threshold) * 0.3;
            glowIntensity = 1 + (1 - dist / threshold) * 0.5;
          }
        }

        // Pulse effect for center node
        const pulseSize = node.pulse ? 1 + 0.08 * Math.sin(time * 1.5) : 1;
        const finalRadius = radius * scale * pulseSize;

        // Glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, finalRadius * 2.5);
        const color = node.color || 'var(--indigo)';
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.2 * glowIntensity;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, finalRadius * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Main circle
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, finalRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Border/ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label (if node has one and is large enough)
        if (node.label && radius > 12) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.font = `${Math.min(12, radius * 1.2)}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.label, x, y + 1);
        }

        // Inner dot for small nodes
        if (radius <= 12) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.beginPath();
          ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw "InternFlow" floating text in the center
      const centerXPos = centerX / 100 * width;
      const centerYPos = centerY / 100 * height;
      
      // Glow behind text
      const textGlow = ctx.createRadialGradient(centerXPos, centerYPos, 0, centerXPos, centerYPos, 60);
      textGlow.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
      textGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = textGlow;
      ctx.beginPath();
      ctx.arc(centerXPos, centerYPos, 60, 0, Math.PI * 2);
      ctx.fill();
      
      // Main text
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = `bold ${Math.min(18, width / 20)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
      ctx.shadowBlur = 20;
      ctx.fillText('InternFlow', centerXPos, centerYPos);
      ctx.shadowBlur = 0;
      
      // Subtitle
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${Math.min(10, width / 30)}px system-ui, -apple-system, sans-serif`;
      ctx.fillText('AI Career Platform', centerXPos, centerYPos + Math.min(24, height / 25));

      // Draw subtle orbiting particles
      for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2 + time * 0.2;
        const dist = 38 + Math.sin(time * 0.3 + i) * 5;
        const x = (centerX + Math.cos(angle) * dist) / 100 * width;
        const y = (centerY + Math.sin(angle) * dist) / 100 * height;
        
        const size = 1.5 + Math.sin(time * 0.5 + i * 2) * 0.5;
        ctx.globalAlpha = 0.15 + 0.1 * Math.sin(time * 0.7 + i);
        ctx.fillStyle = 'var(--indigo)';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrame);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [mousePos, isHovering]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-[var(--radius-lg)]"
        style={{ 
          background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.05) 0%, transparent 70%)',
        }}
      />
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 60%, rgba(0,0,0,0.1) 100%)',
          borderRadius: 'var(--radius-lg)',
        }}
      />
    </div>
  );
}