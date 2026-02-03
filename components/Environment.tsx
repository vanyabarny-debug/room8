
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Stars, Cloud, Environment as DreiEnv, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { EnvironmentType } from '../types';

interface Props {
  type: EnvironmentType;
}

const Snow = () => {
  const count = 2000;
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = new THREE.Object3D();
  const particles = useRef<{ pos: THREE.Vector3; speed: number }[]>([]);

  if (particles.current.length === 0) {
    for (let i = 0; i < count; i++) {
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 200,
        Math.random() * 40,
        (Math.random() - 0.5) * 200
      );
      particles.current.push({ pos, speed: 0.05 + Math.random() * 0.1 });
    }
  }

  useFrame(() => {
    particles.current.forEach((p, i) => {
      p.pos.y -= p.speed;
      if (p.pos.y < 0) p.pos.y = 40;
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(0.05);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="white" />
    </instancedMesh>
  );
};

const CheckeredFloor = () => {
  const texture = new THREE.TextureLoader().load('https://picsum.photos/seed/checker/512/512?grayscale');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(500, 500); 

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial map={texture} color="#222" roughness={0.5} metalness={0.5} />
    </mesh>
  );
};

export const WorldEnvironment: React.FC<Props> = ({ type }) => {
  switch (type) {
    case 'day':
      return (
        <group>
          <ambientLight intensity={0.9} />
          {/* Brighter Sun */}
          <directionalLight position={[50, 80, 25]} intensity={2.0} castShadow shadow-mapSize={[1024, 1024]}>
             <orthographicCamera attach="shadow-camera" args={[-50, 50, 50, -50]} />
          </directionalLight>
          
          {/* Deep Blue Sky - Increased Rayleigh for deeper blue, low turbidity for clarity */}
          <Sky sunPosition={[100, 80, 100]} turbidity={0.1} rayleigh={0.5} mieCoefficient={0.005} mieDirectionalG={0.8} />
          
          <DreiEnv preset="park" />

          {/* Fireflies/Pollen for atmosphere */}
          <Sparkles count={100} scale={40} size={2} speed={0.4} opacity={0.5} color="#ffff00" />

          {/* Infinite Green Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[2000, 2000]} />
            {/* Brighter Green */}
            <meshStandardMaterial color="#22c55e" roughness={0.8} metalness={0.1} />
          </mesh>
          
          {/* Fog for infinity illusion - Matches Sky Blue roughly */}
          <fog attach="fog" args={['#60a5fa', 20, 120]} />
        </group>
      );

    case 'night':
      return (
        <group>
          <ambientLight intensity={0.2} />
          <pointLight position={[0, 20, 0]} intensity={0.8} color="#b0c4de" />
          <Stars radius={200} depth={50} count={8000} factor={4} saturation={0} fade speed={0.5} />
          <Snow />
          <CheckeredFloor />
          
          {/* Giant Moon */}
          <mesh position={[0, 80, -200]}>
            <sphereGeometry args={[40, 64, 64]} />
            <meshStandardMaterial color="#ffffee" emissive="#ffffee" emissiveIntensity={0.1} />
          </mesh>
          
          <fog attach="fog" args={['#000000', 30, 150]} />
        </group>
      );

    case 'office':
    default:
      return (
        <group>
          {/* Finite Room */}
          <ambientLight intensity={0.8} />
          <pointLight position={[0, 10, 0]} intensity={0.5} />
          <DreiEnv preset="city" />
          <mesh position={[0, 10, 0]} scale={[-1, 1, 1]}>
            <boxGeometry args={[40, 20, 40]} />
            <meshStandardMaterial color="#1e3a8a" side={THREE.BackSide} />
          </mesh>
          <gridHelper args={[40, 40, 0xaaaaaa, 0x444444]} />
        </group>
      );
  }
};
