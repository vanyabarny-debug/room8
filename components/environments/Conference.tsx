import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store';
import { audioSynth } from '../../services/AudioSynthesizer';
import { XMarkIcon, PlayIcon, PauseIcon, SpeakerWaveIcon, VideoCameraIcon } from '@heroicons/react/24/solid';

// --- CONSTANTS ---
const HALL_WIDTH = 40;
const HALL_LENGTH = 70;
const HALL_HEIGHT = 16;
const CORRIDOR_WIDTH = 10;
const CORRIDOR_LENGTH = 35; 

const LIGHT_COLORS = [
    '#ff0000', '#ffa500', '#ffff00', '#008000', '#0000ff', '#4b0082', '#ee82ee'
];

// Banner Positions
const BANNER_POSITIONS = [
    { pos: [-4.9, 4, -20], rot: [0, Math.PI/2, 0], scale: [3, 5, 1], id: 0 },
    { pos: [4.9, 4, -20], rot: [0, -Math.PI/2, 0], scale: [3, 5, 1], id: 1 },
    { pos: [-19.5, 6, 10], rot: [0, Math.PI/2, 0], scale: [6, 9, 1], id: 2 },
    { pos: [19.5, 6, 10], rot: [0, -Math.PI/2, 0], scale: [6, 9, 1], id: 3 },
    { pos: [-19.5, 6, 30], rot: [0, Math.PI/2, 0], scale: [6, 9, 1], id: 4 },
    { pos: [19.5, 6, 30], rot: [0, -Math.PI/2, 0], scale: [6, 9, 1], id: 5 },
    { pos: [-19.5, 6, 50], rot: [0, Math.PI/2, 0], scale: [6, 9, 1], id: 6 },
    { pos: [19.5, 6, 50], rot: [0, -Math.PI/2, 0], scale: [6, 9, 1], id: 7 },
];

export const isConferenceObstacle = (x: number, z: number) => {
    const inCorridor = x > -5 && x < 5 && z > -35 && z <= 0;
    const inHall = x > -20 && x < 20 && z > 0 && z < 70;
    
    // Doorway Walls at Z=0
    if (z > -0.5 && z < 0.5 && (x > 3 || x < -3)) return true;

    if (!inCorridor && !inHall) return true;

    // Tribune
    if (z > 57.5 && z < 59.5 && Math.abs(x) < 2.5) return true;

    // Music Player Collision
    if (z > 58.5 && z < 61.5 && x > 14.5 && x < 17.5) return true;

    // Screen
    if (z > 63.5 && z < 65 && Math.abs(x) < 13) return true;

    // Chairs - Reduced collision radius for better sliding
    if (z > 4 && z < 46 && Math.abs(x) < 16) {
        const row = Math.round((z - 5) / 3);
        const col = Math.round(x / 2.5);
        const chairX = col * 2.5;
        const chairZ = 5 + row * 3;
        if (Math.abs(chairX) > 2.5) {
            const dx = x - chairX;
            const dz = z - chairZ;
            // Radius reduced to ~0.45 (0.45^2 = 0.2025)
            if (dx*dx + dz*dz < 0.2) return true; 
        }
    }
    return false;
};

export const getConferenceSeat = (px: number, pz: number) => {
    if (pz > 2 && pz < 48 && Math.abs(px) < 16) {
        const row = Math.round((pz - 5) / 3);
        const col = Math.round(px / 2.5);
        const sz = 5 + row * 3;
        const sx = col * 2.5;
        if (Math.abs(sx) > 2.5) {
            const dist = Math.sqrt((px - sx)**2 + (pz - sz)**2);
            if (dist < 1.2) return { x: sx, y: 0.5, z: sz, dist };
        }
    }
    return null;
};

