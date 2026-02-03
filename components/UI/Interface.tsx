
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { PlayerState, RoomConfig } from '../../types';
import { MicrophoneIcon, SpeakerWaveIcon, ComputerDesktopIcon, ArrowRightOnRectangleIcon, XMarkIcon, CheckIcon, Cog6ToothIcon, EyeSlashIcon, ClipboardDocumentIcon, BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { MicrophoneIcon as MicOff, SpeakerXMarkIcon, ComputerDesktopIcon as ScreenOff, BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline';
import { AudioVisualizer } from './AudioVisualizer';
import { DEFAULT_REACTIONS, TRANSLATIONS } from '../../constants';
import { audioSynth } from '../../services/AudioSynthesizer';

const ControlBtn = ({ 
  active, 
  onClick, 
  icon: Icon, 
  offIcon: OffIcon, 
  label, 
  activeColor = "text-white", 
  customClass = "", 
  extra 
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  offIcon?: React.ElementType;
  label: string;
  activeColor?: string;
  customClass?: string;
  extra?: React.ReactNode;
}) => {
  const TheIcon = active ? Icon : (OffIcon || Icon);
  
  return (
    <div className="relative group flex flex-col items-center">
      <button
        onClick={onClick}
        className={`p-3 rounded-md transition-all duration-200 border border-transparent flex items-center justify-center
        ${active ? `bg-white/10 ${activeColor} border-white/20` : `text-gray-400 hover:text-white hover:bg-white/5 ${customClass}`}
        hover:scale-105 active:scale-95 relative overflow-hidden`}
        title={label}
      >
        <TheIcon className="w-6 h-6" />
        {extra}
      </button>
      <span className="text-[10px] text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-full whitespace-nowrap pointer-events-none">
        {label}
      </span>
    </div>
  );
};

export const Interface = () => {
  const { 
    activeRoomId, rooms, leaveRoom, peers, friends,
    micEnabled, toggleMic, micStream,
    audioEnabled, toggleAudio,
    screenShareEnabled, startScreenShare, stopScreenShare, screenStream,
    cinemaMode, setCinemaMode,
    incomingTeleport, respondToTeleport, requestTeleport,
    setControls,
    triggerReaction,
    selectedMicId, selectedSpeakerId, setAudioDevice,
    toggleRoomSubscription, localPlayer, language
  } = useStore();

  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const cinemaVideoRef = useRef<HTMLVideoElement>(null);

  const room = activeRoomId ? rooms[activeRoomId] : null;
  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;

  // Helper for dynamic room translation
  const getRoomName = (room: RoomConfig) => {
    if (room.isOfficial) {
        if (room.type === 'nature') return t('room_nature_title');
        if (room.type === 'space') return t('room_space_title');
        if (room.type === 'minimal') return t('room_minimal_title');
    }
    return room.name;
  };

  const getRoomDesc = (room: RoomConfig) => {
    if (room.isOfficial) {
        if (room.type === 'nature') return t('room_nature_desc');
        if (room.type === 'space') return t('room_space_desc');
        if (room.type === 'minimal') return t('room_minimal_desc');
    }
    return room.description;
  };

  // Fetch Devices on Open Settings
  useEffect(() => {
    if (showSettingsModal) {
        navigator.mediaDevices.enumerateDevices().then(setDevices);
    }
  }, [showSettingsModal]);

  // Mobile Touch Logic
  const handleTouchMove = (e: React.TouchEvent, side: 'left' | 'right') => {
      const touch = e.touches[0];
      const { innerHeight, innerWidth } = window;
      const { clientX, clientY } = touch;
      
      if (side === 'left') {
          const startY = innerHeight / 2;
          const deltaY = (startY - clientY) / (innerHeight / 4); 
          const forward = Math.max(-1, Math.min(1, deltaY));
          setControls({ forward });
      } else {
          const startX = (innerWidth / 4) * 3;
          const deltaX = (clientX - startX) / (innerWidth / 4);
          const turn = Math.max(-1, Math.min(1, deltaX));
          setControls({ turn });
      }
  };

  const handleTouchEnd = () => {
      setControls({ forward: 0, turn: 0 });
  };

  useEffect(() => {
    if (screenShareEnabled && screenStream && videoRef.current) videoRef.current.srcObject = screenStream;
  }, [screenShareEnabled, screenStream]);

  useEffect(() => {
    if (cinemaMode && screenStream && cinemaVideoRef.current) cinemaVideoRef.current.srcObject = screenStream;
  }, [cinemaMode, screenStream]);

  const handleCopyId = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent opening modal
      if (room) {
          navigator.clipboard.writeText(room.id);
          audioSynth.playUiSuccess();
          setCopiedId(true);
          setTimeout(() => setCopiedId(false), 2000);
      }
  };

  const onlineFriends = (Object.values(peers) as PlayerState[]).filter(p => friends.includes(p.id));
  const currentTotalPlayers = Object.keys(peers).length + 1; 

  return (
    <>
      {/* Mobile Touch Zones */}
      <div className="absolute inset-0 z-30 flex pointer-events-none md:hidden">
          <div className="w-1/2 h-full pointer-events-auto" onTouchStart={(e) => handleTouchMove(e, 'left')} onTouchMove={(e) => handleTouchMove(e, 'left')} onTouchEnd={handleTouchEnd}/>
          <div className="w-1/2 h-full pointer-events-auto" onTouchStart={(e) => handleTouchMove(e, 'right')} onTouchMove={(e) => handleTouchMove(e, 'right')} onTouchEnd={handleTouchEnd}/>
      </div>

      {/* Teleport Request Modal */}
      {incomingTeleport && (
        <div className="absolute top-20 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <div className="bg-black border border-white/20 p-4 rounded-lg shadow-2xl flex items-center gap-4 animate-bounce-in pointer-events-auto">
                 <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                 <div className="text-sm">
                     <span className="font-bold">{incomingTeleport.fromName}</span> {t('tp_request')}
                 </div>
                 <div className="flex gap-2">
                     <button 
                        onClick={() => { audioSynth.playUiSuccess(); respondToTeleport(true); }} 
                        className="p-1 bg-green-500 rounded hover:bg-green-400 btn-interactive"
                     >
                        <CheckIcon className="w-5 h-5 text-black" />
                     </button>
                     <button 
                        onClick={() => { audioSynth.playUiClick(); respondToTeleport(false); }} 
                        className="p-1 bg-red-500 rounded hover:bg-red-400 btn-interactive"
                     >
                        <XMarkIcon className="w-5 h-5 text-white" />
                     </button>
                 </div>
            </div>
        </div>
      )}

      {/* Top Bar Container - Responsive */}
      <div className="absolute top-4 md:top-6 left-0 right-0 px-4 md:px-6 pointer-events-none flex flex-col items-start gap-2 md:flex-row md:items-start md:justify-between z-40 safe-top">
          
          {/* Rules & Info (Left) */}
          {room && (
              <div className="pointer-events-auto relative max-w-[200px] md:max-w-none">
                <button 
                    onClick={() => { audioSynth.playUiClick(); setShowRoomInfo(!showRoomInfo); }}
                    className="bg-black/80 backdrop-blur-md px-4 rounded-md border border-white/10 flex items-center gap-4 shadow-lg animate-fade-in h-12 hover:bg-black transition btn-interactive w-full md:w-auto"
                >
                    {/* Rule Icons */}
                    <div className="flex gap-3 border-r border-white/10 pr-4 h-full items-center">
                        {!room.rules.allowScreenShare && (
                            <div title={t('rule_screen')} className="relative flex items-center justify-center">
                                <ComputerDesktopIcon className="w-5 h-5 text-white/80" />
                                <div className="absolute w-6 h-0.5 bg-white/80 rotate-45" />
                            </div>
                        )}
                        {room.rules.forbidMicMute && (
                            <div title={t('rule_mic')} className="flex items-center justify-center">
                                <MicrophoneIcon className="w-5 h-5 text-white/80" />
                            </div>
                        )}
                        {room.rules.preventIgnoring && (
                            <div title={t('rule_ignore')} className="flex items-center justify-center">
                                <EyeSlashIcon className="w-5 h-5 text-white/80" />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col justify-center overflow-hidden h-full py-1 text-left min-w-0">
                        <span className="font-bold text-sm text-white truncate leading-none mb-0.5">{getRoomName(room)}</span>
                        {room.isPrivate && (
                            <div 
                                onClick={handleCopyId}
                                className="text-[10px] text-gray-400 flex items-center gap-1 hover:text-white transition group leading-none cursor-copy"
                                title="Copy Room ID"
                            >
                                <span className="font-mono bg-white/10 px-1 rounded">{room.id}</span>
                                {copiedId ? <CheckIcon className="w-3 h-3 text-green-500" /> : <ClipboardDocumentIcon className="w-3 h-3 group-hover:scale-110" />}
                            </div>
                        )}
                    </div>
                </button>

                {/* Mini Room Info Modal - Centered on Mobile, Absolute on Desktop */}
                {showRoomInfo && (
                    <>
                        {/* Overlay for mobile center positioning */}
                        <div 
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none md:block md:static md:inset-auto"
                            onClick={() => setShowRoomInfo(false)}
                        >
                            <div 
                                onClick={(e) => e.stopPropagation()}
                                className="w-80 bg-black/90 backdrop-blur-md border border-white/20 rounded-lg p-5 shadow-2xl animate-fade-in text-left relative md:absolute md:top-14 md:left-0 md:origin-top-left"
                            >
                                <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-2">
                                    <h3 className="font-bold text-lg">{getRoomName(room)}</h3>
                                    <button onClick={() => setShowRoomInfo(false)} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5"/></button>
                                </div>
                                
                                <p className="text-sm text-gray-300 mb-4 leading-relaxed">{getRoomDesc(room)}</p>
                                
                                <div className="grid grid-cols-2 gap-2 text-xs mb-4 bg-white/5 p-2 rounded">
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 uppercase">{t('online')}</span>
                                        <span className="font-bold">{room.currentPlayers}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 uppercase">{t('world')}</span>
                                        <span className="font-bold capitalize">{room.type}</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => { audioSynth.playUiClick(); toggleRoomSubscription(room.id); }}
                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm transition border ${room.subscribers.includes(localPlayer.id) ? 'bg-white text-black border-white' : 'border-white/30 hover:bg-white/10 text-white'}`}
                                >
                                    {room.subscribers.includes(localPlayer.id) ? <BookmarkSolid className="w-4 h-4"/> : <BookmarkOutline className="w-4 h-4"/>}
                                    {room.subscribers.includes(localPlayer.id) ? t('saved') : t('save')}
                                </button>
                            </div>
                        </div>
                    </>
                )}
              </div>
          )}

          {/* Online Stats (Right) - Adjust positioning for mobile stack */}
          <div className="pointer-events-auto relative self-start md:self-auto">
              <button 
                onClick={() => { audioSynth.playUiClick(); setShowFriendsList(!showFriendsList); }}
                onMouseEnter={() => audioSynth.playUiHover()}
                className="bg-black/80 backdrop-blur-md h-12 px-4 rounded-md border border-white/10 flex items-center justify-between min-w-[140px] shadow-lg hover:bg-black transition btn-interactive animate-fade-in"
              >
                  <div className="flex items-center h-full">
                     <span className="font-bold text-sm text-white flex items-center h-full">{t('friends_btn')}: <span className="text-blue-400 ml-1">{onlineFriends.length}</span></span>
                     <div className="w-px h-6 bg-white/20 mx-3" />
                     <span className="font-bold text-sm text-white flex items-center h-full">{t('total_btn')}: {currentTotalPlayers}</span>
                  </div>
                  {/* Circle vertically centered */}
                  <div className="h-full flex items-center ml-4">
                     <div className={`w-2.5 h-2.5 rounded-full ${onlineFriends.length > 0 ? 'bg-blue-500' : 'bg-green-500'} animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]`} />
                  </div>
              </button>

              {showFriendsList && (
                  <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 bg-black/90 backdrop-blur border border-white/10 p-2 rounded-md w-56 animate-fade-in shadow-xl z-50">
                      <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest px-2 flex justify-between">
                          <span>{t('friends_list')}</span>
                      </div>
                      {onlineFriends.length === 0 && <div className="text-xs text-gray-400 italic px-2">{t('friends_empty')}</div>}
                      {onlineFriends.map(f => (
                          <button 
                            key={f.id}
                            onClick={() => { audioSynth.playUiClick(); requestTeleport(f.id); }}
                            className="w-full text-left py-2 px-2 hover:bg-white/10 rounded flex items-center justify-between text-sm transition btn-interactive"
                          >
                              <span>{f.name}</span>
                              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1 rounded-sm">TP</span>
                          </button>
                      ))}
                  </div>
              )}
          </div>
      </div>

      {/* UI Overlay Bottom - Responsive Padding */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end pb-6 md:pb-8 z-40 safe-bottom">
        
        {/* Screen Share PIP */}
        {screenShareEnabled && !cinemaMode && (
          <div 
            onClick={() => setCinemaMode(true)}
            className="absolute top-24 md:top-4 left-4 w-40 md:w-64 aspect-video bg-black rounded-md border-2 border-gray-700 overflow-hidden shadow-2xl pointer-events-auto cursor-pointer hover:border-blue-500 transition mt-20 md:mt-48 animate-bounce-in"
          >
            <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-sm uppercase font-bold">Live</div>
          </div>
        )}

        {/* Reaction Bar */}
        {room && (
            <div className="flex justify-center mb-4 pointer-events-auto">
                <div className="flex gap-2 bg-black/50 backdrop-blur-sm p-2 rounded-full border border-white/10 animate-fade-in scale-90 md:scale-100">
                    {(room.allowedReactions || DEFAULT_REACTIONS).map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => { audioSynth.playReactionPop(); triggerReaction(emoji); }}
                            className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/20 rounded-full transition hover:scale-125 active:scale-90"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Dock - Horizontal Scroll on small screens */}
        <div className="flex justify-center pointer-events-auto w-full px-4">
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-xl px-4 py-3 rounded-lg border border-white/10 shadow-2xl animate-fade-in overflow-x-auto max-w-full">
            
            <ControlBtn 
              active={micEnabled} 
              onClick={() => { audioSynth.playUiClick(); toggleMic(); }} 
              icon={MicrophoneIcon} 
              offIcon={MicOff}
              label={t('mic')}
              activeColor={micEnabled ? 'text-white' : 'bg-red-500/20 text-red-500'}
              customClass={!micEnabled ? 'bg-red-900/30 text-red-500' : ''}
              extra={micEnabled && <AudioVisualizer stream={micStream} active={micEnabled} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm bg-black/50" width={8} height={16} />}
            />
            
            <div className="w-px h-8 bg-white/20 flex-shrink-0" />

            <ControlBtn 
              active={audioEnabled} 
              onClick={() => {
                  audioSynth.playUiClick();
                  // Logic: If screen share is OFF, clicking system sound should initiate screen share request to get audio
                  if (!screenShareEnabled) {
                      startScreenShare().then(() => {
                           // Attempt to sync audio state if successful
                           const currentStore = useStore.getState();
                           if (currentStore.screenShareEnabled && !currentStore.audioEnabled) {
                               toggleAudio();
                           }
                      });
                  } else {
                      toggleAudio();
                  }
              }} 
              icon={SpeakerWaveIcon} 
              offIcon={SpeakerXMarkIcon}
              label={t('sound')}
              activeColor="text-white"
              customClass={!audioEnabled ? 'bg-red-900/30 text-red-500' : ''}
              extra={audioEnabled && <AudioVisualizer stream={screenStream} active={audioEnabled} color="#3b82f6" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm bg-black/50" width={8} height={16} />}
            />

            <div className="w-px h-8 bg-white/20 flex-shrink-0" />
            
            <ControlBtn 
              active={screenShareEnabled} 
              onClick={() => { audioSynth.playUiClick(); startScreenShare(); }} 
              icon={ComputerDesktopIcon} 
              offIcon={ScreenOff}
              label={t('screen')}
              activeColor="text-white"
            />

             <div className="w-px h-8 bg-white/20 flex-shrink-0" />
            
            <ControlBtn 
                active={false}
                onClick={() => { audioSynth.playUiClick(); setShowSettingsModal(true); }}
                icon={Cog6ToothIcon}
                offIcon={Cog6ToothIcon}
                label={t('config')}
            />

            <div className="w-px h-8 bg-white/20 flex-shrink-0" />

            <ControlBtn 
              active={false} 
              onClick={() => { audioSynth.playUiClick(); leaveRoom(); }}
              icon={ArrowRightOnRectangleIcon}
              offIcon={ArrowRightOnRectangleIcon} 
              label={t('exit')}
              activeColor="bg-red-500/20 text-red-500"
              customClass="hover:bg-red-500/20 hover:text-red-500"
            />
          </div>
        </div>
      </div>

      {/* Settings Modal (Devices) */}
      {showSettingsModal && (
        <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-black border border-white/20 rounded-lg w-full max-w-md p-6 flex flex-col pointer-events-auto animate-bounce-in">
                 <div className="flex justify-between items-center mb-6">
                     <h2 className="text-xl font-bold">{t('devices_title')}</h2>
                     <button onClick={() => setShowSettingsModal(false)}><XMarkIcon className="w-6 h-6 text-gray-400 hover:text-white" /></button>
                 </div>

                 <div className="space-y-4">
                     {/* Microphone */}
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('mic')}</label>
                         <select 
                            className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-sm text-white focus:border-blue-500 outline-none"
                            value={selectedMicId}
                            onChange={(e) => setAudioDevice('mic', e.target.value)}
                         >
                            <option value="">{t('mic_default')}</option>
                            {devices.filter(d => d.kind === 'audioinput').map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.substr(0, 5)}`}</option>
                            ))}
                         </select>
                     </div>

                     {/* Speaker */}
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('sound')} (Output)</label>
                         <select 
                            className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-sm text-white focus:border-blue-500 outline-none"
                            value={selectedSpeakerId}
                            onChange={(e) => setAudioDevice('speaker', e.target.value)}
                         >
                             <option value="">{t('mic_default')}</option>
                             {devices.filter(d => d.kind === 'audiooutput').map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.substr(0, 5)}`}</option>
                             ))}
                         </select>
                         <p className="text-[10px] text-gray-500 mt-1">* Experimental</p>
                     </div>

                     {/* Screen Share Hint */}
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('screen_share_hint')}</label>
                         <button 
                            onClick={() => { audioSynth.playUiClick(); setShowSettingsModal(false); startScreenShare(); }}
                            className="w-full py-2 bg-blue-600/20 text-blue-400 border border-blue-600/50 rounded-md hover:bg-blue-600/30 transition text-sm font-bold flex items-center justify-center gap-2 btn-interactive"
                         >
                             <ComputerDesktopIcon className="w-4 h-4" />
                             {t('select_window')}
                         </button>
                         <p className="text-[10px] text-gray-500 mt-1">{t('browser_hint')}</p>
                     </div>
                 </div>
             </div>
        </div>
      )}

      {/* Cinema Mode */}
      {cinemaMode && screenShareEnabled && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-8">
            <button 
                onClick={() => setCinemaMode(false)} 
                className="absolute top-8 right-8 text-white hover:text-gray-300 p-2 bg-white/10 rounded-md btn-interactive"
            >
                <XMarkIcon className="w-8 h-8" />
            </button>
            <div className="w-full max-w-7xl aspect-video bg-black rounded-lg shadow-2xl overflow-hidden border border-gray-800 animate-bounce-in">
                <video ref={cinemaVideoRef} autoPlay className="w-full h-full object-contain" />
            </div>
            <div className="absolute bottom-8 text-white font-mono text-sm opacity-50">Viewing Screen Share</div>
        </div>
      )}
    </>
  );
};
