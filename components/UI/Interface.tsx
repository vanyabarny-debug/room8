
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { PlayerState, RoomConfig, Language } from '../../types';
import { MicrophoneIcon, SpeakerWaveIcon, ComputerDesktopIcon, ArrowRightOnRectangleIcon, XMarkIcon, CheckIcon, Cog6ToothIcon, EyeSlashIcon, ClipboardDocumentIcon, BookmarkIcon as BookmarkSolid, UserGroupIcon, UserIcon, Bars3Icon, FaceSmileIcon, ArrowUpIcon } from '@heroicons/react/24/solid';
import { MicrophoneIcon as MicOff, SpeakerXMarkIcon, ComputerDesktopIcon as ScreenOff, BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline';
import { AudioVisualizer } from './AudioVisualizer';
import { DEFAULT_REACTIONS, TRANSLATIONS } from '../../constants';
import { audioSynth } from '../../services/AudioSynthesizer';

// --- Floating Invisible Controls (Split Screen) ---
const MobileControls = () => {
    const { setControls, setCameraDelta, setJoystickActive, isSitting } = useStore();
    const [joyAnchor, setJoyAnchor] = useState<{x: number, y: number} | null>(null);
    const [joyThumb, setJoyThumb] = useState<{x: number, y: number} | null>(null);
    const leftTouchId = useRef<number | null>(null);
    const lastCameraPos = useRef<{x: number, y: number} | null>(null);
    const rightTouchId = useRef<number | null>(null);
    const maxRadius = 60;

    const handleTouchStart = (e: React.TouchEvent) => {
        setJoystickActive(true);
        const halfWidth = window.innerWidth / 2;
        Array.from(e.changedTouches).forEach((touch: React.Touch) => {
            const x = touch.clientX;
            const y = touch.clientY;
            
            // Allow rotation but not movement if sitting
            if (x < halfWidth && leftTouchId.current === null && !isSitting) {
                leftTouchId.current = touch.identifier;
                setJoyAnchor({ x, y });
                setJoyThumb({ x, y });
            } else if (x >= halfWidth && rightTouchId.current === null) {
                rightTouchId.current = touch.identifier;
                lastCameraPos.current = { x, y };
            }
        });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        Array.from(e.changedTouches).forEach((touch: React.Touch) => {
            if (touch.identifier === leftTouchId.current && joyAnchor && !isSitting) {
                const deltaX = touch.clientX - joyAnchor.x;
                const deltaY = touch.clientY - joyAnchor.y;
                const dist = Math.sqrt(deltaX*deltaX + deltaY*deltaY);
                const angle = Math.atan2(deltaY, deltaX);
                const clampedDist = Math.min(dist, maxRadius);
                const thumbX = joyAnchor.x + clampedDist * Math.cos(angle);
                const thumbY = joyAnchor.y + clampedDist * Math.sin(angle);
                setJoyThumb({ x: thumbX, y: thumbY });
                const forward = -(Math.sin(angle) * (clampedDist / maxRadius));
                const turn = (Math.cos(angle) * (clampedDist / maxRadius));
                setControls({ forward, turn });
            }
            if (touch.identifier === rightTouchId.current && lastCameraPos.current) {
                const dx = touch.clientX - lastCameraPos.current.x;
                const dy = touch.clientY - lastCameraPos.current.y;
                const sensitivity = 0.005;
                setCameraDelta({ x: dx * sensitivity, y: dy * sensitivity });
                lastCameraPos.current = { x: touch.clientX, y: touch.clientY };
            }
        });
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        Array.from(e.changedTouches).forEach((touch: React.Touch) => {
            if (touch.identifier === leftTouchId.current) {
                leftTouchId.current = null;
                setJoyAnchor(null);
                setJoyThumb(null);
                setControls({ forward: 0, turn: 0 });
            }
            if (touch.identifier === rightTouchId.current) {
                rightTouchId.current = null;
                lastCameraPos.current = null;
                setCameraDelta({ x: 0, y: 0 });
            }
        });
        if (e.touches.length === 0) setJoystickActive(false);
    };

    return (
        <div 
            className="absolute inset-0 z-10 touch-none pointer-events-auto"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {joyAnchor && joyThumb && !isSitting && (
                <div 
                    className="absolute rounded-full border-2 border-white/20 bg-black/20 backdrop-blur-sm pointer-events-none"
                    style={{ left: joyAnchor.x - maxRadius, top: joyAnchor.y - maxRadius, width: maxRadius * 2, height: maxRadius * 2 }}
                >
                    <div className="absolute w-12 h-12 rounded-full bg-white/50 shadow-lg top-1/2 left-1/2 -mt-6 -ml-6" style={{ transform: `translate(${joyThumb.x - joyAnchor.x}px, ${joyThumb.y - joyAnchor.y}px)` }} />
                </div>
            )}
        </div>
    );
};


const ControlBtn = ({ active, onClick, onTouchStart, onTouchEnd, icon: Icon, offIcon: OffIcon, label, activeColor = "text-white", customClass = "", extra }: any) => {
  const TheIcon = (active ? Icon : (OffIcon || Icon)) as any;
  return (
    <div className="relative group flex flex-col items-center flex-shrink-0">
      <button
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onTouchStart}
        onMouseUp={onTouchEnd}
        onMouseLeave={onTouchEnd}
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
    activeCinemaStream, setActiveCinemaStream,
    incomingTeleport, respondToTeleport, requestTeleport,
    incomingFriendRequest, respondToFriendRequest,
    triggerReaction, setControls,
    selectedMicId, selectedSpeakerId, setAudioDevice,
    toggleRoomSubscription, localPlayer, language,
    isLocalPlayerMoving, currentZone, isSitting, setSitting
  } = useStore();

  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // New State for Reactions Dock
  const [showReactions, setShowReactions] = useState(false);
  // Reusing variable for toast, but repositioned
  const [zoneName, setZoneName] = useState<string | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  
  const isUIOpen = showRoomInfo || showFriendsList || showSettingsModal || showMobileMenu;

  const [isIdle, setIsIdle] = useState(false);
  const idleTimer = useRef<any>(null);
  const isUIOpenRef = useRef(false);
  
  const cinemaVideoRef = useRef<HTMLVideoElement>(null);
  const room = activeRoomId ? rooms[activeRoomId] : null;
  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;

  // Zone Change Toast Logic
  useEffect(() => {
    if (currentZone) {
        setZoneName(currentZone.name);
    }
  }, [currentZone]);

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

  const friendsInSelectedRoom = room ? friends.filter(friendId => room.subscribers.includes(friendId)) : [];

  // Idle Logic
  useEffect(() => {
    isUIOpenRef.current = isUIOpen;
    if (isUIOpenRef.current || isLocalPlayerMoving || showReactions) {
        setIsIdle(false);
        if (idleTimer.current) clearTimeout(idleTimer.current);
    } else {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => {
            setIsIdle(true);
        }, 3000);
    }
  }, [isUIOpen, isLocalPlayerMoving, showReactions]);

  useEffect(() => {
      const wakeUp = (e: Event) => {
          const target = e.target as HTMLElement;
          const isReactionBtn = target.closest('button');
          if (isReactionBtn && isIdle) return;
          if (target.closest('.touch-none') && e.type === 'touchmove') return;

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

  useEffect(() => { if (showSettingsModal) navigator.mediaDevices.enumerateDevices().then(setDevices); }, [showSettingsModal]);

  const isLocalCinemaStream = activeCinemaStream && screenStream && activeCinemaStream.id === screenStream.id;

  useEffect(() => {
    if (activeCinemaStream && cinemaVideoRef.current) {
        const vid = cinemaVideoRef.current;
        vid.srcObject = activeCinemaStream;
        if (isLocalCinemaStream) { vid.muted = true; vid.volume = 0; } 
        else { vid.muted = false; vid.volume = 1; }
        vid.playsInline = true;
        vid.play().catch(e => console.warn("Cinema play error", e));
    }
  }, [activeCinemaStream, isLocalCinemaStream]);

  const handleCopyId = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (room) {
          navigator.clipboard.writeText(room.id);
          audioSynth.playUiSuccess();
          setCopiedId(true);
          setTimeout(() => setCopiedId(false), 2000);
      }
  };

  const onlineFriends = (Object.values(peers) as PlayerState[]).filter(p => friends.includes(p.id));
  const currentTotalPlayers = Object.keys(peers).length + 1; 
  const btnClass = "btn-interactive cursor-pointer";

  // Push reactions down in standard view
  const shouldPushReactionsDown = isIdle && !isUIOpen && showReactions;

  return (
    <>
      <MobileControls />

      {incomingFriendRequest && (
        <div className="absolute top-32 left-0 right-0 flex justify-center z-[9999] pointer-events-auto">
            <div className="bg-black border border-white/20 p-4 rounded-lg shadow-2xl flex items-center gap-4 animate-bounce-in">
                 <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                 <div className="text-sm"><span className="font-bold">{incomingFriendRequest.fromName}</span> {t('add_friend')}?</div>
                 <div className="flex gap-2">
                     <button onClick={() => { audioSynth.playUiSuccess(); respondToFriendRequest(true); }} className="p-1 bg-green-500 rounded hover:bg-green-400 btn-interactive"><CheckIcon className="w-5 h-5 text-black" /></button>
                     <button onClick={() => { audioSynth.playUiClick(); respondToFriendRequest(false); }} className="p-1 bg-red-500 rounded hover:bg-red-400 btn-interactive"><XMarkIcon className="w-5 h-5 text-white" /></button>
                 </div>
            </div>
        </div>
      )}

      {incomingTeleport && (
        <div className="absolute top-20 left-0 right-0 flex justify-center z-[9999] pointer-events-auto">
            <div className="bg-black border border-white/20 p-4 rounded-lg shadow-2xl flex items-center gap-4 animate-bounce-in">
                 <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                 <div className="text-sm"><span className="font-bold">{incomingTeleport.fromName}</span> {t('tp_request')}</div>
                 <div className="flex gap-2">
                     <button onClick={() => { audioSynth.playUiSuccess(); respondToTeleport(true); }} className="p-1 bg-green-500 rounded hover:bg-green-400 btn-interactive"><CheckIcon className="w-5 h-5 text-black" /></button>
                     <button onClick={() => { audioSynth.playUiClick(); respondToTeleport(false); }} className="p-1 bg-red-500 rounded hover:bg-red-400 btn-interactive"><XMarkIcon className="w-5 h-5 text-white" /></button>
                 </div>
            </div>
        </div>
      )}

      {/* Top Bar Container */}
      <div className="absolute top-4 md:top-6 left-0 right-0 px-3 md:px-6 pointer-events-none flex flex-row justify-between items-start z-[200] safe-top landscape:scale-90 landscape:origin-top">
          {room && (
              <div className="pointer-events-auto relative z-50">
                  <div className="flex items-center gap-3">
                       <div className="flex gap-2">
                            {!room.rules.allowScreenShare && (<div title={t('rule_screen')} className="relative flex items-center justify-center"><ComputerDesktopIcon className="w-5 h-5 text-white/50" /><div className="absolute w-6 h-0.5 bg-white/50 rotate-45" /></div>)}
                            {room.rules.forbidMicMute && <MicrophoneIcon className="w-5 h-5 text-white/50" title={t('rule_mic')}/>}
                            {room.rules.preventIgnoring && <EyeSlashIcon className="w-5 h-5 text-white/50" title={t('rule_ignore')}/>}
                       </div>
                       {(room.rules.forbidMicMute || !room.rules.allowScreenShare || room.rules.preventIgnoring) && (<div className="w-px h-6 bg-white/10" />)}
                       <button onClick={() => { audioSynth.playUiClick(); setShowRoomInfo(!showRoomInfo); }} className="text-left group transition hover:opacity-80">
                            <h1 className="text-4xl font-black tracking-tighter leading-none drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] font-sans">R<span className="text-[#3a83f6]">oo</span>m8</h1>
                            <div className="text-xs font-medium text-gray-300 ml-0.5 group-hover:text-white transition">{getRoomName(room)}</div>
                       </button>
                  </div>
                
                {/* ROOM INFO MODAL (Fixed for Landscape/Mobile) */}
                {showRoomInfo && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 safe-bottom" onClick={() => setShowRoomInfo(false)}>
                        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-black/95 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden shadow-2xl animate-fade-in text-left relative max-h-screen overflow-y-auto landscape:max-h-[85vh]">
                            <div className="h-24 w-full relative flex-shrink-0" style={{ background: room.headerGradient || (room.type === 'day' ? 'linear-gradient(to right, #14532d, #1e3a8a)' : room.type === 'night' ? 'linear-gradient(to right, #000000, #312e81)' : 'linear-gradient(to right, #312e81, #1e40af)') }}>
                                <button onClick={() => setShowRoomInfo(false)} className="absolute top-2 right-2 bg-black/20 backdrop-blur p-1 rounded-full hover:bg-white hover:text-black transition z-10 text-white"><XMarkIcon className="w-5 h-5" /></button>
                                <div className="absolute bottom-3 left-4"><h3 className="font-black text-3xl drop-shadow-md text-white leading-none">{getRoomName(room)}</h3></div>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 pb-20 landscape:pb-6">
                                <div className="flex flex-col gap-4">
                                    <p className="text-sm text-gray-300 leading-relaxed min-h-[60px]">{getRoomDesc(room)}</p>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="bg-black border border-white/10 p-3 rounded-lg flex flex-col items-center"><span className="text-gray-500 uppercase block mb-1 font-bold text-[10px]">{t('online')}</span><span className="font-bold text-lg">{room.currentPlayers}</span></div>
                                        <div className="bg-black border border-white/10 p-3 rounded-lg flex flex-col items-center"><span className="text-gray-500 uppercase block mb-1 font-bold text-[10px]">{t('saved')}</span><span className="font-bold text-lg">{room.subscribers.length}</span></div>
                                        <div className="bg-black border border-white/10 p-3 rounded-lg flex flex-col items-center"><span className="text-gray-500 uppercase block mb-1 font-bold text-[10px]">{t('friends_btn')}</span><span className="font-bold text-lg">{friendsInSelectedRoom.length}</span></div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4">
                                    {room.isPrivate && (<div onClick={handleCopyId} className="bg-black border border-white/10 p-3 rounded-lg cursor-copy hover:bg-white/5 transition flex justify-between items-center"><div><div className="text-[10px] text-gray-500 uppercase">Room ID</div><div className="font-mono text-xs text-white">{room.id}</div></div>{copiedId ? <CheckIcon className="w-4 h-4 text-green-500" /> : <ClipboardDocumentIcon className="w-4 h-4 text-gray-400" />}</div>)}
                                    <button onClick={() => { audioSynth.playUiClick(); toggleRoomSubscription(room.id); }} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition border ${room.subscribers.includes(localPlayer.id) ? 'bg-white text-black border-white' : 'border-white/30 hover:bg-white/10 text-white'}`}>{room.subscribers.includes(localPlayer.id) ? <BookmarkSolid className="w-4 h-4"/> : <BookmarkOutline className="w-4 h-4"/>}{room.subscribers.includes(localPlayer.id) ? t('saved') : t('save')}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
              </div>
          )}

          {/* Top Right Buttons */}
          <div className="pointer-events-auto relative z-50 flex gap-2 items-start">
             {/* ZONE NAME INDICATOR (Moved here) */}
             {zoneName && (
                 <div className="hidden md:flex flex-col items-end mr-4 animate-fade-in transition-all">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Location</div>
                    <div className="text-base font-black text-white">{zoneName}</div>
                 </div>
             )}

             <div className="hidden md:flex gap-2">
                <button onMouseEnter={() => audioSynth.playUiHover()} onClick={() => { audioSynth.playUiClick(); setShowFriendsList(!showFriendsList); }} className={`p-3 rounded-xl transition border border-white/10 ${btnClass} h-[50px] w-[50px] ${showFriendsList ? 'bg-white text-black' : 'bg-black/60 backdrop-blur-md hover:bg-white/20 text-white'}`} title={t('friends_list')}><div className="relative flex items-center justify-center w-full h-full"><UserGroupIcon className="w-6 h-6" />{onlineFriends.length > 0 && <div className="absolute -top-2 -right-2 w-3 h-3 bg-blue-500 rounded-full border border-black" />}</div></button>
                <button onMouseEnter={() => audioSynth.playUiHover()} onClick={() => { audioSynth.playUiClick(); setShowSettingsModal(true); }} className={`p-3 rounded-xl transition border border-white/10 ${btnClass} h-[50px] w-[50px] ${showSettingsModal ? 'bg-white text-black' : 'bg-black/60 backdrop-blur-md hover:bg-white/20 text-white'}`} title={t('settings_title')}><div className="flex items-center justify-center w-full h-full"><Cog6ToothIcon className="w-6 h-6" /></div></button>
             </div>
             <div className="md:hidden relative">
                <button onClick={() => setShowMobileMenu(!showMobileMenu)} className={`p-3 rounded-xl transition border border-white/10 ${btnClass} h-[50px] w-[50px] flex items-center justify-center ${showMobileMenu ? 'bg-white text-black' : 'bg-black/60 backdrop-blur-md hover:bg-white/20 text-white'}`}>{showMobileMenu ? <XMarkIcon className="w-6 h-6"/> : <Bars3Icon className="w-6 h-6"/>}</button>
                {showMobileMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl p-2 flex flex-col gap-2 shadow-2xl animate-fade-in z-50">
                        <button onClick={() => { setShowFriendsList(!showFriendsList); setShowMobileMenu(false); }} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-white transition text-sm font-bold relative"><UserGroupIcon className="w-5 h-5 text-blue-400" /><span>{t('friends_list')}</span>{onlineFriends.length > 0 && <div className="w-2 h-2 bg-blue-500 rounded-full ml-auto" />}</button>
                        <button onClick={() => { setShowSettingsModal(true); setShowMobileMenu(false); }} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-white transition text-sm font-bold"><Cog6ToothIcon className="w-5 h-5 text-gray-400" /><span>{t('settings_title')}</span></button>
                        <div className="h-px bg-white/10 my-1" />
                         <button onClick={() => { leaveRoom(); setShowMobileMenu(false); }} className="flex items-center gap-3 p-3 rounded-lg hover:bg-red-500/20 text-red-400 transition text-sm font-bold"><ArrowRightOnRectangleIcon className="w-5 h-5" /><span>{t('exit')}</span></button>
                    </div>
                )}
             </div>
             <div className="p-3 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-white transition cursor-default h-[50px] w-[50px]"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mb-0.5 shadow-[0_0_5px_rgba(34,197,94,0.8)]" /><span className="font-mono font-bold text-xs">{formatCount(currentTotalPlayers)}</span></div>
             {showFriendsList && (
                  <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur border border-white/10 p-2 rounded-xl w-56 animate-fade-in shadow-xl z-50">
                      <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest px-2 flex justify-between items-center">
                        <span>{t('friends_list')}</span>
                        <button onClick={() => setShowFriendsList(false)} className="hover:text-white"><XMarkIcon className="w-3 h-3"/></button>
                      </div>
                      {onlineFriends.length === 0 && <div className="text-xs text-gray-400 italic px-2">{t('friends_empty')}</div>}
                      {onlineFriends.map(f => (<button key={f.id} onClick={() => { audioSynth.playUiClick(); requestTeleport(f.id); }} className="w-full text-left py-2 px-2 hover:bg-white/10 rounded-lg flex items-center justify-between text-sm transition btn-interactive"><span className="truncate max-w-[120px]">{f.name}</span><span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">TP</span></button>))}
                  </div>
              )}
          </div>
      </div>

      {/* UI Overlay Bottom */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end pb-6 md:pb-8 z-40 safe-bottom landscape:scale-90 landscape:origin-bottom">
        
        {/* MOBILE ZONE INDICATOR (Bottom Left) */}
        {zoneName && (
            <div className="md:hidden absolute bottom-24 left-4 pointer-events-none animate-fade-in">
                 <div className="bg-black/40 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-lg">
                    <div className="text-[8px] text-gray-400 uppercase tracking-widest font-bold">Location</div>
                    <div className="text-sm font-black text-white">{zoneName}</div>
                 </div>
            </div>
        )}

        {/* Standard Reaction Bar (Portrait/Desktop) - HIDDEN IN LANDSCAPE MOBILE */}
        {room && showReactions && (
            <div 
                className={`flex justify-center mb-6 pointer-events-auto transition-transform duration-500 animate-bounce-in landscape:hidden md:landscape:flex`}
                style={{ transform: shouldPushReactionsDown ? 'translateY(60px)' : 'translateY(0)' }}
            >
                <div className="flex gap-3 bg-black/80 backdrop-blur-md px-4 py-3 rounded-full border border-white/20 shadow-2xl">
                    {(room.allowedReactions || DEFAULT_REACTIONS).map((emoji) => (
                        <button key={emoji} onClick={(e) => { e.stopPropagation(); audioSynth.playReactionPop(); triggerReaction(emoji); }} className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-white/10 rounded-full transition hover:scale-125 active:scale-90">{emoji}</button>
                    ))}
                </div>
            </div>
        )}

        {/* MOBILE LANDSCAPE REACTION CONTAINER (Bottom Right) */}
        {room && (
            <div className="hidden landscape:flex md:landscape:hidden fixed bottom-4 right-4 pointer-events-auto flex-col-reverse items-end gap-2 z-50">
                {/* Jump Button (Mobile Landscape) */}
                 <ControlBtn 
                    active={false}
                    onTouchStart={() => setControls({ jump: true })}
                    onTouchEnd={() => setControls({ jump: false })}
                    onClick={() => {}}
                    icon={ArrowUpIcon}
                    label="Jump"
                    activeColor="text-white"
                    customClass="bg-black/60 backdrop-blur-xl border border-white/20 rounded-full h-[50px] w-[50px] mb-2"
                />

                <ControlBtn 
                    active={showReactions} 
                    onClick={() => { audioSynth.playUiClick(); setShowReactions(!showReactions); }} 
                    icon={FaceSmileIcon} 
                    label={t('reactions')} 
                    activeColor="text-yellow-400"
                    customClass="bg-black/60 backdrop-blur-xl border border-white/20 rounded-full h-[50px] w-[50px]"
                />
                
                {/* Stand Up Button (Mobile Landscape) */}
                {isSitting && (
                    <button 
                        onClick={() => setSitting(false)}
                        className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-full h-[50px] w-[50px] flex items-center justify-center text-white mb-2"
                    >
                        <ArrowUpIcon className="w-6 h-6" />
                    </button>
                )}
                
                {/* Vertical List Popping Up */}
                {showReactions && (
                    <div className="flex flex-col gap-2 bg-black/80 backdrop-blur-md p-2 rounded-full border border-white/20 animate-fade-in">
                        {(room.allowedReactions || DEFAULT_REACTIONS).map((emoji) => (
                            <button key={emoji} onClick={(e) => { e.stopPropagation(); audioSynth.playReactionPop(); triggerReaction(emoji); }} className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-white/10 rounded-full transition hover:scale-125 active:scale-90">{emoji}</button>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* Main Dock */}
        <div className={`flex justify-center pointer-events-auto w-full px-4 transition-all duration-500 ${isIdle && !isUIOpen ? 'opacity-0 translate-y-20 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-xl px-2 py-2 rounded-2xl border border-white/10 shadow-2xl overflow-x-auto max-w-full no-scrollbar">
            
            {/* Mic */}
            {!room?.rules.forbidMicMute && (
                <>
                <ControlBtn active={micEnabled} onClick={() => { audioSynth.playUiClick(); toggleMic(); }} icon={MicrophoneIcon} offIcon={MicOff} label={t('mic')} activeColor={micEnabled ? 'text-white' : 'bg-red-500/20 text-red-500'} customClass={!micEnabled ? 'bg-red-900/30 text-red-500' : ''} extra={micEnabled && <AudioVisualizer stream={micStream} active={micEnabled} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm bg-black/50" width={8} height={16} />} />
                <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />
                </>
            )}
            
            {/* Audio */}
             {!room?.rules.forbidMicMute && (
                 <>
                <ControlBtn active={audioEnabled} onClick={() => { audioSynth.playUiClick(); if (audioEnabled) { stopScreenShare(); toggleAudio(); } else { if (!screenShareEnabled) { startScreenShare().then(() => { if (useStore.getState().screenShareEnabled && !useStore.getState().audioEnabled) toggleAudio(); }); } else { toggleAudio(); } } }} icon={SpeakerWaveIcon} offIcon={SpeakerXMarkIcon} label={t('sound')} activeColor="text-white" customClass={!audioEnabled ? 'bg-red-900/30 text-red-500' : ''} extra={audioEnabled && <AudioVisualizer stream={screenStream} active={audioEnabled} color="#3b82f6" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm bg-black/50" width={8} height={16} />} />
                <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />
                </>
             )}
            
            {/* Screen */}
            {room?.rules.allowScreenShare && (
                <>
                <ControlBtn active={screenShareEnabled} onClick={() => { audioSynth.playUiClick(); if (screenShareEnabled) { stopScreenShare(); } else { startScreenShare(); } }} icon={ComputerDesktopIcon} offIcon={ScreenOff} label={t('screen')} activeColor="text-white" />
                <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />
                </>
            )}

            {/* Reactions Toggle - HIDDEN IN LANDSCAPE MOBILE */}
            <div className="flex items-center landscape:hidden md:landscape:flex">
                <ControlBtn 
                    active={showReactions} 
                    onClick={() => { audioSynth.playUiClick(); setShowReactions(!showReactions); }} 
                    icon={FaceSmileIcon} 
                    label={t('reactions')} 
                    activeColor="text-yellow-400"
                />
                
                {/* Jump Button (Mobile Only - Hidden on MD+ & Hidden on Landscape Mobile) */}
                <div className="md:hidden mx-1 landscape:hidden">
                    <ControlBtn 
                        active={false}
                        onTouchStart={() => setControls({ jump: true })}
                        onTouchEnd={() => setControls({ jump: false })}
                        onClick={() => {}} // No click, only touch/press for jump to avoid loops
                        icon={ArrowUpIcon}
                        label="Jump"
                        activeColor="text-white"
                        customClass="bg-white/10 rounded-full w-12 h-12"
                    />
                </div>
                
                {/* Sit/Stand Toggle (Mobile Only - Hidden on MD+) */}
                {isSitting && (
                    <div className="md:hidden mx-1 landscape:hidden">
                        <ControlBtn 
                            active={false}
                            onClick={() => setSitting(false)}
                            icon={ArrowUpIcon}
                            label="Stand"
                            activeColor="text-white"
                            customClass="bg-white/10 rounded-full w-12 h-12"
                        />
                    </div>
                )}
            </div>

            {/* Exit Button (Hidden on Mobile dock, moved to menu) */}
            <div className="hidden md:flex items-center ml-1 pl-1 border-l border-white/10">
                 <ControlBtn active={false} onClick={() => { audioSynth.playUiClick(); leaveRoom(); }} icon={ArrowRightOnRectangleIcon} offIcon={ArrowRightOnRectangleIcon} label={t('exit')} activeColor="bg-red-500/20 text-red-500" customClass="hover:bg-red-500/20 hover:text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {activeCinemaStream && (
        <div className="absolute inset-0 z-[250] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
            <button onClick={() => setActiveCinemaStream(null)} className="absolute top-6 right-6 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full btn-interactive z-50"><XMarkIcon className="w-8 h-8" /></button>
            <div className="w-full max-w-7xl aspect-video bg-black rounded-2xl shadow-2xl overflow-hidden border border-gray-800 animate-bounce-in relative">
                <video ref={cinemaVideoRef} autoPlay controls muted={isLocalCinemaStream} className="w-full h-full object-contain" style={{ maxHeight: '85vh' }} />
            </div>
        </div>
      )}
      
      {showSettingsModal && (
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-black border border-white/20 rounded-xl w-full max-w-sm p-8 relative flex flex-col animate-bounce-in shadow-2xl max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold">{t('settings_title')}</h2>
                      <button onClick={() => setShowSettingsModal(false)} className="hover:opacity-70 p-1"><XMarkIcon className="w-6 h-6" /></button>
                  </div>
                  <div className="space-y-6">
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('mic')}</label>
                         <select className="w-full h-[50px] bg-black border-2 border-white/20 rounded-xl text-white px-4 outline-none text-sm focus:border-blue-500" value={selectedMicId} onChange={(e) => setAudioDevice('mic', e.target.value)}>
                            <option value="">{t('mic_default')}</option>
                            {devices.filter(d => d.kind === 'audioinput').map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.substr(0, 5)}`}</option>
                            ))}
                         </select>
                     </div>
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('sound')} (Output)</label>
                         <select className="w-full h-[50px] bg-black border-2 border-white/20 rounded-xl text-white px-4 outline-none text-sm focus:border-blue-500" value={selectedSpeakerId} onChange={(e) => setAudioDevice('speaker', e.target.value)}>
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
    </>
  );
};
