
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store';
import { audioSynth } from '../../services/AudioSynthesizer';

// --- SHADERS ---

// 1. World-Space Grass Shader
const GrassShaderMaterial = shaderMaterial(
  {
    colorA: new THREE.Color('#4ade80'), // Light Green
    colorB: new THREE.Color('#166534'), // Dark Green
    scale: 0.2, 
  },
  // Vertex Shader
  `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  // Fragment Shader
  `
    uniform vec3 colorA;
    uniform vec3 colorB;
    uniform float scale;
    varying vec3 vWorldPosition;
    
    // Simplex-like pseudo-random noise
    float rand(vec2 n) { 
      return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }

    float noise(vec2 p){
      vec2 ip = floor(p);
      vec2 u = fract(p);
      u = u*u*(3.0-2.0*u);
      
      float res = mix(
        mix(rand(ip), rand(ip+vec2(1.0,0.0)), u.x),
        mix(rand(ip+vec2(0.0,1.0)), rand(ip+vec2(1.0,1.0)), u.x), u.y);
      return res;
    }

    void main() {
      // Use World X/Z for noise -> Texture stays fixed even if mesh moves
      vec2 pos = vWorldPosition.xz;
      
      float n1 = noise(pos * scale);
      float n2 = noise(pos * scale * 2.0); 
      
      float finalNoise = mix(n1, n2, 0.4);
      
      vec3 color = mix(colorB, colorA, finalNoise);
      
      // Macro variation to break tiling
      float macro = noise(pos * 0.05);
      color = mix(color, color * 0.9, macro * 0.2);

      gl_FragColor = vec4(color, 1.0);
    }
  `
);

// 2. Fixed Screen-Space Gradient Shader
// Renders a full-screen quad behind everything, creating a static background
const ScreenGradientMaterial = shaderMaterial(
  {
    colorTop: new THREE.Color('#24a4ff'),
    colorBottom: new THREE.Color('#ffffff')
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      // Ignore camera transforms, render as full-screen quad in clip space (-1 to 1)
      // Z=0.999 ensures it renders behind mostly everything but is visible
      gl_Position = vec4(position.xy, 0.999, 1.0); 
    }
  `,
  // Fragment Shader
  `
    uniform vec3 colorTop;
    uniform vec3 colorBottom;
    varying vec2 vUv;
    void main() {
      // Vertical gradient from bottom (0) to top (1)
      gl_FragColor = vec4(mix(colorBottom, colorTop, vUv.y), 1.0);
    }
  `
);

extend({ GrassShaderMaterial, ScreenGradientMaterial });

// --- COMPONENTS ---

