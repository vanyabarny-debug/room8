import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useStore } from '../../store';
import { COLORS, SHAPES, LANGUAGES } from '../../constants';
import { FaceCapture } from '../Utils/FaceCapture';
import { audioSynth } from '../../services/AudioSynthesizer';
import { Environment } from '@react-three/drei';
import { SouthParkHead } from '../World/SouthParkHead';

// Preview Component for the Lobby
const AvatarPreview = ({ settings }: { settings: any }) => {
  return (
    <group position={[0, -1, 0]}>
       <mesh position={[0, 0.5, 0]}>
             {settings.shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
             {settings.shape === 'sphere' && <sphereGeometry args={[0.6, 32, 32]} />}
             {settings.shape === 'cone' && <coneGeometry args={[0.6, 1.2, 32]} />}
             {settings.shape === 'cylinder' && <cylinderGeometry args={[0.6, 0.6, 1, 32]} />}
             <meshStandardMaterial color={settings.color} />
             {settings.faceTexture && (
                 <SouthParkHead 
                    faceTexture={settings.faceTexture} 
                    isSpeaking={true} // Animate in preview
                    splitRatio={settings.faceSplitRatio}
                 />
             )}
       </mesh>
       <hemisphereLight intensity={0.5} groundColor="black" />
       <directionalLight position={[5, 5, 5]} intensity={1} />
       <Environment preset="city" />
    </group>
  );
};

export const Lobby: React.FC = () => {
  const { settings, setSettings, joinRoom, setLocalStream } = useStore();
  const [roomId, setRoomInput] = useState('room9-lobby');
  const [tab, setTab] = useState<'profile' | 'room'>('profile');

  const handleStart = async () => {
    audioSynth.playConnect();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
    } catch (e) {
      console.warn("No mic access", e);
    }
    joinRoom(roomId);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col md:flex-row bg-dark-950 text-white overflow-hidden">
      
      {/* LEFT: 3D Preview Hero */}
      <div className="w-full md:w-1/2 h-[40vh] md:h-full relative bg-gradient-to-br from-dark-900 to-dark-800">
         <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
         <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
             <Suspense fallback={null}>
                 <AvatarPreview settings={settings} />
             </Suspense>
         </Canvas>
         <div className="absolute bottom-6 left-6">
            <h1 className="font-display text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple tracking-tighter">
                ROOM9
            </h1>
            <p className="font-sans text-neon-blue/60 tracking-[0.2em] text-sm mt-2">P2P METAVERSE</p>
         </div>
      </div>

      {/* RIGHT: Controls */}
      <div className="w-full md:w-1/2 h-[60vh] md:h-full flex flex-col p-6 md:p-12 overflow-y-auto bg-dark-950/90 backdrop-blur-sm border-l border-white/5">
         
         {/* Navigation Tabs */}
         <div className="flex gap-6 mb-8 border-b border-white/10 pb-2">
            <button 
                onClick={() => setTab('profile')}
                className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${tab === 'profile' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-gray-500 hover:text-white'}`}
            >
                01 // Identity
            </button>
            <button 
                onClick={() => setTab('room')}
                className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${tab === 'room' ? 'text-neon-green border-b-2 border-neon-green' : 'text-gray-500 hover:text-white'}`}
            >
                02 // Connection
            </button>
         </div>

         {/* TAB: Profile */}
         {tab === 'profile' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Nickname */}
                <div className="space-y-2">
                    <label className="text-xs uppercase text-gray-400 font-bold">Codename</label>
                    <input 
                        value={settings.nickname}
                        onChange={(e) => setSettings({ nickname: e.target.value })}
                        className="w-full bg-dark-800 border border-white/10 rounded p-3 text-lg font-display focus:border-neon-blue outline-none transition-colors"
                        placeholder="ENTER_NAME"
                    />
                </div>

                {/* Face Capture */}
                <div className="space-y-2">
                    <label className="text-xs uppercase text-gray-400 font-bold">Face Data</label>
                    <FaceCapture 
                        onCapture={(f) => setSettings({ faceTexture: f })} 
                        onSplitChange={(v) => setSettings({ faceSplitRatio: v })}
                        initialSplit={settings.faceSplitRatio}
                    />
                </div>

                {/* Appearance */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs uppercase text-gray-400 font-bold">Form Factor</label>
                        <div className="grid grid-cols-2 gap-2">
                            {SHAPES.map(s => (
                                <button 
                                    key={s.type}
                                    onClick={() => { audioSynth.playClick(); setSettings({ shape: s.type }) }}
                                    className={`h-10 rounded border transition-all ${settings.shape === s.type ? 'border-neon-blue bg-neon-blue/20' : 'border-white/10 bg-dark-800 hover:bg-dark-700'}`}
                                >
                                    <span className="text-[10px] uppercase">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs uppercase text-gray-400 font-bold">Signal Color</label>
                        <div className="grid grid-cols-4 gap-2">
                            {COLORS.slice(0, 8).map(c => (
                                <button 
                                    key={c}
                                    onClick={() => { audioSynth.playClick(); setSettings({ color: c }) }}
                                    className={`h-8 rounded-full border-2 transition-transform hover:scale-110 ${settings.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => setTab('room')}
                    className="w-full py-4 bg-white/5 border border-white/10 hover:bg-neon-blue hover:text-black hover:border-transparent transition-all font-display font-bold text-lg rounded"
                >
                    CONFIRM IDENTITY
                </button>
             </div>
         )}

         {/* TAB: Room */}
         {tab === 'room' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                    <label className="text-xs uppercase text-gray-400 font-bold">Target Coordinates (Room ID)</label>
                    <input 
                        value={roomId}
                        onChange={(e) => setRoomInput(e.target.value)}
                        className="w-full bg-dark-800 border border-white/10 rounded p-3 text-lg font-mono text-neon-green focus:border-neon-green outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs uppercase text-gray-400 font-bold">Region Region</label>
                    <select 
                        value={settings.language}
                        onChange={(e) => setSettings({ language: e.target.value })}
                        className="w-full bg-dark-800 border border-white/10 rounded p-3 text-sm focus:border-neon-blue outline-none"
                    >
                        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                </div>

                <div className="pt-8">
                     <button 
                        onClick={handleStart}
                        className="w-full py-4 bg-gradient-to-r from-neon-blue to-neon-purple text-white font-display font-bold text-xl rounded shadow-[0_0_30px_rgba(188,19,254,0.4)] hover:shadow-[0_0_50px_rgba(0,243,255,0.6)] transition-all transform hover:-translate-y-1"
                    >
                        JACK IN
                    </button>
                </div>
             </div>
         )}

      </div>
    </div>
  );
};