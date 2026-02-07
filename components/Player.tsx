
import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { MicrophoneIcon } from '@heroicons/react/24/solid';
import { ShapeType } from '../types';
import { useStore } from '../store';
import { audioSynth } from '../services/AudioSynthesizer';
import { MOVEMENT_SPEED, AUDIO_DISTANCE_REF, AUDIO_DISTANCE_MAX, TRANSLATIONS } from '../constants';
import { useAudioVolume } from './UI/AudioVisualizer';
import { networkService } from '../services/NetworkService';
import { getTerrainHeight, getClosestSeat, isObstacle } from './Environment';

// --- Constants for Physics ---
const JUMP_FORCE = 0.4;     
const GRAVITY = 0.02;      
const TERMINAL_VELOCITY = -0.8;
const PLAYER_RADIUS = 0.25; // Narrower collision radius

// --- Components ---

const CinemaScreen = ({ stream, isLocal }: { stream?: MediaStream, isLocal: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
  const { setActiveCinemaStream, language } = useStore();
  const [hovered, setHovered] = useState(false);
  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;

  useEffect(() => {
    if (stream) {
      const vid = videoRef.current;
      vid.srcObject = stream;
      vid.crossOrigin = 'Anonymous';
      vid.muted = true; // Always mute the 3D texture video
      vid.playsInline = true;
      vid.play().catch(e => console.log("Video play error", e));
      const texture = new THREE.VideoTexture(vid);
      setVideoTexture(texture);
    }
    return () => {
      if(videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  if (!stream || !videoTexture) return null;

  return (
    <group position={[0, 4.5, 0]}>
      <mesh position={[0, 0, -0.1]}>
         <planeGeometry args={[8.2, 4.7]} />
         <meshStandardMaterial color="#111" />
      </mesh>
      <mesh 
        onClick={(e) => { e.stopPropagation(); setActiveCinemaStream(stream); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[8, 4.5]} />
        <meshBasicMaterial map={videoTexture} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {hovered && (
        <Html position={[0, 0, 0.1]} center pointerEvents="none">
           <div className="bg-black/70 text-white px-2 py-1 rounded text-xs backdrop-blur-sm whitespace-nowrap">
             {t('view_stream')}
           </div>
        </Html>
      )}
      <pointLight position={[0, 0, 2]} intensity={2} distance={10} color="#ffffff" />
    </group>
  );
};

const RemoteAudioController: React.FC<{ stream: MediaStream | undefined, position: [number, number, number], isSpeaker?: boolean }> = ({ stream, position, isSpeaker }) => {
    const audioRef = useRef<HTMLAudioElement>(document.createElement('audio'));
    const { camera } = useThree();
    const { activeCinemaStream } = useStore();

    useEffect(() => {
        const audio = audioRef.current;
        if (stream) {
            audio.srcObject = stream;
            audio.autoplay = true;
            audio.volume = 1;
            document.body.appendChild(audio);
            const tryPlay = async () => { try { await audio.play(); } catch(e) { console.warn("Audio autoplay blocked", e); } };
            tryPlay();
        }
        return () => {
            audio.pause();
            audio.srcObject = null;
            if (document.body.contains(audio)) {
                document.body.removeChild(audio);
            }
        };
    }, [stream]);

    useFrame(() => {
        if (audioRef.current) {
            if (activeCinemaStream && stream && activeCinemaStream.id === stream.id) {
                audioRef.current.volume = 0;
            } else if (isSpeaker) {
                // Speaker Mode: Loud everywhere
                audioRef.current.volume = 1.0;
            } else {
                const myPos = camera.position;
                const theirPos = new THREE.Vector3(...position);
                const dist = myPos.distanceTo(theirPos);
                let vol = 1 - (dist - AUDIO_DISTANCE_REF) / (AUDIO_DISTANCE_MAX - AUDIO_DISTANCE_REF);
                vol = Math.max(0, Math.min(1, vol));
                audioRef.current.volume = vol;
            }
        }
    });

    return null;
};

const ReactionParticle: React.FC<{ emoji: string, onComplete: () => void }> = ({ emoji, onComplete }) => {
  useEffect(() => {
      const timer = setTimeout(onComplete, 2000);
      return () => clearTimeout(timer);
  }, [onComplete]);

  return (
      <div 
          className="animate-float-up flex items-center justify-center pointer-events-none"
          style={{ 
            fontSize: '4rem', 
            textShadow: '0 4px 8px rgba(0,0,0,0.5)',
            marginLeft: `${(Math.random() - 0.5) * 60}px`
          }}
      >
          {emoji}
      </div>
  );
};

const ReactionEffect = ({ triggerEmoji, triggerTs }: { triggerEmoji?: string, triggerTs?: number }) => {
    const [items, setItems] = useState<{ id: number, emoji: string }[]>([]);
    const lastTs = useRef(0);

    useEffect(() => {
        if (triggerEmoji && triggerTs && triggerTs !== lastTs.current) {
            lastTs.current = triggerTs;
            const newItems = Array.from({ length: 6 }).map(() => ({
                id: Math.random(),
                emoji: triggerEmoji
            }));
            setItems(prev => [...prev, ...newItems]);
        }
    }, [triggerEmoji, triggerTs]);

    const remove = (id: number) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    if (items.length === 0) return null;

    return (
        <Html position={[0, 2, 0]} center zIndexRange={[100, 0]} pointerEvents="none">
            <div className="relative w-0 h-0 flex items-center justify-center">
                {items.map(item => (
                    <ReactionParticle key={item.id} emoji={item.emoji} onComplete={() => remove(item.id)} />
                ))}
            </div>
        </Html>
    );
};

const AvatarShape = ({ shape, color }: { shape: ShapeType; color: string }) => {
  const material = <meshStandardMaterial color={color} />;
  switch (shape) {
    case 'sphere': return <mesh castShadow receiveShadow>{material}<sphereGeometry args={[0.5, 32, 32]} /></mesh>;
    case 'cone': return <mesh position={[0, 0, 0]} castShadow receiveShadow>{material}<coneGeometry args={[0.5, 1, 32]} /></mesh>;
    case 'cylinder': return <mesh castShadow receiveShadow>{material}<cylinderGeometry args={[0.4, 0.4, 1.2, 32]} /></mesh>;
    case 'box':
    default: return <mesh castShadow receiveShadow>{material}<boxGeometry args={[0.8, 0.8, 0.8]} /></mesh>;
  }
};

const DynamicMicIcon = ({ stream, isMicOn }: { stream: MediaStream | null, isMicOn: boolean }) => {
    const volume = useAudioVolume(stream, isMicOn);
    if (!isMicOn) return <MicrophoneIcon className="w-4 h-4 text-red-500 drop-shadow-sm" />;
    return (
        <div className="relative w-4 h-4">
            <MicrophoneIcon className="w-4 h-4 text-gray-400 absolute top-0 left-0" />
            <div className="absolute bottom-0 left-0 w-full overflow-hidden" style={{ height: `${Math.max(10, volume)}%` }}>
                <MicrophoneIcon className="w-4 h-4 text-green-400 absolute bottom-0 left-0" />
            </div>
        </div>
    );
};

const Nametag = ({ name, isFriend, isMicOn, isSpeaking, stream, isSpeaker }: { name: string, isFriend?: boolean, isMicOn: boolean, isSpeaking: boolean, stream: MediaStream | null, isSpeaker?: boolean }) => (
    <Html position={[0, 1.8, 0]} center zIndexRange={[50, 0]}>
        <div className="flex flex-col items-center">
            {isSpeaker && <div className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold mb-1 uppercase tracking-widest animate-pulse">Loud Speaker</div>}
            <div className="flex items-center gap-2 px-3 py-1.5 transform transition-all select-none whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                <span className="text-sm font-bold text-white drop-shadow-md">{name} {isFriend ? "❤️" : ""}</span>
                <div className="w-px h-3 bg-white/50" />
                <DynamicMicIcon stream={stream} isMicOn={isMicOn} />
            </div>
        </div>
    </Html>
);

export const RemotePlayer: React.FC<{ id: string; data: any }> = ({ id, data }) => {
  const group = useRef<THREE.Group>(null);
  const { friends, requestFriend, removeFriend, updatePeer, activeRoomId, rooms, peerStreams, language } = useStore();
  const room = activeRoomId ? rooms[activeRoomId] : null;
  const [showMenu, setShowMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const isFriend = friends.includes(id);
  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;
  const streams = peerStreams[id];
  const audioStream = streams?.audio;
  const screenStream = streams?.screen;
  const finalAudioStream = data.mutedByMe ? undefined : audioStream;

  useFrame((state) => {
    if (group.current) {
      group.current.position.lerp(new THREE.Vector3(...data.position), 0.1);
      // Visual Sit Offset for Remote Players
      if (data.isSitting) {
          group.current.position.y -= 0.5;
      }
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, data.rotation[1], 0.1);
    }
  });

  return (
    <group ref={group} position={data.position} onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowRemoveConfirm(false); }}>
      <group position={[0, 0.5, 0]}>
        <AvatarShape shape={data.shape} color={data.color} />
      </group>
      <Nametag name={data.name} isFriend={isFriend} isMicOn={!!audioStream && data.isMicOn} isSpeaking={data.isSpeaking} stream={finalAudioStream || null} isSpeaker={data.isSpeaker} />
      {finalAudioStream && <RemoteAudioController key={`${id}-audio`} stream={finalAudioStream} position={data.position} isSpeaker={data.isSpeaker} />}
      
      {/* Only show overhead screen if NOT in conference mode (where it is on the big screen) OR if not speaker */}
      {screenStream && (!room || room.type !== 'conference' || !data.isSpeaker) && <RemoteAudioController key={`${id}-screen-audio`} stream={screenStream} position={data.position} />}
      {data.isScreenSharing && screenStream && (!room || room.type !== 'conference' || !data.isSpeaker) && <CinemaScreen stream={screenStream} isLocal={false} />}
      
      <ReactionEffect triggerEmoji={data.lastReaction} triggerTs={data.lastReactionTs} />

      {showMenu && (
        <Html position={[0, 1, 0]} center zIndexRange={[100, 0]}>
          <div className="bg-black/90 backdrop-blur text-white p-4 rounded-lg border border-gray-700 shadow-xl flex flex-col gap-2 min-w-[160px]">
            <div className="font-bold text-center border-b border-gray-600 pb-2 mb-1">{data.name}</div>
            {!data.isBot && (
                <>
                {!isFriend && (<button className="text-xs py-2 px-2 rounded-md font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition whitespace-nowrap" onClick={(e) => { e.stopPropagation(); requestFriend(id); setShowMenu(false); }}>{t('add_friend')}</button>)}
                {isFriend && !showRemoveConfirm && (<button className="text-xs py-2 px-2 rounded-md font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition whitespace-nowrap" onClick={(e) => { e.stopPropagation(); setShowRemoveConfirm(true); }}>{t('remove_friend')}</button>)}
                {isFriend && showRemoveConfirm && (<div className="flex flex-col gap-1 bg-red-900/30 p-2 rounded-md"><span className="text-[10px] text-center whitespace-nowrap">{t('sure')}</span><div className="flex gap-1"><button className="flex-1 bg-red-600 text-white text-[10px] rounded-md py-1" onClick={(e) => { e.stopPropagation(); removeFriend(id); setShowMenu(false); }}>{t('yes')}</button><button className="flex-1 bg-gray-600 text-white text-[10px] rounded-md py-1" onClick={(e) => { e.stopPropagation(); setShowRemoveConfirm(false); }}>{t('no')}</button></div></div>)}
                </>
            )}
            {!room?.rules.preventIgnoring && (<button className={`text-xs py-2 px-2 rounded-md font-medium whitespace-nowrap ${data.mutedByMe ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 hover:bg-gray-600'} transition`} onClick={(e) => { e.stopPropagation(); updatePeer(id, { mutedByMe: !data.mutedByMe }); }}>{data.mutedByMe ? t('unmute') : t('mute')}</button>)}
          </div>
        </Html>
      )}
    </group>
  );
};

// --- Local Player ---
export const LocalPlayer = () => {
  const { localPlayer, isInGame, screenShareEnabled, screenStream, micEnabled, micStream, controls, activeRoomId, rooms, setLocalPlayerMoving, isJoystickActive, cameraDelta, setControls, isSitting, setSitting, isSpeaker } = useStore();
  const room = activeRoomId ? rooms[activeRoomId] : null;

  const group = useRef<THREE.Group>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [localReaction, setLocalReaction] = useState<{emoji: string, ts: number} | undefined>(undefined);
  const [nearSeat, setNearSeat] = useState<{ x: number, y: number, z: number } | null>(null);

  // Velocity for Physics (Jump)
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const isGrounded = useRef(true);
  
  // Double Jump Logic
  const jumpCount = useRef(0);

  const cameraAngle = useRef({ yaw: 0, pitch: 0.3 });
  const cameraDistance = useRef(8); // Default Zoom
  const currentCameraPos = useRef(new THREE.Vector3(0, 5, 8));
  
  // Track if we are actively rotating (LMB Held or Touch)
  const isRotatingCamera = useRef(false);

  // --- INITIALIZATION FIX ---
  useLayoutEffect(() => {
      if (group.current) {
          const initPos = useStore.getState().gameRefs.localPlayerPosition;
          group.current.position.copy(initPos);
          
          // Reset Physics
          velocity.current.set(0, 0, 0);
          isGrounded.current = false;
      }
  }, []);

  // Interaction Event Listener
  useEffect(() => {
    if (controls.jump) {
        if (isSitting) {
            setSitting(false);
            if (group.current) {
                // EJECT LOGIC: Move forward from current orientation
                const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.current.rotation.y);
                group.current.position.add(forward.multiplyScalar(1.5));
                group.current.position.y += 0.5; // Pop up slightly
            }
            setControls({ jump: false });
            return;
        }

        if (isGrounded.current) {
            velocity.current.y = JUMP_FORCE;
            isGrounded.current = false;
            jumpCount.current = 1; // First jump used
            audioSynth.playFootstep();
        } else if (jumpCount.current < 2) {
            velocity.current.y = JUMP_FORCE; // Second jump
            jumpCount.current = 2; // Max jumps used
            audioSynth.playFootstep();
        }
    }
  }, [controls.jump, isSitting]);

  // --- PC CONTROLS LOGIC ---
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
        // Rotate only if LMB is held
        if (!isJoystickActive && e.buttons === 1) {
            isRotatingCamera.current = true;
            const sensitivity = 0.005;
            cameraAngle.current.yaw -= e.movementX * sensitivity;
            // ALLOW LOOKING UP: Pitch can go negative (-0.5) to look upwards
            cameraAngle.current.pitch = Math.max(-0.5, Math.min(Math.PI / 2 - 0.1, cameraAngle.current.pitch + e.movementY * sensitivity));
        } else {
            isRotatingCamera.current = false;
        }
    };

    const onWheel = (e: WheelEvent) => {
        if (!isJoystickActive) {
            cameraDistance.current = Math.max(2, Math.min(25, cameraDistance.current + e.deltaY * 0.01));
        }
    }

    const down = (e: KeyboardEvent) => {
        setKeys(k => ({ ...k, [e.code]: true }));
        if (e.code === 'Space') setControls({ jump: true });
        
        // Interaction Logic
        if (e.code === 'KeyE') {
            if (isSitting) {
                setSitting(false);
                if (group.current) {
                    // EJECT LOGIC: Move forward from current orientation
                    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.current.rotation.y);
                    group.current.position.add(forward.multiplyScalar(1.5));
                    group.current.position.y += 0.5; // Pop up slightly
                }
            } else if (nearSeat) {
                setSitting(true);
                if (group.current) {
                    group.current.position.set(nearSeat.x, nearSeat.y, nearSeat.z);
                    group.current.rotation.y = Math.atan2(-nearSeat.x, -nearSeat.z); // Face center roughly (generic, adjusted for Conference later)
                    if (room?.type === 'conference') {
                        group.current.rotation.y = Math.PI; // Face stage
                    }
                }
            } else if (group.current) {
                // Dispatch event for other environment interactions
                window.dispatchEvent(new CustomEvent('player-interact', { 
                    detail: { 
                        position: group.current.position, 
                        rotation: group.current.rotation.y 
                    } 
                }));
            }
        }
    };
    const up = (e: KeyboardEvent) => {
        setKeys(k => ({ ...k, [e.code]: false }));
        if (e.code === 'Space') setControls({ jump: false });
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    
    const onTeleport = (e: any) => { 
        if(group.current) {
            setSitting(false);
            group.current.position.set(e.detail[0] + 2, 0, e.detail[2] + 2);
            // If teleporting in Roofs, make sure we drop from above
            if (room?.type === 'roofs') {
                group.current.position.y += 20;
                velocity.current.y = 0;
            }
        } 
    };
    window.addEventListener('teleport-to', onTeleport);
    const onReaction = (e: any) => { setLocalReaction({ emoji: e.detail, ts: Date.now() }); };
    window.addEventListener('local-reaction', onReaction);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('teleport-to', onTeleport);
      window.removeEventListener('local-reaction', onReaction);
    };
  }, [isJoystickActive, room, isSitting, nearSeat]);

  useFrame((state) => {
    if (!group.current || !isInGame) return;

    // UPDATE PHYSICS REFS (High frequency, no re-render)
    useStore.getState().gameRefs.localPlayerPosition.copy(group.current.position);
    useStore.getState().gameRefs.localPlayerRotation = group.current.rotation.y;

    // 1. Mobile Touch Rotation (Camera Orbit)
    if (cameraDelta.x !== 0 || cameraDelta.y !== 0) {
        isRotatingCamera.current = true;
        cameraAngle.current.yaw -= cameraDelta.x;
        // ALLOW LOOKING UP (Mobile)
        cameraAngle.current.pitch = Math.max(-0.5, Math.min(Math.PI / 2 - 0.1, cameraAngle.current.pitch + cameraDelta.y));
    }

    // SIT LOGIC SKIPS MOVEMENT
    if (isSitting) {
        const camX = cameraDistance.current * Math.sin(cameraAngle.current.yaw) * Math.cos(cameraAngle.current.pitch);
        const camY = cameraDistance.current * Math.sin(cameraAngle.current.pitch);
        const camZ = cameraDistance.current * Math.cos(cameraAngle.current.yaw) * Math.cos(cameraAngle.current.pitch);
        
        const targetCenter = group.current.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        const desiredPos = targetCenter.clone().add(new THREE.Vector3(camX, camY, camZ));
        
        currentCameraPos.current.lerp(desiredPos, 0.1);
        state.camera.position.copy(currentCameraPos.current);
        state.camera.lookAt(targetCenter);
        
        if (useStore.getState().isLocalPlayerMoving) setLocalPlayerMoving(false);
        networkService.sendMyUpdate({
            ...localPlayer,
            position: [group.current.position.x, group.current.position.y, group.current.position.z],
            rotation: [0, group.current.rotation.y, 0],
            isMoving: false,
            isMicOn: micEnabled,
            isScreenSharing: screenShareEnabled,
            isSitting: true,
            isSpeaker: isSpeaker
        });
        return;
    }

    // 2. MOVEMENT LOGIC
    const currentYaw = cameraAngle.current.yaw;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentYaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentYaw);

    const direction = new THREE.Vector3(0, 0, 0);

    // Joystick
    if (controls.forward !== 0 || controls.turn !== 0) {
        const fwdAmt = -controls.forward;
        const rightAmt = controls.turn;
        direction.addScaledVector(forward, fwdAmt);
        direction.addScaledVector(right, rightAmt);
    } 
    // Keyboard
    else {
        if (keys['KeyW'] || keys['ArrowUp']) direction.add(forward);
        if (keys['KeyS'] || keys['ArrowDown']) direction.sub(forward);
        if (keys['KeyA'] || keys['ArrowLeft']) direction.sub(right);
        if (keys['KeyD'] || keys['ArrowRight']) direction.add(right);
    }

    const isMoving = direction.lengthSq() > 0.001;

    // Apply Move
    if (isMoving) {
        direction.normalize().multiplyScalar(MOVEMENT_SPEED);
        
        // SLIDING COLLISION LOGIC WITH WIDER PLAYER BODY
        // We check 3 points for every axis move: Center, +Radius, -Radius
        
        // --- Try X Move ---
        const dx = new THREE.Vector3(direction.x, 0, 0);
        const nextPosX = group.current.position.clone().add(dx);
        let canMoveX = true;
        
        if (room) {
            // Check Center, Left Shoulder, Right Shoulder (relative to Z axis)
            if (isObstacle(nextPosX.x, nextPosX.z, room.type) || 
                isObstacle(nextPosX.x, nextPosX.z + PLAYER_RADIUS, room.type) ||
                isObstacle(nextPosX.x, nextPosX.z - PLAYER_RADIUS, room.type)) {
                canMoveX = false;
            }
        }
        if (canMoveX) {
            group.current.position.add(dx);
        }

        // --- Try Z Move ---
        const dz = new THREE.Vector3(0, 0, direction.z);
        const nextPosZ = group.current.position.clone().add(dz);
        let canMoveZ = true;
        
        if (room) {
            // Check Center, Left Shoulder, Right Shoulder (relative to X axis)
            if (isObstacle(nextPosZ.x, nextPosZ.z, room.type) ||
                isObstacle(nextPosZ.x + PLAYER_RADIUS, nextPosZ.z, room.type) ||
                isObstacle(nextPosZ.x - PLAYER_RADIUS, nextPosZ.z, room.type)) {
                canMoveZ = false;
            }
        }
        if (canMoveZ) {
            group.current.position.add(dz);
        }
        
        // Rotation (Face input direction, even if blocked)
        const targetRotation = Math.atan2(direction.x, direction.z);
        const currentRotation = group.current.rotation.y;
        
        let rotDiff = targetRotation - currentRotation;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        
        group.current.rotation.y += rotDiff * 0.15;
    }

    // 3. Gravity & Floor Collision
    if (!isGrounded.current) {
        velocity.current.y -= GRAVITY;
        if (velocity.current.y < TERMINAL_VELOCITY) velocity.current.y = TERMINAL_VELOCITY;
    }
    
    // Apply Y Velocity
    group.current.position.y += velocity.current.y;
    
    // Check Room Boundaries (Amphitheater)
    if (room?.type === 'amphitheater') {
        const dist = Math.sqrt(group.current.position.x**2 + group.current.position.z**2);
        if (dist > 65) {
            const angle = Math.atan2(group.current.position.z, group.current.position.x);
            group.current.position.x = Math.cos(angle) * 65;
            group.current.position.z = Math.sin(angle) * 65;
        }
    }
    
    // Check Seat Detection logic
    if (room) {
        const seat = getClosestSeat(group.current.position.x, group.current.position.z, room.type);
        if (seat && seat.dist < 1.5) {
            setNearSeat(seat);
        } else {
            setNearSeat(null);
        }
    }

    // Get Floor Height based on Environment
    let groundHeight = 0;
    if (room) {
        groundHeight = getTerrainHeight(group.current.position.x, group.current.position.z, room.type);
    }

    // Collision Check
    if (group.current.position.y <= groundHeight) {
        group.current.position.y = groundHeight;
        velocity.current.y = 0;
        isGrounded.current = true;
        jumpCount.current = 0;
    } else {
        isGrounded.current = false;
    }

    // Respawn Logic (Fall into Abyss)
    if (group.current.position.y < -300) {
        group.current.position.y = 50;
        velocity.current.y = 0;
        isGrounded.current = false;
    }

    // Room Boundaries (Office Only)
    if (room?.type === 'office') {
        group.current.position.x = Math.max(-19.5, Math.min(19.5, group.current.position.x));
        group.current.position.z = Math.max(-19.5, Math.min(19.5, group.current.position.z));
    }

    // Camera Positioning
    let effectiveDistance = cameraDistance.current;
    
    // ZOOM IN WHEN LOOKING UP (To see things above without floor blocking view)
    if (cameraAngle.current.pitch < 0.2) {
        // Map pitch from 0.2 (normal) down to -0.5 (full up)
        // Zoom factor goes from 1.0 down to 0.4
        const t = (0.2 - cameraAngle.current.pitch) / 0.7; // 0 to 1 range approx
        const zoomFactor = 1.0 - (t * 0.6); 
        effectiveDistance *= zoomFactor;
    }

    const camX = effectiveDistance * Math.sin(cameraAngle.current.yaw) * Math.cos(cameraAngle.current.pitch);
    const camY = effectiveDistance * Math.sin(cameraAngle.current.pitch);
    const camZ = effectiveDistance * Math.cos(cameraAngle.current.yaw) * Math.cos(cameraAngle.current.pitch);

    const targetCenter = group.current.position.clone().add(new THREE.Vector3(0, 2, 0));
    let desiredPos = targetCenter.clone().add(new THREE.Vector3(camX, camY, camZ));

    // CAMERA GROUND COLLISION
    // Ensure camera doesn't go below floor level (approx 0.5)
    if (desiredPos.y < groundHeight + 0.5) {
        desiredPos.y = groundHeight + 0.5;
    }

    // CAMERA CEILING COLLISION (Conference Room)
    if (room?.type === 'conference') {
        if (desiredPos.y > 15.5) {
            desiredPos.y = 15.5;
        }
        
        // CAMERA WALL CLAMPING (Hard Limits for Conference Room)
        // Corridor: Z < 0. Width 10 (x from -5 to 5). Camera must be inside -4 to 4 approx.
        if (desiredPos.z < 0) {
            // Keep X within corridor bounds
            desiredPos.x = Math.max(-4.0, Math.min(4.0, desiredPos.x));
            
            // Limit Z back to -34 (Corridor End)
            if (desiredPos.z < -34) desiredPos.z = -34;
        } else {
            // Hall: Z > 0. Width 40 (x from -20 to 20). Camera inside -19 to 19.
            desiredPos.x = Math.max(-19.0, Math.min(19.0, desiredPos.x));
            
            // Limit Z far to 69 (Stage End)
            if (desiredPos.z > 69) desiredPos.z = 69;

            // Screen Collision Check (Camera shouldn't go through screen at Z=64)
            if (desiredPos.z > 63.5 && Math.abs(desiredPos.x) < 13) {
                desiredPos.z = 63.5;
            }
        }
    }

    // CAMERA WALL COLLISION (Raycast Fallback / Anti-Clip for other objects)
    // Works for Conference walls and screen, and Lobby obstacles
    if (room && room.type !== 'conference') {
        const dir = new THREE.Vector3().subVectors(desiredPos, targetCenter);
        const dist = dir.length();
        dir.normalize();
        
        let hitDist = dist;
        // Simple Raycast: Check every 0.5 units from player to camera
        for (let d = 0.5; d < dist; d += 0.5) {
            const checkPos = targetCenter.clone().add(dir.clone().multiplyScalar(d));
            // Check collision at camera height (y)
            if (isObstacle(checkPos.x, checkPos.z, room.type)) {
                hitDist = Math.max(0.5, d - 0.5); // Pull back slightly before wall
                break;
            }
        }
        desiredPos = targetCenter.clone().add(dir.multiplyScalar(hitDist));
    }

    currentCameraPos.current.lerp(desiredPos, 0.2);
    state.camera.position.copy(currentCameraPos.current);
    state.camera.lookAt(targetCenter);

    if (useStore.getState().isLocalPlayerMoving !== isMoving) {
        setLocalPlayerMoving(isMoving);
    }
    
    networkService.sendMyUpdate({
        ...localPlayer,
        position: [group.current.position.x, group.current.position.y, group.current.position.z],
        rotation: [0, group.current.rotation.y, 0],
        isMoving: isMoving,
        isMicOn: micEnabled,
        isScreenSharing: screenShareEnabled,
        isSitting: false,
        isSpeaker: isSpeaker
    });
  });

  return (
    <group ref={group}>
       <group position={[0, 0.5, 0]}>
        <AvatarShape shape={localPlayer.shape} color={localPlayer.color} />
      </group>
      <Nametag name={localPlayer.name} isMicOn={micEnabled} isSpeaking={micEnabled} stream={micStream} isSpeaker={isSpeaker} />
      
      {/* SEAT HINT */}
      {nearSeat && !isSitting && (
          <Html position={[0, 2.5, 0]} center zIndexRange={[100, 0]}>
              <div className="bg-black/80 text-white px-3 py-1 rounded-full text-xs font-bold border border-white/20 animate-bounce whitespace-nowrap">
                  Press E to Sit
              </div>
          </Html>
      )}
      {isSitting && (
          <Html position={[0, 2.5, 0]} center zIndexRange={[100, 0]}>
              <div className="bg-black/50 text-white px-2 py-1 rounded text-[10px] backdrop-blur">
                  Press E to Stand
              </div>
          </Html>
      )}

      <ReactionEffect triggerEmoji={localReaction?.emoji} triggerTs={localReaction?.ts} />
      
      {/* Only show overhead screen if NOT in conference room (where it's on big screen) OR if local player isn't speaker */}
      {screenShareEnabled && screenStream && (!room || room.type !== 'conference' || !isSpeaker) && <CinemaScreen stream={screenStream} isLocal={true} />}
    </group>
  );
};
