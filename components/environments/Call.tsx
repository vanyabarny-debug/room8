
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { MicrophoneIcon, ArrowsPointingOutIcon, XMarkIcon, ClipboardDocumentIcon } from '@heroicons/react/24/solid';
import { TRANSLATIONS } from '../../constants';
import { useAudioVolume } from '../UI/AudioVisualizer';
import { audioSynth } from '../../services/AudioSynthesizer';

// --- SMOOTH REACTIVE VOID SHADER ---
const PlasmaMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uAudioLevel: { value: 0 },
    uColorBase: { value: new THREE.Color('#000000') }, // Pure Black
    uColorActive: { value: new THREE.Color('#0a0a2a') }, // Very Dark Blue
    uColorHighlight: { value: new THREE.Color('#1e3a8a') }, // Deep Blue
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uAudioLevel;
    uniform vec3 uColorBase;
    uniform vec3 uColorActive;
    uniform vec3 uColorHighlight;
    varying vec2 vUv;

    // Simplex noise function
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      // 1. Slow, liquid movement (Constant speed, does not jerk with audio)
      float time = uTime * 0.1; 
      
      // Scale coordinates for larger, smoother waves
      vec2 uv = vUv * 2.0; 
      
      // Liquid Distortion
      float n1 = snoise(uv + vec2(time * 0.15, time * 0.1));
      float n2 = snoise(uv * 0.6 - vec2(time * 0.1, time * 0.15));
      
      // Combine for pattern (0.0 to 1.0)
      float pattern = (n1 + n2) * 0.5 + 0.5; 
      
      // 2. Audio Interaction: Controls Opacity/Brightness
      // Using smoothstep to gate low noise and clamp max brightness
      float visibility = smoothstep(0.05, 0.6, uAudioLevel);
      
      // 3. Color Logic
      vec3 col = uColorBase;
      
      // Gradient based on pattern
      vec3 waveColor = mix(uColorActive, uColorHighlight, pattern * pattern);
      
      // Apply visibility (Volume)
      col = mix(col, waveColor, visibility);

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

// --- Updated Minimalist Dynamic Mic Icon ---
const MinimalMicIcon = ({ stream, isMicOn, size = "w-5 h-5" }: { stream: MediaStream | null, isMicOn: boolean, size?: string }) => {
    const volume = useAudioVolume(stream, isMicOn);
    
    if (!isMicOn) {
        return <MicrophoneIcon className={`${size} text-red-500`} />;
    }

    // Dynamic Height Clip for "Filling" effect (Green liquid)
    return (
        <div className={`relative ${size}`}>
            {/* Background (Empty/Gray) */}
            <MicrophoneIcon className={`${size} text-gray-600 absolute top-0 left-0`} />
            
            {/* Foreground (Filled/Green) - Clipped by volume height */}
            <div 
                className="absolute bottom-0 left-0 w-full overflow-hidden transition-all duration-75"
                style={{ 
                    // Map 0-50 volume to 0-100% height for more sensitivity
                    height: `${Math.min(100, Math.max(15, volume * 2.5))}%` 
                }} 
            >
               <MicrophoneIcon className={`${size} text-green-500 absolute bottom-0 left-0`} />
            </div>
        </div>
    );
};

// --- Explosive Reaction Burst ---
const ReactionBurst: React.FC<{ emoji: string, onComplete: () => void }> = ({ emoji, onComplete }) => {
    const particles = useMemo(() => {
        return Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * 2 * Math.PI;
            const distance = 100 + Math.random() * 80; 
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            return { id: i, tx, ty, delay: Math.random() * 0.1 };
        });
    }, []);

    useEffect(() => {
        const timer = setTimeout(onComplete, 1500);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]">
            {particles.map(p => (
                <div 
                    key={p.id}
                    className="absolute text-5xl transition-all duration-1000 ease-out opacity-0"
                    style={{
                        transform: `translate(0px, 0px) scale(0.5)`,
                        animation: `burst-${p.id} 1s ease-out forwards`,
                        animationDelay: `${p.delay}s`
                    }}
                >
                    {emoji}
                    <style>{`
                        @keyframes burst-${p.id} {
                            0% { transform: translate(0, 0) scale(0.5); opacity: 1; }
                            100% { transform: translate(${p.tx}px, ${p.ty}px) scale(1.5); opacity: 0; }
                        }
                    `}</style>
                </div>
            ))}
        </div>
    );
};

