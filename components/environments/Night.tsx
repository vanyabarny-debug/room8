
import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

const InfiniteFloor = ({ color }: { color?: string }) => {
    const { camera } = useThree();
    const mesh = useRef<THREE.Mesh>(null!);
    useFrame(() => {
        if(mesh.current) {
            mesh.current.position.x = camera.position.x;
            mesh.current.position.z = camera.position.z;
        }
    });
    return <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow><planeGeometry args={[2000, 2000]} /><meshStandardMaterial color={color || '#4ade80'} /></mesh>;
};

const SkyBox = ({color}: {color: string}) => {
    const {scene} = useThree();
    React.useEffect(() => { scene.background = new THREE.Color(color); scene.fog = new THREE.Fog(color, 30, 200); }, [color]);
    return null;
}

export const NightScene = () => (
    <group>
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 20, 0]} intensity={0.5} color="#b0c4de" />
        <Stars radius={200} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
        <InfiniteFloor color="#202020" />
        <SkyBox color="#0f172a" />
    </group>
);
