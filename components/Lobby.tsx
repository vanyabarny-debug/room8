
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { COLORS, DEFAULT_REACTIONS, AVAILABLE_EMOJIS, TRANSLATIONS } from '../constants';
import { ShapeType, EnvironmentType, RoomConfig, Language } from '../types';
import { XMarkIcon, PlusIcon, UserIcon, UserGroupIcon, ComputerDesktopIcon, MicrophoneIcon, ArrowLeftOnRectangleIcon, EyeSlashIcon, BookmarkIcon as BookmarkSolid, Cog6ToothIcon, LockClosedIcon, TrashIcon, PaintBrushIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline';
import { audioSynth } from '../services/AudioSynthesizer';

// Toggle Component
const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/10">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <div 
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-800'}`}
            onClick={() => onChange(!checked)}
        >
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
        </div>
    </div>
);

export const Lobby = () => {
  const { 
      localPlayer, updateLocalPlayerConfig, setPlayerName,
      rooms, registerRoom, joinRoom, setInGame, 
      hasOnboarded, setOnboarded, logout,
      friends, toggleRoomSubscription, updateRoomDetails,
      language, setLanguage,
      selectedMicId, selectedSpeakerId, setAudioDevice
  } = useStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  
  // Create Room State
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [roomType, setRoomType] = useState<EnvironmentType>('day');
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowScreenShare, setAllowScreenShare] = useState(true);
  const [forbidMicMute, setForbidMicMute] = useState(false);
  const [preventIgnoring, setPreventIgnoring] = useState(false);
  const [gradientColors, setGradientColors] = useState<string[]>(['#1e3a8a', '#000000']);
  
  // Emoji Selection
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>(DEFAULT_REACTIONS);
  const [editingEmojiIndex, setEditingEmojiIndex] = useState<number | null>(null);

  // Room Details Modal
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Join Room State
  const [joinId, setJoinId] = useState('');

  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;

  useEffect(() => {
    if (showSettings) {
        navigator.mediaDevices.enumerateDevices().then(setDevices);
    }
  }, [showSettings]);

  // Helper for dynamic room translation
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

  const selectedRoom = selectedRoomId ? rooms[selectedRoomId] : null;

  // Calculate friends in room (Intersection of room subscribers and user friends as proxy for this demo)
  const friendsInSelectedRoom = selectedRoom 
    ? friends.filter(friendId => selectedRoom.subscribers.includes(friendId)) 
    : [];

  const handleEnterApp = () => {
    if (!localPlayer.name.trim()) return;
    audioSynth.playUiSuccess();
    setPlayerName(localPlayer.name); 
    setOnboarded(true);
  };

  const generateRoomId = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  // Gradient Helpers
  const handleAddColor = () => {
      if (gradientColors.length < 7) {
          setGradientColors([...gradientColors, '#ffffff']);
      }
  };

  const handleRemoveColor = (index: number) => {
      if (gradientColors.length > 2) {
          const newColors = [...gradientColors];
          newColors.splice(index, 1);
          setGradientColors(newColors);
      }
  };

  const handleUpdateColor = (index: number, val: string) => {
      const newColors = [...gradientColors];
      newColors[index] = val;
      setGradientColors(newColors);
  };

  const getGradientString = () => {
      return `linear-gradient(to right, ${gradientColors.join(', ')})`;
  };

  // Emoji Helpers
  const handleEmojiClick = (emoji: string) => {
      if (editingEmojiIndex !== null) {
          const newEmojis = [...selectedEmojis];
          newEmojis[editingEmojiIndex] = emoji;
          setSelectedEmojis(newEmojis);
          setEditingEmojiIndex(null);
      }
  };

  const handleCreate = () => {
    if (!roomName.trim()) {
        alert(t('room_name'));
        return;
    }
    audioSynth.playUiSuccess();
    const roomId = generateRoomId();
    
    const newRoom: RoomConfig = {
      id: roomId,
      name: roomName,
      description: roomDesc || 'No description',
      type: roomType,
      region: language, 
      isPrivate: isPrivate,
      isOfficial: false,
      creatorId: localPlayer.id,
      subscribers: [localPlayer.id],
      createdAt: Date.now(),
      rules: { 
          allowScreenShare, 
          forbidMicMute, 
          preventIgnoring 
      },
      headerGradient: getGradientString(),
      maxPlayers: 20, 
      currentPlayers: 1, 
      allowedReactions: selectedEmojis
    };

    registerRoom(newRoom);
    setShowCreateModal(false);
    joinRoom(roomId);
    setInGame(true);
  };

  const handleJoin = (id: string) => {
    audioSynth.playUiClick();
    const lowerId = id.trim().toLowerCase();
    const foundRoom = (Object.values(rooms) as RoomConfig[]).find(r => r.id.toLowerCase() === lowerId);

    if (!foundRoom) {
        alert("Room not found");
        return;
    }

    joinRoom(foundRoom.id);
    setInGame(true);
  };

  const handleRoomClick = (room: RoomConfig) => {
      audioSynth.playUiClick();
      setSelectedRoomId(room.id);
      setEditMode(false);
      setEditName(getRoomName(room));
      setEditDesc(getRoomDesc(room));
  };

  const handleSaveEdit = () => {
      if(selectedRoomId && editName.trim()) {
          updateRoomDetails(selectedRoomId, { name: editName, description: editDesc });
          setEditMode(false);
      }
  }

  const handleCreatePrivateOffice = () => {
      audioSynth.playUiSuccess();
      setRoomType('office');
      setIsPrivate(true);
      setRoomName('My Private Office');
      setRoomDesc('A private space for meetings.');
      setGradientColors(['#1e1e2e', '#3b82f6']);
      setShowCreateModal(true);
      setSelectedRoomId(null);
  };

  const btnClass = "btn-interactive cursor-pointer";

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

  const LANG_ICONS: Record<Language, string> = {
      en: '🇺🇸', ru: '🇷🇺', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹', cn: '🇨🇳', jp: '🇯🇵', th: '🇹🇭'
  };

  // --- Step 0: Onboarding ---
  if (!hasOnboarded) {
    return (
      <div className="absolute inset-0 liquid-bg flex flex-col items-center justify-center p-6 z-50 text-center">
        
        {/* Language Switcher */}
        <div className="absolute top-6 right-6 z-50">
            <button 
                onClick={() => setShowLangModal(!showLangModal)}
                className="text-4xl hover:scale-110 transition btn-interactive drop-shadow-md"
                title="Change Language"
            >
                {LANG_ICONS[language]}
            </button>
            
            {showLangModal && (
                <div className="absolute top-14 right-0 bg-black border border-white/20 rounded-xl p-2 flex flex-col gap-1 w-48 shadow-2xl animate-fade-in z-50">
                     {(Object.keys(LANG_FLAGS) as Language[]).map(l => (
                        <button 
                            key={l}
                            onClick={() => { setLanguage(l); setShowLangModal(false); }}
                            className={`px-4 py-3 text-left rounded-lg text-sm hover:bg-white/10 flex items-center gap-3 transition ${language === l ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span className="text-xl">{LANG_ICONS[l]}</span>
                            <span>{LANG_FLAGS[l].split(' ')[1]}</span>
                        </button>
                     ))}
                </div>
            )}
        </div>

        {/* Minimal Login */}
        <div className="w-full max-w-sm animate-fade-in flex flex-col items-center gap-12">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-white drop-shadow-lg">
                R<span className="text-[#3a83f6]">oo</span>m8
            </h1>
            <p className="text-white/60 text-lg">{t('welcome_title')}</p>
          </div>

          <div className="w-full flex flex-col gap-8 items-center">
             <input 
              type="text" 
              autoFocus
              value={localPlayer.name}
              placeholder={t('enter_name')}
              onChange={(e) => updateLocalPlayerConfig({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleEnterApp()}
              className="minimal-input"
            />
            
            <button 
                onClick={handleEnterApp}
                onMouseEnter={() => audioSynth.playUiHover()}
                disabled={!localPlayer.name}
                className={`w-auto px-12 py-4 rounded-xl text-xl font-bold transition-all transform hover:scale-[1.02] shadow-lg
                    ${localPlayer.name 
                        ? 'bg-white text-black hover:bg-gray-200' 
                        : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
            >
                {t('enter_btn')}
            </button>
          </div>
          
          <div className="text-[11px] text-white/40 max-w-xs leading-relaxed">
              <span>{t('legal_agree')} </span>
              <button onClick={() => setShowLegalModal('terms')} className="underline hover:text-white transition">{t('legal_terms')}</button>
              <span> {t('legal_and')} </span>
              <button onClick={() => setShowLegalModal('privacy')} className="underline hover:text-white transition">{t('legal_privacy')}</button>.
          </div>
        </div>

        {/* Legal Modal */}
        {showLegalModal && (
            <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-black border border-white/20 rounded-xl max-w-lg w-full p-8 relative flex flex-col shadow-2xl">
                    <button 
                        onClick={() => setShowLegalModal(null)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                    <h3 className="text-2xl font-bold mb-6 text-white border-b border-white/10 pb-4">
                        {showLegalModal === 'terms' ? t('legal_modal_terms_title') : t('legal_modal_privacy_title')}
                    </h3>
                    <div className="text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scroll text-sm">
                        {showLegalModal === 'terms' ? t('legal_modal_terms_text') : t('legal_modal_privacy_text')}
                    </div>
                    <button 
                        onClick={() => setShowLegalModal(null)}
                        className="mt-8 bg-white text-black font-bold py-3 rounded-xl transition hover:bg-gray-200"
                    >
                        OK
                    </button>
                </div>
            </div>
        )}
      </div>
    );
  }

  // Sorting Logic for Rooms
  const visibleRooms = (Object.values(rooms) as RoomConfig[]).filter(room => !room.isPrivate && room.region === language);
  visibleRooms.sort((a, b) => {
      const aSub = a.subscribers.includes(localPlayer.id);
      const bSub = b.subscribers.includes(localPlayer.id);
      if (aSub && !bSub) return -1;
      if (!bSub && aSub) return 1;
      return 0;
  });

  // --- Step 1: Main Menu (Lobby) ---
  return (
    <div className="absolute inset-0 bg-black text-white flex flex-col overflow-hidden font-sans">
        
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between p-6 z-20 relative gap-4">
        <div className="flex flex-col items-center md:items-start">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter">
                R<span className="text-[#3a83f6]">oo</span>m8
            </h1>
        </div>
        
        <div className="flex gap-3">
            <button 
                onMouseEnter={() => audioSynth.playUiHover()} 
                onClick={() => { audioSynth.playUiClick(); setShowFriends(!showFriends); }} 
                className={`w-12 h-12 flex items-center justify-center rounded-xl transition border border-white/10 ${btnClass} ${showFriends ? 'bg-white text-black' : 'bg-black hover:bg-white/10 text-white'}`}
                title={t('friends_list')}
            >
                <UserGroupIcon className="w-6 h-6" />
            </button>
            <button 
                onMouseEnter={() => audioSynth.playUiHover()} 
                onClick={() => { audioSynth.playUiClick(); setShowProfile(!showProfile); }} 
                className={`w-12 h-12 flex items-center justify-center rounded-xl transition border border-white/10 ${btnClass} ${showProfile ? 'bg-white text-black' : 'bg-black hover:bg-white/10 text-white'}`}
                title={t('profile_settings')}
            >
                <UserIcon className="w-6 h-6" />
            </button>
            <button 
                onMouseEnter={() => audioSynth.playUiHover()} 
                onClick={() => { audioSynth.playUiClick(); setShowSettings(!showSettings); }} 
                className={`w-12 h-12 flex items-center justify-center rounded-xl transition border border-white/10 ${btnClass} ${showSettings ? 'bg-white text-black' : 'bg-black hover:bg-white/10 text-white'}`}
                title={t('settings_title')}
            >
                <Cog6ToothIcon className="w-6 h-6" />
            </button>
        </div>
      </div>

      {/* Friends Panel */}
      {showFriends && (
          <div className="bg-black border-b border-white/10 p-4 flex flex-col items-center animate-fade-in relative z-20">
              {friends.length === 0 ? (
                  <div className="text-gray-600 text-sm">{t('friends_empty')}</div>
              ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2 w-full justify-center">
                      {friends.map(fid => (
                          <div key={fid} className="bg-black border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-sm font-mono">{fid.substring(0,8)}</span> 
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* Profile Panel */}
      {showProfile && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-black border border-white/10 p-8 rounded-xl w-full max-w-sm flex flex-col relative overflow-hidden shadow-2xl max-h-[90vh] animate-bounce-in">
                 <button onClick={() => setShowProfile(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white z-10"><XMarkIcon className="w-6 h-6" /></button>
                 
                 <div className="flex flex-col gap-8 w-full overflow-y-auto custom-scroll pr-1">
                     <h2 className="text-2xl font-bold">{t('profile_settings')}</h2>
                     
                     <div className="flex flex-col gap-2">
                         <label className="text-xs uppercase tracking-widest text-gray-500 font-bold">{t('nickname')}</label>
                         <div className="relative group">
                            <input 
                                value={localPlayer.name}
                                onChange={(e) => setPlayerName(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:border-blue-500 outline-none font-bold placeholder-gray-700 transition"
                                placeholder={t('nickname')}
                            />
                        </div>
                     </div>

                     <div>
                         <label className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3 block">{t('shape')}</label>
                         <div className="flex justify-between gap-2">
                            {(['box', 'sphere', 'cone', 'cylinder'] as ShapeType[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => { audioSynth.playUiClick(); updateLocalPlayerConfig({ shape: s }); }}
                                    className={`w-14 h-14 flex items-center justify-center rounded-xl border-2 transition-all ${btnClass}
                                    ${localPlayer.shape === s ? 'border-white text-white bg-black' : 'border-transparent bg-black text-gray-500 hover:border-white/20 hover:text-white'}`}
                                >
                                    {s === 'box' && <div className="w-6 h-6 bg-current rounded-sm" />}
                                    {s === 'sphere' && <div className="w-6 h-6 bg-current rounded-full" />}
                                    {s === 'cone' && <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px] border-b-current" />}
                                    {s === 'cylinder' && <div className="w-5 h-6 bg-current rounded-sm" />}
                                </button>
                            ))}
                         </div>
                     </div>

                     <div>
                        <label className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3 block">{t('color')}</label>
                        <div className="flex flex-wrap gap-3">
                            {COLORS.map(c => (
                                <button
                                key={c}
                                onClick={() => { audioSynth.playUiClick(); updateLocalPlayerConfig({ color: c }); }}
                                className={`w-9 h-9 rounded-full border-2 transition-transform ${btnClass} ${localPlayer.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={() => { audioSynth.playUiClick(); logout(); }}
                        className={`mt-4 w-full flex items-center justify-center gap-2 text-red-400 text-sm hover:text-white transition px-4 py-4 border border-red-900/30 rounded-xl hover:bg-red-900/20 ${btnClass}`}
                    >
                        <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                        <span>{t('logout')}</span>
                    </button>
                 </div>
            </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-black border border-white/10 rounded-xl w-full max-w-sm p-8 relative flex flex-col animate-bounce-in max-h-[90vh] overflow-y-auto custom-scroll">
                  <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold">{t('settings_title')}</h2>
                      <button onClick={() => setShowSettings(false)} className="hover:text-gray-300 p-1">
                          <XMarkIcon className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="space-y-6">
                      <div className="border-b border-white/10 pb-6">
                          <label className="text-xs uppercase text-gray-500 mb-3 block font-bold">{t('language')}</label>
                          <div className="grid grid-cols-2 gap-2">
                              {(Object.keys(LANG_FLAGS) as Language[]).map(l => (
                                  <button 
                                    key={l}
                                    onClick={() => { audioSynth.playUiClick(); setLanguage(l); }}
                                    className={`py-3 px-3 text-sm rounded-lg border text-left transition ${language === l ? 'bg-blue-600 text-white border-blue-500 font-bold' : 'border-white/10 text-gray-400 hover:border-white/30 hover:bg-white/5'}`}
                                  >
                                      {LANG_FLAGS[l]}
                                  </button>
                              ))}
                          </div>
                      </div>

                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('mic')}</label>
                         <select 
                            className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none"
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
                            className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none"
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

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-black border border-white/10 rounded-xl w-full max-w-md p-6 relative flex flex-col animate-bounce-in max-h-[95vh] overflow-y-auto custom-scroll shadow-2xl">
                 <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                     <h2 className="text-xl font-bold">{t('create_title')}</h2>
                     <button onClick={() => setShowCreateModal(false)}><XMarkIcon className="w-6 h-6 text-gray-400 hover:text-white" /></button>
                 </div>
                 
                 <div className="space-y-5">
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('room_name')}</label>
                         <input 
                            value={roomName}
                            onChange={e => setRoomName(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                            placeholder={t('room_name')}
                         />
                     </div>
                     
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('room_desc')}</label>
                         <textarea 
                            value={roomDesc}
                            onChange={e => setRoomDesc(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none min-h-[80px]"
                            placeholder={t('room_desc')}
                         />
                     </div>

                     {/* Custom Gradient Picker */}
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">Cover Gradient</label>
                         <div className="flex flex-col gap-3 p-4 bg-black border border-white/10 rounded-xl">
                             <div 
                                className="w-full h-12 rounded-lg mb-2 border border-white/10"
                                style={{ background: getGradientString() }} 
                             />
                             <div className="flex flex-wrap gap-2">
                                 {gradientColors.map((color, idx) => (
                                     <div key={idx} className="relative group">
                                         <input 
                                            type="color" 
                                            value={color}
                                            onChange={(e) => handleUpdateColor(idx, e.target.value)}
                                            className="w-8 h-8 rounded-full overflow-hidden border-none p-0 cursor-pointer"
                                         />
                                         {gradientColors.length > 2 && (
                                            <button 
                                                onClick={() => handleRemoveColor(idx)}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-sm"
                                            >
                                                <XMarkIcon className="w-2 h-2" />
                                            </button>
                                         )}
                                     </div>
                                 ))}
                                 {gradientColors.length < 7 && (
                                     <button 
                                        onClick={handleAddColor}
                                        className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 text-white transition"
                                     >
                                         <PlusIcon className="w-4 h-4" />
                                     </button>
                                 )}
                             </div>
                             <p className="text-[10px] text-gray-500">Pick 2-7 colors for the room card header.</p>
                         </div>
                     </div>

                     {/* Emoji Selection */}
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('reactions')}</label>
                         <div className="flex gap-2 mb-2">
                             {selectedEmojis.map((emoji, index) => (
                                 <button
                                    key={index}
                                    onClick={() => setEditingEmojiIndex(index === editingEmojiIndex ? null : index)}
                                    className={`w-10 h-10 flex items-center justify-center bg-black border ${editingEmojiIndex === index ? 'border-blue-500' : 'border-white/10'} rounded-lg hover:bg-white/5 transition text-xl`}
                                 >
                                     {emoji}
                                 </button>
                             ))}
                         </div>
                         
                         {editingEmojiIndex !== null && (
                             <div className="grid grid-cols-8 gap-2 bg-black border border-white/10 p-2 rounded-xl mt-2 max-h-40 overflow-y-auto custom-scroll">
                                 {AVAILABLE_EMOJIS.map(emoji => (
                                     <button
                                        key={emoji}
                                        onClick={() => handleEmojiClick(emoji)}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded text-lg"
                                     >
                                         {emoji}
                                     </button>
                                 ))}
                             </div>
                         )}
                     </div>
                     
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('location')}</label>
                         <div className="grid grid-cols-3 gap-2">
                             {(['day', 'night', 'office'] as EnvironmentType[]).map(type => (
                                 <button
                                    key={type}
                                    onClick={() => setRoomType(type)}
                                    className={`py-2 rounded-xl border text-sm capitalize ${roomType === type ? 'bg-white text-black border-white' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}
                                 >
                                     {t(type as any)}
                                 </button>
                             ))}
                         </div>
                     </div>

                     <div className="bg-black border border-white/10 rounded-xl p-4 space-y-1">
                        <Toggle label={t('private')} checked={isPrivate} onChange={setIsPrivate} />
                        <Toggle label={t('rule_screen')} checked={allowScreenShare} onChange={setAllowScreenShare} />
                        <Toggle label={t('rule_mic')} checked={forbidMicMute} onChange={setForbidMicMute} />
                        <Toggle label={t('rule_ignore')} checked={preventIgnoring} onChange={setPreventIgnoring} />
                     </div>

                     <button 
                        onClick={handleCreate}
                        disabled={!roomName}
                        className={`w-full py-4 rounded-xl font-bold text-lg mt-2 ${roomName ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/10 text-gray-500'}`}
                     >
                         {t('create_room')}
                     </button>
                 </div>
             </div>
        </div>
      )}

       {/* Room Details Modal */}
      {selectedRoom && (
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-black border border-white/10 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-bounce-in relative flex flex-col">
                  
                  {/* Color header based on room settings or type */}
                  <div 
                    className="h-40 w-full"
                    style={{ background: selectedRoom.headerGradient || (selectedRoom.type === 'day' ? 'linear-gradient(to right, #14532d, #1e3a8a)' : selectedRoom.type === 'night' ? 'linear-gradient(to right, #000000, #312e81)' : 'linear-gradient(to right, #312e81, #1e40af)') }} 
                  />
                  
                  <button onClick={() => setSelectedRoomId(null)} className="absolute top-4 right-4 bg-black/20 backdrop-blur p-2 rounded-full hover:bg-white hover:text-black transition z-10 text-white">
                      <XMarkIcon className="w-6 h-6" />
                  </button>

                  <div className="p-6 md:p-10 -mt-16 relative z-10 flex flex-col gap-6">
                      <div className="flex flex-col">
                        <div className="flex justify-between items-start">
                             {editMode ? (
                                <input 
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="text-4xl md:text-5xl font-bold bg-black/50 border border-white/30 rounded p-1 w-full mr-4 text-white"
                                />
                            ) : (
                                <h2 className="text-4xl md:text-5xl font-black drop-shadow-xl leading-tight">{getRoomName(selectedRoom)}</h2>
                            )}
                        </div>
                        
                        <div className="mt-4 flex gap-3">
                            <button 
                                onClick={() => toggleRoomSubscription(selectedRoom.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition border inline-flex ${btnClass} 
                                ${selectedRoom.subscribers.includes(localPlayer.id) ? 'bg-white text-black border-white' : 'border-white/30 hover:bg-white/10 text-white'}`}
                            >
                                {selectedRoom.subscribers.includes(localPlayer.id) ? <BookmarkSolid className="w-5 h-5"/> : <BookmarkOutline className="w-5 h-5"/>}
                                {selectedRoom.subscribers.includes(localPlayer.id) ? t('saved') : t('save')}
                            </button>
                        </div>
                      </div>

                      {editMode ? (
                          <textarea 
                             value={editDesc}
                             onChange={e => setEditDesc(e.target.value)}
                             className="w-full bg-black/50 border border-white/30 rounded p-2 text-gray-300 min-h-[80px]"
                          />
                      ) : (
                          <p className="text-gray-300 text-lg leading-relaxed font-light">{getRoomDesc(selectedRoom)}</p>
                      )}

                      {/* Stats with Tooltip for Friends */}
                      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                           <div className="bg-black border border-white/10 p-3 rounded-lg flex flex-col items-center">
                                <span className="text-gray-500 uppercase block mb-1 font-bold">{t('online')}</span>
                                <span className="font-bold text-lg">{selectedRoom.currentPlayers}</span>
                           </div>
                           <div className="bg-black border border-white/10 p-3 rounded-lg flex flex-col items-center">
                                <span className="text-gray-500 uppercase block mb-1 font-bold">{t('saved')}</span>
                                <span className="font-bold text-lg">{selectedRoom.subscribers.length}</span>
                           </div>
                           <div className="bg-black border border-white/10 p-3 rounded-lg flex flex-col items-center relative group">
                                <span className="text-gray-500 uppercase block mb-1 font-bold">{t('friends_btn')}</span>
                                <span className="font-bold text-lg">{friendsInSelectedRoom.length}</span>
                                
                                {friendsInSelectedRoom.length > 0 && (
                                    <div className="absolute bottom-full mb-2 bg-black border border-white/20 p-2 rounded shadow-xl hidden group-hover:block w-32 z-20">
                                        <div className="text-[10px] uppercase text-gray-500 mb-1 border-b border-white/10 pb-1">Saved by</div>
                                        {friendsInSelectedRoom.map(fid => (
                                            <div key={fid} className="text-xs truncate text-gray-300">{fid.substring(0,8)}...</div>
                                        ))}
                                    </div>
                                )}
                           </div>
                      </div>

                      {/* Explicit Rules List */}
                      <div className="border-t border-white/10 pt-4">
                          <h4 className="text-xs uppercase text-gray-500 font-bold mb-3 tracking-widest">{t('rules')}</h4>
                          <div className="grid grid-cols-1 gap-2">
                              <div className="flex items-center justify-between p-2 rounded-lg bg-black border border-white/10">
                                  <div className="flex items-center gap-3">
                                      <ComputerDesktopIcon className={`w-5 h-5 ${selectedRoom.rules.allowScreenShare ? 'text-green-400' : 'text-red-400'}`} />
                                      <span className="text-sm font-medium">Screen Share</span>
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${selectedRoom.rules.allowScreenShare ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                      {selectedRoom.rules.allowScreenShare ? 'Allowed' : 'Forbidden'}
                                  </span>
                              </div>
                              <div className="flex items-center justify-between p-2 rounded-lg bg-black border border-white/10">
                                  <div className="flex items-center gap-3">
                                      <MicrophoneIcon className={`w-5 h-5 ${!selectedRoom.rules.forbidMicMute ? 'text-green-400' : 'text-red-400'}`} />
                                      <span className="text-sm font-medium">Mute Mic</span>
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${!selectedRoom.rules.forbidMicMute ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                      {!selectedRoom.rules.forbidMicMute ? 'Allowed' : 'Forbidden'}
                                  </span>
                              </div>
                              <div className="flex items-center justify-between p-2 rounded-lg bg-black border border-white/10">
                                  <div className="flex items-center gap-3">
                                      <EyeSlashIcon className={`w-5 h-5 ${!selectedRoom.rules.preventIgnoring ? 'text-green-400' : 'text-red-400'}`} />
                                      <span className="text-sm font-medium">Ignore Users</span>
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${!selectedRoom.rules.preventIgnoring ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                      {!selectedRoom.rules.preventIgnoring ? 'Allowed' : 'Forbidden'}
                                  </span>
                              </div>
                          </div>
                      </div>

                      <div className="flex flex-col md:flex-row justify-between items-center border-t border-white/10 pt-6 gap-4">
                          <div className="flex gap-4">
                             {localPlayer.id === selectedRoom.creatorId && !selectedRoom.isOfficial && (
                                 !editMode ? (
                                    <button onClick={() => setEditMode(true)} className="text-sm text-gray-400 hover:text-white underline">{t('edit')}</button>
                                 ) : (
                                     <div className="flex gap-2">
                                         <button onClick={handleSaveEdit} className="text-sm text-green-400 hover:text-green-300 underline">{t('save')}</button>
                                         <button onClick={() => setEditMode(false)} className="text-sm text-red-400 hover:text-red-300 underline">{t('cancel')}</button>
                                     </div>
                                 )
                             )}
                          </div>
                          
                          {selectedRoom.type === 'office' && selectedRoom.isOfficial ? (
                              <button 
                                onClick={handleCreatePrivateOffice}
                                className={`w-full md:w-auto px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition text-lg shadow-lg ${btnClass}`}
                              >
                                  {t('create_private_office')}
                              </button>
                          ) : (
                              <button 
                                onClick={() => { joinRoom(selectedRoom.id); setInGame(true); }}
                                className={`w-full md:w-auto px-10 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition text-lg shadow-lg ${btnClass}`}
                              >
                                  {t('enter_world')}
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Room List Input Bar */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scroll z-10 relative">
         <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex flex-col md:flex-row gap-3 mb-8 w-full">
                <input 
                    value={joinId}
                    onChange={e => setJoinId(e.target.value)}
                    placeholder={t('enter_code_placeholder')}
                    className="flex-1 bg-black border border-white/20 rounded-xl px-4 py-4 focus:border-white outline-none text-lg text-white placeholder:text-gray-600 w-full"
                />
                <div className="flex gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => handleJoin(joinId)} 
                        disabled={!joinId} 
                        className={`flex-1 md:flex-none px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50 transition ${btnClass} min-w-[120px]`}
                    >
                        {t('enter_room_btn')}
                    </button>
                    <button 
                        onMouseEnter={() => audioSynth.playUiHover()} 
                        onClick={() => { audioSynth.playUiClick(); setShowCreateModal(true); }} 
                        className={`px-4 py-4 bg-[#3a83f6] text-white rounded-xl hover:bg-blue-600 transition flex items-center justify-center ${btnClass} aspect-square`}
                        title={t('create_room')}
                    >
                        <PlusIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4 ml-1">{t('open_worlds')}</h2>
            
            <div className="flex flex-col gap-4">
            {visibleRooms.map((room) => {
               const isSubscribed = room.subscribers.includes(localPlayer.id);
               const displayName = getRoomName(room);
               const displayDesc = getRoomDesc(room);

               // Use custom gradient if available, else default
               const headerStyle = room.headerGradient ? { background: room.headerGradient } : {
                   background: room.type === 'day' 
                    ? 'linear-gradient(to right, rgba(20, 83, 45, 0.5), rgba(30, 58, 138, 0.5))' 
                    : room.type === 'night' 
                    ? 'linear-gradient(to right, black, rgba(49, 46, 129, 0.5))' 
                    : 'linear-gradient(to right, rgba(49, 46, 129, 0.5), rgba(30, 64, 175, 0.5))'
               };

               return (
                <button 
                  key={room.id}
                  onClick={() => handleRoomClick(room)}
                  onMouseEnter={() => audioSynth.playUiHover()}
                  className={`w-full text-left p-0 border rounded-xl transition group relative overflow-visible ${btnClass} ${isSubscribed ? 'border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.05)] bg-black' : 'border-white/10 hover:border-white/30 bg-black'}`}
                >
                  <div className="flex flex-col">
                      {/* Card Header Gradient */}
                      <div className="h-16 w-full rounded-t-xl relative" style={headerStyle}>
                          <div className="absolute bottom-3 left-4 flex items-center gap-2">
                             <span className="text-xl font-bold group-hover:translate-x-1 transition-transform flex items-center gap-2 text-white drop-shadow-md">
                                {displayName}
                             </span>
                             {isSubscribed && <BookmarkSolid className="w-4 h-4 text-white" />}
                          </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 flex flex-col gap-4">
                          <span className="text-sm text-gray-400 leading-snug line-clamp-2 min-h-[40px]">{displayDesc}</span>
                          
                          {/* Community Stats Footer */}
                          <div className="flex items-center gap-4 border-t border-white/10 pt-3">
                               <div className="flex items-center gap-2 text-xs font-mono text-gray-400 bg-black border border-white/10 px-2 py-1 rounded">
                                   <div className={`w-2 h-2 rounded-full ${room.currentPlayers > 0 ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-gray-700'}`} />
                                   <span>{room.currentPlayers} {t('online')}</span>
                               </div>
                               
                               <div className="flex items-center gap-2 text-xs font-mono text-gray-400 bg-black border border-white/10 px-2 py-1 rounded">
                                   <BookmarkSolid className="w-3 h-3 text-gray-500" />
                                   <span>{room.subscribers.length} {t('saved')}</span>
                               </div>

                               <span className="text-[10px] uppercase text-gray-500 border border-white/10 px-2 py-1 rounded bg-black/40 ml-auto">
                                   {t(room.type as any)}
                               </span>
                          </div>
                      </div>
                  </div>
                </button>
               )
            })}
            </div>
         </div>
      </div>
    </div>
  );
};