interface VideoTileProps {
    videoStream?: MediaStream | null;
    screenStream?: MediaStream | null;
    muted: boolean;
    name: string;
    isLocal: boolean;
    isMicOn: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    isSpeaking: boolean;
    color: string;
    lastReaction?: string;
    lastReactionTs?: number;
    onPin: () => void;
    isPinned: boolean;
    onExpand: () => void;
    isExpanded: boolean;
    audioStream: MediaStream | null;
}

const VideoTile: React.FC<VideoTileProps> = ({ 
    videoStream, screenStream, muted, name, isLocal, isMicOn, isVideoOn, isScreenSharing, isSpeaking, color, 
    lastReaction, lastReactionTs, onPin, isPinned, onExpand, isExpanded, audioStream
}) => {
    const mainVideoRef = useRef<HTMLVideoElement>(null);
    const pipVideoRef = useRef<HTMLVideoElement>(null);
    
    const [reactions, setReactions] = useState<{id: number, emoji: string}[]>([]);
    const prevReactionTs = useRef<number | undefined>(undefined);

    const showPip = isScreenSharing && isVideoOn;
    const mainStream = isScreenSharing ? screenStream : videoStream;
    const pipStream = isScreenSharing ? videoStream : null;
    const hasMainContent = (isVideoOn || isScreenSharing) && mainStream;

    // Handle Reactions & Play Sound
    useEffect(() => {
        if (lastReaction && lastReactionTs !== prevReactionTs.current) {
            const newReaction = { id: Date.now() + Math.random(), emoji: lastReaction };
            setReactions(prev => [...prev, newReaction]);
            prevReactionTs.current = lastReactionTs;
            // FORCE SOUND PLAYBACK
            audioSynth.playReactionPop(); 
        }
    }, [lastReaction, lastReactionTs]);

    const removeReaction = (id: number) => {
        setReactions(prev => prev.filter(r => r.id !== id));
    };

    // Attach Streams
    useEffect(() => {
        if (mainVideoRef.current && mainStream) {
            mainVideoRef.current.srcObject = mainStream;
            mainVideoRef.current.play().catch(() => {});
        }
    }, [mainStream]);

    useEffect(() => {
        if (pipVideoRef.current && pipStream) {
            pipVideoRef.current.srcObject = pipStream;
            pipVideoRef.current.play().catch(() => {});
        }
    }, [pipStream]);

    return (
        <div 
            className={`relative transition-all duration-300 group
                ${isExpanded ? 'fixed inset-0 z-0 m-0 rounded-none bg-black' : 'w-full h-full aspect-square z-10'}
            `}
        >
            {/* --- VISUAL CARD --- */}
            <div 
                onClick={onPin}
                className={`relative w-full h-full overflow-hidden shadow-2xl cursor-pointer flex flex-col items-center justify-center
                    ${isExpanded ? '' : 'rounded-3xl border border-white/10 hover:border-white/30'}
                    ${isSpeaking ? 'ring-4 ring-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : ''}
                    ${!hasMainContent ? 'bg-gradient-to-b from-[#0f172a] to-[#172554]' : 'bg-black'} 
                `}
            >
                {/* Main Content - Full Screen scaling fixed here */}
                {hasMainContent ? (
                    <video 
                        ref={mainVideoRef} 
                        autoPlay 
                        playsInline 
                        muted={muted} 
                        // IF expanded AND screen sharing -> object-contain (readability)
                        // ELSE (Camera expanded OR any tile) -> object-cover (background/wallpaper feel)
                        className={`w-full h-full ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''} ${isExpanded && isScreenSharing ? 'object-contain' : 'object-cover'}`} 
                    />
                ) : (
                    // NO VIDEO STATE
                    <div className="flex items-center gap-4">
                        <span className="text-white font-bold text-2xl md:text-3xl drop-shadow-lg tracking-tight">
                            {name}
                        </span>
                        {/* Dynamic Mic Icon Next to Name */}
                        <MinimalMicIcon stream={audioStream} isMicOn={isMicOn} size="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                )}

                {/* Picture in Picture */}
                {showPip && (
                    <div className="absolute top-4 right-4 w-1/3 aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border border-white/20 z-20">
                        <video 
                            ref={pipVideoRef}
                            autoPlay
                            playsInline
                            muted={true}
                            className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
                        />
                    </div>
                )}
                
                {/* Overlay Info - ONLY SHOW AT BOTTOM IF VIDEO IS ON */}
                {hasMainContent && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full z-10 border border-white/10">
                        <span className="text-white font-bold text-sm shadow-black drop-shadow-md">{name}</span>
                        <div className="w-px h-3 bg-white/30"></div>
                        <MinimalMicIcon stream={audioStream} isMicOn={isMicOn} size="w-4 h-4" />
                    </div>
                )}

                {/* Controls Overlay (Hover) */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-start justify-end p-4 z-20">
                     <button 
                        onClick={(e) => { e.stopPropagation(); onExpand(); }} 
                        className="pointer-events-auto p-2 bg-black/50 hover:bg-white/20 rounded-full text-white backdrop-blur-md"
                        title="Fullscreen"
                    >
                        {isExpanded ? <XMarkIcon className="w-6 h-6" /> : <ArrowsPointingOutIcon className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* --- REACTIONS EXPLOSION --- */}
            {reactions.map(r => (
                <ReactionBurst key={r.id} emoji={r.emoji} onComplete={() => removeReaction(r.id)} />
            ))}
        </div>
    );
};

export const CallScene = () => {
    const { 
        localPlayer, peers, peerStreams, micEnabled, videoEnabled, videoStream, 
        screenShareEnabled, screenStream, activeRoomId, language, isSpeaker,
        micStream, globalMute
    } = useStore();

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
    const [localReaction, setLocalReaction] = useState<{emoji: string, ts: number} | undefined>(undefined);
    const shaderRef = useRef<any>(null);
    
    const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;

    useEffect(() => {
        const onReaction = (e: any) => { 
            setLocalReaction({ emoji: e.detail, ts: Date.now() }); 
        };
        window.addEventListener('local-reaction', onReaction);
        return () => window.removeEventListener('local-reaction', onReaction);
    }, []);

    // Background Audio Reactivity
    const localVol = useAudioVolume(micStream, micEnabled);
    
    useFrame(({ clock }) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = clock.getElapsedTime();
            const threshold = 10; 
            let normalized = Math.max(0, localVol - threshold) / (100 - threshold);
            let curved = normalized * normalized; 
            shaderRef.current.uniforms.uAudioLevel.value = THREE.MathUtils.lerp(
                shaderRef.current.uniforms.uAudioLevel.value,
                curved, 
                0.03 
            );
        }
    });

    const allUsers = useMemo(() => {
        const localUser = {
            id: localPlayer.id,
            isLocal: true,
            name: localPlayer.name,
            color: localPlayer.color,
            shape: localPlayer.shape,
            isMicOn: micEnabled,
            isVideoOn: videoEnabled,
            isScreenSharing: screenShareEnabled,
            isSpeaking: isSpeaker,
            lastReaction: localReaction?.emoji,
            lastReactionTs: localReaction?.ts
        };
        const remoteUsers = Object.values(peers).map((p: any) => ({ ...p, isLocal: false }));
        return [localUser, ...remoteUsers];
    }, [localPlayer, peers, micEnabled, videoEnabled, screenShareEnabled, isSpeaker, localReaction]);

    const sortedUsers = useMemo(() => {
        return [...allUsers].sort((a, b) => {
            if (pinnedUserId) {
                if (a.id === pinnedUserId) return -1;
                if (b.id === pinnedUserId) return 1;
            }
            if (a.isScreenSharing && !b.isScreenSharing) return -1;
            if (b.isScreenSharing && !a.isScreenSharing) return 1;
            if (a.isSpeaking && !b.isSpeaking) return -1;
            if (b.isSpeaking && !a.isSpeaking) return 1;
            return a.id.localeCompare(b.id);
        });
    }, [allUsers, pinnedUserId]);

    const totalUsers = sortedUsers.length;

    // --- RESPONSIVE GRID LAYOUT FIX ---
    // Added 'h-full items-center content-center' to ensure vertical centering
    // For landscape mobile: 'landscape:grid-cols-2'
    // 'min-h-0' is crucial for flex/grid children to shrink properly in landscape
    let gridClass = '';
    if (totalUsers === 1) {
        gridClass = 'flex justify-center items-center h-full w-full max-w-md mx-auto'; 
    } else if (totalUsers === 2) {
        gridClass = 'grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 gap-4 h-full w-full max-w-6xl mx-auto items-center content-center min-h-0';
    } else {
        gridClass = 'grid grid-cols-2 landscape:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 h-full w-full max-w-7xl mx-auto content-center min-h-0';
    }

    const handleCopyLink = () => {
        if (activeRoomId) {
            navigator.clipboard.writeText(`${window.location.origin}?room=${activeRoomId}`);
            alert(t('copy_id'));
        }
    };

    return (
        <group>
            {/* REACTIVE PLASMA BACKGROUND */}
            <mesh position={[0, 0, -10]}>
                <planeGeometry args={[100, 100]} />
                <shaderMaterial 
                    ref={shaderRef}
                    args={[PlasmaMaterial]} 
                    side={THREE.DoubleSide} 
                    depthTest={false} 
                    depthWrite={false} 
                />
            </mesh>
            
            {/* Z-Index 0 Ensures UI (z-40) stays on top */}
            <Html fullscreen style={{ pointerEvents: 'none' }} zIndexRange={[0, 0]}>
                <div className="w-full h-full p-4 md:p-6 pb-32 pointer-events-auto overflow-hidden flex flex-col">
                    
                    {/* Non-intrusive "Waiting" UI */}
                    {totalUsers === 1 && (
                        <div className="w-full flex justify-center mb-6 animate-fade-in absolute top-20 left-0 right-0 z-50 pointer-events-none">
                            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-full pl-6 pr-2 py-2 flex items-center gap-4 shadow-xl pointer-events-auto">
                                <span className="text-white font-bold text-sm">Waiting for others...</span>
                                <button 
                                    onClick={handleCopyLink}
                                    className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gray-200 transition flex items-center gap-2"
                                >
                                    <ClipboardDocumentIcon className="w-3 h-3" />
                                    <span>Copy Link</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* VIDEO GRID */}
                    <div className={`flex-1 w-full ${gridClass} transition-all duration-500 ease-in-out`}>
                        {sortedUsers.map((u, index) => {
                            const isHero = (pinnedUserId && index === 0) || (totalUsers >= 3 && index === 0 && !pinnedUserId); 
                            const heroClasses = isHero ? 'col-span-2 row-span-2 md:col-span-2 md:row-span-2' : '';
                            let vStream = null;
                            let sStream = null;

                            if (u.isLocal) {
                                vStream = videoStream;
                                sStream = screenStream;
                            } else {
                                const streams = peerStreams[u.id];
                                vStream = streams?.video;
                                sStream = streams?.screen;
                            }

                            // Determine Audio Stream for Visualizer
                            const audioStream = u.isLocal ? micStream : (peerStreams[u.id]?.audio || null);

                            const isExpanded = expandedId === u.id;
                            
                            return (
                                <div key={u.id} className={`w-full transition-all duration-500 ${heroClasses} ${isExpanded ? '' : 'aspect-square min-h-0'}`}>
                                    <VideoTile 
                                        videoStream={vStream}
                                        screenStream={sStream}
                                        muted={u.isLocal || globalMute} 
                                        name={u.name}
                                        isLocal={u.isLocal}
                                        isMicOn={u.isMicOn}
                                        isVideoOn={u.isVideoOn}
                                        isScreenSharing={u.isScreenSharing}
                                        isSpeaking={u.isSpeaking}
                                        color={u.color}
                                        // @ts-ignore
                                        lastReaction={u.lastReaction}
                                        // @ts-ignore
                                        lastReactionTs={u.lastReactionTs}
                                        onPin={() => setPinnedUserId(pinnedUserId === u.id ? null : u.id)}
                                        isPinned={pinnedUserId === u.id}
                                        onExpand={() => setExpandedId(isExpanded ? null : u.id)}
                                        isExpanded={isExpanded}
                                        audioStream={audioStream} 
                                    />
                                    {!u.isLocal && peerStreams[u.id]?.audio && (
                                        <audio 
                                            autoPlay 
                                            muted={globalMute}
                                            ref={(el) => { if(el) el.srcObject = peerStreams[u.id]!.audio! }} 
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Html>
        </group>
    );
};
