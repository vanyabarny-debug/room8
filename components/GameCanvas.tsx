
import React, { useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader, OrbitControls } from '@react-three/drei';
import { useStore } from '../store';
import { PlayerState } from '../types';
import { WorldEnvironment } from './Environment';
import { LocalPlayer, RemotePlayer } from './Player';

export const GameCanvas = () => {
  const { activeRoomId, rooms, peers, isJoystickActive } = useStore();
  const controlsRef = useRef<any>(null);
  
  const room = activeRoomId ? rooms[activeRoomId] : null;

  const configureControls = useCallback((node: any) => {
    controlsRef.current = node;
    if (node) {
        node.enablePan = false;
        node.maxPolarAngle = Math.PI / 2 - 0.1; // Don't go below ground
        // Tightened camera constraints
        node.minDistance = 2;
        node.maxDistance = 14; 
    }
  }, []);

  if (!room) return null;

  return (
    <>
      <Canvas shadows camera={{ position: [0, 5, 8], fov: 50, far: 200 }}>
        {/* Environment */}
        <WorldEnvironment type={room.type} />
        
        {/* Controls - Disabled if joystick is active to allow LocalPlayer to control camera */}
        <OrbitControls 
            ref={configureControls}
            makeDefault 
            enabled={!isJoystickActive}
        />
        
        {/* Players */}
        <LocalPlayer />
        
        {Object.values(peers).map((peer: PlayerState) => (
          <RemotePlayer key={peer.id} id={peer.id} data={peer} />
        ))}
      </Canvas>
      <Loader />
    </>
  );
};
