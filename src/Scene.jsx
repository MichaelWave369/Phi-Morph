import React from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";

function Assembly({ result, pressure }) {
  const { nodes, edges, base } = result;
  return (
    <group>
      {edges.map((edge) => (
        <Line
          key={edge.a + "-" + edge.b}
          points={[
            [nodes[edge.a].x, nodes[edge.a].y, 0],
            [nodes[edge.b].x, nodes[edge.b].y, 0],
          ]}
          color="#4685a6"
          lineWidth={1.6}
          transparent
          opacity={0.62}
        />
      ))}
      {base.map((point) => (
        <mesh key={"reference-" + point.id} position={[point.x, point.y, -0.16]}>
          <sphereGeometry args={[0.085, 10, 8]} />
          <meshBasicMaterial color="#41566c" />
        </mesh>
      ))}
      {nodes.map((node, i) => (
        <group key={node.id} position={[node.x, node.y, 0]}>
          <mesh>
            <sphereGeometry args={[0.29 + pressure * 0.018, 24, 16]} />
            <meshPhysicalMaterial
              color={i % 4 === 0 ? "#4cf3e0" : "#38a9e8"}
              roughness={0.23}
              metalness={0.08}
              transparent
              opacity={0.8}
              clearcoat={0.7}
              clearcoatRoughness={0.15}
            />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <sphereGeometry args={[0.074, 12, 10]} />
            <meshBasicMaterial color="#cffafe" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function Scene({ result, pressure }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 12], zoom: 63, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.7]}
      aria-label="Three-dimensional visualization of a simulated 24-cell network"
    >
      <ambientLight intensity={1.4} />
      <pointLight position={[4, 5, 7]} intensity={55} />
      <pointLight position={[-5, -3, 5]} intensity={18} color="#15b8cd" />
      <Assembly result={result} pressure={pressure} />
      <OrbitControls enablePan={false} minZoom={38} maxZoom={95} />
    </Canvas>
  );
}