// Chair with Shadows Enabled
const Chair: React.FC<{ position: [number, number, number] }> = ({ position }) => {
    return (
        <group position={position} rotation={[0, Math.PI, 0]}>
            {/* Seat */}
            <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.2, 0.15, 1.0]} />
                <meshStandardMaterial color="#7f1d1d" roughness={0.5} />
            </mesh>
            {/* Backrest */}
            <group position={[0, 0.95, 0.45]} rotation={[-0.15, 0, 0]}>
                <mesh castShadow receiveShadow>
                    <boxGeometry args={[1.2, 1.0, 0.1]} />
                    <meshStandardMaterial color="#7f1d1d" roughness={0.5} />
                </mesh>
            </group>
            {/* Armrests */}
            <mesh position={[-0.65, 0.7, 0]} castShadow>
                <boxGeometry args={[0.1, 0.05, 0.8]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[0.65, 0.7, 0]} castShadow>
                <boxGeometry args={[0.1, 0.05, 0.8]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            {/* Legs - Only draw main support to save draw calls visually if wanted, but boxes are cheap */}
            <mesh position={[-0.55, 0.2, 0]} castShadow>
                <boxGeometry args={[0.05, 0.4, 0.8]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0.55, 0.2, 0]} castShadow>
                <boxGeometry args={[0.05, 0.4, 0.8]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </group>
    );
};

const Banner: React.FC<{ data: typeof BANNER_POSITIONS[0] }> = ({ data }) => {
    const { conferenceState, setConferenceBanner } = useStore();
    const [showHint, setShowHint] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const textureUrl = conferenceState.banners[data.id];
    
    const [texture, setTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (textureUrl) {
            new THREE.TextureLoader().load(textureUrl, (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                setTexture(t);
            });
        }
    }, [textureUrl]);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const res = reader.result as string;
                setConferenceBanner(data.id, res);
            };
            reader.readAsDataURL(file);
        }
    };

    useFrame(() => {
        const playerPos = useStore.getState().gameRefs.localPlayerPosition;
        const dist = new THREE.Vector2(playerPos.x, playerPos.z).distanceTo(new THREE.Vector2(data.pos[0], data.pos[2]));
        setShowHint(dist < 6); 
    });

    useEffect(() => {
        const onInteract = (e: any) => {
            const pPos = e.detail.position;
            const dist = new THREE.Vector2(pPos.x, pPos.z).distanceTo(new THREE.Vector2(data.pos[0], data.pos[2]));
            if (dist < 6) fileInput.current?.click();
        };
        window.addEventListener('player-interact', onInteract);
        return () => window.removeEventListener('player-interact', onInteract);
    }, [data]);

    return (
        <group position={new THREE.Vector3(...(data.pos as [number, number, number]))} rotation={new THREE.Euler(...(data.rot as [number, number, number]))}>
            <mesh position={[0, 0, 0.05]} onClick={() => fileInput.current?.click()}>
                <planeGeometry args={new THREE.Vector3(...(data.scale as [number, number, number])).toArray() as [number, number, number]} />
                {texture ? (
                    <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
                ) : (
                    <meshStandardMaterial color="#1e293b" side={THREE.DoubleSide} roughness={0.8} />
                )}
            </mesh>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[data.scale[0] + 0.2, data.scale[1] + 0.2, 0.05]} />
                <meshStandardMaterial color="#000" />
            </mesh>
            
            {showHint && (
                <Html position={[0, -2.5, 0.5]} center transform>
                    <div className="bg-black/80 text-white text-sm px-3 py-1.5 rounded-full border border-white/20 whitespace-nowrap backdrop-blur-md animate-bounce pointer-events-none">
                        Press <span className="font-bold text-yellow-400">E</span> to Upload Banner
                    </div>
                </Html>
            )}
            <Html>
                <input type="file" ref={fileInput} className="hidden" accept="image/*" onChange={handleUpload} />
            </Html>
        </group>
    );
};

