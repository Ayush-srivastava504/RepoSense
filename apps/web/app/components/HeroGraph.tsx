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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('Canvas ref not found');
      return;
    }

    try {
      const rect = canvas.parentElement?.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      const width = (rect?.width || 420) * dpr;
      const height = (rect?.height || 420) * dpr;
      
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${rect?.width || 420}px`;
      canvas.style.height = `${rect?.height || 420}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.warn('Canvas context not available');
        return;
      }

      // Center-focused nodes with hub-and-spoke design
      const nodes: Node[] = [
        { id: 0, x: 50, y: 50, radius: 30, color: '#6366F1', pulse: true },
        { id: 1, x: 50, y: 20, radius: 14, color: '#34D399', label: 'Code' },
        { id: 2, x: 75, y: 35, radius: 14, color: '#60A5FA', label: 'Review' },
        { id: 3, x: 80, y: 60, radius: 14, color: '#A78BFA', label: 'Resume' },
        { id: 4, x: 65, y: 78, radius: 14, color: '#FB923C', label: 'Jobs' },
        { id: 5, x: 35, y: 78, radius: 14, color: '#F472B6', label: 'Connect' },
        { id: 6, x: 20, y: 60, radius: 14, color: '#2DD4BF', label: 'Learn' },
        { id: 7, x: 25, y: 35, radius: 14, color: '#F87171', label: 'Build' },
        { id: 8, x: 50, y: 5, radius: 9, color: '#818CF8' },
        { id: 9, x: 85, y: 20, radius: 9, color: '#6EE7B7' },
        { id: 10, x: 92, y: 50, radius: 9, color: '#93C5FD' },
        { id: 11, x: 78, y: 85, radius: 9, color: '#C4B5FD' },
        { id: 12, x: 22, y: 85, radius: 9, color: '#FDBA74' },
        { id: 13, x: 8, y: 50, radius: 9, color: '#F9A8D4' },
        { id: 14, x: 15, y: 20, radius: 9, color: '#5EEAD4' },
      ];

      const connections: Connection[] = [
        { from: 0, to: 1, strength: 0.8 },
        { from: 0, to: 2, strength: 0.9 },
        { from: 0, to: 3, strength: 0.8 },
        { from: 0, to: 4, strength: 0.7 },
        { from: 0, to: 5, strength: 0.7 },
        { from: 0, to: 6, strength: 0.8 },
        { from: 0, to: 7, strength: 0.7 },
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

      let animationFrame: number;
      let time = 0;
      let mousePos = { x: 50, y: 50 };
      let isHovering = false;

      const handleMouseMove = (e: MouseEvent) => {
        try {
          const rect = canvas.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          mousePos = { x, y };
          isHovering = true;
        } catch (err) {
          // Silently handle mouse events
        }
      };

      const handleMouseLeave = () => {
        isHovering = false;
      };

      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseLeave);

      const draw = () => {
        try {
          time += 0.01;
          ctx.clearRect(0, 0, width, height);

          const getNodePosition = (node: Node, baseX: number, baseY: number) => {
            const radius = 42;
            const angleOffset = time * 0.1;
            
            if (node.id === 0) {
              return { x: baseX, y: baseY };
            }

            const isInner = node.id >= 1 && node.id <= 7;
            const ringRadius = isInner ? radius : radius * 1.8;
            const index = isInner ? node.id - 1 : node.id - 8;
            const totalInRing = 7;
            const angle = (index / totalInRing) * Math.PI * 2 - Math.PI / 2 + angleOffset * (isInner ? 0.5 : 0.3);
            const offset = Math.sin(time * 0.5 + node.id) * 2;
            
            return {
              x: baseX + Math.cos(angle) * (ringRadius + offset),
              y: baseY + Math.sin(angle) * (ringRadius + offset)
            };
          };

          const centerX = 50;
          const centerY = 50;

          const nodePositions = nodes.map(node => {
            const pos = getNodePosition(node, centerX, centerY);
            return { ...node, ...pos };
          });

          // Draw connections
          connections.forEach(conn => {
            const from = nodePositions.find(n => n.id === conn.from);
            const to = nodePositions.find(n => n.id === conn.to);
            if (!from || !to) return;

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
            ctx.moveTo(from.x / 100 * width, from.y / 100 * height);
            ctx.lineTo(to.x / 100 * width, to.y / 100 * height);
            ctx.strokeStyle = `rgba(99, 102, 241, ${opacity * pulse})`;
            ctx.lineWidth = lineWidth * pulse;
            ctx.stroke();
          });

          // Draw nodes
          nodePositions.forEach(node => {
            const x = node.x / 100 * width;
            const y = node.y / 100 * height;
            const radius = (node.radius / 100) * Math.min(width, height) / 1.2;
            
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

            const pulseSize = node.pulse ? 1 + 0.08 * Math.sin(time * 1.5) : 1;
            const finalRadius = radius * scale * pulseSize;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, finalRadius * 2.5);
            const color = node.color || '#6366F1';
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'transparent');
            ctx.globalAlpha = 0.2 * glowIntensity;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, finalRadius * 2.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(x, y, finalRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (node.label && radius > 12) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
              ctx.font = `${Math.min(12, radius * 1.2)}px system-ui, -apple-system, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(node.label, x, y + 1);
            }

            if (radius <= 12) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
              ctx.beginPath();
              ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Draw "InternFlow" text
          const centerXPos = centerX / 100 * width;
          const centerYPos = centerY / 100 * height;
          
          const textGlow = ctx.createRadialGradient(centerXPos, centerYPos, 0, centerXPos, centerYPos, 60);
          textGlow.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
          textGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
          ctx.fillStyle = textGlow;
          ctx.beginPath();
          ctx.arc(centerXPos, centerYPos, 60, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.font = `bold ${Math.min(18, width / 20)}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
          ctx.shadowBlur = 20;
          ctx.fillText('InternFlow', centerXPos, centerYPos);
          ctx.shadowBlur = 0;
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.font = `${Math.min(10, width / 30)}px system-ui, -apple-system, sans-serif`;
          ctx.fillText('AI Career Platform', centerXPos, centerYPos + Math.min(24, height / 25));

          // Orbiting particles
          for (let i = 0; i < 15; i++) {
            const angle = (i / 15) * Math.PI * 2 + time * 0.2;
            const dist = 38 + Math.sin(time * 0.3 + i) * 5;
            const x = (centerX + Math.cos(angle) * dist) / 100 * width;
            const y = (centerY + Math.sin(angle) * dist) / 100 * height;
            
            const size = 1.5 + Math.sin(time * 0.5 + i * 2) * 0.5;
            ctx.globalAlpha = 0.15 + 0.1 * Math.sin(time * 0.7 + i);
            ctx.fillStyle = '#6366F1';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.globalAlpha = 1;
          animationFrame = requestAnimationFrame(draw);
        } catch (err) {
          console.warn('Animation frame error:', err);
        }
      };

      draw();

      return () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
      };
    } catch (err) {
      console.error('HeroGraph initialization error:', err);
    }
  }, [isMounted]);

  // Fallback rendering when not mounted
  if (!isMounted) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="w-full h-full rounded-[var(--radius-lg)] bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
      </div>
    );
  }

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