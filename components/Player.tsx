import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { MicrophoneIcon } from '@heroicons/react/24/solid';
import { ShapeType } from '../types';
import { useStore } from '../store';
import { audioSynth } from '../services/AudioSynthesizer';
import { MOVEMENT_SPEED, ROTATION_SPEED, AUDIO_DISTANCE_REF, AUDIO_DISTANCE_MAX, TRANSLATIONS } from '../constants';
import { useAudioVolume } from './UI/AudioVisualizer';
import { networkService } from '../services/NetworkService';

// --- Components ---

const CinemaScreen = ({ stream, isLocal }: { stream?: MediaStream, isLocal: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
  const { setCinemaMode, language } = useStore();
  const [hovered, setHovered] = useState(false);
  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;

  useEffect(() => {
    if (stream) {
      const vid = videoRef.current;
      vid.srcObject = stream;
      vid.crossOrigin = 'Anonymous';
      vid.muted = true; // Always mute the video element itself, we rely on Audio tracks or RemoteAudioController
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
        onClick={(e) => { e.stopPropagation(); setCinemaMode(true); }}
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

// --- 3D Audio Controller for Remote Players ---
const RemoteAudioController = ({ stream, position }: { stream: MediaStream | undefined, position: [number, number, number] }) => {
    const audioRef = useRef<HTMLAudioElement>(document.createElement('audio'));
    const { camera } = useThree();

    useEffect(() => {
        const audio = audioRef.current;
        if (stream) {
            audio.srcObject = stream;
            // audio.playsInline = true; // Removed as it does not exist on HTMLAudioElement
            audio.autoplay = true;
            audio.volume = 1;
            
            // Append to body to ensure it plays even if 3D component unmounts unexpectedly
            // (Though we fixed unmounting in parent, this is double safety)
            document.body.appendChild(audio);

            const tryPlay = async () => {
                try {
                    await audio.play();
                } catch(e) {
                    console.warn("Audio autoplay blocked", e);
                }
            };
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
            // Simple linear distance attenuation
            const myPos = camera.position;
            const theirPos = new THREE.Vector3(...position);
            const dist = myPos.distanceTo(theirPos);
            
            // Calculate volume: 1.0 at REF distance, 0.0 at MAX distance
            let vol = 1 - (dist - AUDIO_DISTANCE_REF) / (AUDIO_DISTANCE_MAX - AUDIO_DISTANCE_REF);
            vol = Math.max(0, Math.min(1, vol));
            
            audioRef.current.volume = vol;
        }
    });

    return null; // Logic only, no UI
};

// --- Reaction Particle Subcomponent using CSS Animation ---
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
    case 'sphere': return <mesh>{material}<sphereGeometry args={[0.5, 32, 32]} /></mesh>;
    case 'cone': return <mesh position={[0, 0, 0]}>{material}<coneGeometry args={[0.5, 1, 32]} /></mesh>;
    case 'cylinder': return <mesh>{material}<cylinderGeometry args={[0.4, 0.4, 1.2, 32]} /></mesh>;
    case 'box':
    default: return <mesh>{material}<boxGeometry args={[0.8, 0.8, 0.8]} /></mesh>;
  }
};

const DynamicMicIcon = ({ stream, isMicOn }: { stream: MediaStream | null, isMicOn: boolean }) => {
    const volume = useAudioVolume(stream, isMicOn);

    if (!isMicOn) {
        return <MicrophoneIcon className="w-4 h-4 text-red-500 drop-shadow-sm" />;
    }

    return (
        <div className="relative w-4 h-4">
            <MicrophoneIcon className="w-4 h-4 text-gray-400 absolute top-0 left-0" />
            <div 
                className="absolute bottom-0 left-0 w-full overflow-hidden" 
                style={{ height: `${Math.max(10, volume)}%` }}
            >
                <MicrophoneIcon className="w-4 h-4 text-green-400 absolute bottom-0 left-0" />
            </div>
        </div>
    );
};

const Nametag = ({ name, isFriend, isMicOn, isSpeaking, stream }: { name: string, isFriend?: boolean, isMicOn: boolean, isSpeaking: boolean, stream: MediaStream | null }) => (
    <Html position={[0, 1.8, 0]} center zIndexRange={[50, 0]}>
        <div className="flex items-center gap-2 px-3 py-1.5 transform transition-all select-none whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            <span className="text-sm font-bold text-white drop-shadow-md">
                {name} {isFriend ? "❤️" : ""}
            </span>
            <div className="w-px h-3 bg-white/50" />
            <DynamicMicIcon stream={stream} isMicOn={isMicOn} />
        </div>
    </Html>
);

// --- Remote Player ---
export const RemotePlayer: React.FC<{ id: string; data: any }> = ({ id, data }) => {
  const group = useRef<THREE.Group>(null);
  const { friends, requestFriend, removeFriend, updatePeer, activeRoomId, rooms, peerStreams, language } = useStore();
  const room = activeRoomId ? rooms[activeRoomId] : null;

  const [showMenu, setShowMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const isFriend = friends.includes(id);

  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;

  // Retrieve streams for this peer
  const streams = peerStreams[id];
  const audioStream = streams?.audio;
  const screenStream = streams?.screen;

  // If I muted them locally, don't play audio
  const finalAudioStream = data.mutedByMe ? undefined : audioStream;

  useFrame((state) => {
    if (group.current) {
      group.current.position.lerp(new THREE.Vector3(...data.position), 0.1);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, data.rotation[1], 0.1);
    }
  });

  return (
    <group ref={group} position={data.position} onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowRemoveConfirm(false); }}>
      <group position={[0, 0.5, 0]}>
        <AvatarShape shape={data.shape} color={data.color} />
      </group>

      <Nametag 
        name={data.name} 
        isFriend={isFriend} 
        isMicOn={!!audioStream && data.isMicOn} 
        isSpeaking={data.isSpeaking} 
        stream={finalAudioStream || null} 
      />
      
      {/* 3D Audio Logic - Always mounted to prevent audio cutting */}
      {finalAudioStream && <RemoteAudioController key={finalAudioStream.id} stream={finalAudioStream} position={data.position} />}

      <ReactionEffect triggerEmoji={data.lastReaction} triggerTs={data.lastReactionTs} />

      {/* Interface Popup */}
      {showMenu && (
        <Html position={[0, 1, 0]} center zIndexRange={[100, 0]}>
          <div className="bg-black/90 backdrop-blur text-white p-4 rounded-lg border border-gray-700 shadow-xl flex flex-col gap-2 min-w-[160px]">
            <div className="font-bold text-center border-b border-gray-600 pb-2 mb-1">{data.name}</div>
            
            {!data.isBot && (
                <>
                {!isFriend && (
                    <button 
                        className="text-xs py-2 px-2 rounded-md font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition whitespace-nowrap"
                        onClick={(e) => { e.stopPropagation(); requestFriend(id); setShowMenu(false); }}
                    >
                        {t('add_friend')}
                    </button>
                )}
                {isFriend && !showRemoveConfirm && (
                     <button 
                        className="text-xs py-2 px-2 rounded-md font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition whitespace-nowrap"
                        onClick={(e) => { e.stopPropagation(); setShowRemoveConfirm(true); }}
                    >
                        {t('remove_friend')}
                    </button>
                )}
                {isFriend && showRemoveConfirm && (
                    <div className="flex flex-col gap-1 bg-red-900/30 p-2 rounded-md">
                        <span className="text-[10px] text-center whitespace-nowrap">{t('sure')}</span>
                        <div className="flex gap-1">
                            <button className="flex-1 bg-red-600 text-white text-[10px] rounded-md py-1" onClick={(e) => { e.stopPropagation(); removeFriend(id); setShowMenu(false); }}>{t('yes')}</button>
                            <button className="flex-1 bg-gray-600 text-white text-[10px] rounded-md py-1" onClick={(e) => { e.stopPropagation(); setShowRemoveConfirm(false); }}>{t('no')}</button>
                        </div>
                    </div>
                )}
                </>
            )}

            {!room?.rules.preventIgnoring && (
                <button 
                className={`text-xs py-2 px-2 rounded-md font-medium whitespace-nowrap ${data.mutedByMe ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 hover:bg-gray-600'} transition`}
                onClick={(e) => { e.stopPropagation(); updatePeer(id, { mutedByMe: !data.mutedByMe }); }}
                >
                {data.mutedByMe ? t('unmute') : t('mute')}
                </button>
            )}
            {room?.rules.preventIgnoring && <div className="text-[10px] text-gray-500 text-center">{t('ignore_forbidden')}</div>}
          </div>
        </Html>
      )}

      {/* Screen Share from Network */}
      {data.isScreenSharing && screenStream && (
        <CinemaScreen stream={screenStream} isLocal={false} />
      )}
    </group>
  );
};

// --- Local Player ---
export const LocalPlayer = () => {
  const { localPlayer, isInGame, screenShareEnabled, screenStream, micEnabled, micStream, controls, activeRoomId, rooms, setLocalPlayerMoving, isJoystickActive } = useStore();
  const room = activeRoomId ? rooms[activeRoomId] : null;

  const group = useRef<THREE.Group>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [localReaction, setLocalReaction] = useState<{emoji: string, ts: number} | undefined>(undefined);

  useEffect(() => {
    const down = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: true }));
    const up = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: false }));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    
    const onTeleport = (e: any) => {
        if(group.current) {
            group.current.position.set(e.detail[0] + 2, 0, e.detail[2] + 2);
        }
    };
    window.addEventListener('teleport-to', onTeleport);

    const onReaction = (e: any) => {
        setLocalReaction({ emoji: e.detail, ts: Date.now() });
    };
    window.addEventListener('local-reaction', onReaction);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('teleport-to', onTeleport);
      window.removeEventListener('local-reaction', onReaction);
    };
  }, []);

  useFrame((state) => {
    if (!group.current || !isInGame) return;

    let turn = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) turn += 1;
    if (keys['KeyD'] || keys['ArrowRight']) turn -= 1;
    
    // Joystick turn input
    turn -= controls.turn;

    if (turn !== 0) {
        group.current.rotation.y += turn * ROTATION_SPEED;
    }

    let move = 0;
    if (keys['KeyW'] || keys['ArrowUp']) move = -1; 
    if (keys['KeyS'] || keys['ArrowDown']) move = 1;  
    
    // Joystick forward input
    if (controls.forward !== 0) move = -controls.forward;

    const direction = new THREE.Vector3(0, 0, move);
    const speed = MOVEMENT_SPEED;

    if (move !== 0) {
        const euler = new THREE.Euler(0, group.current.rotation.y, 0);
        direction.applyEuler(euler).multiplyScalar(speed);
        
        const newPos = group.current.position.clone().add(direction);

        if (room?.type === 'office') {
            newPos.x = Math.max(-19.5, Math.min(19.5, newPos.x));
            newPos.z = Math.max(-19.5, Math.min(19.5, newPos.z));
        }

        group.current.position.copy(newPos);
        audioSynth.playFootstep();
    }

    // --- CAMERA LOGIC: "Iron-Locked" Camera when using Joystick ---
    if (isJoystickActive && group.current) {
        // Calculate position slightly behind and above player, respecting player rotation
        const offset = new THREE.Vector3(0, 4, 8); 
        offset.applyEuler(group.current.rotation);
        
        const targetCamPos = group.current.position.clone().add(offset);
        
        // Smoothly interpolate camera position
        state.camera.position.lerp(targetCamPos, 0.2);
        
        // Always look at the player center
        state.camera.lookAt(group.current.position.x, group.current.position.y + 1, group.current.position.z);
    } 
    // If not using joystick, OrbitControls in GameCanvas handles it (via standard mode) or standard keyboard movement doesn't lock camera
    else if (group.current && (state.controls as any) && !isJoystickActive) {
         // Standard OrbitControls follow logic
          (state.controls as any).target.lerp(group.current.position, 0.2);
          (state.controls as any).update();
    }
    
    // Check if store needs update for UI idle state
    if (useStore.getState().isLocalPlayerMoving !== (move !== 0)) {
        setLocalPlayerMoving(move !== 0);
    }
    
    // BROADCAST UPDATE
    networkService.sendMyUpdate({
        ...localPlayer,
        position: [group.current.position.x, group.current.position.y, group.current.position.z],
        rotation: [0, group.current.rotation.y, 0],
        isMoving: move !== 0,
        isMicOn: micEnabled,
        isScreenSharing: screenShareEnabled
    });
  });

  return (
    <group ref={group}>
       <group position={[0, 0.5, 0]}>
        <AvatarShape shape={localPlayer.shape} color={localPlayer.color} />
      </group>
      
      <Nametag name={localPlayer.name} isMicOn={micEnabled} isSpeaking={micEnabled} stream={micStream} />

      <ReactionEffect triggerEmoji={localReaction?.emoji} triggerTs={localReaction?.ts} />

      {screenShareEnabled && screenStream && (
        <CinemaScreen stream={screenStream} isLocal={true} />
      )}
    </group>
  );
};