const MainScreen = () => {
    const { conferenceState, peers, screenStream, localPlayer, setConferenceScreenVideo, toggleConferenceVideoPause } = useStore();
    const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
    const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isViewingModal, setIsViewingModal] = useState(false);
    const [videoSize, setVideoSize] = useState<[number, number]>([24, 13.5]);
    const [volume, setVolume] = useState(1);
    const [showControls, setShowControls] = useState(false);

    const speakerId = Object.keys(peers).find(id => peers[id].isSpeaker) || (localPlayer.id && useStore.getState().isSpeaker ? localPlayer.id : null);
    
    // Logic to fit video
    const updateVideoSize = (vid: HTMLVideoElement) => {
        if (!vid.videoWidth || !vid.videoHeight) return;
        const MAX_WIDTH = 24; const MAX_HEIGHT = 13.5;
        const videoRatio = vid.videoWidth / vid.videoHeight;
        let w = MAX_WIDTH; let h = w / videoRatio;
        if (h > MAX_HEIGHT) { h = MAX_HEIGHT; w = h * videoRatio; }
        setVideoSize([w, h]);
    };

    useEffect(() => {
        let stream: MediaStream | null = null;
        if (speakerId) {
            if (speakerId === localPlayer.id && screenStream) {
                stream = screenStream;
            } else if (peers[speakerId]?.isScreenSharing) {
                const streams = useStore.getState().peerStreams[speakerId];
                if (streams?.screen) stream = streams.screen;
            }
        }

        if (stream) {
            setIsScreenSharing(true);
            const vid = videoRef.current;
            vid.srcObject = stream;
            vid.muted = false; 
            vid.volume = volume;
            vid.onloadedmetadata = () => { vid.play().catch(e => console.error(e)); updateVideoSize(vid); };
            setVideoTexture(new THREE.VideoTexture(vid));
        } else if (conferenceState.screenVideoUrl) {
            setIsScreenSharing(false);
            const vid = videoRef.current;
            if (vid.src !== conferenceState.screenVideoUrl) {
                vid.src = conferenceState.screenVideoUrl;
                vid.crossOrigin = 'Anonymous';
                vid.loop = true;
            }
            vid.muted = false; 
            vid.volume = volume;
            vid.onloadedmetadata = () => { if (!conferenceState.screenVideoPaused) vid.play().catch(e => console.error(e)); updateVideoSize(vid); };
            setVideoTexture(new THREE.VideoTexture(vid));
        } else {
            setIsScreenSharing(false);
            setVideoTexture(null);
            setVideoSize([24, 13.5]); 
        }
    }, [speakerId, screenStream, conferenceState.screenVideoUrl, peers]);

    useEffect(() => {
        if (!isScreenSharing && conferenceState.screenVideoUrl && videoRef.current) {
            if (conferenceState.screenVideoPaused) videoRef.current.pause();
            else videoRef.current.play().catch(console.error);
        }
    }, [conferenceState.screenVideoPaused, isScreenSharing, conferenceState.screenVideoUrl]);

    useEffect(() => { if (videoRef.current) videoRef.current.volume = volume; }, [volume]);

    useFrame(() => {
        const playerPos = useStore.getState().gameRefs.localPlayerPosition;
        setShowControls(playerPos.z > 40 && Math.abs(playerPos.x) < 20);
    });

    const handleClick = (e: any) => {
        e.stopPropagation();
        if (conferenceState.screenVideoUrl || isScreenSharing) setIsViewingModal(true);
    }

    return (
        <group>
            <group position={[0, 8, 64]} rotation={[0, Math.PI, 0]}>
                <mesh position={[0, 0, 0.1]} onClick={handleClick}>
                    <planeGeometry args={[videoSize[0], videoSize[1]]} />
                    {videoTexture ? (
                        <meshBasicMaterial map={videoTexture} toneMapped={false} side={THREE.DoubleSide} />
                    ) : (
                        <meshStandardMaterial color="#111" side={THREE.DoubleSide} />
                    )}
                </mesh>
                
                {/* Interaction Plane - Invisible but strict raycast target */}
                <mesh position={[0, 0, 0.2]} visible={false} onClick={handleClick}>
                    <planeGeometry args={[24.5, 14]} />
                </mesh>

                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[24.5, 14, 0.1]} />
                    <meshStandardMaterial color="#000" emissive="#333" />
                </mesh>
                
                {!videoTexture && !isScreenSharing && (
                    <Html position={[0, 0, 0.2]} center transform pointerEvents="none">
                        <div className="text-gray-500 text-lg font-mono opacity-50 flex flex-col items-center">
                            <div>NO SIGNAL</div>
                        </div>
                    </Html>
                )}

                {showControls && conferenceState.screenVideoUrl && !isScreenSharing && (
                    <Html position={[0, -7.5, 0]} center zIndexRange={[100, 0]}>
                        <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md p-2 rounded-xl border border-white/10 animate-fade-in shadow-xl pointer-events-auto">
                            <button onClick={(e) => { e.stopPropagation(); toggleConferenceVideoPause(!conferenceState.screenVideoPaused); }} className="p-2 hover:bg-white/10 rounded-full text-white transition">
                                {conferenceState.screenVideoPaused ? <PlayIcon className="w-5 h-5"/> : <PauseIcon className="w-5 h-5"/>}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setConferenceScreenVideo(null); }} className="p-2 hover:bg-red-500/20 rounded-full text-red-400 transition" title="Stop & Clear">
                                <XMarkIcon className="w-5 h-5"/>
                            </button>
                            <div className="w-px h-6 bg-white/20 mx-1"></div>
                            <SpeakerWaveIcon className="w-4 h-4 text-gray-400"/>
                            <input 
                                type="range" min="0" max="1" step="0.1" value={volume} 
                                onChange={(e) => setVolume(parseFloat(e.target.value))} 
                                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    </Html>
                )}
            </group>

            {isViewingModal && (
                <Html fullscreen style={{ zIndex: 9999 }}>
                    <div 
                        className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 cursor-pointer"
                        onClick={() => setIsViewingModal(false)}
                    >
                        <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full">
                            <XMarkIcon className="w-8 h-8" />
                        </button>
                        <div className="w-full max-w-7xl aspect-video bg-black rounded shadow-2xl flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
                            {conferenceState.screenVideoUrl ? (
                                <video src={conferenceState.screenVideoUrl} autoPlay loop controls className="w-full h-full object-contain" />
                            ) : (
                                <div className="text-white">Live Stream Active</div>
                            )}
                        </div>
                    </div>
                </Html>
            )}
        </group>
    );
};

