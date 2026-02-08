
import React, { useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useStore } from '../store';
import { PlayerState } from '../types';
import { WorldEnvironment } from './Environment';
import { LocalPlayer, RemotePlayer } from './Player';

export const GameCanvas = () => {
  const { activeRoomId, rooms, peers } = useStore();
  const controlsRef = useRef<any>(null);
  
  const room = activeRoomId ? rooms[activeRoomId] : null;
  const isCallMode = room?.type === 'call';

  const configureControls = useCallback((node: any) => {
    controlsRef.current = node;
    if (node) {
        node.enablePan = false;
        node.maxPolarAngle = Math.PI / 2 - 0.1; 
        node.minDistance = 2;
        node.maxDistance = 14; 
    }
  }, []);

  if (!room) return null;

  return (
    <>
      <Canvas 
        shadows 
        camera={{ position: [0, 5, 8], fov: 50, far: 1000 }}
        gl={{ 
          toneMapping: THREE.ACESFilmicToneMapping, // Cinema-quality lighting
          toneMappingExposure: 1.0,
          antialias: false, // Post-processing handles AA better usually, or we save perf
          stencil: false,
          depth: true
        }}
        dpr={[1, 1.5]} // Limit pixel ratio for performance with Bloom
      >
        {/* Global Environment / Reflections */}
        <WorldEnvironment type={room.type} />
        
        {/* Only render 3D avatars if NOT in Call mode */}
        {!isCallMode && (
            <>
                <OrbitControls ref={configureControls} makeDefault enabled={false} />
                <LocalPlayer />
                {Object.values(peers).map((peer: PlayerState) => (
                  <RemotePlayer key={peer.id} id={peer.id} data={peer} />
                ))}
            </>
        )}
        
        {/* 
            POST PROCESSING STACK 
            This is what creates the "Expensive" look.
            Bloom makes the red lights and windows glow.
        */}
        <EffectComposer disableNormalPass>
            {room.type === 'roofs' && (
                <Bloom 
                    luminanceThreshold={1.2} // Only very bright things (emissive > 1) glow
                    mipmapBlur 
                    intensity={1.5} // Strong glow
                    radius={0.6}
                />
            )}
            {/* Standard Bloom for Lobby (Magical Tree) and Night */}
            {(room.type === 'night' || room.type === 'lobby') && (
                <Bloom 
                    luminanceThreshold={1} // Glows if brightness > 1 (Emissive materials)
                    mipmapBlur 
                    intensity={0.8} 
                    radius={0.4}
                />
            )}
            <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>

      </Canvas>
      <Loader />
    </>
  );
};
