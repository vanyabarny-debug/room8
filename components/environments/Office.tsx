
import React from 'react';
import * as THREE from 'three';

export const OfficeScene = () => (
    <group>
        <ambientLight intensity={0.8} />
        <pointLight position={[0, 10, 0]} intensity={0.5} />
        <mesh position={[0, 10, 0]} scale={[-1, 1, 1]}>
            <boxGeometry args={[40, 20, 40]} />
            <meshStandardMaterial color="#1e3a8a" side={THREE.BackSide} />
        </mesh>
        <gridHelper args={[40, 40, 0xaaaaaa, 0x444444]} />
    </group>
);
