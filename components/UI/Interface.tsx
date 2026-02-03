
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { PlayerState, RoomConfig, Language } from '../../types';
import { MicrophoneIcon, SpeakerWaveIcon, ComputerDesktopIcon, ArrowRightOnRectangleIcon, XMarkIcon, CheckIcon, Cog6ToothIcon, EyeSlashIcon, ClipboardDocumentIcon, BookmarkIcon as BookmarkSolid, UserGroupIcon, UserIcon } from '@heroicons/react/24/solid';
import { MicrophoneIcon as MicOff, SpeakerXMarkIcon, ComputerDesktopIcon as ScreenOff, BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline';
import { AudioVisualizer } from './AudioVisualizer';
import { DEFAULT_REACTIONS, TRANSLATIONS } from '../../constants';
import { audioSynth } from '../../services/AudioSynthesizer';

// --- Roblox-style Fixed Joystick ---
const Joystick = ({ setControls }: { setControls: (c: { forward: number, turn: number }) => void }) => {
    const stickRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    // Configuration
    const maxDistance = 50; // Max radius of the stick movement
    
    const handleStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        handleMove(e);
    };

    const handleMove = (e: React.TouchEvent) => {
        // We use a fixed center point relative to the container for the "Roblox" feel
        // The container is 128x128 (w-32), so center is 64,64
        const touch = e.touches[0];
        const target = e.currentTarget.getBoundingClientRect();
        
        const centerX = target.left + target.width / 2;
        const centerY = target.top + target.height / 2;

        const deltaX = touch.clientX - centerX;
        const deltaY = touch.clientY - centerY;

        const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxDistance);
        const angle = Math.atan2(deltaY, deltaX);

        const x = distance * Math.cos(angle);
        const y = distance * Math.sin(angle);

        setPosition({ x, y });

        // Normalize output -1 to 1
        // Forward is Negative Y (up on screen)
        // Turn is Negative X (left) / Positive X (right)
        const forward = -(y / maxDistance);
        const turn = -(x / maxDistance);

        setControls({ forward, turn });
    };

    const handleEnd = () => {
        setIsDragging(false);
        setPosition({ x: 0, y: 0 });
        setControls({ forward: 0, turn: 0 });
    };

    return (
        <div 
            className="absolute bottom-10 left-10 w-40 h-40 z-50 touch-none select-none flex items-center justify-center"
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
        >
            {/* Base Circle */}
            <div className="w-32 h-32 rounded-full bg-black/40 border-2 border-white/10 backdrop-blur-sm relative flex items-center justify-center">
                {/* Thumb Stick */}
                <div 
                    ref={stickRef}
                    className={`w-14 h-14 rounded-full shadow-lg transition-transform duration-75 ${isDragging ? 'bg-white/80' : 'bg-white/50'}`}
                    style={{ 
                        transform: `translate(${position.x}px, ${position.y}px)` 
                    }}
                />
            </div>
        </div>
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
        className={`p-3 rounded-xl transition-all duration-200 border border-transparent flex items-center justify-center
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

// Formatter for online count (1000 -> 1k)
const formatCount = (n: number) => {
    if (n < 1000) return n;
    if (n < 10000) return (n / 1000).toFixed(1) + 'k';
    return (n / 1000).toFixed(0) + 'k';
}

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
    toggleRoomSubscription, localPlayer, language,
    isLocalPlayerMoving
  } = useStore();

  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  
  // Defined here to be accessible in render scope
  const isUIOpen = showRoomInfo || showFriendsList || showSettingsModal;

  const [isIdle, setIsIdle] = useState(false);
  const idleTimer = useRef<any>(null);
  const isUIOpenRef = useRef(false);
  
  const cinemaVideoRef = useRef<HTMLVideoElement>(null);

  const room = activeRoomId ? rooms[activeRoomId] : null;
  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;

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

  // Calculate friends in room
  const friendsInSelectedRoom = room 
  ? friends.filter(friendId => room.subscribers.includes(friendId)) 
  : [];

  // --- Idle Logic (Dock Hiding) ---
  useEffect(() => {
    isUIOpenRef.current = isUIOpen;
    if (isUIOpenRef.current || isLocalPlayerMoving) {
        setIsIdle(false);
        if (idleTimer.current) clearTimeout(idleTimer.current);
    } else {
        // If not moving and UI closed, start timer to hide
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => {
            setIsIdle(true);
        }, 3000); // 3 seconds to hide
    }
  }, [isUIOpen, isLocalPlayerMoving]);

  // Wake up listener with exclusion logic
  useEffect(() => {
      const wakeUp = (e: Event) => {
          const target = e.target as HTMLElement;
          const isReactionBtn = target.closest('button');
          if (isReactionBtn && isIdle) {
              return;
          }

          setIsIdle(false);
          if (idleTimer.current) clearTimeout(idleTimer.current);
          idleTimer.current = setTimeout(() => setIsIdle(true), 3000);
      };

      window.addEventListener('keydown', wakeUp);
      window.addEventListener('mousedown', wakeUp); 
      window.addEventListener('touchstart', wakeUp);

      return () => {
          window.removeEventListener('keydown', wakeUp);
          window.removeEventListener('mousedown', wakeUp);
          window.removeEventListener('touchstart', wakeUp);
          if(idleTimer.current) clearTimeout(idleTimer.current);
      }
  }, [isIdle]);


  useEffect(() => {
    if (showSettingsModal) {
        navigator.mediaDevices.enumerateDevices().then(setDevices);
    }
  }, [showSettingsModal]);

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
  
  // Interactive Button Class (Squircle)
  const btnClass = "btn-interactive cursor-pointer";

  return (
    <>
      {/* Mobile Controls Layer - Visible Joystick */}
      <Joystick setControls={setControls} />

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

      {/* Teleport Request Modal */}
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

      {/* Top Bar Container - Tightened Padding to px-3 */}
      <div className="absolute top-4 md:top-6 left-0 right-0 px-3 md:px-6 pointer-events-none flex flex-row justify-between items-start z-[200] safe-top landscape:scale-90 landscape:origin-top">
          
          {/* Rules & Logo Info (Left) */}
          {room && (
              <div className="pointer-events-auto relative z-50">
                  <div className="flex items-center gap-3">
                       
                       {/* Rules Icons - Moved to Left */}
                       <div className="flex gap-2">
                            {!room.rules.allowScreenShare && (
                                <div title={t('rule_screen')} className="relative flex items-center justify-center">
                                    <ComputerDesktopIcon className="w-5 h-5 text-white/50" />
                                    <div className="absolute w-6 h-0.5 bg-white/50 rotate-45" />
                                </div>
                            )}
                            {room.rules.forbidMicMute && <MicrophoneIcon className="w-5 h-5 text-white/50" title={t('rule_mic')}/>}
                            {room.rules.preventIgnoring && <EyeSlashIcon className="w-5 h-5 text-white/50" title={t('rule_ignore')}/>}
                       </div>

                       {/* Divider */}
                       {(room.rules.forbidMicMute || !room.rules.allowScreenShare || room.rules.preventIgnoring) && (
                           <div className="w-px h-6 bg-white/10" />
                       )}

                       {/* Logo & Name - Clickable */}
                       <button 
                            onClick={() => { audioSynth.playUiClick(); setShowRoomInfo(!showRoomInfo); }}
                            className="text-left group transition hover:opacity-80"
                       >
                            <h1 className="text-4xl font-black tracking-tighter leading-none shadow-black drop-shadow-md">
                                R<span className="text-[#3a83f6]">oo</span>m8
                            </h1>
                            <div className="text-xs font-medium text-gray-300 ml-0.5 group-hover:text-white transition">
                                {getRoomName(room)}
                            </div>
                       </button>
                  </div>

                {/* MODAL in Interface.tsx is strictly for viewing Room Info while IN-GAME */}
                {/* Updated: Wider, Grid Layout */}
                {showRoomInfo && (
                    <div 
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm md:absolute md:inset-auto md:top-20 md:left-4 md:bg-transparent md:backdrop-blur-none"
                        onClick={() => setShowRoomInfo(false)}
                    >
                        <div 
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-2xl bg-black/95 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden shadow-2xl animate-fade-in text-left relative"
                        >
                            {/* Header Gradient */}
                            <div 
                                className="h-24 w-full relative"
                                style={{ background: room.headerGradient || (room.type === 'day' ? 'linear-gradient(to right, #14532d, #1e3a8a)' : room.type === 'night' ? 'linear-gradient(to right, #000000, #312e81)' : 'linear-gradient(to right, #312e81, #1e40af)') }} 
                            >
                                <button onClick={() => setShowRoomInfo(false)} className="absolute top-2 right-2 bg-black/20 backdrop-blur p-1 rounded-full hover:bg-white hover:text-black transition z-10 text-white">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                                <div className="absolute bottom-3 left-4">
                                    <h3 className="font-black text-3xl drop-shadow-md text-white leading-none">{getRoomName(room)}</h3>
                                </div>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column: Description & Stats */}
                                <div className="flex flex-col gap-4">
                                    <p className="text-sm text-gray-300 leading-relaxed min-h-[60px]">{getRoomDesc(room)}</p>
                                    
                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="bg-black border border-white/10 p-3 rounded-lg flex flex-col items-center">
                                            <span className="text-gray-500 uppercase block mb-1 font-bold text-[10px]">{t('online')}</span>
                                            <span className="font-bold text-lg">{room.currentPlayers}</span>
                                        </div>
                                        <div className="bg-black border border-white/10 p-3 rounded-lg flex flex-col items-center">
                                            <span className="text-gray-500 uppercase block mb-1 font-bold text-[10px]">{t('saved')}</span>
                                            <span className="font-bold text-lg">{room.subscribers.length}</span>
                                        </div>
                                        <div className="bg-black border border-white/10 p-3 rounded-lg flex flex-col items-center">
                                            <span className="text-gray-500 uppercase block mb-1 font-bold text-[10px]">{t('friends_btn')}</span>
                                            <span className="font-bold text-lg">{friendsInSelectedRoom.length}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Rules & Actions */}
                                <div className="flex flex-col gap-4">
                                    {/* Rules */}
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-black border border-white/10">
                                            <div className="flex items-center gap-2">
                                                <ComputerDesktopIcon className={`w-4 h-4 ${room.rules.allowScreenShare ? 'text-green-400' : 'text-red-400'}`} />
                                                <span className="text-xs font-bold text-gray-300">Screen Share</span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${room.rules.allowScreenShare ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {room.rules.allowScreenShare ? 'Allowed' : 'Forbidden'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-black border border-white/10">
                                            <div className="flex items-center gap-2">
                                                <MicrophoneIcon className={`w-4 h-4 ${!room.rules.forbidMicMute ? 'text-green-400' : 'text-red-400'}`} />
                                                <span className="text-xs font-bold text-gray-300">Mute Mic</span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${!room.rules.forbidMicMute ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {!room.rules.forbidMicMute ? 'Allowed' : 'Forbidden'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-black border border-white/10">
                                            <div className="flex items-center gap-2">
                                                <EyeSlashIcon className={`w-4 h-4 ${!room.rules.preventIgnoring ? 'text-green-400' : 'text-red-400'}`} />
                                                <span className="text-xs font-bold text-gray-300">Ignore Users</span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${!room.rules.preventIgnoring ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {!room.rules.preventIgnoring ? 'Allowed' : 'Forbidden'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {room.isPrivate && (
                                        <div 
                                            onClick={handleCopyId}
                                            className="bg-black border border-white/10 p-3 rounded-lg cursor-copy hover:bg-white/5 transition flex justify-between items-center"
                                        >
                                            <div>
                                                <div className="text-[10px] text-gray-500 uppercase">Room ID</div>
                                                <div className="font-mono text-xs text-white">{room.id}</div>
                                            </div>
                                            {copiedId ? <CheckIcon className="w-4 h-4 text-green-500" /> : <ClipboardDocumentIcon className="w-4 h-4 text-gray-400" />}
                                        </div>
                                    )}

                                    <button 
                                        onClick={() => { audioSynth.playUiClick(); toggleRoomSubscription(room.id); }}
                                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition border ${room.subscribers.includes(localPlayer.id) ? 'bg-white text-black border-white' : 'border-white/30 hover:bg-white/10 text-white'}`}
                                    >
                                        {room.subscribers.includes(localPlayer.id) ? <BookmarkSolid className="w-4 h-4"/> : <BookmarkOutline className="w-4 h-4"/>}
                                        {room.subscribers.includes(localPlayer.id) ? t('saved') : t('save')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
              </div>
          )}

          {/* Top Right Buttons - Square Shape + Counter */}
          <div className="pointer-events-auto relative z-50 flex gap-2 items-center">
             
             <button 
                onMouseEnter={() => audioSynth.playUiHover()} 
                onClick={() => { audioSynth.playUiClick(); setShowFriendsList(!showFriendsList); }} 
                className={`p-3 rounded-xl transition border border-white/10 ${btnClass} h-[50px] w-[50px] ${showFriendsList ? 'bg-white text-black' : 'bg-black/60 backdrop-blur-md hover:bg-white/20 text-white'}`}
                title={t('friends_list')}
            >
                <div className="relative flex items-center justify-center w-full h-full">
                    <UserGroupIcon className="w-6 h-6" />
                    {onlineFriends.length > 0 && <div className="absolute -top-2 -right-2 w-3 h-3 bg-blue-500 rounded-full border border-black" />}
                </div>
            </button>

            <button 
                onMouseEnter={() => audioSynth.playUiHover()} 
                onClick={() => { audioSynth.playUiClick(); setShowSettingsModal(true); }} 
                className={`p-3 rounded-xl transition border border-white/10 ${btnClass} h-[50px] w-[50px] ${showSettingsModal ? 'bg-white text-black' : 'bg-black/60 backdrop-blur-md hover:bg-white/20 text-white'}`}
                title={t('settings_title')}
            >
                <div className="flex items-center justify-center w-full h-full">
                    <Cog6ToothIcon className="w-6 h-6" />
                </div>
            </button>

            {/* Online Counter Badge - Moved to far right */}
             <div className="p-3 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-white transition cursor-default h-[50px] w-[50px]">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mb-0.5 shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                 <span className="font-mono font-bold text-xs">{formatCount(currentTotalPlayers)}</span>
             </div>

              {showFriendsList && (
                  <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur border border-white/10 p-2 rounded-xl w-56 animate-fade-in shadow-xl z-50">
                      <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest px-2 flex justify-between">
                          <span>{t('friends_list')}</span>
                      </div>
                      {onlineFriends.length === 0 && <div className="text-xs text-gray-400 italic px-2">{t('friends_empty')}</div>}
                      {onlineFriends.map(f => (
                          <button 
                            key={f.id}
                            onClick={() => { audioSynth.playUiClick(); requestTeleport(f.id); }}
                            className="w-full text-left py-2 px-2 hover:bg-white/10 rounded-lg flex items-center justify-between text-sm transition btn-interactive"
                          >
                              <span className="truncate max-w-[120px]">{f.name}</span>
                              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">TP</span>
                          </button>
                      ))}
                  </div>
              )}
          </div>
      </div>

      {/* UI Overlay Bottom */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end pb-6 md:pb-8 z-40 safe-bottom landscape:scale-90 landscape:origin-bottom">
        
        {/* Reaction Bar */}
        {room && (
            <div className={`flex justify-center mb-6 pointer-events-auto transition-transform duration-500 ${isIdle && !isUIOpen ? 'translate-y-[80px]' : 'translate-y-0'}`}>
                <div className="flex gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                    {(room.allowedReactions || DEFAULT_REACTIONS).map((emoji) => (
                        <button
                            key={emoji}
                            onClick={(e) => { 
                                e.stopPropagation();
                                audioSynth.playReactionPop(); 
                                triggerReaction(emoji); 
                            }}
                            className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-white/10 rounded-full transition hover:scale-125 active:scale-90"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Dock */}
        <div className={`flex justify-center pointer-events-auto w-full px-4 transition-all duration-500 ${isIdle && !isUIOpen ? 'opacity-0 translate-y-20 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-xl px-2 py-2 rounded-2xl border border-white/10 shadow-2xl overflow-x-auto max-w-full no-scrollbar">
            
            {!room?.rules.forbidMicMute && (
                <>
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
                <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />
                </>
            )}
            
             {!room?.rules.forbidMicMute && (
                 <>
                <ControlBtn 
                active={audioEnabled} 
                onClick={() => {
                    audioSynth.playUiClick();
                    if (audioEnabled) {
                        // If audio is on, we are sharing screen for audio. Stop it.
                        stopScreenShare();
                        toggleAudio();
                    } else {
                        // If off, try to start screen share to get audio
                         if (!screenShareEnabled) {
                            startScreenShare().then(() => {
                                // If successful, enable audio state
                                const currentStore = useStore.getState();
                                if (currentStore.screenShareEnabled) {
                                     if (!currentStore.audioEnabled) toggleAudio();
                                }
                            });
                        } else {
                            // If screen share is already on, just toggle state
                            toggleAudio();
                        }
                    }
                }} 
                icon={SpeakerWaveIcon} 
                offIcon={SpeakerXMarkIcon}
                label={t('sound')}
                activeColor="text-white"
                customClass={!audioEnabled ? 'bg-red-900/30 text-red-500' : ''}
                extra={audioEnabled && <AudioVisualizer stream={screenStream} active={audioEnabled} color="#3b82f6" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm bg-black/50" width={8} height={16} />}
                />

                <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />
                </>
             )}
            
            {room?.rules.allowScreenShare && (
                <>
                <ControlBtn 
                active={screenShareEnabled} 
                onClick={() => { 
                    audioSynth.playUiClick(); 
                    if (screenShareEnabled) {
                        stopScreenShare();
                    } else {
                        startScreenShare(); 
                    }
                }} 
                icon={ComputerDesktopIcon} 
                offIcon={ScreenOff}
                label={t('screen')}
                activeColor="text-white"
                />

                <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />
                </>
            )}

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

      {/* Settings Modal - Simplified */}
      {showSettingsModal && (
        <div className="absolute inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-black border border-white/20 rounded-xl w-full max-w-md p-8 flex flex-col pointer-events-auto animate-bounce-in max-h-[80vh] overflow-y-auto custom-scroll">
                 <div className="flex justify-between items-center mb-6">
                     <h2 className="text-2xl font-bold">{t('devices_title')}</h2>
                     <button onClick={() => setShowSettingsModal(false)}><XMarkIcon className="w-6 h-6 text-gray-400 hover:text-white" /></button>
                 </div>

                 <div className="space-y-6">
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('mic')}</label>
                         <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none"
                            value={selectedMicId}
                            onChange={(e) => setAudioDevice('mic', e.target.value)}
                         >
                            <option value="">{t('mic_default')}</option>
                            {devices.filter(d => d.kind === 'audioinput').map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.substr(0, 5)}`}</option>
                            ))}
                         </select>
                     </div>

                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('sound')} (Output)</label>
                         <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none"
                            value={selectedSpeakerId}
                            onChange={(e) => setAudioDevice('speaker', e.target.value)}
                         >
                             <option value="">{t('mic_default')}</option>
                             {devices.filter(d => d.kind === 'audiooutput').map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.substr(0, 5)}`}</option>
                             ))}
                         </select>
                     </div>
                 </div>
             </div>
        </div>
      )}

      {/* Cinema Mode */}
      {cinemaMode && screenShareEnabled && (
        <div className="absolute inset-0 z-[250] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
            <button 
                onClick={() => setCinemaMode(false)} 
                className="absolute top-6 right-6 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full btn-interactive"
            >
                <XMarkIcon className="w-8 h-8" />
            </button>
            <div className="w-full max-w-7xl aspect-video bg-black rounded-2xl shadow-2xl overflow-hidden border border-gray-800 animate-bounce-in">
                <video ref={cinemaVideoRef} autoPlay className="w-full h-full object-contain" />
            </div>
            <div className="absolute bottom-10 text-white font-mono text-sm opacity-50 bg-black/50 px-4 py-1 rounded-full">Live Stream</div>
        </div>
      )}
    </>
  );
};
