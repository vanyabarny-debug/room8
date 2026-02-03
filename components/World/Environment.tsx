import React, { useEffect, useRef } from 'react';
import { Stars, Sparkles } from '@react-three/drei';
import { useStore } from '../../store';
import { WorldType } from '../../types';
import * as THREE from 'three';

const CinemaScreen = () => {
    const { screenShareStream } = useStore();
    const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
    const textureRef = useRef<THREE.VideoTexture | null>(null);

    useEffect(() => {
        if (screenShareStream) {
            videoRef.current.srcObject = screenShareStream.stream;
            videoRef.current.play().catch(e => console.error("Play video failed", e));
            textureRef.current = new THREE.VideoTexture(videoRef.current);
            textureRef.current.colorSpace = THREE.SRGBColorSpace;
        } else {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
        }
    }, [screenShareStream]);

    return (
        <group position={[0, 4, -12]}>
            {/* Screen Frame */}
            <mesh position={[0, 0, -0.1]}>
                <boxGeometry args={[16.2, 9.2, 0.5]} />
                <meshStandardMaterial color="#111" />
            </mesh>
            {/* Screen Content */}
            <mesh>
                <planeGeometry args={[16, 9]} />
                {screenShareStream ? (
                    <meshBasicMaterial map={textureRef.current} toneMapped={false} />
                ) : (
                    <meshBasicMaterial color="#000" />
                )}
            </mesh>
            {/* Glow */}
            {screenShareStream && (
                 <pointLight distance={20} intensity={2} color="#fff" position={[0, 0, 2]} />
            )}
        </group>
    );
}

export const Environment: React.FC = () => {
  const { settings } = useStore();

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={0.8} 
        castShadow 
        shadow-mapSize={[2048, 2048]} 
      />
      
      {/* Cyber Grid Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.8} />
      </mesh>
      
      {/* Neon Grid Helper */}
      <gridHelper args={[100, 50, settings.color, '#222']} position={[0, -0.48, 0]} />

      <CinemaScreen />

      {settings.world === WorldType.DAY && (
        <>
           <color attach="background" args={['#87CEEB']} />
           <fog attach="fog" args={['#87CEEB', 20, 60]} />
        </>
      )}

      {/* Night / Default Cyberpunk */}
      {(settings.world === WorldType.NIGHT || settings.world === WorldType.OFFICE) && (
        <>
          <color attach="background" args={['#050505']} />
          <Stars radius={80} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
          <Sparkles count={200} scale={20} size={2} speed={0.4} opacity={0.5} color={settings.color} />
          <fog attach="fog" args={['#050505', 10, 50]} />
          
          {/* Neon Pillars */}
          <mesh position={[-15, 0, -15]}>
              <cylinderGeometry args={[0.2, 0.2, 20]} />
              <meshBasicMaterial color="magenta" />
          </mesh>
           <mesh position={[15, 0, -15]}>
              <cylinderGeometry args={[0.2, 0.2, 20]} />
              <meshBasicMaterial color="cyan" />
          </mesh>
        </>
      )}
    </>
  );
};