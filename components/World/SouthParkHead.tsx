import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { TextureLoader } from 'three';

interface SouthParkHeadProps {
  faceTexture: string;
  isSpeaking: boolean;
  splitRatio?: number;
}

export const SouthParkHead: React.FC<SouthParkHeadProps> = ({ faceTexture, isSpeaking, splitRatio = 0.5 }) => {
  const topRef = useRef<any>(null);
  const bottomRef = useRef<any>(null);
  
  const texture = useMemo(() => new TextureLoader().load(faceTexture), [faceTexture]);
  
  // Calculate Geometry and Texture coords based on splitRatio
  // splitRatio is the Y-position of the split (0 to 1), from bottom.
  // Example: 0.3 means split is 30% from chin.
  
  // Textures
  const topTex = useMemo(() => {
    const t = texture.clone();
    // V offset starts at splitRatio, Height is (1 - splitRatio)
    t.offset.set(0, splitRatio); 
    t.repeat.set(1, 1 - splitRatio);
    t.needsUpdate = true;
    return t;
  }, [texture, splitRatio]);

  const botTex = useMemo(() => {
    const t = texture.clone();
    // V offset starts at 0, Height is splitRatio
    t.offset.set(0, 0);
    t.repeat.set(1, splitRatio);
    t.needsUpdate = true;
    return t;
  }, [texture, splitRatio]);

  // Geometry Heights
  const topH = 1 - splitRatio;
  const botH = splitRatio;

  // Positions (Relative to group center 0)
  // Total height is 1. Center is 0.
  // Bottom starts at -0.5. Top ends at +0.5.
  // Split Y global = -0.5 + botH
  // Bottom Center Y = -0.5 + (botH / 2)
  // Top Center Y = (-0.5 + botH) + (topH / 2)
  
  const botY = -0.5 + (botH / 2);
  const topY = (-0.5 + botH) + (topH / 2);

  useFrame((state) => {
    if (isSpeaking && bottomRef.current) {
      // Oscillate bottom jaw
      // Move DOWN to open mouth.
      const offset = Math.sin(state.clock.elapsedTime * 25) * 0.12;
      const drop = Math.min(0, offset < 0 ? offset : 0); 
      
      bottomRef.current.position.y = botY + drop;
      
      // Slight bounce of whole head for energy
      if (topRef.current) {
          topRef.current.position.y = topY + (Math.abs(drop) * 0.1);
      }
    } else {
        if (bottomRef.current) bottomRef.current.position.y = botY;
        if (topRef.current) topRef.current.position.y = topY;
    }
  });

  return (
    <group position={[0, 1.2, 0.51]} scale={[0.8, 0.8, 0.8]}>
      {/* Top Half */}
      <mesh ref={topRef} position={[0, topY, 0]}>
        <planeGeometry args={[1, topH]} />
        <meshBasicMaterial map={topTex} transparent />
      </mesh>
      {/* Bottom Half */}
      <mesh ref={bottomRef} position={[0, botY, 0]}>
        <planeGeometry args={[1, botH]} />
        <meshBasicMaterial map={botTex} transparent />
      </mesh>
    </group>
  );
};