const MusicPlayer = () => {
    const { conferenceState, setConferenceMusic, toggleConferenceMusicPause } = useStore();
    const { camera } = useThree();
    const [showHint, setShowHint] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [volume, setVolume] = useState(0.5);

    // Context Refs
    const ctxRef = useRef<AudioContext | null>(null);
    const nodesRef = useRef<{ source: MediaElementAudioSourceNode, panner: PannerNode, filter: BiquadFilterNode, gain: GainNode } | null>(null);

    // Initialize Audio Graph Once
    useEffect(() => {
        if (!audioRef.current || ctxRef.current) return;

        const initAudio = () => {
            if (ctxRef.current) return;
            try {
                const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
                const ctx = new AudioContextClass();
                ctxRef.current = ctx;

                const source = ctx.createMediaElementSource(audioRef.current!);
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter(); // For Lowpass in Corridor
                const panner = ctx.createPanner();

                // Panner Config
                panner.panningModel = 'HRTF';
                panner.distanceModel = 'exponential';
                panner.refDistance = 10;
                panner.maxDistance = 100;
                panner.rolloffFactor = 1;
                // Position of Speaker: 16, 1.5, 60
                panner.positionX.value = 16;
                panner.positionY.value = 1.5;
                panner.positionZ.value = 60;

                // Filter Config (Default Open)
                filter.type = 'lowpass';
                filter.frequency.value = 20000;

                // Graph: Source -> Gain -> Filter -> Panner -> Out
                source.connect(gain);
                gain.connect(filter);
                filter.connect(panner);
                panner.connect(ctx.destination);

                nodesRef.current = { source, gain, filter, panner };
            } catch (e) {
                console.warn("Audio init failed", e);
            }
        };

        // Initialize on first user interaction to satisfy browser policies
        const handleUserGesture = () => {
            initAudio();
            if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
            window.removeEventListener('click', handleUserGesture);
            window.removeEventListener('keydown', handleUserGesture);
        };

        window.addEventListener('click', handleUserGesture);
        window.addEventListener('keydown', handleUserGesture);

        return () => {
            window.removeEventListener('click', handleUserGesture);
            window.removeEventListener('keydown', handleUserGesture);
            if (ctxRef.current) ctxRef.current.close();
        };
    }, []);

    // 3D & Muffling Update Loop
    useFrame(() => {
        if (!ctxRef.current || !nodesRef.current) return;

        // 1. Update Listener (Camera)
        // Note: In R3F, camera position is world position.
        const listener = ctxRef.current.listener;
        const camPos = camera.position;
        const camQuat = camera.quaternion;
        
        // Setup listener orientation vectors
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camQuat);

        if (listener.positionX) {
            listener.positionX.value = camPos.x;
            listener.positionY.value = camPos.y;
            listener.positionZ.value = camPos.z;
            listener.forwardX.value = forward.x;
            listener.forwardY.value = forward.y;
            listener.forwardZ.value = forward.z;
            listener.upX.value = up.x;
            listener.upY.value = up.y;
            listener.upZ.value = up.z;
        } else {
            // Safari/Old Chrome
            listener.setPosition(camPos.x, camPos.y, camPos.z);
            listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
        }

        // 2. Muffling Logic (Corridor vs Hall)
        // Speaker is at Z=60. Hall starts at Z=0. Corridor is Z < 0.
        // If player is in Corridor (Z < 0), muffle sound.
        const distIntoCorridor = camPos.z < 0 ? Math.abs(camPos.z) : 0;
        
        // Target Frequency: 20000 (Open) -> 400 (Muffled)
        const targetFreq = camPos.z > 0 ? 20000 : Math.max(400, 5000 - (distIntoCorridor * 500));
        
        // Smooth transition
        nodesRef.current.filter.frequency.setTargetAtTime(targetFreq, ctxRef.current.currentTime, 0.1);
    });

    // Sync State
    useEffect(() => {
        if (audioRef.current) {
            if (conferenceState.backgroundMusicUrl && audioRef.current.src !== conferenceState.backgroundMusicUrl) {
                audioRef.current.src = conferenceState.backgroundMusicUrl;
                audioRef.current.crossOrigin = "anonymous";
            }
            
            if (nodesRef.current && ctxRef.current) {
                nodesRef.current.gain.gain.setTargetAtTime(volume, ctxRef.current.currentTime, 0.1);
            } else {
                audioRef.current.volume = volume;
            }

            if (conferenceState.backgroundMusicUrl && !conferenceState.backgroundMusicPaused) {
                audioRef.current.play().catch(() => {});
            } else {
                audioRef.current.pause();
            }
        }
    }, [conferenceState.backgroundMusicUrl, conferenceState.backgroundMusicPaused, volume]);

    const handleUploadMusic = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setConferenceMusic(URL.createObjectURL(file));
    };

    useFrame(() => {
        const playerPos = useStore.getState().gameRefs.localPlayerPosition;
        setShowHint(playerPos.z > 58 && playerPos.x > 14 && playerPos.x < 18);
    });

    useEffect(() => {
        const onInteract = (e: any) => {
            const pPos = e.detail.position;
            if (pPos.z > 58 && pPos.x > 14 && pPos.x < 18) fileInput.current?.click();
        };
        window.addEventListener('player-interact', onInteract);
        return () => window.removeEventListener('player-interact', onInteract);
    }, []);

    return (
        <group position={[16, 0.5, 60]} rotation={[0, Math.PI, 0]}>
            <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.5, 3, 1.5]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[0, 1.5, 0.8]}>
                <circleGeometry args={[0.6, 32]} />
                <meshStandardMaterial color="#444" />
            </mesh>
            <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.5, 3]} />
                <meshStandardMaterial color="#111" />
            </mesh>

            {conferenceState.backgroundMusicUrl && !conferenceState.backgroundMusicPaused && (
                <Sparkles count={10} scale={[2, 4, 2]} position={[0, 3, 0]} speed={0.5} size={5} color="#00ff00" />
            )}

            {showHint && (
                <Html position={[0, 2, 0]} center zIndexRange={[100, 0]}>
                     <div className="flex flex-col gap-2 items-center">
                        <div className="bg-black/80 text-white text-sm px-3 py-1.5 rounded-full border border-white/20 whitespace-nowrap backdrop-blur-md animate-bounce pointer-events-none">
                            Press <span className="font-bold text-purple-400">E</span> to DJ
                        </div>
                        {conferenceState.backgroundMusicUrl && (
                            <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-xl pointer-events-auto">
                                <button onClick={(e) => { e.stopPropagation(); toggleConferenceMusicPause(!conferenceState.backgroundMusicPaused); }} className="p-2 hover:bg-white/10 rounded-full text-white transition">
                                    {conferenceState.backgroundMusicPaused ? <PlayIcon className="w-4 h-4"/> : <PauseIcon className="w-4 h-4"/>}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setConferenceMusic(null); }} className="p-2 hover:bg-red-500/20 rounded-full text-red-400 transition">
                                    <XMarkIcon className="w-4 h-4"/>
                                </button>
                                <div className="w-px h-6 bg-white/20 mx-1"></div>
                                <SpeakerWaveIcon className="w-3 h-3 text-gray-400"/>
                                <input 
                                    type="range" min="0" max="1" step="0.1" value={volume} 
                                    onChange={(e) => setVolume(parseFloat(e.target.value))} 
                                    className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                                    onPointerDown={(e) => e.stopPropagation()}
                                />
                            </div>
                        )}
                    </div>
                </Html>
            )}
            
            <Html>
                <input type="file" ref={fileInput} className="hidden" accept="audio/*" onChange={handleUploadMusic} />
                <audio ref={audioRef} loop crossOrigin="anonymous" />
            </Html>
        </group>
    );
};

