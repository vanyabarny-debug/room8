import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, PositionalAudio, Billboard, Float } from '@react-three/drei';
import { Vector3, Mesh, PositionalAudio as ThreePositionalAudio } from 'three';
import { PlayerState } from '../../types';
import { SouthParkHead } from './SouthParkHead';
import { NORMAL_VOICE_DISTANCE, NORMAL_VOICE_REF, MEGAPHONE_DISTANCE, MEGAPHONE_REF } from '../../constants';
import { useStore } from '../../store';

interface RemoteAvatarProps {
  peer: PlayerState;
}

interface ReactionInstance {
  id: number;
  emoji: string;
  startTime: number;
}

// Particle is now an Emoji, not a shape
const EmojiParticle: React.FC<{ emoji: string; velocity: Vector3 }> = ({ emoji, velocity }) => {
    const groupRef = useRef<any>(null);

    useFrame((state, delta) => {
        if(groupRef.current) {
            // Move based on velocity
            groupRef.current.position.add(velocity.clone().multiplyScalar(delta));
            // Shrink over time
            groupRef.current.scale.multiplyScalar(0.96);
        }
    });

    return (
        <group ref={groupRef}>
            <Billboard>
                <Text 
                    fontSize={0.5} 
                    outlineWidth={0.02} 
                    outlineColor="black"
                    anchorX="center" 
                    anchorY="middle"
                >
                    {emoji}
                </Text>
            </Billboard>
        </group>
    );
};

// Explosion Effect
const ReactionExplosion: React.FC<{ reaction: ReactionInstance }> = ({ reaction }) => {
    const group = useRef<any>(null);
    
    // Create random velocities for the burst
    const particles = useMemo(() => {
        return new Array(12).fill(0).map(() => ({
            velocity: new Vector3(
                (Math.random() - 0.5) * 6, // Spread X
                (Math.random() * 5) + 2,   // Upward Y burst
                (Math.random() - 0.5) * 6  // Spread Z
            )
        }));
    }, []);

    useFrame(() => {
        if (group.current) {
            const age = (Date.now() - reaction.startTime) / 2000;
            // Float up logic for the main group
            group.current.position.y = 1.0 + (age * 1);
            
            // Fade out logic
            if (age > 0.8) {
                const opacity = 1 - ((age - 0.8) * 5); 
                group.current.scale.setScalar(opacity); 
            }
        }
    });

    return (
        <group ref={group} position={[0, 0, 0]}>
            {/* Main Big Emoji */}
            <Billboard>
                <Float speed={10} rotationIntensity={0.5} floatIntensity={0.5}>
                    <Text 
                        fontSize={2} 
                        outlineWidth={0.05} 
                        outlineColor="black"
                        anchorY="middle"
                    >
                        {reaction.emoji}
                    </Text>
                </Float>
            </Billboard>
            
            {/* Explosion of Mini Emojis */}
            {particles.map((p, i) => (
                <EmojiParticle key={i} emoji={reaction.emoji} velocity={p.velocity} />
            ))}
        </group>
    );
};

export const RemoteAvatar: React.FC<RemoteAvatarProps> = ({ peer }) => {
  const meshRef = useRef<Mesh>(null);
  const audioRef = useRef<ThreePositionalAudio>(null);
  const targetPos = useRef(new Vector3(...peer.position));
  
  const [reactions, setReactions] = useState<ReactionInstance[]>([]);
  const prevReaction = useRef<string | undefined>(undefined);

  const stream = useStore((state) => state.peerStreams[peer.id]);

  useEffect(() => {
    targetPos.current.set(...peer.position);
  }, [peer.position]);

  // Handle Incoming Reaction
  useEffect(() => {
    if (peer.reaction && peer.reaction !== prevReaction.current) {
        const id = Math.random();
        setReactions(prev => [...prev, { id, emoji: peer.reaction!, startTime: Date.now() }]);
        
        // Remove after 2s
        setTimeout(() => {
             setReactions(prev => prev.filter(p => p.id !== id));
        }, 2000);
    }
    prevReaction.current = peer.reaction;
  }, [peer.reaction]);

  // Handle Audio
  useEffect(() => {
    if(stream && audioRef.current) {
       try {
        audioRef.current.setMediaStreamSource(stream);
        audioRef.current.setRefDistance(peer.isLoudspeaker ? MEGAPHONE_REF : NORMAL_VOICE_REF);
        audioRef.current.setMaxDistance(peer.isLoudspeaker ? MEGAPHONE_DISTANCE : NORMAL_VOICE_DISTANCE);
       } catch(e) {
           console.warn("Audio Context issue", e);
       }
    }
  }, [stream, peer.isLoudspeaker]);

  // Movement Loop
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.lerp(targetPos.current, delta * 12);
      const currentRot = meshRef.current.rotation.y;
      const targetRot = peer.rotation[1];
      meshRef.current.rotation.y += (targetRot - currentRot) * delta * 5;
    }
  });

  return (
    <group position={peer.position}>
        {/* Nickname */}
        <Billboard position={[0, 2.2, 0]}>
            <Text 
                fontSize={0.25} 
                color={peer.isLoudspeaker ? "#ff00ff" : "white"}
                anchorX="center" 
                anchorY="middle"
                outlineWidth={0.04}
                outlineColor="#000"
                font="https://fonts.gstatic.com/s/orbitron/v25/yMJRMI8u0W+u85b9-jTrwQ.ttf"
            >
                {peer.nickname}
            </Text>
        </Billboard>

        {/* Reactions (Emoji Explosion) */}
        {reactions.map(r => (
            <ReactionExplosion key={r.id} reaction={r} />
        ))}

        {/* Face */}
        {peer.faceTexture && (
            <SouthParkHead 
                faceTexture={peer.faceTexture} 
                isSpeaking={peer.isSpeaking} 
                splitRatio={peer.faceSplitRatio}
            />
        )}

        {/* Body */}
        <mesh ref={meshRef} castShadow receiveShadow>
            {peer.shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
            {peer.shape === 'sphere' && <sphereGeometry args={[0.6, 32, 32]} />}
            {peer.shape === 'cone' && <coneGeometry args={[0.6, 1.2, 32]} />}
            {peer.shape === 'cylinder' && <cylinderGeometry args={[0.6, 0.6, 1, 32]} />}
            <meshStandardMaterial color={peer.color} metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Audio Source */}
        {stream && (
            <PositionalAudio 
                ref={audioRef as any}
                url="" 
                distance={NORMAL_VOICE_DISTANCE}
                loop={false}
                autoplay
            />
        )}
    </group>
  );
};