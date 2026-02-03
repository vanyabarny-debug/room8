import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, AudioListener, Euler } from 'three';
import { useStore } from '../../store';
import { networkService } from '../../services/NetworkService';
import { SouthParkHead } from './SouthParkHead';

export const SelfAvatar: React.FC = () => {
  const meshRef = useRef<any>(null);
  const { settings, micOn } = useStore();
  const { camera } = useThree();
  const [keys, setKeys] = useState({ forward: false, backward: false, left: false, right: false });
  const [isLoudspeaker, setIsLoudspeaker] = useState(false);
  
  // Camera State
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);

  // Audio
  const listenerRef = useRef<AudioListener>(new AudioListener());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Initialize Audio & Camera Orientation
  useEffect(() => {
    camera.add(listenerRef.current);
    
    // Sync state with current camera rotation to avoid jumps
    const e = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    setYaw(e.y);
    setPitch(e.x);

    return () => {
        camera.remove(listenerRef.current);
    };
  }, [camera]);

  // Mouse Drag Logic (Look Around)
  useEffect(() => {
      const onMove = (e: MouseEvent) => {
          // Check if interacting with UI
          if ((e.target as HTMLElement).closest('button, input, select, .ui-panel')) return;

          // Rotate if any mouse button is held down
          if (e.buttons > 0) {
            const sensitivity = 0.003;
            setYaw(y => y - e.movementX * sensitivity);
            setPitch(p => Math.max(-Math.PI / 3, Math.min(Math.PI / 3, p - e.movementY * sensitivity)));
          }
      };
      
      window.addEventListener('mousemove', onMove);
      return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Keyboard Logic (WASD + Arrows)
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
       const code = e.code;
       if (code === 'KeyW' || code === 'ArrowUp') setKeys(p => ({ ...p, forward: true }));
       if (code === 'KeyS' || code === 'ArrowDown') setKeys(p => ({ ...p, backward: true }));
       if (code === 'KeyA' || code === 'ArrowLeft') setKeys(p => ({ ...p, left: true }));
       if (code === 'KeyD' || code === 'ArrowRight') setKeys(p => ({ ...p, right: true }));
    };
    const handleUp = (e: KeyboardEvent) => {
       const code = e.code;
       if (code === 'KeyW' || code === 'ArrowUp') setKeys(p => ({ ...p, forward: false }));
       if (code === 'KeyS' || code === 'ArrowDown') setKeys(p => ({ ...p, backward: false }));
       if (code === 'KeyA' || code === 'ArrowLeft') setKeys(p => ({ ...p, left: false }));
       if (code === 'KeyD' || code === 'ArrowRight') setKeys(p => ({ ...p, right: false }));
    };
    
    const handleMegaphone = (e: CustomEvent) => setIsLoudspeaker(e.detail);

    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    window.addEventListener('local-megaphone', handleMegaphone as EventListener);
    
    return () => {
        window.removeEventListener('keydown', handleDown);
        window.removeEventListener('keyup', handleUp);
        window.removeEventListener('local-megaphone', handleMegaphone as EventListener);
    };
  }, []);

  // Setup Mic Analysis
  useEffect(() => {
    const stream = useStore.getState().localStream;
    if (stream) {
      const ctx = listenerRef.current.context;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
    }
  }, []);

  // Movement & Logic Loop
  const lastUpdate = useRef(0);
  
  useFrame((state) => {
    if (!meshRef.current) return;

    // 1. Update Camera Rotation manually
    // We use YXZ order to prevent gimbal lock for FPS style cameras
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // 2. Calculate Movement Vector (Relative to Camera Yaw)
    const speed = 0.15;
    const direction = new Vector3();

    const forward = Number(keys.forward) - Number(keys.backward);
    const side = Number(keys.right) - Number(keys.left);

    // Forward is -Z in Three.js
    const frontVector = new Vector3(0, 0, -forward);
    const sideVector = new Vector3(side, 0, 0);
    
    direction.addVectors(frontVector, sideVector).normalize().multiplyScalar(speed);
    
    // Rotate movement vector by Camera Yaw only (we don't fly up/down)
    const euler = new Euler(0, yaw, 0, 'YXZ');
    direction.applyEuler(euler);

    // Apply Position
    if (forward !== 0 || side !== 0) {
        meshRef.current.position.add(direction);
    }

    // Avatar visual rotation matches camera yaw
    meshRef.current.rotation.y = yaw;
    
    // Boundary Checks (Simple Map Limits)
    const limit = 48; // Map size 100x100
    meshRef.current.position.x = Math.max(-limit, Math.min(limit, meshRef.current.position.x));
    meshRef.current.position.z = Math.max(-limit, Math.min(limit, meshRef.current.position.z));
    
    // 3. Camera Position Follow
    // Calculate desired camera position (behind and up)
    const camOffset = new Vector3(0, 2, 5); 
    camOffset.applyEuler(euler); // Rotate offset to be behind player
    const targetCamPos = meshRef.current.position.clone().add(camOffset);
    
    // Lerp position for smoothness
    camera.position.lerp(targetCamPos, 0.2); 

    // 4. Audio Level Check
    let talking = false;
    if (micOn && analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a,b) => a+b) / data.length;
        if (avg > 15) talking = true;
    }
    if (talking !== isSpeaking) setIsSpeaking(talking);

    // 5. Network Update (Throttled ~50ms)
    const now = Date.now();
    if (now - lastUpdate.current > 50) { 
       networkService.sendUpdatePacket({
         p: meshRef.current.position.toArray(),
         r: [0, yaw, 0], // Send yaw so others see rotation
         c: settings.color,
         s: settings.shape,
         n: settings.nickname,
         f: settings.faceTexture,
         fs: settings.faceSplitRatio,
         v: talking,
         m: isLoudspeaker
       });
       lastUpdate.current = now;
    }
  });

  return (
    <group>
        <mesh ref={meshRef} position={[0, 0.5, 0]} castShadow receiveShadow>
            {settings.shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
            {settings.shape === 'sphere' && <sphereGeometry args={[0.6, 32, 32]} />}
            {settings.shape === 'cone' && <coneGeometry args={[0.6, 1.2, 32]} />}
            {settings.shape === 'cylinder' && <cylinderGeometry args={[0.6, 0.6, 1, 32]} />}
            <meshStandardMaterial color={settings.color} roughness={0.3} metalness={0.8} />
            
            {/* Face attached to body */}
            {settings.faceTexture && (
                <SouthParkHead 
                    faceTexture={settings.faceTexture} 
                    isSpeaking={isSpeaking} 
                    splitRatio={settings.faceSplitRatio}
                />
            )}
        </mesh>
    </group>
  );
};