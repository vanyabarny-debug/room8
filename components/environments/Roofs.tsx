
import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';

export const RoofsScene = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = new THREE.Object3D();
    const count = 1000;
    
    const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.2 }), []);
    
    // Init blocks
    React.useEffect(() => {
        if(!meshRef.current) return;
        let idx = 0;
        for(let x=-15; x<15; x++) {
            for(let z=-15; z<15; z++) {
                if (Math.random() > 0.6) {
                    const h = Math.random() * 40 + 10;
                    dummy.position.set(x * 20, h/2 - 20, z * 20);
                    dummy.scale.set(15, h, 15);
                    dummy.updateMatrix();
                    meshRef.current.setMatrixAt(idx++, dummy.matrix);
                }
            }
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, []);

    return (
        <group>
            <Environment preset="city" blur={0.8} />
            <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
                <boxGeometry />
                <primitive object={mat} />
            </instancedMesh>
            <mesh position={[0, -20, 0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1000,1000]}/><meshStandardMaterial color="#111" /></mesh>
        </group>
    );
};
