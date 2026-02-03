
import React, { useState } from 'react';
import { useStore } from '../store';
import { COLORS, DEFAULT_REACTIONS, AVAILABLE_EMOJIS, TRANSLATIONS } from '../constants';
import { ShapeType, EnvironmentType, RoomConfig, Language } from '../types';
import { XMarkIcon, PlusIcon, UserIcon, UserGroupIcon, GlobeAltIcon, LockClosedIcon, ComputerDesktopIcon, MicrophoneIcon, SpeakerXMarkIcon, PencilSquareIcon, ArrowLeftOnRectangleIcon, EyeSlashIcon, CheckIcon, BookmarkIcon as BookmarkSolid, Cog6ToothIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkOutline, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { audioSynth } from '../services/AudioSynthesizer';

export const Lobby = () => {
  const { 
      localPlayer, updateLocalPlayerConfig, setPlayerName,
      rooms, registerRoom, joinRoom, setInGame, 
      hasOnboarded, setOnboarded, logout,
      friends, toggleRoomSubscription, updateRoomDetails,
      peers, language, setLanguage
  } = useStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  
  // Create Room State
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [roomType, setRoomType] = useState<EnvironmentType>('nature');
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowScreenShare, setAllowScreenShare] = useState(true);
  const [forbidMicMute, setForbidMicMute] = useState(false);
  const [preventIgnoring, setPreventIgnoring] = useState(false);
  
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

  const selectedRoom = selectedRoomId ? rooms[selectedRoomId] : null;

  const handleEnterApp = () => {
    if (!localPlayer.name.trim()) return;
    audioSynth.playUiSuccess();
    setPlayerName(localPlayer.name); 
    setOnboarded(true);
  };

  const generateRoomId = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  const handleEmojiSelect = (emoji: string) => {
    audioSynth.playUiClick();
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
      isPrivate: isPrivate,
      isOfficial: false,
      creatorId: localPlayer.id,
      subscribers: [localPlayer.id], // Creator subscribes automatically
      createdAt: Date.now(),
      rules: { allowScreenShare, forbidMicMute, preventIgnoring },
      maxPlayers: 20, 
      currentPlayers: 1, 
      allowedReactions: selectedEmojis
    };

    registerRoom(newRoom);
    joinRoom(roomId);
    setInGame(true);
  };

  const handleJoin = (id: string) => {
    audioSynth.playUiClick();
    const lowerId = id.toLowerCase();
    const foundRoom = (Object.values(rooms) as RoomConfig[]).find(r => r.id.toLowerCase() === lowerId);

    if (!foundRoom) {
        alert("Room not found");
        return;
    }

    joinRoom(foundRoom.id);
    setInGame(true);
  };

  const openRoomDetails = (room: RoomConfig) => {
      audioSynth.playUiClick();
      setSelectedRoomId(room.id);
      setEditMode(false);
      setEditName(getRoomName(room));
      setEditDesc(getRoomDesc(room));
  }

  const handleSaveEdit = () => {
      if(selectedRoomId && editName.trim()) {
          updateRoomDetails(selectedRoomId, { name: editName, description: editDesc });
          setEditMode(false);
      }
  }

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
      <div className="absolute inset-0 bg-black text-white flex flex-col items-center justify-center p-6 z-50">
        
        {/* Language Switcher - Top Right */}
        <div className="absolute top-6 right-6 z-50">
            <button 
                onClick={() => setShowLangModal(!showLangModal)}
                className="text-3xl hover:scale-110 transition btn-interactive"
                title="Change Language"
            >
                {LANG_ICONS[language]}
            </button>
            
            {showLangModal && (
                <div className="absolute top-12 right-0 bg-black border border-white/20 rounded-lg p-2 flex flex-col gap-1 w-40 shadow-2xl animate-fade-in z-50">
                     {(Object.keys(LANG_FLAGS) as Language[]).map(l => (
                        <button 
                            key={l}
                            onClick={() => { setLanguage(l); setShowLangModal(false); }}
                            className={`px-3 py-2 text-left rounded text-sm hover:bg-white/10 flex items-center gap-2 ${language === l ? 'bg-white/20 font-bold' : 'text-gray-300'}`}
                        >
                            <span>{LANG_ICONS[l]}</span>
                            <span>{LANG_FLAGS[l].split(' ')[1]}</span>
                        </button>
                     ))}
                </div>
            )}
        </div>

        <div className="w-full max-w-sm text-center animate-fade-in flex flex-col items-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-12 tracking-tighter">
            R<span className="text-blue-500 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]">oo</span>m8
          </h1>
          <h2 className="text-2xl font-bold mb-8">{t('welcome_title')}</h2>
          <div className="relative mb-12 w-full">
             <input 
              type="text" 
              autoFocus
              value={localPlayer.name}
              placeholder={t('enter_name')}
              onChange={(e) => updateLocalPlayerConfig({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleEnterApp()}
              className="w-full bg-transparent border-b-2 border-white text-center text-xl pb-2 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600 placeholder:text-sm"
            />
          </div>
          <button 
            onClick={handleEnterApp}
            onMouseEnter={() => audioSynth.playUiHover()}
            disabled={!localPlayer.name}
            className={`px-10 py-3 rounded-md text-lg font-bold border-2 border-white transition-all ${btnClass}
                ${localPlayer.name ? 'bg-white text-black hover:bg-gray-200' : 'opacity-50 cursor-not-allowed'}`}
          >
            {t('enter_btn')}
          </button>
        </div>
      </div>
    );
  }

  // Sorting Logic for Rooms
  const visibleRooms = (Object.values(rooms) as RoomConfig[]).filter(room => !room.isPrivate);
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
      <div className="flex items-center justify-between p-6 z-20 relative">
        <h1 className="text-3xl font-bold tracking-tight">
            R<span className="text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">oo</span>m8
        </h1>
        <div className="flex gap-4">
            <button 
                onMouseEnter={() => audioSynth.playUiHover()} 
                onClick={() => { audioSynth.playUiClick(); setShowFriends(!showFriends); }} 
                className={`p-2 rounded-md transition border border-white/20 ${btnClass} ${showFriends ? 'bg-white text-black' : 'hover:bg-white/10'}`}
                title={t('friends_list')}
            >
                <UserGroupIcon className="w-5 h-5" />
            </button>
            <button 
                onMouseEnter={() => audioSynth.playUiHover()} 
                onClick={() => { audioSynth.playUiClick(); setShowProfile(!showProfile); }} 
                className={`p-2 rounded-md transition border border-white/20 ${btnClass} ${showProfile ? 'bg-white text-black' : 'hover:bg-white/10'}`}
                title={t('profile_settings')}
            >
                <UserIcon className="w-5 h-5" />
            </button>
            {/* SETTINGS BUTTON */}
            <button 
                onMouseEnter={() => audioSynth.playUiHover()} 
                onClick={() => { audioSynth.playUiClick(); setShowSettings(!showSettings); }} 
                className={`p-2 rounded-md transition border border-white/20 ${btnClass} ${showSettings ? 'bg-white text-black' : 'hover:bg-white/10'}`}
                title={t('settings_title')}
            >
                <Cog6ToothIcon className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Friends Panel */}
      {showFriends && (
          <div className="bg-black border-b border-white/20 p-6 flex flex-col items-center animate-fade-in relative z-20">
              <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-4">{t('friends_list')}</h3>
              {friends.length === 0 ? (
                  <div className="text-gray-600 text-sm">{t('friends_empty')}</div>
              ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2">
                      {friends.map(fid => (
                          <div key={fid} className="bg-white/5 border border-white/10 px-4 py-2 rounded-md flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span>{fid}</span> 
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* Profile Panel */}
      {showProfile && (
        <div className="flex justify-center mb-6 px-4 animate-fade-in relative z-20">
            <div className="bg-black border border-white/20 p-8 rounded-2xl w-full max-w-sm flex flex-col relative overflow-hidden backdrop-blur-md shadow-2xl">
                 <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
                 
                 <div className="flex flex-col gap-6 w-full">
                     {/* Name Section */}
                     <div className="flex flex-col gap-2">
                         <label className="text-xs uppercase tracking-widest text-gray-500 font-bold">{t('nickname')}</label>
                         <div className="relative">
                            <input 
                                value={localPlayer.name}
                                onChange={(e) => setPlayerName(e.target.value)}
                                className="w-full bg-transparent border-b border-white/30 text-white text-lg py-2 focus:border-blue-500 outline-none font-bold placeholder-gray-700"
                                placeholder={t('nickname')}
                            />
                            <PencilSquareIcon className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"/>
                        </div>
                     </div>

                     {/* Shape Section */}
                     <div>
                         <label className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3 block">{t('shape')}</label>
                         <div className="flex justify-between gap-2">
                            {(['box', 'sphere', 'cone', 'cylinder'] as ShapeType[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => { audioSynth.playUiClick(); updateLocalPlayerConfig({ shape: s }); }}
                                    className={`w-12 h-12 flex items-center justify-center rounded-lg border-2 transition-all ${btnClass}
                                    ${localPlayer.shape === s ? 'border-white text-white' : 'border-white/10 text-gray-600 hover:border-white/30 hover:text-white'}`}
                                >
                                    {s === 'box' && <div className="w-6 h-6 bg-current rounded-sm" />}
                                    {s === 'sphere' && <div className="w-6 h-6 bg-current rounded-full" />}
                                    {s === 'cone' && <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px] border-b-current" />}
                                    {s === 'cylinder' && <div className="w-5 h-6 bg-current rounded-sm" />}
                                </button>
                            ))}
                         </div>
                     </div>

                     {/* Color Section */}
                     <div>
                        <label className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3 block">{t('color')}</label>
                        <div className="flex flex-wrap gap-2">
                            {COLORS.map(c => (
                                <button
                                key={c}
                                onClick={() => { audioSynth.playUiClick(); updateLocalPlayerConfig({ color: c }); }}
                                className={`w-8 h-8 rounded-full border-2 transition-transform ${btnClass} ${localPlayer.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Logout */}
                    <button 
                        onClick={() => { audioSynth.playUiClick(); logout(); }}
                        className={`mt-4 w-full flex items-center justify-center gap-2 text-white/50 text-sm hover:text-white transition px-4 py-3 border border-white/10 rounded-md hover:bg-white/5 ${btnClass}`}
                    >
                        <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
                        <span>{t('logout')}</span>
                    </button>
                 </div>
            </div>
        </div>
      )}

      {/* SETTINGS MODAL (Language) */}
      {showSettings && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-black border border-white rounded-lg w-full max-w-sm p-6 relative flex flex-col animate-bounce-in">
                  <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold">{t('settings_title')}</h2>
                      <button onClick={() => setShowSettings(false)} className="hover:text-gray-300 p-1">
                          <XMarkIcon className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div>
                      <label className="text-xs uppercase text-gray-500 mb-3 block">{t('language')}</label>
                      <div className="grid grid-cols-2 gap-2">
                          {(Object.keys(LANG_FLAGS) as Language[]).map(l => (
                              <button 
                                key={l}
                                onClick={() => { audioSynth.playUiClick(); setLanguage(l); }}
                                className={`py-2 px-3 text-sm rounded border text-left transition ${language === l ? 'bg-white text-black border-white' : 'border-white/20 hover:border-white hover:bg-white/10'}`}
                              >
                                  {LANG_FLAGS[l]}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Room List */}
      <div className="flex-1 overflow-y-auto p-6 custom-scroll z-10 relative">
         <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex gap-2 mb-6">
                <input 
                    value={joinId}
                    onChange={e => setJoinId(e.target.value)}
                    placeholder={t('enter_code_placeholder')}
                    className="flex-1 bg-transparent border border-white/30 rounded-md px-4 py-3 focus:border-white outline-none"
                />
                <button 
                    onClick={() => handleJoin(joinId)} 
                    disabled={!joinId} 
                    className={`px-6 border border-white rounded-md hover:bg-white hover:text-black font-bold disabled:opacity-50 ${btnClass}`}
                >
                    {t('enter_room_btn')}
                </button>
                <button 
                    onMouseEnter={() => audioSynth.playUiHover()} 
                    onClick={() => { audioSynth.playUiClick(); setShowCreateModal(true); }} 
                    className={`p-3 bg-white text-black rounded-md hover:bg-gray-200 transition border border-white flex items-center justify-center ${btnClass}`}
                    title={t('create_room')}
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>

            <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-2">{t('open_worlds')}</h2>
            
            {visibleRooms.map((room) => {
               // Determine gradients
               let gradient = "from-white/5 to-transparent";
               if (room.type === 'nature') gradient = "from-green-900/20 to-transparent";
               if (room.type === 'space') gradient = "from-blue-900/20 to-transparent";
               if (room.type === 'minimal') gradient = "from-indigo-900/20 to-transparent";
               
               const isSubscribed = room.subscribers.includes(localPlayer.id);

               const friendsInRoom = friends.filter(() => Math.random() > 0.9); // Placeholder logic
               const hasFriends = friendsInRoom.length > 0;
               
               // DYNAMIC TRANSLATION
               const displayName = getRoomName(room);
               const displayDesc = getRoomDesc(room);

               return (
                <button 
                  key={room.id}
                  onClick={() => openRoomDetails(room)}
                  onMouseEnter={() => audioSynth.playUiHover()}
                  className={`w-full text-left p-6 border rounded-lg transition group bg-gradient-to-r ${gradient} relative overflow-visible ${btnClass} ${isSubscribed ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'border-white/10 hover:border-white'}`}
                >
                  <div className="flex justify-between items-start relative z-10">
                      <div className="flex flex-col max-w-[70%]">
                          <div className="flex items-center gap-2 mb-2">
                             <span className="text-2xl font-bold group-hover:tracking-wider transition-all flex items-center gap-2">
                                {displayName}
                             </span>
                             {isSubscribed && <BookmarkSolid className="w-5 h-5 text-white" />}
                          </div>
                          {/* Use Description instead of Type */}
                          <span className="text-sm text-gray-300 leading-snug">{displayDesc}</span>
                          
                          {/* Rules Icons in Card - Explicitly White/Visible */}
                           <div className="flex gap-2 mt-3 items-center">
                              {!room.rules.allowScreenShare && (
                                <div className="text-gray-500" title={t('rule_screen')}>
                                    <div className="relative">
                                        <ComputerDesktopIcon className="w-5 h-5 text-white/70" />
                                        <div className="absolute w-6 h-0.5 bg-white/70 rotate-45 -mt-2.5 -ml-0.5"></div>
                                    </div>
                                </div>
                              )}
                              {room.rules.forbidMicMute && <MicrophoneIcon className="w-5 h-5 text-white/70" title={t('rule_mic')}/>}
                              {room.rules.preventIgnoring && <EyeSlashIcon className="w-5 h-5 text-white/70" title={t('rule_ignore')}/>}
                           </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                          {/* UPDATED STATS DISPLAY */}
                          <div className="flex flex-col items-end gap-1">
                               {/* Online Count */}
                               <div className="flex items-center gap-2 text-sm font-mono text-gray-300">
                                   <div className={`w-2 h-2 rounded-full ${room.currentPlayers > 0 ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-gray-600'}`} />
                                   <span>{room.currentPlayers} {t('online')}</span>
                               </div>

                               {/* Friends Count with Tooltip */}
                               <div className="relative group/friends">
                                   <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-black border border-white/20 text-white`}>
                                       <UserGroupIcon className="w-3 h-3" />
                                       <span>{hasFriends ? friendsInRoom.length : 0} {t('friends_btn')}</span>
                                   </div>
                                   
                                   {/* Friends Hover Tooltip */}
                                   {hasFriends && (
                                       <div className="absolute top-full right-0 mt-2 w-32 bg-black border border-white/20 rounded-md p-2 hidden group-hover/friends:block z-50 shadow-xl">
                                           <div className="text-[10px] text-gray-500 uppercase mb-1">{t('friends_in_room')}:</div>
                                           {friendsInRoom.map(fid => (
                                               <div key={fid} className="text-xs text-white truncate py-0.5">{fid}</div>
                                           ))}
                                       </div>
                                   )}
                               </div>
                          </div>
                      </div>
                  </div>
                </button>
               )
            })}
         </div>
      </div>

      {/* EMOJI PICKER MODAL - Square Aspect */}
      {editingEmojiIndex !== null && (
          <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-black border border-white/30 rounded-xl w-full max-w-sm flex flex-col shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-center p-4 border-b border-white/10">
                      <h3 className="text-white font-bold">{t('reactions')}</h3>
                      <button onClick={() => setEditingEmojiIndex(null)} className="text-gray-400 hover:text-white"><XMarkIcon className="w-6 h-6"/></button>
                  </div>
                  {/* Square Aspect Grid */}
                  <div className="p-4 overflow-y-auto custom-scroll h-[320px]">
                      <div className="grid grid-cols-5 gap-2">
                          {AVAILABLE_EMOJIS.map(emoji => (
                              <button 
                                key={emoji} 
                                onClick={() => handleEmojiSelect(emoji)}
                                className="aspect-square flex items-center justify-center text-2xl hover:bg-white/10 rounded-md transition hover:scale-110"
                              >
                                  {emoji}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* ROOM DETAILS MODAL */}
      {selectedRoom && (
          <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-black border border-white rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl animate-bounce-in relative">
                  
                  {/* Decorative Background Header */}
                  <div className={`h-32 w-full bg-gradient-to-r 
                    ${selectedRoom.type === 'nature' ? 'from-green-900 to-blue-900' : 
                      selectedRoom.type === 'space' ? 'from-black to-indigo-900' : 'from-indigo-900 to-blue-800'}`} 
                  />
                  
                  <button onClick={() => setSelectedRoomId(null)} className="absolute top-4 right-4 bg-black/50 p-2 rounded-full hover:bg-white hover:text-black transition z-10">
                      <XMarkIcon className="w-6 h-6" />
                  </button>

                  <div className="p-8 -mt-12 relative z-10">
                      <div className="flex flex-col mb-4">
                        <div className="flex justify-between items-start">
                             {editMode ? (
                                <input 
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="text-4xl font-bold bg-black/50 border border-white/30 rounded p-1 w-full mr-4 text-white"
                                />
                            ) : (
                                <h2 className="text-4xl font-bold drop-shadow-md leading-tight">{getRoomName(selectedRoom)}</h2>
                            )}
                        </div>
                        
                        {/* Bookmark Button moved below title to avoid overlap */}
                        <div className="mt-4">
                            <button 
                                onClick={() => toggleRoomSubscription(selectedRoom.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold transition border inline-flex ${btnClass} 
                                ${selectedRoom.subscribers.includes(localPlayer.id) ? 'bg-white text-black border-white' : 'border-white/30 hover:bg-white/10 text-white'}`}
                            >
                                {selectedRoom.subscribers.includes(localPlayer.id) ? <BookmarkSolid className="w-5 h-5"/> : <BookmarkOutline className="w-5 h-5"/>}
                                {selectedRoom.subscribers.includes(localPlayer.id) ? t('saved') : t('save')}
                            </button>
                        </div>
                      </div>

                      {/* Description */}
                      {editMode ? (
                          <textarea 
                             value={editDesc}
                             onChange={e => setEditDesc(e.target.value)}
                             className="w-full bg-black/50 border border-white/30 rounded p-2 text-gray-300 min-h-[80px]"
                          />
                      ) : (
                          <p className="text-gray-300 text-lg mb-6 leading-relaxed">{getRoomDesc(selectedRoom)}</p>
                      )}

                      {/* Metadata - No Borders, Just Text */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                          <div className="flex flex-col">
                              <div className="text-xs text-gray-500 uppercase mb-1">{t('online')}</div>
                              <div className="text-xl font-bold text-white">{selectedRoom.currentPlayers}</div>
                          </div>
                          <div className="flex flex-col">
                              <div className="text-xs text-gray-500 uppercase mb-1">{t('fans')}</div>
                              <div className="text-xl font-bold text-white">{selectedRoom.subscribers.length}</div>
                          </div>
                          <div className="flex flex-col">
                              <div className="text-xs text-gray-500 uppercase mb-1">{t('world')}</div>
                              <div className="text-xl font-bold capitalize text-white">{selectedRoom.type}</div>
                          </div>
                          <div className="flex flex-col">
                              <div className="text-xs text-gray-500 uppercase mb-1">{t('access')}</div>
                              <div className="text-xl font-bold text-white">{selectedRoom.isPrivate ? t('private') : t('public')}</div>
                          </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-between items-center border-t border-white/10 pt-6">
                          <div className="flex gap-4">
                             {/* Only show Edit if Creator and not Official */}
                             {localPlayer.id === selectedRoom.creatorId && !selectedRoom.isOfficial && (
                                 !editMode ? (
                                    <button onClick={() => setEditMode(true)} className="text-sm text-gray-400 hover:text-white underline">
                                        {t('edit')}
                                    </button>
                                 ) : (
                                     <div className="flex gap-2">
                                         <button onClick={handleSaveEdit} className="text-sm text-green-400 hover:text-green-300 underline">{t('save')}</button>
                                         <button onClick={() => setEditMode(false)} className="text-sm text-red-400 hover:text-red-300 underline">{t('cancel')}</button>
                                     </div>
                                 )
                             )}
                          </div>
                          
                          <button 
                            onClick={() => { joinRoom(selectedRoom.id); setInGame(true); }}
                            className={`px-8 py-3 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition text-lg ${btnClass}`}
                          >
                              {t('enter_world')}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Create Modal - Pure Black */}
      {showCreateModal && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-black border border-white rounded-lg w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto flex flex-col animate-bounce-in">
                {/* Header Aligned */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">{t('create_title')}</h2>
                    <button onClick={() => setShowCreateModal(false)} className="hover:text-gray-300 p-1">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                         <label className="text-xs uppercase text-gray-500 mb-2 block">{t('room_name')}</label>
                         <input 
                            value={roomName}
                            onChange={e => setRoomName(e.target.value)}
                            className="w-full bg-black border border-white/30 p-3 rounded-md text-white focus:border-white outline-none"
                            placeholder={t('room_name')}
                         />
                    </div>

                    <div>
                         <label className="text-xs uppercase text-gray-500 mb-2 block">{t('room_desc')}</label>
                         <textarea 
                            value={roomDesc}
                            onChange={e => setRoomDesc(e.target.value)}
                            className="w-full bg-black border border-white/30 p-3 rounded-md text-white focus:border-white outline-none min-h-[80px]"
                            placeholder={t('room_desc')}
                         />
                    </div>
                    
                     {/* Public/Private */}
                    <div className="flex items-center gap-4 bg-black p-3 rounded-md border border-white/30">
                         <button 
                            onClick={() => { audioSynth.playUiClick(); setIsPrivate(false); }}
                            className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 text-sm font-bold transition ${btnClass} ${!isPrivate ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                         >
                            <GlobeAltIcon className="w-4 h-4" /> {t('public')}
                         </button>
                         <button 
                            onClick={() => { audioSynth.playUiClick(); setIsPrivate(true); }}
                            className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 text-sm font-bold transition ${btnClass} ${isPrivate ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                         >
                            <LockClosedIcon className="w-4 h-4" /> {t('private')}
                         </button>
                    </div>

                    {/* Location */}
                    <div>
                        <label className="text-xs uppercase text-gray-500 mb-2 block">{t('location')}</label>
                        <div className="grid grid-cols-3 gap-2">
                             <button
                                onClick={() => { audioSynth.playUiClick(); setRoomType('nature'); }}
                                className={`p-3 border rounded-md text-sm transition ${btnClass} ${roomType === 'nature' ? 'bg-white text-black border-white' : 'border-white/30 hover:border-white'}`}
                            >
                                {t('solar')}
                            </button>
                             <button
                                onClick={() => { audioSynth.playUiClick(); setRoomType('space'); }}
                                className={`p-3 border rounded-md text-sm transition ${btnClass} ${roomType === 'space' ? 'bg-white text-black border-white' : 'border-white/30 hover:border-white'}`}
                            >
                                {t('lunar')}
                            </button>
                            <button
                                onClick={() => { audioSynth.playUiClick(); setRoomType('minimal'); }}
                                className={`p-3 border rounded-md text-sm transition ${btnClass} ${roomType === 'minimal' ? 'bg-white text-black border-white' : 'border-white/30 hover:border-white'}`}
                            >
                                {t('office')}
                            </button>
                        </div>
                    </div>

                    {/* Reactions Config */}
                     <div>
                        <label className="text-xs uppercase text-gray-500 mb-2 block">{t('reactions')}</label>
                        <div className="flex justify-between gap-2 mb-2">
                            {selectedEmojis.map((emoji, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => { audioSynth.playUiClick(); setEditingEmojiIndex(idx); }}
                                    className={`w-12 h-12 bg-transparent border border-white/30 rounded-md text-2xl flex items-center justify-center hover:bg-white/10 transition ring-1 ring-white/10 hover:ring-white ${btnClass}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rules */}
                    <div className="bg-transparent p-4 rounded-md border border-white/30">
                        <label className="text-xs uppercase text-gray-500 mb-3 block">{t('rules')}</label>
                        <div className="space-y-3">
                             <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-5 h-5 border border-white flex items-center justify-center transition rounded-sm bg-black`}>
                                    {allowScreenShare && <CheckIcon className="w-4 h-4 text-white" />}
                                </div>
                                <input type="checkbox" className="hidden" checked={allowScreenShare} onChange={e => { audioSynth.playUiClick(); setAllowScreenShare(e.target.checked); }} />
                                <div className="flex items-center gap-2 text-sm group-hover:text-gray-300">
                                    <ComputerDesktopIcon className="w-4 h-4 text-gray-400" />
                                    <span>{t('rule_screen')}</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-5 h-5 border border-white flex items-center justify-center transition rounded-sm bg-black`}>
                                    {forbidMicMute && <CheckIcon className="w-4 h-4 text-white" />}
                                </div>
                                <input type="checkbox" className="hidden" checked={forbidMicMute} onChange={e => { audioSynth.playUiClick(); setForbidMicMute(e.target.checked); }} />
                                <div className="flex items-center gap-2 text-sm group-hover:text-gray-300">
                                    <MicrophoneIcon className="w-4 h-4 text-gray-400" />
                                    <span>{t('rule_mic')}</span>
                                </div>
                            </label>

                             <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-5 h-5 border border-white flex items-center justify-center transition rounded-sm bg-black`}>
                                    {preventIgnoring && <CheckIcon className="w-4 h-4 text-white" />}
                                </div>
                                <input type="checkbox" className="hidden" checked={preventIgnoring} onChange={e => { audioSynth.playUiClick(); setPreventIgnoring(e.target.checked); }} />
                                <div className="flex items-center gap-2 text-sm group-hover:text-gray-300">
                                    <EyeSlashIcon className="w-4 h-4 text-gray-400" />
                                    <span>{t('rule_ignore')}</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <button 
                        onClick={handleCreate}
                        className={`w-full bg-white text-black font-bold py-4 rounded-md hover:bg-gray-200 transition mt-4 ${btnClass}`}
                    >
                        {t('create_room')}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
