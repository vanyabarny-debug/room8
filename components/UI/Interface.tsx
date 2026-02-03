
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { PlayerState, RoomConfig, Language } from '../../types';
import { MicrophoneIcon, SpeakerWaveIcon, ComputerDesktopIcon, ArrowRightOnRectangleIcon, XMarkIcon, CheckIcon, Cog6ToothIcon, EyeSlashIcon, ClipboardDocumentIcon, BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { MicrophoneIcon as MicOff, SpeakerXMarkIcon, ComputerDesktopIcon as ScreenOff, BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline';
import { AudioVisualizer } from './AudioVisualizer';
import { DEFAULT_REACTIONS, TRANSLATIONS } from '../../constants';
import { audioSynth } from '../../services/AudioSynthesizer';

// --- New Invisible Mobile Movement Layer ---
const MobileMovementLayer = ({ setControls }: { setControls: (c: { forward: number, turn: number }) => void }) => {
    const startY = useRef<number | null>(null);
    const startX = useRef<number | null>(null);
    
    const handleStart = (e: React.TouchEvent) => {
        startY.current = e.touches[0].clientY;
        startX.current = e.touches[0].clientX;
    };

    const handleMove = (e: React.TouchEvent) => {
        if (startY.current === null || startX.current === null) return;
        
        const deltaY = startY.current - e.touches[0].clientY; // Positive = Dragging Up
        const deltaX = e.touches[0].clientX - startX.current; // Positive = Dragging Right

        const maxDist = 50; 
        
        // Forward: Drag Up -> Forward (1), Drag Down -> Backward (-1)
        let forward = Math.max(-1, Math.min(1, deltaY / maxDist));
        
        // Turn: Drag Left -> Left Turn (1), Drag Right -> Right Turn (-1)
        // Note: Player logic: turn positive = left
        let turn = Math.max(-1, Math.min(1, -deltaX / maxDist)); 
        
        // Deadzone
        if (Math.abs(forward) < 0.2) forward = 0;
        if (Math.abs(turn) < 0.2) turn = 0;

        setControls({ forward, turn });
    };

    const handleEnd = () => {
        startY.current = null;
        startX.current = null;
        setControls({ forward: 0, turn: 0 });
    };

    return (
        <div 
            className="absolute top-1/2 left-0 w-1/2 h-1/2 z-30 pointer-events-auto"
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
        />
    );
};


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
  const TheIcon = (active ? Icon : (OffIcon || Icon)) as any;
  
  return (
    <div className="relative group flex flex-col items-center flex-shrink-0">
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
    incomingFriendRequest, respondToFriendRequest,
    setControls,
    triggerReaction,
    selectedMicId, selectedSpeakerId, setAudioDevice,
    toggleRoomSubscription, localPlayer, language, setLanguage
  } = useStore();

  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  
  const idleTimer = useRef<any>(null);
  const isUIOpenRef = useRef(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const cinemaVideoRef = useRef<HTMLVideoElement>(null);

  const room = activeRoomId ? rooms[activeRoomId] : null;
  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;

  // Track if any UI modal is open to prevent idle hiding
  useEffect(() => {
    isUIOpenRef.current = showRoomInfo || showFriendsList || showSettingsModal;
    if (isUIOpenRef.current) {
        setIsIdle(false);
        if (idleTimer.current) clearTimeout(idleTimer.current);
    } else {
        // Restart timer when UI closes
        resetIdle();
    }
  }, [showRoomInfo, showFriendsList, showSettingsModal]);

  const resetIdle = () => {
      if (isUIOpenRef.current) return;
      
      setIsIdle(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
          setIsIdle(true);
      }, 5000);
  };

  useEffect(() => {
      window.addEventListener('mousemove', resetIdle);
      window.addEventListener('touchstart', resetIdle);
      window.addEventListener('keydown', resetIdle);
      window.addEventListener('click', resetIdle);
      resetIdle();
      return () => {
          window.removeEventListener('mousemove', resetIdle);
          window.removeEventListener('touchstart', resetIdle);
          window.removeEventListener('keydown', resetIdle);
          window.removeEventListener('click', resetIdle);
          if (idleTimer.current) clearTimeout(idleTimer.current);
      }
  }, []);

  const getRoomName = (room: RoomConfig) => {
    if (room.isOfficial) {
        if (room.type === 'day') return t('room_day_title');
        if (room.type === 'night') return t('room_night_title');
        if (room.type === 'office') return t('room_office_title');
    }
    return room.name;
  };

  const getRoomDesc = (room: RoomConfig) => {
    if (room.isOfficial) {
        if (room.type === 'day') return t('room_day_desc');
        if (room.type === 'night') return t('room_night_desc');
        if (room.type === 'office') return t('room_office_desc');
    }
    return room.description;
  };

  const LANG_FLAGS: Record<Language, string> = {
      en: '🇺🇸 English',
      ru: '🇷🇺 Русский',
      es: '🇪🇸 Español',
      fr: '🇫🇷 Français',
      de: '🇩🇪 Deutsch',
      it: '🇮🇹 Italiano',
      cn: '🇨🇳 中文',
      jp: '🇯🇵 日本語',
      th: '🇹🇭 ไทย'
  };

  useEffect(() => {
    if (showSettingsModal) {
        navigator.mediaDevices.enumerateDevices().then(setDevices);
    }
  }, [showSettingsModal]);

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

  const isUIOpen = showRoomInfo || showFriendsList || showSettingsModal;

  return (
    <>
      {/* Mobile Controls Layer - Invisible */}
      <MobileMovementLayer setControls={setControls} />

      {/* Friend Request Modal */}
      {incomingFriendRequest && (
        <div className="absolute top-32 left-0 right-0 flex justify-center z-[9999] pointer-events-auto">
            <div className="bg-black border border-white/20 p-4 rounded-lg shadow-2xl flex items-center gap-4 animate-bounce-in">
                 <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                 <div className="text-sm">
                     <span className="font-bold">{incomingFriendRequest.fromName}</span> {t('add_friend')}?
                 </div>
                 <div className="flex gap-2">
                     <button 
                        onClick={() => { audioSynth.playUiSuccess(); respondToFriendRequest(true); }} 
                        className="p-1 bg-green-500 rounded hover:bg-green-400 btn-interactive"
                     >
                        <CheckIcon className="w-5 h-5 text-black" />
                     </button>
                     <button 
                        onClick={() => { audioSynth.playUiClick(); respondToFriendRequest(false); }} 
                        className="p-1 bg-red-500 rounded hover:bg-red-400 btn-interactive"
                     >
                        <XMarkIcon className="w-5 h-5 text-white" />
                     </button>
                 </div>
            </div>
        </div>
      )}

      {/* Teleport Request Modal - Z-INDEX 9999 */}
      {incomingTeleport && (
        <div className="absolute top-20 left-0 right-0 flex justify-center z-[9999] pointer-events-auto">
            <div className="bg-black border border-white/20 p-4 rounded-lg shadow-2xl flex items-center gap-4 animate-bounce-in">
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

      {/* Top Bar Container - Responsive - UPDATED Z-INDEX to 200 (Above Canvas, Below Modal) */}
      <div className={`absolute top-4 md:top-6 left-0 right-0 px-4 md:px-6 pointer-events-none flex flex-row justify-between items-start z-[200] safe-top transition-opacity duration-500 ${isIdle && !isUIOpen ? 'opacity-0' : 'opacity-100'}`}>
          
          {/* Rules & Info (Left) */}
          {room && (
              <div className="pointer-events-auto relative max-w-[45%] md:max-w-none z-50">
                <button 
                    onClick={() => { audioSynth.playUiClick(); setShowRoomInfo(!showRoomInfo); }}
                    className="bg-black/80 backdrop-blur-md px-3 md:px-4 rounded-md border border-white/10 flex items-center gap-2 md:gap-4 shadow-lg animate-fade-in hover:bg-black transition btn-interactive w-full md:w-auto h-10 md:h-12"
                >
                    {/* Desktop Rule Icons */}
                    <div className="hidden md:flex gap-3 border-r border-white/10 pr-4 h-full items-center">
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
                        <span className="font-bold text-xs md:text-sm text-white truncate leading-none mb-0.5">{getRoomName(room)}</span>
                        {room.isPrivate && (
                            <div 
                                onClick={handleCopyId}
                                className="text-[10px] text-gray-400 flex items-center gap-1 hover:text-white transition group leading-none cursor-copy"
                            >
                                <span className="font-mono bg-white/10 px-1 rounded truncate max-w-[60px] md:max-w-none">{room.id}</span>
                                {copiedId ? <CheckIcon className="w-3 h-3 text-green-500" /> : <ClipboardDocumentIcon className="w-3 h-3 group-hover:scale-110" />}
                            </div>
                        )}
                    </div>
                </button>

                {showRoomInfo && (
                    <div 
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm md:absolute md:inset-auto md:top-14 md:left-0 md:bg-transparent md:backdrop-blur-none"
                        onClick={() => setShowRoomInfo(false)}
                    >
                        <div 
                            onClick={(e) => e.stopPropagation()}
                            className="w-80 bg-black/90 backdrop-blur-md border border-white/20 rounded-lg p-5 shadow-2xl animate-fade-in text-left relative"
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
                )}
              </div>
          )}

          {/* Online Stats (Right) */}
          <div className="pointer-events-auto relative max-w-[45%] md:max-w-none z-50">
              <button 
                onClick={() => { audioSynth.playUiClick(); setShowFriendsList(!showFriendsList); }}
                onMouseEnter={() => audioSynth.playUiHover()}
                className="bg-black/80 backdrop-blur-md px-3 md:px-4 rounded-md border border-white/10 flex items-center justify-between shadow-lg hover:bg-black transition btn-interactive w-full md:min-w-[140px] h-10 md:h-12"
              >
                  <div className="flex items-center gap-2 md:w-full md:justify-between">
                     <div className="flex flex-col text-right md:flex-row md:items-center md:gap-3">
                        <span className="font-bold text-xs md:text-sm text-white leading-none md:leading-normal">
                            <span className="hidden md:inline">{t('friends_btn')}: </span>
                            <span className="md:text-blue-400 md:ml-1 hidden md:inline">{onlineFriends.length}</span>
                            <span className="md:hidden">{currentTotalPlayers} {t('total_btn')}</span>
                        </span>
                        
                        {/* Desktop Separator */}
                        <div className="hidden md:block w-px h-6 bg-white/20" />
                        
                        <span className="font-bold text-sm text-white hidden md:block">{t('total_btn')}: {currentTotalPlayers}</span>
                        
                        {/* Mobile Friends Subtext */}
                        {onlineFriends.length > 0 && <span className="text-[10px] text-blue-400 leading-none mt-0.5 md:hidden">{onlineFriends.length} friends</span>}
                     </div>
                     <div className={`w-2 h-2 rounded-full ${onlineFriends.length > 0 ? 'bg-blue-500' : 'bg-green-500'} animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)] flex-shrink-0 md:ml-4`} />
                  </div>
              </button>

              {showFriendsList && (
                  <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur border border-white/10 p-2 rounded-md w-48 md:w-56 animate-fade-in shadow-xl z-50">
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
                              <span className="truncate max-w-[100px] md:max-w-none">{f.name}</span>
                              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1 rounded-sm">TP</span>
                          </button>
                      ))}
                  </div>
              )}
          </div>
      </div>

      {/* UI Overlay Bottom - Responsive Padding */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end pb-6 md:pb-8 z-40 safe-bottom">
        
        {/* Screen Share PIP - Hides when Idle */}
        {screenShareEnabled && !cinemaMode && (
          <div 
            onClick={() => setCinemaMode(true)}
            className={`absolute top-24 md:top-4 left-4 w-32 md:w-64 aspect-video bg-black rounded-md border-2 border-gray-700 overflow-hidden shadow-2xl pointer-events-auto cursor-pointer hover:border-blue-500 transition-opacity duration-500 mt-20 md:mt-48 animate-bounce-in ${isIdle && !isUIOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-sm uppercase font-bold">Live</div>
          </div>
        )}

        {/* Reaction Bar - MOVES DOWN WHEN IDLE */}
        {room && (
            <div className={`flex justify-center mb-4 pointer-events-auto transition-all duration-500 ${isIdle && !isUIOpen ? 'translate-y-[60px]' : 'translate-y-0'}`}>
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

        {/* Dock - Horizontal Scroll on small screens - HIDES WHEN IDLE */}
        <div className={`flex justify-center pointer-events-auto w-full px-4 transition-all duration-500 ${isIdle && !isUIOpen ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-xl px-4 py-3 rounded-lg border border-white/10 shadow-2xl animate-fade-in overflow-x-auto max-w-full no-scrollbar">
            
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
                  if (!screenShareEnabled) {
                      startScreenShare().then(() => {
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

      {/* Settings Modal (Devices & Language) */}
      {showSettingsModal && (
        <div className="absolute inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-black border border-white/20 rounded-lg w-full max-w-md p-6 flex flex-col pointer-events-auto animate-bounce-in max-h-[80vh] overflow-y-auto custom-scroll">
                 <div className="flex justify-between items-center mb-6">
                     <h2 className="text-xl font-bold">{t('devices_title')}</h2>
                     <button onClick={() => setShowSettingsModal(false)}><XMarkIcon className="w-6 h-6 text-gray-400 hover:text-white" /></button>
                 </div>

                 <div className="space-y-6">
                     {/* Language */}
                     <div className="border-b border-white/10 pb-4">
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('language')}</label>
                         <select 
                            className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-sm text-white focus:border-blue-500 outline-none"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as Language)}
                         >
                            {Object.entries(LANG_FLAGS).map(([code, name]) => (
                                <option key={code} value={code}>{name}</option>
                            ))}
                         </select>
                     </div>

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
        <div className="absolute inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-8">
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