const InfiniteFloor = () => {
    const { camera } = useThree();
    const mesh = useRef<THREE.Mesh>(null!);
    
    const material = useMemo(() => new (THREE.ShaderMaterial as any)({
        // @ts-ignore
        ...new GrassShaderMaterial(),
        uniforms: {
            colorA: { value: new THREE.Color('#86efac') }, 
            colorB: { value: new THREE.Color('#22c55e') }, 
            scale: { value: 10.0 } 
        }
    }), []);

    useFrame(() => {
        if(mesh.current) {
            mesh.current.position.x = camera.position.x;
            mesh.current.position.z = camera.position.z;
        }
    });

    return (
        <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
            <planeGeometry args={[2000, 2000]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
};

const FixedGradientSky = () => {
    const { scene } = useThree();
    useEffect(() => {
        // Clear default background to let our mesh act as background
        const oldBg = scene.background;
        scene.background = null;
        
        // Match fog to bottom color (White) for seamless horizon blending
        scene.fog = new THREE.Fog('#ffffff', 60, 200);

        return () => {
            scene.background = oldBg;
            scene.fog = null;
        };
    }, [scene]);

    return (
        <mesh frustumCulled={false} renderOrder={-1000}>
            {/* Plane covers clip space -1 to 1 */}
            <planeGeometry args={[2, 2]} />
            {/* @ts-ignore */}
            <screenGradientMaterial depthWrite={false} depthTest={false} />
        </mesh>
    );
};

// --- AUTONOMOUS RABBIT ---

const Rabbit: React.FC<{ initialPos: THREE.Vector3 }> = ({ initialPos }) => {
    const group = useRef<THREE.Group>(null!);
    const { camera } = useThree();
    
    // Mutable state for physics/logic (prevents re-renders)
    const state = useRef({
        pos: initialPos.clone(),
        vel: new THREE.Vector3(),
        rot: Math.random() * Math.PI * 2,
        isFlying: false,
        nextHopTime: Math.random() * 2,
        isHopping: false,
        hopProgress: 0,
        isRecovering: false // Brief cooldown after hit
    });

    useEffect(() => {
        const onInteract = (e: any) => {
            if (!group.current) return;
            
            const playerPos = e.detail.position as THREE.Vector3; 
            const playerRot = e.detail.rotation as number;

            // Distance Check
            const myPos = state.current.pos;
            const dist = myPos.distanceTo(playerPos);

            // Kick Range: 3 units
            if (dist < 3.0) {
                // Calculate Kick Direction
                // Inverted to (0,0,1) based on request (was -1)
                // This ensures it flies "forward" relative to where player is looking
                const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerRot);
                
                // Add some upward force
                state.current.vel.copy(forwardDir).multiplyScalar(0.6 + Math.random() * 0.2); 
                state.current.vel.y = 0.6 + Math.random() * 0.3; 
                
                state.current.isFlying = true;
                state.current.isHopping = false;
                state.current.isRecovering = true;
                
                audioSynth.playCreatureHit(); // SOUND EFFECT
            }
        };

        window.addEventListener('player-interact', onInteract);
        return () => window.removeEventListener('player-interact', onInteract);
    }, []);

    useFrame((_, delta) => {
        if (!group.current) return;
        const s = state.current;
        const GRAVITY = 0.04;

        // --- 0. Player Collision (Hard & Soft) ---
        // Use Real-Time Game Refs instead of potentially stale store state
        const playerPos = useStore.getState().gameRefs.localPlayerPosition;
        if (playerPos) {
            const px = playerPos.x;
            const pz = playerPos.z;
            
            const dx = s.pos.x - px;
            const dz = s.pos.z - pz;
            const distSq = dx*dx + dz*dz;
            
            // Min Dist: Player Radius (approx 0.5) + Rabbit Radius (approx 0.3) + padding
            const minDist = 1.2; // Slightly increased for solid feel

            if (distSq < minDist * minDist) {
                 const dist = Math.sqrt(distSq);
                 // Normalize push vector (if dist is 0, default to x=1)
                 const nx = dist > 0.01 ? dx / dist : 1;
                 const nz = dist > 0.01 ? dz / dist : 0;

                 // 1. Hard Position Correction (Snap out)
                 // This makes the rabbit instantly move out of the player's body
                 const penetration = minDist - dist;
                 s.pos.x += nx * penetration;
                 s.pos.z += nz * penetration;

                 // 2. Soft Velocity Bump (Bounce)
                 if (!s.isRecovering) {
                     // Add simple impulse away from player
                     s.vel.x += nx * 0.08;
                     s.vel.z += nz * 0.08;
                     
                     // Small hop if grounded
                     if (!s.isFlying) {
                         s.vel.y = 0.2;
                         s.isFlying = true;
                     }
                 }
            }
        }

        // --- 1. PHYSICS LOOP ---
        if (s.isFlying) {
            // Apply Velocity
            s.pos.add(s.vel);
            s.vel.y -= GRAVITY;
            
            // Drag
            s.vel.x *= 0.98;
            s.vel.z *= 0.98;

            // Simple "Air Spin" when kicked
            if (s.vel.lengthSq() > 0.1) {
                group.current.rotation.x += delta * 15; 
            }

            // Ground Collision
            if (s.pos.y <= 0) {
                s.pos.y = 0;
                s.vel.set(0, 0, 0);
                s.isFlying = false;
                s.isRecovering = false; // Reset collision immunity
                
                // Reset rotation to normal upright
                group.current.rotation.x = 0;
                group.current.rotation.z = 0;
                group.current.rotation.y = s.rot; 
            }
        } 
        // --- 2. IDLE BEHAVIOR (Hopping) ---
        else {
            if (s.isHopping) {
                // Perform Hop
                s.hopProgress += delta * 3; // Hop speed
                if (s.hopProgress >= Math.PI) {
                    s.isHopping = false;
                    s.hopProgress = 0;
                    s.pos.y = 0;
                    s.nextHopTime = 1 + Math.random() * 3; // Wait 1-4s before next hop
                } else {
                    // Parabolic Arc
                    s.pos.y = Math.sin(s.hopProgress) * 0.5; // Jump height 0.5
                    // Move forward while hopping
                    const speed = 0.05;
                    s.pos.x += Math.sin(s.rot) * speed;
                    s.pos.z += Math.cos(s.rot) * speed;
                }
            } else {
                // Waiting to hop
                s.nextHopTime -= delta;
                if (s.nextHopTime <= 0) {
                    s.isHopping = true;
                    // Occasionally change direction
                    if (Math.random() > 0.5) {
                        s.rot += (Math.random() - 0.5) * 2; // +/- 1 radian turn
                    }
                    // Update visual rotation
                    group.current.rotation.y = s.rot;
                }
            }
        }

        // --- 3. INFINITE WORLD RESPAWN ---
        const centerPos = camera.position;
        const dx = s.pos.x - centerPos.x;
        const dz = s.pos.z - centerPos.z;
        const distSq = dx*dx + dz*dz;

        // Radius 160 (25600 sq) - Doubled respawn check range
        if (distSq > 25600) {
            const angle = Math.random() * Math.PI * 2;
            const spawnDist = 80 + Math.random() * 40; // 80-120 units away (Doubled spawn distance)
            
            s.pos.x = centerPos.x + Math.cos(angle) * spawnDist;
            s.pos.z = centerPos.z + Math.sin(angle) * spawnDist;
            s.pos.y = 0;
            s.vel.set(0,0,0);
            s.isFlying = false;
            s.isHopping = false;
            s.nextHopTime = Math.random();
        }

        // Apply Position to Mesh
        group.current.position.copy(s.pos);
    });

    return (
        <group ref={group} position={state.current.pos} rotation={[0, state.current.rot, 0]}>
             {/* Body */}
            <mesh position={[0, 0.25, 0]} castShadow>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 0.45, 0.15]} castShadow>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
            </mesh>
             {/* Ears */}
            <mesh position={[0.08, 0.65, 0.15]} rotation={[0.2, 0, -0.2]}>
                <capsuleGeometry args={[0.04, 0.25, 4, 8]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.08, 0.65, 0.15]} rotation={[0.2, 0, 0.2]}>
                <capsuleGeometry args={[0.04, 0.25, 4, 8]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Tail */}
            <mesh position={[0, 0.15, -0.22]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>
        </group>
    );
};

const RabbitsManager = () => {
    // Generate static initial positions. 
    // The Rabbit components handle their own logic/respawning afterwards.
    const rabbits = useMemo(() => {
        return new Array(40).fill(0).map((_, i) => {
            const angle = Math.random() * Math.PI * 2;
            // Increased initial spread: 20-80 units (Doubled from 10-40)
            const dist = 20 + Math.random() * 60;
            return new THREE.Vector3(
                Math.cos(angle) * dist,
                0,
                Math.sin(angle) * dist
            );
        });
    }, []);

    return (
        <group>
            {rabbits.map((pos, i) => <Rabbit key={i} initialPos={pos} />)}
        </group>
    );
};

export const DayScene = () => (
    <group>
        <ambientLight intensity={1.2} />
        <directionalLight 
            position={[100, 200, 100]} 
            intensity={1.5} 
            castShadow 
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-100}
            shadow-camera-right={100}
            shadow-camera-top={100}
            shadow-camera-bottom={-100}
        />
        
        <InfiniteFloor />
        <FixedGradientSky />
        <RabbitsManager />
    </group>
);