const Tribune = () => {
    const { isSpeaker, setSpeaker, conferenceState, setConferenceLightColor, setConferenceScreenVideo } = useStore();
    const [showHint, setShowHint] = useState(false);
    const videoInput = useRef<HTMLInputElement>(null);

    const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setConferenceScreenVideo(URL.createObjectURL(file));
    };

    useFrame(() => {
        const playerPos = useStore.getState().gameRefs.localPlayerPosition;
        setShowHint(playerPos.z > 53 && playerPos.z < 63 && Math.abs(playerPos.x) < 5);
    });

    useEffect(() => {
        const onInteract = (e: any) => {
            const pPos = e.detail.position;
            if (pPos.z > 53 && pPos.z < 63 && Math.abs(pPos.x) < 5) {
                if (Math.abs(pPos.x) < 2) {
                    setSpeaker(!useStore.getState().isSpeaker);
                    audioSynth.playUiSuccess();
                }
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            const playerPos = useStore.getState().gameRefs.localPlayerPosition;
            if (playerPos.z > 53 && playerPos.z < 63 && Math.abs(playerPos.x) < 5) {
                if (e.code === 'KeyL') {
                    const currIdx = LIGHT_COLORS.indexOf(conferenceState.lightColor);
                    const nextColor = LIGHT_COLORS[(currIdx + 1) % LIGHT_COLORS.length];
                    setConferenceLightColor(nextColor);
                    audioSynth.playUiClick();
                }
                if (e.code === 'KeyV') videoInput.current?.click();
            }
        };

        window.addEventListener('player-interact', onInteract);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('player-interact', onInteract);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [conferenceState.lightColor]);

    const teleportToPodium = (e: any) => {
        e.stopPropagation();
        const teleportEvent = new CustomEvent('teleport-to', { detail: [0, 1.5, 59] });
        window.dispatchEvent(teleportEvent);
        
        // Also trigger look at audience (handled by setting rotation in teleport handler if needed, 
        // or we can manually set it here via store ref if we exposed it, but standard teleport
        // just moves position. User can turn.)
        // Actually, let's force rotation via a small hack or just let user turn.
        // For now, position is key.
    };

    return (
        <group position={[0, 0, 58]}>
            <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[4, 3, 2]} />
                <meshStandardMaterial color="#111" roughness={0.2} />
            </mesh>
            
            {/* Stand Here Button */}
            <group position={[0, 3.02, 0.5]} onClick={teleportToPodium} onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = 'auto'}>
                <mesh>
                    <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
                    <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} />
                </mesh>
                <Html position={[0, 0.2, 0]} center transform pointerEvents="none">
                    <div className="text-[8px] font-bold text-black bg-green-400 px-1 rounded whitespace-nowrap">STAND</div>
                </Html>
            </group>

            <mesh position={[0, 3.2, 0.5]} rotation={[0.5, 0, 0]} castShadow>
                <cylinderGeometry args={[0.02, 0.02, 1]} />
                <meshStandardMaterial color="#888" />
            </mesh>
            <mesh position={[0, 3.01, 0]}>
                <boxGeometry args={[0.5, 0.1, 0.5]} />
                <meshStandardMaterial color={isSpeaker ? "#ff0000" : "#333"} emissive={isSpeaker ? "#ff0000" : "#000"} emissiveIntensity={5} />
            </mesh>
            <mesh position={[1, 3.01, 0]}>
                <boxGeometry args={[0.5, 0.1, 0.5]} />
                <meshStandardMaterial color={conferenceState.lightColor} emissive={conferenceState.lightColor} emissiveIntensity={5} />
            </mesh>

            {showHint && (
                <Html position={[0, 2, 0]} center zIndexRange={[100, 0]}>
                    <div className="flex flex-col gap-1 items-center pointer-events-none">
                        <div className="flex gap-2">
                            <span className="bg-black/70 text-white text-xs px-2 py-1 rounded border border-white/20">E: {isSpeaker ? 'Mute' : 'Broadcast'}</span>
                            <span className="bg-black/70 text-white text-xs px-2 py-1 rounded border border-white/20">L: Lights</span>
                        </div>
                        <span className="bg-black/70 text-white text-xs px-2 py-1 rounded border border-white/20">V: Upload Video</span>
                    </div>
                </Html>
            )}
            <Html>
                <input type="file" ref={videoInput} className="hidden" accept="video/*" onChange={handleUploadVideo} />
            </Html>
        </group>
    );
};

