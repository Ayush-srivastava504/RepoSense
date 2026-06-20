'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The hero signature element: a small git history rendered as an
 * actual 3D graph. A main branch runs straight through; a second
 * branch (the "AI review" branch, in indigo) splits off and merges
 * back in — which is exactly what this product does to a real repo.
 */

type Vec3 = [number, number, number];

function buildGraph() {
  const main: Vec3[] = [
    [-3.2, 0, 0],
    [-2.1, 0, 0],
    [-1.0, 0, 0],
    [1.0, 0, 0],
    [2.1, 0, 0],
    [3.2, 0, 0],
  ];

  const feature: Vec3[] = [
    [-1.0, 0, 0],
    [-0.3, 0.95, 0.4],
    [0.4, 1.25, 0.6],
    [1.0, 0, 0],
  ];

  const edges: [Vec3, Vec3][] = [];
  for (let i = 0; i < main.length - 1; i++) edges.push([main[i], main[i + 1]]);
  for (let i = 0; i < feature.length - 1; i++) edges.push([feature[i], feature[i + 1]]);

  const mainNodes = main;
  const featureNodes = feature.slice(1, -1); // exclude shared split/merge points

  return { edges, mainNodes, featureNodes, splitMerge: [main[2], main[3]] as Vec3[] };
}

function Node({ position, color, size = 0.085 }: { position: Vec3; color: string; size?: number }) {
  return (
    <mesh position={position}>
      <icosahedronGeometry args={[size, 1]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
    </mesh>
  );
}

function Graph() {
  const group = useRef<THREE.Group>(null);
  const { edges, mainNodes, featureNodes, splitMerge } = useMemo(buildGraph, []);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useFrame((_, delta) => {
    if (!group.current || reducedMotion) return;
    group.current.rotation.y += delta * 0.14;
    group.current.rotation.x = 0.18 + Math.sin(Date.now() * 0.0002) * 0.04;
  });

  return (
    <group ref={group}>
      {edges.map(([a, b], i) => (
        <Line
          key={i}
          points={[a, b]}
          color={i < mainNodes.length - 1 ? '#cfc8b2' : '#3a3ad6'}
          lineWidth={1.4}
          transparent
          opacity={i < mainNodes.length - 1 ? 0.9 : 0.85}
        />
      ))}

      {mainNodes.map((p, i) => (
        <Node key={`m-${i}`} position={p} color="#2e6f4f" />
      ))}

      {featureNodes.map((p, i) => (
        <Node key={`f-${i}`} position={p} color="#3a3ad6" size={0.07} />
      ))}

      {splitMerge.map((p, i) => (
        <Node key={`s-${i}`} position={p} color="#15171c" size={0.1} />
      ))}
    </group>
  );
}

export default function CommitGraph3D() {
  return (
    <div className="h-full w-full" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.6, 6.2], fov: 38 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={0.6} />
        <Graph />
      </Canvas>
    </div>
  );
}