export const ConferenceScene = () => {
    const { conferenceState } = useStore();

    // Calculate Chair Positions Once
    const chairs = useMemo(() => {
        const arr = [];
        for (let z = 5; z < 45; z += 3) {
            for (let x = -15; x <= 15; x += 2.5) {
                if (Math.abs(x) > 2.5) { 
                    arr.push([x, 0, z] as [number, number, number]);
                }
            }
        }
        return arr;
    }, []);

    // Sanitize Light Array to avoid "Text is not allowed"
    const ceilingLights = useMemo(() => {
        return Array.from({ length: 4 }).map((_, i) => {
            const z = i * 15;
            return (
                <group key={z}>
                    {/* Main Light */}
                    <pointLight position={[0, 14, z]} intensity={0.5} distance={40} color={conferenceState.lightColor} />
                    {/* Fake Fill Lights */}
                    <pointLight position={[-12, 14, z]} intensity={0.2} distance={20} color={conferenceState.lightColor} />
                    <pointLight position={[12, 14, z]} intensity={0.2} distance={20} color={conferenceState.lightColor} />
                </group>
            );
        });
    }, [conferenceState.lightColor]);

    return (
        <group>
            {/* CORRIDOR */}
            <group position={[0, HALL_HEIGHT/2, -17.5]}>
                <mesh position={[0, -HALL_HEIGHT/2, 0]} receiveShadow>
                    <boxGeometry args={[CORRIDOR_WIDTH, 0.2, CORRIDOR_LENGTH]} />
                    <meshStandardMaterial color="#1a1a1a" />
                </mesh>
                <mesh position={[0, HALL_HEIGHT/2, 0]}>
                    <boxGeometry args={[CORRIDOR_WIDTH, 0.2, CORRIDOR_LENGTH]} />
                    <meshStandardMaterial color="#111" />
                </mesh>
                <mesh position={[-CORRIDOR_WIDTH/2, 0, 0]}>
                    <boxGeometry args={[0.2, HALL_HEIGHT, CORRIDOR_LENGTH]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
                <mesh position={[CORRIDOR_WIDTH/2, 0, 0]}>
                    <boxGeometry args={[0.2, HALL_HEIGHT, CORRIDOR_LENGTH]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
                <mesh position={[0, 0, -CORRIDOR_LENGTH/2]}>
                    <boxGeometry args={[CORRIDOR_WIDTH, HALL_HEIGHT, 0.5]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
            </group>

            {/* DOOR */}
            <group position={[0, 0, 0]}>
                <mesh position={[-HALL_WIDTH/4 - 1.5, HALL_HEIGHT/2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[HALL_WIDTH/2 - 3, HALL_HEIGHT, 1]} />
                    <meshStandardMaterial color="#111" />
                </mesh>
                <mesh position={[HALL_WIDTH/4 + 1.5, HALL_HEIGHT/2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[HALL_WIDTH/2 - 3, HALL_HEIGHT, 1]} />
                    <meshStandardMaterial color="#111" />
                </mesh>
                <mesh position={[0, 12, 0]} castShadow>
                    <boxGeometry args={[6, 8, 1]} />
                    <meshStandardMaterial color="#111" />
                </mesh>
                <mesh position={[-3.5, 4, 0]}>
                    <boxGeometry args={[3, 8, 0.1]} />
                    <meshStandardMaterial color="#88ccff" transparent opacity={0.3} metalness={0.9} roughness={0} />
                </mesh>
                <mesh position={[3.5, 4, 0]}>
                    <boxGeometry args={[3, 8, 0.1]} />
                    <meshStandardMaterial color="#88ccff" transparent opacity={0.3} metalness={0.9} roughness={0} />
                </mesh>
            </group>

            {/* MAIN HALL */}
            <group position={[0, HALL_HEIGHT/2, 35]}>
                <mesh position={[0, -HALL_HEIGHT/2, 0]} receiveShadow>
                    <boxGeometry args={[HALL_WIDTH, 0.2, HALL_LENGTH]} />
                    <meshStandardMaterial color="#0f172a" roughness={1} />
                </mesh>
                <mesh position={[0, HALL_HEIGHT/2, 0]}>
                    <boxGeometry args={[HALL_WIDTH, 0.2, HALL_LENGTH]} />
                    <meshStandardMaterial color="#111" />
                </mesh>
                <mesh position={[-HALL_WIDTH/2, 0, 0]} receiveShadow>
                    <boxGeometry args={[0.2, HALL_HEIGHT, HALL_LENGTH]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
                <mesh position={[HALL_WIDTH/2, 0, 0]} receiveShadow>
                    <boxGeometry args={[0.2, HALL_HEIGHT, HALL_LENGTH]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
                <mesh position={[0, 0, HALL_LENGTH/2]}>
                    <boxGeometry args={[HALL_WIDTH, HALL_HEIGHT, 0.2]} />
                    <meshStandardMaterial color="#000" />
                </mesh>
                <mesh position={[0, -HALL_HEIGHT/2 + 1, HALL_LENGTH/2 - 5]} receiveShadow>
                    <boxGeometry args={[30, 2, 10]} />
                    <meshStandardMaterial color="#000" roughness={0.1} />
                </mesh>
            </group>

            {/* LIGHTING */}
            <ambientLight intensity={0.15} color="#ffffff" />
            <pointLight position={[0, 7, -30]} intensity={0.2} distance={15} color="#fff" />
            <pointLight position={[0, 7, -10]} intensity={0.2} distance={15} color="#fff" />
            {ceilingLights}

            {/* Simulated Glow - Intensified via Power */}
            <rectAreaLight position={[-19.8, HALL_HEIGHT/2, 35]} width={70} height={16} color={conferenceState.lightColor} intensity={50} rotation={[0, -Math.PI/2, 0]} />
            <rectAreaLight position={[19.8, HALL_HEIGHT/2, 35]} width={70} height={16} color={conferenceState.lightColor} intensity={50} rotation={[0, Math.PI/2, 0]} />
            
            {/* SHADOW CASTING LIGHT - Directional for cleaner shadows across hall */}
            <directionalLight 
                position={[20, 30, 10]} 
                target-position={[0, 0, 40]}
                intensity={1.0} 
                castShadow 
                shadow-mapSize={[4096, 4096]}
                shadow-bias={-0.0005}
                shadow-camera-left={-40}
                shadow-camera-right={40}
                shadow-camera-top={40}
                shadow-camera-bottom={-40}
            />

            {/* PROPS */}
            {chairs.map((pos, i) => <Chair key={i} position={pos} />)}
            {BANNER_POSITIONS.map((data) => <Banner key={data.id} data={data} />)}
            
            <MainScreen />
            <Tribune />
            <MusicPlayer />

        </group>
    );
};