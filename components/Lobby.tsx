
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { COLORS, DEFAULT_REACTIONS, AVAILABLE_EMOJIS, TRANSLATIONS } from '../constants';
import { ShapeType, EnvironmentType, RoomConfig, Language, Post, PollOption, CustomRule } from '../types';
import { XMarkIcon, PlusIcon, UserIcon, UserGroupIcon, ComputerDesktopIcon, MicrophoneIcon, ArrowLeftOnRectangleIcon, EyeSlashIcon, BookmarkIcon as BookmarkSolid, Cog6ToothIcon, LockClosedIcon, TrashIcon, PaintBrushIcon, MagnifyingGlassIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon, AdjustmentsHorizontalIcon, BarsArrowDownIcon, ListBulletIcon, ArrowRightIcon, DocumentTextIcon, ShieldCheckIcon, InformationCircleIcon, ChatBubbleLeftRightIcon, BriefcaseIcon, LinkIcon, GlobeAltIcon, ExclamationCircleIcon, ArrowLeftIcon, PhotoIcon, ChatBubbleOvalLeftIcon, EllipsisHorizontalIcon, BellIcon as BellSolid, ArrowUpIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkOutline, MoonIcon, SunIcon, QuestionMarkCircleIcon, HeartIcon, BellIcon as BellOutline, ArrowUpOnSquareIcon } from '@heroicons/react/24/outline';
import { audioSynth } from '../services/AudioSynthesizer';

// Toggle Component
const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
        <div 
            className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-700'}`}
            onClick={() => onChange(!checked)}
        >
            <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
    </div>
);

export const Lobby = () => {
  const { 
      localPlayer, updateLocalPlayerConfig, setPlayerName,
      rooms, registerRoom, joinRoom, setInGame, isInGame,
      hasOnboarded, setOnboarded, logout,
      friends, toggleRoomSubscription, updateRoomDetails,
      language, setLanguage, theme, setTheme,
      selectedMicId, selectedSpeakerId, setAudioDevice,
      addRoomPost, togglePostReaction, togglePostGoing, votePoll
  } = useStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<'terms' | 'privacy' | 'about' | 'support' | 'career' | null>(null);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  
  // Create Room State
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [roomType, setRoomType] = useState<EnvironmentType>('day');
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowScreenShare, setAllowScreenShare] = useState(true);
  const [forbidMicMute, setForbidMicMute] = useState(false);
  const [preventIgnoring, setPreventIgnoring] = useState(false);
  const [gradientColors, setGradientColors] = useState<string[]>(['#1e3a8a', '#000000']);
  const [draftRoomId, setDraftRoomId] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [idError, setIdError] = useState(false);
  
  // Custom Rules State (Create)
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [newCustomRuleText, setNewCustomRuleText] = useState('');
  const [newCustomRuleType, setNewCustomRuleType] = useState<'allow' | 'forbid'>('allow');

  // Emoji Selection
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>(DEFAULT_REACTIONS);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Room Details & Social Page
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState<EnvironmentType>('day');
  const [editReactions, setEditReactions] = useState<string[]>([]);
  
  // Edit Rules
  const [editAllowScreenShare, setEditAllowScreenShare] = useState(true);
  const [editForbidMicMute, setEditForbidMicMute] = useState(false);
  const [editPreventIgnoring, setEditPreventIgnoring] = useState(false);
  const [editCustomRules, setEditCustomRules] = useState<CustomRule[]>([]);
  const [newEditRuleText, setNewEditRuleText] = useState('');
  const [newEditRuleType, setNewEditRuleType] = useState<'allow' | 'forbid'>('allow');

  // Feed Logic
  const [isEventFormExpanded, setIsEventFormExpanded] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostDate, setNewPostDate] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<'text' | 'image' | 'poll'>('text');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [pollOptions, setPollOptions] = useState<{id: string, text: string}[]>([{id: '1', text: ''}, {id: '2', text: ''}]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null); // Post ID to share

  // Main Input & World List Logic
  const [mainInput, setMainInput] = useState('');
  const [isWorldListOpen, setIsWorldListOpen] = useState(false);
  const worldListRef = useRef<HTMLDivElement>(null);
  const listContentRef = useRef<HTMLDivElement>(null);
  const roomScrollRef = useRef<HTMLDivElement>(null);

  // Scroll To Top State
  const [showListScrollTop, setShowListScrollTop] = useState(false);
  const [showRoomScrollTop, setShowRoomScrollTop] = useState(false);

  // Sorting & Filtering State
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'online_asc' | 'online_desc'>('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  
  const [filterMinPlayers, setFilterMinPlayers] = useState(0);
  const [filterType, setFilterType] = useState<EnvironmentType | 'all'>('all');
  const [filterRules, setFilterRules] = useState({
      screenShare: false,
      micMute: false,
      ignore: false
  });

  const t = (key: keyof typeof TRANSLATIONS['ru']) => TRANSLATIONS[language][key] || key;
  const isDark = theme === 'dark';

  // THEME COLORS
  const bgClass = isDark ? 'bg-black' : 'bg-gray-200';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const borderClass = isDark ? 'border-white/10' : 'border-gray-300';
  const cardBgClass = isDark ? 'bg-black' : 'bg-white';
  const secondaryTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
  
  // SHARED STYLES
  const getGlassBtnClass = (active: boolean) => 
    `h-[50px] border-2 rounded-xl transition flex items-center justify-center shadow-lg cursor-pointer
    ${active 
        ? 'bg-white/10 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
        : 'bg-black border-white/20 hover:bg-white/10 text-white' 
    }`;

  const inputStyle = `h-[50px] bg-black border-2 border-white/20 rounded-xl text-white px-4 outline-none placeholder:text-gray-500 placeholder:font-normal shadow-lg focus:border-white/40 transition-all`;

  useEffect(() => {
    if (showSettings) {
        navigator.mediaDevices.enumerateDevices().then(setDevices);
    }
  }, [showSettings]);

  // URL Query Param Check
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const roomIdParam = params.get('room');
      
      if (roomIdParam && hasOnboarded && !isInGame) {
          const existingRoom = rooms[roomIdParam];
          if (existingRoom) {
              setSelectedRoomId(roomIdParam);
          } else {
              const tempRoom: RoomConfig = {
                  id: roomIdParam,
                  name: `Shared Room`,
                  description: 'A private room shared via link.',
                  type: 'office',
                  region: language,
                  isPrivate: true,
                  isOfficial: false,
                  subscribers: [],
                  createdAt: Date.now(),
                  rules: { allowScreenShare: true, forbidMicMute: false, preventIgnoring: false, custom: [] },
                  maxPlayers: 20,
                  currentPlayers: 0,
                  allowedReactions: DEFAULT_REACTIONS,
                  posts: [],
                  headerGradient: 'linear-gradient(to right, #1e3a8a, #000000)'
              };
              registerRoom(tempRoom);
              setSelectedRoomId(roomIdParam);
          }
      }
  }, [hasOnboarded, rooms, registerRoom, isInGame, language]);

  // Scroll logic
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
        if (!hasOnboarded) return;
        if (showCreateModal || showProfile || showSettings || selectedRoomId || showLegalModal) return; 
        
        if (e.deltaY > 20 && !isWorldListOpen) {
            setIsWorldListOpen(true);
        }
        if (e.deltaY < -20 && isWorldListOpen && worldListRef.current && worldListRef.current.scrollTop === 0) {
            setIsWorldListOpen(false);
        }
    };
    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isWorldListOpen, hasOnboarded, showCreateModal, showProfile, showSettings, selectedRoomId, showLegalModal]);

  // Room Helpers
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

  const friendsInSelectedRoom = selectedRoom 
    ? friends.filter(friendId => selectedRoom.subscribers.includes(friendId)) 
    : [];

  // Filter My Rooms
  const myRooms = (Object.values(rooms) as RoomConfig[]).filter(r => r.creatorId === localPlayer.id);

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
  const getGradientString = () => `linear-gradient(to right, ${gradientColors.join(', ')})`;

  // Emoji Helpers (Creation)
  const handleToggleEmoji = (emoji: string) => {
      if (selectedEmojis.includes(emoji)) {
          setSelectedEmojis(selectedEmojis.filter(e => e !== emoji));
      } else if (selectedEmojis.length < 5) {
          setSelectedEmojis([...selectedEmojis, emoji]);
      }
  };

  // Emoji Helpers (Editing)
  const handleToggleEditEmoji = (emoji: string) => {
      if (editReactions.includes(emoji)) {
          setEditReactions(editReactions.filter(e => e !== emoji));
      } else if (editReactions.length < 5) {
          setEditReactions([...editReactions, emoji]);
      }
  };

  // Custom Rules Helpers (Creation)
  const handleAddCustomRule = () => {
      if (newCustomRuleText.trim()) {
          setCustomRules([...customRules, { text: newCustomRuleText.trim(), type: newCustomRuleType }]);
          setNewCustomRuleText('');
      }
  };
  const handleRemoveCustomRule = (index: number) => {
      const newRules = [...customRules];
      newRules.splice(index, 1);
      setCustomRules(newRules);
  };

  // Custom Rules Helpers (Editing)
  const handleAddEditRule = () => {
      if (newEditRuleText.trim()) {
          setEditCustomRules([...editCustomRules, { text: newEditRuleText.trim(), type: newEditRuleType }]);
          setNewEditRuleText('');
      }
  }

  // Actions
  const handleCreate = () => {
    if (!roomName.trim()) {
        alert(t('room_name'));
        return;
    }
    if (idError) {
        alert("ID is taken");
        return;
    }

    setIsJoining(true);
    
    setTimeout(() => {
        const roomId = draftRoomId.trim().length > 0 ? draftRoomId.trim() : generateRoomId();
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
              preventIgnoring, 
              custom: customRules 
          },
          headerGradient: getGradientString(),
          maxPlayers: 20, 
          currentPlayers: 1, 
          allowedReactions: selectedEmojis.length > 0 ? selectedEmojis : DEFAULT_REACTIONS,
          posts: []
        };

        registerRoom(newRoom);
        setShowCreateModal(false);
        joinRoom(roomId);
        setInGame(true);
        setIsJoining(false);
    }, 500);
  };

  const handleJoin = (id: string) => {
    if(!id) return;
    setIsJoining(true);
    setTimeout(() => {
        const lowerId = id.trim();
        const foundRoom = (Object.values(rooms) as RoomConfig[]).find(r => r.id.toLowerCase() === lowerId.toLowerCase());

        if (!foundRoom) {
            const normalizedId = lowerId.toUpperCase();
            const tempRoom: RoomConfig = {
                id: normalizedId,
                name: `Private Room (${normalizedId})`,
                description: 'Unknown room',
                type: 'office',
                region: language,
                isPrivate: true,
                isOfficial: false,
                subscribers: [],
                createdAt: Date.now(),
                rules: { allowScreenShare: true, forbidMicMute: false, preventIgnoring: false, custom: [] },
                maxPlayers: 20, 
                currentPlayers: 1, 
                allowedReactions: DEFAULT_REACTIONS,
                posts: [],
                headerGradient: 'linear-gradient(to right, #1e3a8a, #000000)'
            };
            registerRoom(tempRoom);
            joinRoom(normalizedId);
        } else {
            joinRoom(foundRoom.id);
        }
        
        setInGame(true);
        setIsJoining(false);
    }, 500);
  };

  const handleMainAction = () => {
      if (isWorldListOpen) {
          const inputEl = document.getElementById('main-input');
          if (inputEl) inputEl.focus();
      } else if (mainInput.trim().length > 0) {
          handleJoin(mainInput);
      } else {
          setCustomRules([]);
          setNewCustomRuleText('');
          setDraftRoomId(generateRoomId());
          setIdError(false);
          setShowCreateModal(true);
      }
  };

  const handleRoomClick = (room: RoomConfig) => {
      setSelectedRoomId(room.id);
      setEditMode(false);
      
      // Init edit states
      setEditName(getRoomName(room));
      setEditDesc(getRoomDesc(room));
      setEditType(room.type);
      setEditReactions(room.allowedReactions || DEFAULT_REACTIONS);
      setEditAllowScreenShare(room.rules.allowScreenShare);
      setEditForbidMicMute(room.rules.forbidMicMute);
      setEditPreventIgnoring(room.rules.preventIgnoring);
      setEditCustomRules(room.rules.custom || []);
  };

  const handleSaveEdit = () => {
      if(selectedRoomId && editName.trim()) {
          updateRoomDetails(selectedRoomId, { 
              name: editName, 
              description: editDesc,
              type: editType,
              allowedReactions: editReactions,
              rules: {
                  allowScreenShare: editAllowScreenShare,
                  forbidMicMute: editForbidMicMute,
                  preventIgnoring: editPreventIgnoring,
                  custom: editCustomRules
              }
          });
          setEditMode(false);
      }
  };

  const checkIdAvailability = (id: string) => {
      const exists = rooms[id] !== undefined;
      setIdError(exists);
      setDraftRoomId(id);
  };

  // Social Wall Logic
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setNewPostImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleCreatePost = () => {
      if(!newPostTitle.trim() || !selectedRoomId) return;
      
      let finalPollOptions: PollOption[] | undefined = undefined;
      if (newPostType === 'poll') {
          finalPollOptions = pollOptions.filter(o => o.text.trim()).map(o => ({
              id: Math.random().toString(36).substr(2, 5),
              text: o.text,
              votes: []
          }));
      }

      const post: Post = {
          id: Math.random().toString(36).substr(2, 9),
          authorId: localPlayer.id, // Stored but not shown
          timestamp: Date.now(),
          type: newPostType,
          title: newPostTitle,
          eventDate: newPostDate,
          content: newPostContent,
          imageUrl: newPostImage || undefined,
          pollOptions: finalPollOptions,
          reactions: {},
          going: []
      };
      
      addRoomPost(selectedRoomId, post);
      
      // Reset
      setNewPostTitle('');
      setNewPostDate('');
      setNewPostContent('');
      setNewPostImage(null);
      setNewPostType('text');
      setPollOptions([{id: '1', text: ''}, {id: '2', text: ''}]);
      setIsEventFormExpanded(false);
  };

  const handleSharePost = (postId: string) => {
      if (navigator.share) {
          navigator.share({
              title: 'Check out this event on Room8',
              url: `${window.location.origin}?room=${selectedRoomId}&post=${postId}`
          }).catch(console.error);
      } else {
          navigator.clipboard.writeText(`${window.location.origin}?room=${selectedRoomId}&post=${postId}`);
          alert('Link copied to clipboard!');
      }
      setShowShareModal(null);
  };

  const handleShareRoom = () => {
      if (!selectedRoomId) return;
      if (navigator.share) {
          navigator.share({
              title: 'Join me in Room8',
              url: `${window.location.origin}?room=${selectedRoomId}`
          }).catch(console.error);
      } else {
          navigator.clipboard.writeText(`${window.location.origin}?room=${selectedRoomId}`);
          alert('Room link copied!');
      }
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

  // --- Search & Filter Logic ---
  const visibleRooms = (Object.values(rooms) as RoomConfig[]).filter(room => {
      const matchRegion = !room.isPrivate && room.region === language;
      if (!isWorldListOpen && !selectedRoomId) return matchRegion;
      
      const lowerInput = mainInput ? mainInput.toLowerCase() : '';
      const translatedName = getRoomName(room).toLowerCase();
      
      const matchSearch = !mainInput || (
                          translatedName.includes(lowerInput) || 
                          room.id.toLowerCase().includes(lowerInput) ||
                          room.description.toLowerCase().includes(lowerInput) ||
                          room.type.toLowerCase().includes(lowerInput)
                        );
      
      const matchMinPlayers = room.currentPlayers >= filterMinPlayers;
      const matchRules = 
          (!filterRules.screenShare || room.rules.allowScreenShare) &&
          (!filterRules.micMute || room.rules.forbidMicMute) &&
          (!filterRules.ignore || room.rules.preventIgnoring);
      const matchType = filterType === 'all' || room.type === filterType;

      return matchRegion && matchSearch && matchMinPlayers && matchRules && matchType;
  });

  visibleRooms.sort((a, b) => {
      const aSub = a.subscribers.includes(localPlayer.id);
      const bSub = b.subscribers.includes(localPlayer.id);
      if (aSub && !bSub) return -1;
      if (!bSub && aSub) return 1;

      switch(sortBy) {
          case 'popular': return b.currentPlayers - a.currentPlayers;
          case 'newest': return b.createdAt - a.createdAt;
          case 'online_asc': return a.currentPlayers - b.currentPlayers;
          case 'online_desc': return b.currentPlayers - a.currentPlayers;
          default: return 0;
      }
  });

  // Scroll Handlers
  const handleRoomScroll = (e: React.UIEvent<HTMLDivElement>) => {
      setShowRoomScrollTop(e.currentTarget.scrollTop > 300);
  };

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
      setShowListScrollTop(e.currentTarget.scrollTop > 300);
  };

  const scrollToTopRoom = () => {
      roomScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTopList = () => {
      listContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reusable Info Menu
  const renderInfoMenu = () => (
      <div className={`absolute bottom-6 right-6 z-[60] flex flex-col items-end gap-3`}>
          <div 
             className={`fixed inset-0 z-[55] pointer-events-none transition-opacity duration-500 ease-in-out ${showHelpMenu ? 'opacity-100' : 'opacity-0'}`} 
             style={{ background: 'radial-gradient(circle at bottom right, #000000 0%, #000000 10%, transparent 30%)' }} 
          />
          {showHelpMenu && (
             <div className="flex flex-col items-end gap-2 mb-2 animate-fade-in relative z-[60]">
                <button onClick={() => setShowLegalModal('career')} className="flex items-center gap-2 bg-black border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition group">
                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">{t('menu_careers')}</span>
                    <BriefcaseIcon className="w-4 h-4 text-purple-400" />
                </button>
                <button onClick={() => setShowLegalModal('support')} className="flex items-center gap-2 bg-black border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition group">
                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">{t('menu_support')}</span>
                    <ChatBubbleLeftRightIcon className="w-4 h-4 text-green-400" />
                </button>
                <button onClick={() => setShowLegalModal('privacy')} className="flex items-center gap-2 bg-black border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition group">
                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">{t('menu_privacy')}</span>
                    <ShieldCheckIcon className="w-4 h-4 text-blue-400" />
                </button>
                <button onClick={() => setShowLegalModal('terms')} className="flex items-center gap-2 bg-black border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition group">
                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">{t('menu_rules')}</span>
                    <DocumentTextIcon className="w-4 h-4 text-orange-400" />
                </button>
                <button onClick={() => setShowLegalModal('about')} className="flex items-center gap-2 bg-black border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition group">
                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">{t('menu_about')}</span>
                    <InformationCircleIcon className="w-4 h-4 text-white" />
                </button>
             </div>
          )}
          <button 
              onClick={() => { setShowHelpMenu(!showHelpMenu); }}
              className="opacity-50 hover:opacity-100 transition-transform hover:scale-110 text-white relative z-[60]"
              title="Help & Info"
          >
             {showHelpMenu ? <XMarkIcon className="w-8 h-8" /> : <QuestionMarkCircleIcon className="w-8 h-8" />}
          </button>
      </div>
  );

  const renderLegalModal = () => (
      showLegalModal && (
        <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowLegalModal(null)}>
            <div className={`${cardBgClass} border ${borderClass} rounded-xl p-8 max-w-sm w-full shadow-2xl animate-bounce-in text-left relative`} onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowLegalModal(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><XMarkIcon className="w-6 h-6"/></button>
                {showLegalModal === 'about' && (
                    <>
                        <h2 className="text-3xl font-black mb-4 tracking-tighter">About <span className="text-blue-500">Room8</span></h2>
                        <p className={`text-sm ${secondaryTextClass} leading-relaxed mb-4`}>{t('about_text')}</p>
                    </>
                )}
                 {showLegalModal === 'support' && (
                    <>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><ChatBubbleLeftRightIcon className="w-6 h-6 text-green-500"/> Support</h2>
                        <p className={`text-sm ${secondaryTextClass} leading-relaxed mb-4`}>{t('support_text')}</p>
                        <div className="bg-white/5 p-3 rounded-lg text-center font-mono text-sm text-blue-400 select-all cursor-text">support@room8.app</div>
                    </>
                )}
                {showLegalModal === 'career' && (
                    <>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><BriefcaseIcon className="w-6 h-6 text-purple-500"/> Careers</h2>
                        <p className={`text-sm ${secondaryTextClass} leading-relaxed mb-4`}>{t('career_text')}</p>
                        <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition">{t('career_btn')}</button>
                    </>
                )}
                {showLegalModal === 'terms' && (
                    <>
                        <h2 className="text-2xl font-bold mb-4">{t('legal_modal_terms_title')}</h2>
                        <p className={`whitespace-pre-wrap text-sm ${secondaryTextClass} leading-relaxed`}>{t('legal_modal_terms_text')}</p>
                    </>
                )}
                {showLegalModal === 'privacy' && (
                    <>
                        <h2 className="text-2xl font-bold mb-4">{t('legal_modal_privacy_title')}</h2>
                        <p className={`whitespace-pre-wrap text-sm ${secondaryTextClass} leading-relaxed`}>{t('legal_modal_privacy_text')}</p>
                    </>
                )}
            </div>
        </div>
      )
  );

  // --- Step 0: Onboarding ---
  if (!hasOnboarded) {
    return (
      <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 z-50 text-center liquid-bg`}>
        {/* Onboarding content (Same as before) */}
        <div className="absolute top-6 right-6 z-50">
            <button 
                onClick={() => setShowLangModal(!showLangModal)}
                className="text-4xl hover:scale-110 transition btn-interactive drop-shadow-md"
                title="Change Language"
            >
                {LANG_ICONS[language]}
            </button>
            {showLangModal && (
                <div className={`absolute top-14 right-0 ${cardBgClass} border ${borderClass} rounded-xl p-2 flex flex-col gap-1 w-48 shadow-2xl animate-fade-in z-50`}>
                     {(Object.keys(LANG_FLAGS) as Language[]).map(l => (
                        <button 
                            key={l}
                            onClick={() => { setLanguage(l); setShowLangModal(false); }}
                            className={`px-4 py-3 text-left rounded-lg text-sm hover:bg-white/10 flex items-center gap-3 transition ${language === l ? 'bg-blue-600 text-white font-bold' : `${textClass} hover:opacity-80`}`}
                        >
                            <span className="text-xl">{LANG_ICONS[l]}</span>
                            <span>{LANG_FLAGS[l].split(' ')[1]}</span>
                        </button>
                     ))}
                </div>
            )}
        </div>
        <div className="w-full max-w-sm animate-fade-in flex flex-col items-center gap-20">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-7xl md:text-8xl font-black tracking-tighter drop-shadow-lg font-sans text-white">R<span className="text-[#3a83f6]">oo</span>m8</h1>
            <p className="text-white/60 text-lg">{t('welcome_title')}</p>
          </div>
          <div className="relative w-full max-w-xs h-[50px] mx-auto">
             <input 
              type="text" autoFocus value={localPlayer.name} placeholder={t('enter_name')}
              onChange={(e) => updateLocalPlayerConfig({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleEnterApp()}
              className="minimal-input w-full text-center h-full"
            />
            <div className={`absolute right-0 top-0 bottom-0 flex items-center justify-center transition-all duration-300 ${localPlayer.name.trim().length > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                <button onClick={handleEnterApp} className="p-2 hover:scale-110 transition flex items-center justify-center"><ArrowRightIcon className="w-6 h-6 text-white" /></button>
            </div>
          </div>
          <div className="text-[11px] max-w-xs leading-relaxed text-white/40">
              <span>{t('legal_agree')} </span>
              <button onClick={() => setShowLegalModal('terms')} className="underline hover:opacity-80 transition">{t('legal_terms')}</button>
              <span> {t('legal_and')} </span>
              <button onClick={() => setShowLegalModal('privacy')} className="underline hover:opacity-80 transition">{t('legal_privacy')}</button>.
          </div>
        </div>
        {renderInfoMenu()}
        {renderLegalModal()}
      </div>
    );
  }

  // --- Step 1: Main Menu (Lobby) ---
  return (
    <div className={`absolute inset-0 flex flex-col overflow-hidden font-sans ${bgClass} ${textClass}`}>
        
      {/* HEADER - PERSISTENT, ADAPTIVE BACKGROUND */}
      <div className={`absolute top-0 left-0 right-0 p-6 z-[60] flex items-center justify-between transition-colors duration-500 ${selectedRoomId ? 'bg-black/60 backdrop-blur-md border-b border-white/5' : ''}`}>
          
          {/* LEFT: LOGO */}
          <div className="flex-shrink-0 z-20">
            <button 
                onClick={() => {
                    if (selectedRoomId) {
                        setSelectedRoomId(null);
                    }
                }}
                className={`text-left group transition ${selectedRoomId ? 'hover:opacity-80' : ''}`}
            >
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] font-sans select-none text-white">
                    R<span className="text-[#3a83f6]">oo</span>m8
                </h1>
            </button>
          </div>

          {/* CENTER: SEARCH BAR (Only when room active) - Centered Absolutely */}
          {selectedRoomId && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-4 hidden md:block z-10">
                <div className="relative group">
                    <div className="relative flex items-center">
                        {/* Use same input style as main input */}
                        <input 
                            value={mainInput} 
                            onChange={e => setMainInput(e.target.value)} 
                            className={`${inputStyle} w-full text-lg pl-4 pr-10 focus:border-white/50 bg-black/50 backdrop-blur-md shadow-lg`} 
                            placeholder={t('search_placeholder')} 
                        />
                        <div className="absolute right-3 text-gray-500">
                            {mainInput ? <button onClick={() => setMainInput('')}><XMarkIcon className="w-5 h-5 hover:text-white"/></button> : <MagnifyingGlassIcon className="w-5 h-5" />}
                        </div>
                    </div>

                    {/* Dropdown Results */}
                    {mainInput.trim().length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[60vh] overflow-y-auto custom-scroll z-[80]">
                            {visibleRooms.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 text-xs">No worlds found</div>
                            ) : (
                                visibleRooms.map(room => (
                                    <button 
                                        key={room.id}
                                        onClick={() => { handleRoomClick(room); setMainInput(''); }}
                                        className="flex items-center gap-3 p-3 hover:bg-white/10 transition text-left border-b border-white/5 last:border-0"
                                    >
                                        <div 
                                            className="w-10 h-10 rounded-lg flex-shrink-0" 
                                            style={{ background: room.headerGradient || (room.type === 'day' ? 'linear-gradient(to right, #14532d, #1e3a8a)' : room.type === 'night' ? 'linear-gradient(to right, #000000, #312e81)' : '#333') }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-white truncate">{getRoomName(room)}</div>
                                            <div className="text-[10px] text-gray-400 truncate">{room.currentPlayers} online • {t(room.type as any)}</div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* RIGHT: BUTTONS */}
          <div className="flex-shrink-0 z-20 flex gap-3">
             <button onClick={() => { setShowFriends(!showFriends); }} className={`${getGlassBtnClass(showFriends)} w-[50px]`} title={t('friends_list')}><UserGroupIcon className="w-5 h-5" /></button>
            <button onClick={() => { setShowProfile(!showProfile); }} className={`${getGlassBtnClass(showProfile)} w-[50px]`} title={t('profile_settings')}><UserIcon className="w-5 h-5" /></button>
            <button onClick={() => { setShowSettings(!showSettings); }} className={`${getGlassBtnClass(showSettings)} w-[50px]`} title={t('settings_title')}><Cog6ToothIcon className="w-5 h-5" /></button>
          </div>
      </div>

      {/* CENTER STAGE (Main Input) - Hidden when room selected */}
      <div 
        className={`absolute z-30 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex items-center justify-center
        ${isWorldListOpen ? 'top-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-6' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-6'}
        ${selectedRoomId ? 'opacity-0 pointer-events-none translate-y-20' : 'opacity-100'}
        `}
      >
          <div className={`relative flex items-center transition-all duration-500 w-full ${!isWorldListOpen ? 'gap-2' : ''}`}>
                {isWorldListOpen && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2">
                        <MagnifyingGlassIcon className="w-5 h-5 text-gray-500" />
                        <div className="w-px h-4 bg-gray-700 mx-1" />
                        <button onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }} className="text-gray-400 hover:text-white transition p-1 relative"><BarsArrowDownIcon className="w-6 h-6" /></button>
                        <button onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }} className="text-gray-400 hover:text-white transition p-1 relative"><AdjustmentsHorizontalIcon className="w-6 h-6" /></button>
                    </div>
                )}
                <input 
                    id="main-input" value={mainInput} onChange={e => setMainInput(e.target.value)}
                    placeholder={isWorldListOpen ? t('search_placeholder') : "Enter room code... or create new ->"}
                    className={`${inputStyle} w-full transition-all duration-500 ${isWorldListOpen ? 'pl-4 pr-[120px]' : ''} text-lg`}
                />
                <div className={`overflow-hidden transition-all duration-500 ${isWorldListOpen ? 'w-0 opacity-0' : 'w-[50px] opacity-100 flex-shrink-0'}`}>
                    <button onClick={handleMainAction} disabled={isJoining} className={`h-[50px] border-2 border-white/20 rounded-xl text-white transition flex items-center justify-center shadow-lg cursor-pointer w-[50px] ${mainInput ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                        {isJoining ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : (mainInput ? <CheckIcon className="w-6 h-6" /> : <PlusIcon className="w-6 h-6" />)}
                    </button>
                </div>
          </div>
      </div>

      {/* Social Page (Unified Room Details & Events) - OVERLAY */}
      {selectedRoomId && selectedRoom && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xl overflow-hidden animate-fade-in">
            {/* Scroll Container */}
            <div 
                ref={roomScrollRef}
                onScroll={handleRoomScroll}
                className="h-full overflow-y-auto custom-scroll pt-24 relative"
            >
                
                {/* Floating Back Button (Sticky inside scroll view) */}
                <div className="sticky top-24 left-6 z-[50] pointer-events-none mb-[-50px]">
                    <button onClick={() => setSelectedRoomId(null)} className="pointer-events-auto p-2 text-white/30 hover:text-white hover:-translate-x-1 transition-all">
                        <ArrowLeftIcon className="w-8 h-8"/>
                    </button>
                </div>

                <div className="w-full max-w-2xl mx-auto px-4 py-6 pb-20">
                    
                    {/* UNIFIED CONTAINER */}
                    <div className="bg-black border border-white/20 rounded-xl overflow-hidden relative shadow-2xl">
                        
                        {/* Banner */}
                        <div className="relative h-48 w-full" style={selectedRoom.headerGradient ? { background: selectedRoom.headerGradient } : { background: '#1e3a8a' }}>
                            {editMode ? (
                                <button onClick={handleSaveEdit} className="absolute top-4 right-4 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-xs shadow-lg z-20">Save</button>
                            ) : (
                                selectedRoom.creatorId === localPlayer.id && (
                                    <button onClick={() => setEditMode(true)} className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-xl text-white transition backdrop-blur-md border border-white/10">
                                        <PaintBrushIcon className="w-4 h-4" />
                                    </button>
                                )
                            )}
                        </div>

                        <div className="p-6 pt-2">
                            {/* Header Row: Title & Save */}
                            <div className="flex justify-between items-start -mt-10 mb-4 relative z-10">
                                <div>
                                    {editMode ? (
                                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-black/50 backdrop-blur text-3xl font-black text-white border border-white/20 rounded px-2 py-1 outline-none w-full mb-1" autoFocus />
                                    ) : (
                                        <h1 className="text-4xl font-black text-white drop-shadow-md leading-tight mb-1">{getRoomName(selectedRoom)}</h1>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold text-gray-300 uppercase border border-white/10">{t(selectedRoom.type as any)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleShareRoom}
                                        className="w-14 h-14 flex items-center justify-center rounded-xl border-2 border-white/20 bg-black text-white hover:bg-white hover:text-black transition-all shadow-lg hover:scale-105"
                                        title="Share Room Link"
                                    >
                                        <ArrowUpOnSquareIcon className="w-6 h-6" />
                                    </button>
                                    <button 
                                        onClick={() => toggleRoomSubscription(selectedRoom.id)}
                                        className={`w-14 h-14 flex items-center justify-center rounded-xl border-2 shadow-lg transition-transform hover:scale-105 ${selectedRoom.subscribers.includes(localPlayer.id) ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-black border-white/20 text-white hover:bg-white hover:text-black hover:border-white'}`}
                                    >
                                        {selectedRoom.subscribers.includes(localPlayer.id) ? <BookmarkSolid className="w-6 h-6"/> : <BookmarkOutline className="w-6 h-6"/>}
                                    </button>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="flex items-center gap-6 text-sm text-gray-400 border-b border-white/10 pb-6 mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                                    <span className="font-bold text-white text-lg">{selectedRoom.currentPlayers}</span>
                                    <span className="text-xs uppercase tracking-wide">{t('online')}</span>
                                </div>
                                <div className="w-px h-4 bg-white/10" />
                                <div className="flex items-center gap-2">
                                    <BookmarkSolid className="w-4 h-4 text-gray-500" />
                                    <span className="font-bold text-white text-lg">{selectedRoom.subscribers.length}</span>
                                    <span className="text-xs uppercase tracking-wide">{t('saved')}</span>
                                </div>
                                <div className="w-px h-4 bg-white/10" />
                                <div className="flex items-center gap-2">
                                    <UserGroupIcon className="w-4 h-4 text-blue-400" />
                                    <span className="font-bold text-white text-lg">{friendsInSelectedRoom.length}</span>
                                    <span className="text-xs uppercase tracking-wide">{t('friends_btn')}</span>
                                </div>
                            </div>

                            {/* Description & Rules (Edit Mode) */}
                            <div className="mb-6">
                                {editMode ? (
                                    <div className="space-y-4">
                                        <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none h-24 resize-none" placeholder="Description" />
                                        
                                        <div className="border border-white/10 rounded-xl p-4 bg-white/5">
                                            <h3 className="text-xs uppercase font-bold text-gray-500 mb-2">Location Type</h3>
                                            <div className="flex gap-2 mb-4">
                                                {['day', 'night', 'office'].map(type => (
                                                    <button key={type} onClick={() => setEditType(type as any)} className={`flex-1 py-2 text-sm rounded-lg border transition capitalize ${editType === type ? 'bg-blue-600 text-white border-blue-500 font-bold' : 'border-white/20 text-gray-400 hover:text-white'}`}>{t(type as any)}</button>
                                                ))}
                                            </div>

                                            <h3 className="text-xs uppercase font-bold text-gray-500 mb-2">Rules</h3>
                                            <Toggle label="Allow Screen Share" checked={editAllowScreenShare} onChange={setEditAllowScreenShare} />
                                            <Toggle label="Forbid Mic Mute" checked={editForbidMicMute} onChange={setEditForbidMicMute} />
                                            <Toggle label="Forbid Ignoring" checked={editPreventIgnoring} onChange={setEditPreventIgnoring} />
                                            
                                            {/* Custom Rules Edit */}
                                            <div className="mt-4">
                                                <div className="text-xs uppercase font-bold text-gray-500 mb-2">Custom Rules</div>
                                                <div className="flex gap-2 mb-2">
                                                    <input 
                                                        value={newEditRuleText} 
                                                        onChange={e => setNewEditRuleText(e.target.value)} 
                                                        className="flex-1 bg-black border border-white/20 rounded-lg px-2 py-1 text-sm"
                                                        placeholder="Add rule..."
                                                    />
                                                    <button onClick={() => setNewEditRuleType(newEditRuleType === 'allow' ? 'forbid' : 'allow')} className={`px-2 py-1 rounded text-xs font-bold ${newEditRuleType === 'allow' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {newEditRuleType === 'allow' ? 'Allow' : 'Forbid'}
                                                    </button>
                                                    <button onClick={handleAddEditRule} className="bg-white/10 p-1 rounded-lg"><PlusIcon className="w-5 h-5"/></button>
                                                </div>
                                                {editCustomRules.map((r, i) => (
                                                    <div key={i} className="flex justify-between items-center text-sm bg-black/30 p-2 rounded mb-1">
                                                        <span className={`text-xs ${r.type === 'allow' ? 'text-green-400' : 'text-red-400'}`}>[{r.type.toUpperCase()}] {r.text}</span>
                                                        <button onClick={() => setEditCustomRules(editCustomRules.filter((_, idx) => idx !== i))}><XMarkIcon className="w-4 h-4 text-red-500"/></button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Emoji Editing */}
                                            <div className="mt-4">
                                                <div className="text-xs uppercase font-bold text-gray-500 mb-2">{t('reactions')}</div>
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    {editReactions.map(emoji => (
                                                        <button key={emoji} onClick={() => handleToggleEditEmoji(emoji)} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-red-500/20 border border-white/20">{emoji}</button>
                                                    ))}
                                                    {editReactions.length < 5 && (
                                                        <button onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)} className="w-8 h-8 flex items-center justify-center border border-dashed border-white/30 rounded-full text-gray-400 hover:text-white"><PlusIcon className="w-4 h-4"/></button>
                                                    )}
                                                </div>
                                                {isEmojiPickerOpen && (
                                                    <div className="bg-black border border-white/20 rounded-lg p-2 grid grid-cols-8 gap-1 h-32 overflow-y-auto custom-scroll mb-2">
                                                        {AVAILABLE_EMOJIS.map(e => (
                                                            <button key={e} onClick={() => handleToggleEditEmoji(e)} className={`w-8 h-8 flex items-center justify-center rounded hover:bg-white/20 ${editReactions.includes(e) ? 'bg-blue-600' : ''}`}>{e}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gray-300 leading-relaxed text-sm">{getRoomDesc(selectedRoom)}</p>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="mb-8">
                                <button onClick={() => handleJoin(selectedRoom.id)} className="w-full py-4 bg-white text-black rounded-xl font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2 border-2 border-transparent">
                                    <span>{t('enter_world')}</span>
                                    <ArrowRightIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Rules List (View Mode) */}
                            {!editMode && (
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-8">
                                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-3 tracking-widest">{t('rules')}</div>
                                    <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                                        <div className="flex items-center gap-2">
                                            {selectedRoom.rules.allowScreenShare ? <CheckIcon className="w-4 h-4 text-green-500"/> : <XMarkIcon className="w-4 h-4 text-red-500"/>}
                                            <span>Screen Share</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!selectedRoom.rules.forbidMicMute ? <CheckIcon className="w-4 h-4 text-green-500"/> : <XMarkIcon className="w-4 h-4 text-red-500"/>}
                                            <span>Mute Mic</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!selectedRoom.rules.preventIgnoring ? <CheckIcon className="w-4 h-4 text-green-500"/> : <XMarkIcon className="w-4 h-4 text-red-500"/>}
                                            <span>Ignore</span>
                                        </div>
                                        {selectedRoom.rules.custom?.map((r, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                {r.type === 'allow' ? <CheckIcon className="w-4 h-4 text-green-500"/> : <XMarkIcon className="w-4 h-4 text-red-500"/>}
                                                <span>{r.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2. WALL OF EVENTS */}
                            <div className="border-t border-white/10 pt-8">
                                <div className="flex items-center gap-2 mb-6">
                                    <h2 className="text-xl font-bold text-white">Events</h2>
                                </div>

                                {/* Create Event (Only Owner) - Expandable */}
                                {selectedRoom.creatorId === localPlayer.id && (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8 transition-all">
                                        {!isEventFormExpanded ? (
                                            <input 
                                                className="w-full bg-transparent border-none outline-none text-white placeholder:text-gray-500 text-base" 
                                                placeholder="Tell about an event..."
                                                onFocus={() => setIsEventFormExpanded(true)}
                                            />
                                        ) : (
                                            <div className="animate-fade-in">
                                                <input 
                                                    value={newPostTitle}
                                                    onChange={(e) => setNewPostTitle(e.target.value)}
                                                    className="w-full bg-transparent border-b border-white/10 outline-none text-white placeholder:text-gray-500 text-lg font-bold mb-3 pb-2"
                                                    placeholder="Event Title"
                                                    autoFocus
                                                />
                                                <input 
                                                    type="date"
                                                    value={newPostDate}
                                                    onChange={(e) => setNewPostDate(e.target.value)}
                                                    className="w-full bg-transparent border-b border-white/10 outline-none text-gray-400 text-sm mb-3 pb-2"
                                                />
                                                <textarea 
                                                    value={newPostContent}
                                                    onChange={(e) => setNewPostContent(e.target.value)}
                                                    className="w-full bg-transparent border-none outline-none text-white placeholder:text-gray-500 text-sm resize-none mb-3"
                                                    placeholder="Description..."
                                                    rows={3}
                                                />
                                                
                                                {/* Image Preview */}
                                                {newPostImage && (
                                                    <div className="relative mb-3">
                                                        <img src={newPostImage} alt="Preview" className="max-h-40 rounded-lg border border-white/10 object-contain bg-black/50" />
                                                        <button onClick={() => setNewPostImage(null)} className="absolute top-1 right-1 bg-red-600 rounded-full p-1"><XMarkIcon className="w-4 h-4 text-white"/></button>
                                                    </div>
                                                )}

                                                {/* Poll Creator */}
                                                {newPostType === 'poll' && (
                                                    <div className="bg-black/30 p-3 rounded-lg mb-3">
                                                        <div className="text-xs uppercase font-bold text-gray-500 mb-2">Poll Options</div>
                                                        {pollOptions.map((opt, idx) => (
                                                            <div key={opt.id} className="flex gap-2 mb-2">
                                                                <input 
                                                                    value={opt.text}
                                                                    onChange={(e) => {
                                                                        const newOpts = [...pollOptions];
                                                                        newOpts[idx].text = e.target.value;
                                                                        setPollOptions(newOpts);
                                                                    }}
                                                                    className="flex-1 bg-black border border-white/20 rounded-lg px-2 py-1 text-sm"
                                                                    placeholder={`Option ${idx + 1}`}
                                                                />
                                                                {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter(o => o.id !== opt.id))}><XMarkIcon className="w-4 h-4 text-red-500"/></button>}
                                                            </div>
                                                        ))}
                                                        <button onClick={() => setPollOptions([...pollOptions, {id: Math.random().toString(), text: ''}])} className="text-xs text-blue-400 hover:text-white flex items-center gap-1"><PlusIcon className="w-3 h-3"/> Add Option</button>
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-center border-t border-white/10 pt-3">
                                                    <div className="flex gap-2">
                                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                                                        <button onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-xl hover:bg-white/10 transition ${newPostImage ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400'}`}><PhotoIcon className="w-5 h-5"/></button>
                                                        <button onClick={() => setNewPostType(newPostType === 'poll' ? 'text' : 'poll')} className={`p-2 rounded-xl hover:bg-white/10 transition ${newPostType==='poll' ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400'}`}><ListBulletIcon className="w-5 h-5"/></button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setIsEventFormExpanded(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-bold">Cancel</button>
                                                        <button onClick={handleCreatePost} disabled={!newPostTitle.trim()} className="px-6 py-2 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition">Post</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Events Feed */}
                                <div className="bg-black border border-white/20 rounded-xl overflow-hidden">
                                    {selectedRoom.posts?.map((post) => (
                                        <div key={post.id} className="border-b border-white/10 last:border-0 hover:bg-white/5 transition relative group">
                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-white mb-1">{post.title}</h3>
                                                        {post.eventDate && <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">{new Date(post.eventDate).toLocaleDateString()}</div>}
                                                    </div>
                                                </div>
                                                
                                                <div className="cursor-default">
                                                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>
                                                    
                                                    {/* Image */}
                                                    {post.imageUrl && (
                                                        <div 
                                                            className="w-full mb-4 cursor-pointer overflow-hidden rounded-lg border border-white/10"
                                                            onClick={() => setLightboxImage(post.imageUrl!)}
                                                        >
                                                            <img src={post.imageUrl} className="w-full h-auto object-contain max-h-[500px] bg-black/50" alt="Event" />
                                                        </div>
                                                    )}

                                                    {/* Poll Display */}
                                                    {post.type === 'poll' && post.pollOptions && (
                                                        <div className="space-y-2 mb-4 bg-white/5 p-3 rounded-xl border border-white/5">
                                                            {post.pollOptions.map(opt => {
                                                                const totalVotes = post.pollOptions!.reduce((acc, o) => acc + o.votes.length, 0);
                                                                const percent = totalVotes > 0 ? (opt.votes.length / totalVotes) * 100 : 0;
                                                                const iVoted = opt.votes.includes(localPlayer.id);
                                                                
                                                                return (
                                                                    <button 
                                                                        key={opt.id} 
                                                                        onClick={(e) => { e.stopPropagation(); votePoll(selectedRoom.id, post.id, opt.id); }}
                                                                        className={`w-full relative h-10 rounded-lg overflow-hidden border transition ${iVoted ? 'border-blue-500' : 'border-white/10 hover:border-white/30'}`}
                                                                    >
                                                                        <div className="absolute top-0 left-0 bottom-0 bg-white/10 transition-all duration-500" style={{ width: `${percent}%` }} />
                                                                        <div className="absolute inset-0 flex justify-between items-center px-3 z-10 text-sm">
                                                                            <span>{opt.text}</span>
                                                                            <span className="font-mono text-xs opacity-70">{Math.round(percent)}%</span>
                                                                        </div>
                                                                    </button>
                                                                )
                                                            })}
                                                            <div className="text-center text-[10px] text-gray-500 uppercase mt-1">{post.pollOptions.reduce((acc, o) => acc + o.votes.length, 0)} votes</div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions Bar */}
                                                <div className="flex items-center justify-between pt-2 mt-2">
                                                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                                        {/* Going Button */}
                                                        <button 
                                                            onClick={() => togglePostGoing(selectedRoom.id, post.id)}
                                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${post.going.includes(localPlayer.id) ? 'bg-green-600 border-green-600 text-white' : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-300'}`}
                                                        >
                                                            {post.going.includes(localPlayer.id) ? <BellSolid className="w-4 h-4"/> : <BellOutline className="w-4 h-4"/>}
                                                            <span>{post.going.length || 'Going'}</span>
                                                        </button>

                                                        <div className="w-px h-8 bg-white/10 mx-1"/>

                                                        {(selectedRoom.allowedReactions || DEFAULT_REACTIONS).map(emoji => {
                                                            const count = (post.reactions?.[emoji] || []).length;
                                                            const iReacted = (post.reactions?.[emoji] || []).includes(localPlayer.id);
                                                            return (
                                                                <button 
                                                                    key={emoji} 
                                                                    onClick={() => togglePostReaction(selectedRoom.id, post.id, emoji)}
                                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition border ${iReacted ? 'bg-blue-900/30 border-blue-500/50 text-blue-200' : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-400'}`}
                                                                >
                                                                    <span>{emoji}</span>
                                                                    {count > 0 && <span className="text-xs">{count}</span>}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                    <button onClick={() => setShowShareModal(post.id)} className="text-gray-500 hover:text-white p-2 hover:bg-white/10 rounded-xl transition"><ArrowUpOnSquareIcon className="w-5 h-5"/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedRoom.posts || selectedRoom.posts.length === 0) && (
                                        <div className="text-center py-12 text-gray-600">
                                            <p className="text-sm">No events yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Scroll To Top Button (Room) */}
                {showRoomScrollTop && (
                    <div className="sticky bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
                        <button 
                            onClick={scrollToTopRoom} 
                            className="pointer-events-auto bg-black/80 backdrop-blur border border-white/20 text-white rounded-full p-3 shadow-lg hover:bg-white hover:text-black transition animate-bounce-in"
                        >
                            <ArrowUpIcon className="w-6 h-6" />
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Lightbox - Global Overlay */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
            <button className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full hover:bg-white/20"><XMarkIcon className="w-8 h-8"/></button>
            <img src={lightboxImage} alt="Full view" className="max-w-full max-h-full object-contain shadow-2xl" onClick={e => e.stopPropagation()}/>
        </div>
      )}

      {/* Share Modal - Global Overlay */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center" onClick={() => setShowShareModal(null)}>
            <div className="bg-black border border-white/20 p-8 rounded-2xl animate-bounce-in text-center max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-6 text-white">Share Event</h3>
                <div className="flex gap-8 justify-center">
                    <button onClick={() => handleSharePost(showShareModal)} className="flex flex-col items-center gap-3 group">
                        <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-white/20 group-hover:scale-110 transition"><LinkIcon className="w-6 h-6 text-white"/></div>
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Copy Link</span>
                    </button>
                    <button onClick={() => { handleSharePost(showShareModal); }} className="flex flex-col items-center gap-3 group">
                        <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-blue-600/20 group-hover:border-blue-500 group-hover:scale-110 transition"><GlobeAltIcon className="w-6 h-6 text-white"/></div>
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Socials</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Friends Panel */}
      {showFriends && (
          <div className={`absolute top-24 right-6 w-auto max-w-[90vw] ${cardBgClass} border ${borderClass} rounded-xl p-4 flex flex-col items-center origin-top-right animate-bounce-in z-50 shadow-2xl`}>
              {friends.length === 0 ? <div className={`${secondaryTextClass} text-sm`}>{t('friends_empty')}</div> : (
                  <div className="flex gap-4 overflow-x-auto pb-2 w-full justify-center">
                      {friends.map(fid => (
                          <div key={fid} className={`${cardBgClass} border ${borderClass} px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap`}>
                              <div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-sm font-mono">{fid.substring(0,8)}</span> 
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}
      
      {renderInfoMenu()}
      {renderLegalModal()}

      {/* Create Room Modal */}
      {showCreateModal && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={`${cardBgClass} border ${borderClass} rounded-xl w-full max-w-sm p-6 relative flex flex-col animate-bounce-in max-h-[90vh] overflow-y-auto custom-scroll shadow-2xl`}>
                   <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">{t('create_title')}</h2>
                        <button onClick={() => setShowCreateModal(false)} className="hover:opacity-70 p-1"><XMarkIcon className="w-6 h-6"/></button>
                   </div>
                   <div className="space-y-5">
                       <div>
                           <label className="text-xs uppercase text-gray-500 font-bold mb-1 block">{t('room_name')}</label>
                           <input value={roomName} onChange={(e) => setRoomName(e.target.value)} className={`${inputStyle} w-full text-sm`} placeholder={t('room_name')} autoFocus />
                       </div>
                       <div>
                           <label className="text-xs uppercase text-gray-500 font-bold mb-1 block">{t('room_desc')}</label>
                           <textarea value={roomDesc} onChange={(e) => setRoomDesc(e.target.value)} className="w-full bg-black border-2 border-white/20 rounded-xl text-white px-4 py-3 outline-none focus:border-white/40 resize-none h-20 text-sm" placeholder={t('room_desc')} />
                       </div>
                       <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs uppercase text-gray-500 font-bold block">{t('access')}</label>
                                <div className="text-xs font-bold text-blue-400">{isPrivate ? t('private') : t('public')}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`flex-1 flex items-center bg-black border ${idError ? 'border-red-500' : 'border-white/20'} rounded-lg px-2 h-10 transition-all`}>
                                    <span className="text-gray-500 text-xs">@</span>
                                    <input value={draftRoomId} onChange={(e) => checkIdAvailability(e.target.value.toUpperCase())} className="bg-transparent border-none outline-none text-white text-xs w-full ml-1 font-mono uppercase" placeholder="HANDLE" />
                                    {idError && <ExclamationCircleIcon className="w-4 h-4 text-red-500" />}
                                </div>
                                <Toggle label="" checked={isPrivate} onChange={setIsPrivate} />
                            </div>
                        </div>
                       <div>
                           <label className="text-xs uppercase text-gray-500 font-bold mb-1 block">{t('location')}</label>
                           <div className="flex gap-2">
                               {['day', 'night', 'office'].map(type => (
                                   <button key={type} onClick={() => setRoomType(type as any)} className={`flex-1 py-2 text-sm rounded-lg border transition capitalize ${roomType === type ? 'bg-blue-600 text-white border-blue-500 font-bold' : 'border-white/20 text-gray-400 hover:text-white'}`}>{t(type as any)}</button>
                               ))}
                           </div>
                       </div>
                       <div>
                            <label className="text-xs uppercase text-gray-500 font-bold mb-2 block">{t('rules')}</label>
                            <Toggle label={t('rule_screen')} checked={allowScreenShare} onChange={setAllowScreenShare} />
                            <Toggle label={t('rule_mic')} checked={forbidMicMute} onChange={setForbidMicMute} />
                            <Toggle label={t('rule_ignore')} checked={preventIgnoring} onChange={setPreventIgnoring} />
                        </div>
                       <div>
                            <label className="text-xs uppercase text-gray-500 font-bold mb-2 block">{t('custom_rules')}</label>
                            <div className="flex gap-2 mb-2">
                                <input value={newCustomRuleText} onChange={(e) => setNewCustomRuleText(e.target.value)} className="flex-1 bg-black border border-white/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/40" placeholder={t('add_rule_placeholder')} onKeyDown={(e) => e.key === 'Enter' && handleAddCustomRule()} />
                                <button onClick={() => setNewCustomRuleType(newCustomRuleType === 'allow' ? 'forbid' : 'allow')} className={`px-2 py-1 rounded text-xs font-bold ${newCustomRuleType === 'allow' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {newCustomRuleType === 'allow' ? 'Allow' : 'Forbid'}
                                </button>
                                <button onClick={handleAddCustomRule} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-white transition"><PlusIcon className="w-4 h-4" /></button>
                            </div>
                            {customRules.length > 0 && (
                                <div className="flex flex-col gap-1 max-h-24 overflow-y-auto custom-scroll">
                                    {customRules.map((rule, i) => (
                                        <div key={i} className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded border border-white/5">
                                            <span className={`text-xs ${rule.type === 'allow' ? 'text-green-400' : 'text-red-400'} truncate`}>[{rule.type.toUpperCase()}] {rule.text}</span>
                                            <button onClick={() => handleRemoveCustomRule(i)} className="text-red-400 hover:text-red-300"><XMarkIcon className="w-3 h-3"/></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* REACTION SELECTION (Restored) */}
                        <div>
                            <label className="text-xs uppercase text-gray-500 font-bold mb-2 block">{t('reactions')}</label>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {selectedEmojis.map(emoji => (
                                    <button key={emoji} onClick={() => handleToggleEmoji(emoji)} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-red-500/20">{emoji}</button>
                                ))}
                                {selectedEmojis.length < 5 && (
                                    <button onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)} className="w-8 h-8 flex items-center justify-center border border-dashed border-white/30 rounded-full text-gray-400 hover:text-white"><PlusIcon className="w-4 h-4"/></button>
                                )}
                            </div>
                            {isEmojiPickerOpen && (
                                <div className="bg-black border border-white/20 rounded-lg p-2 grid grid-cols-8 gap-1 h-32 overflow-y-auto custom-scroll mb-2">
                                    {AVAILABLE_EMOJIS.map(e => (
                                        <button key={e} onClick={() => handleToggleEmoji(e)} className={`w-8 h-8 flex items-center justify-center rounded hover:bg-white/20 ${selectedEmojis.includes(e) ? 'bg-blue-600' : ''}`}>{e}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Gradient */}
                        <div>
                            <label className="text-xs uppercase text-gray-500 font-bold mb-2 block">Header Gradient</label>
                            <div className="flex items-center gap-2 mb-2">
                                {gradientColors.map((c, i) => (
                                    <div key={i} className="relative group">
                                        <input type="color" value={c} onChange={(e) => handleUpdateColor(i, e.target.value)} className="w-8 h-8 rounded-full cursor-pointer border-none bg-transparent" />
                                        {gradientColors.length > 2 && <button onClick={() => handleRemoveColor(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100"><XMarkIcon/></button>}
                                    </div>
                                ))}
                                {gradientColors.length < 5 && <button onClick={handleAddColor} className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:border-white"><PlusIcon className="w-4 h-4"/></button>}
                            </div>
                            <div className="w-full h-8 rounded-lg" style={{ background: getGradientString() }} />
                        </div>
                        
                        <div className="pt-2">
                            <button onClick={handleCreate} className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2"><PlusIcon className="w-5 h-5" /><span>{t('create_room')}</span></button>
                        </div>
                   </div>
              </div>
          </div>
      )}

      {/* World List Drawer (Same as before) */}
      <div 
        ref={worldListRef}
        className={`fixed left-0 right-0 bottom-0 z-20 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col items-center
            ${isWorldListOpen 
                ? 'top-24 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] bg-black/90 backdrop-blur-3xl' 
                : 'top-[calc(100vh-80px)] hover:top-[calc(100vh-90px)] cursor-pointer' 
            }`}
        onClick={() => !isWorldListOpen && setIsWorldListOpen(true)}
      >
          <div className="absolute inset-0 rounded-t-[2rem] overflow-hidden pointer-events-none z-0 bg-black" />
          {isWorldListOpen && <div className="absolute top-0 left-0 right-0 h-24 z-30 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 100%)' }} />}
          <div className="w-full max-w-md mx-auto flex flex-col items-center pt-4 pb-2 flex-shrink-0 cursor-pointer relative z-40" onClick={(e) => { e.stopPropagation(); if (!isWorldListOpen) setIsWorldListOpen(true); }}>
              {!isWorldListOpen ? (
                 <div className="animate-bounce-rare mb-1 opacity-50"><ChevronUpIcon className={`w-6 h-6 text-white`} /></div>
              ) : (
                <div className="mb-4 opacity-50 hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }} className="transition hover:scale-110"><PlusIcon className="w-8 h-8 text-white" /></button>
                 </div>
              )}
              {!isWorldListOpen && <div className="flex items-center gap-2 transition-all"><h2 className={`text-sm uppercase tracking-widest font-bold text-gray-300 drop-shadow-md`}>{t('open_worlds')}</h2></div>}
          </div>

          <div 
            ref={listContentRef}
            onScroll={handleListScroll}
            className={`flex-1 w-full overflow-y-auto pb-6 pt-2 custom-scroll space-y-4 transition-all duration-500 relative z-20 ${!isWorldListOpen ? 'opacity-0 translate-y-20 pointer-events-none scale-95' : 'opacity-100 translate-y-0 scale-100 delay-100'}`}
          >
                <div className="w-full max-w-3xl mx-auto px-4 md:px-6 space-y-4">
                    {visibleRooms.map((room) => {
                    const isSubscribed = room.subscribers.includes(localPlayer.id);
                    const displayName = getRoomName(room);
                    const displayDesc = getRoomDesc(room);
                    const headerStyle = room.headerGradient ? { background: room.headerGradient } : {
                        background: room.type === 'day' ? 'linear-gradient(to right, rgba(20, 83, 45, 0.5), rgba(30, 58, 138, 0.5))' : room.type === 'night' ? 'linear-gradient(to right, black, rgba(49, 46, 129, 0.5))' : 'linear-gradient(to right, rgba(49, 46, 129, 0.5), rgba(30, 64, 175, 0.5))'
                    };
                    return (
                        <button key={room.id} onClick={(e) => { e.stopPropagation(); handleRoomClick(room); }} className={`w-full text-left p-0 border-2 rounded-xl transition group relative overflow-visible ${btnClass} ${isSubscribed ? `border-blue-500/40 bg-black` : `border-white/20 hover:border-blue-400/50 bg-black`}`}>
                        <div className="flex flex-col">
                            <div className="h-16 w-full rounded-t-[10px] relative" style={headerStyle}>
                                <div className="absolute bottom-3 left-4 flex items-center gap-2"><span className="text-xl font-bold group-hover:translate-x-1 transition-transform flex items-center gap-2 text-white drop-shadow-md">{displayName}</span></div>
                                <button onClick={(e) => { e.stopPropagation(); toggleRoomSubscription(room.id); }} className={`absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-xl border-2 transition-all shadow-lg z-20 ${isSubscribed ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-black/40 backdrop-blur-md border-white/20 text-white hover:bg-white hover:text-black hover:border-white'}`}>{isSubscribed ? <BookmarkSolid className="w-5 h-5" /> : <BookmarkOutline className="w-5 h-5" />}</button>
                            </div>
                            <div className="p-4 flex flex-col gap-4">
                                <span className={`text-sm ${secondaryTextClass} leading-snug line-clamp-2`}>{displayDesc}</span>
                                <div className={`flex items-center gap-3 border-t ${borderClass} pt-3`}>
                                    <div className={`flex items-center gap-2 text-xs font-mono ${secondaryTextClass} bg-black border ${borderClass} px-2 py-1 rounded`}><div className={`w-2 h-2 rounded-full ${room.currentPlayers > 0 ? 'bg-green-400' : 'bg-gray-500'}`} /><span>{room.currentPlayers}</span></div>
                                    <div className={`flex items-center gap-1 text-xs font-mono ${secondaryTextClass} bg-black border ${borderClass} px-2 py-1 rounded`}><BookmarkSolid className="w-3 h-3" /><span>{room.subscribers.length}</span></div>
                                    <div className="flex gap-1 ml-auto mr-2">
                                        {room.rules.allowScreenShare && <ComputerDesktopIcon className="w-4 h-4 text-gray-500" title="Screen Share" />}
                                        {!room.rules.forbidMicMute && <MicrophoneIcon className="w-4 h-4 text-gray-500" title="Mic Allowed" />}
                                        {!room.rules.preventIgnoring && <EyeSlashIcon className="w-4 h-4 text-gray-500" title="Ignore Allowed" />}
                                    </div>
                                    <span className="text-[10px] uppercase text-gray-500 border border-gray-500/20 px-2 py-1 rounded">{t(room.type as any)}</span>
                                </div>
                            </div>
                        </div>
                        </button>
                    )
                    })}
                    {visibleRooms.length === 0 && <div className="text-center py-10 opacity-50">No worlds found matching "{mainInput}"</div>}
                    <div className="h-20" />
                </div>
                {/* Scroll To Top Button (List) */}
                {showListScrollTop && (
                    <div className="sticky bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
                        <button 
                            onClick={scrollToTopList} 
                            className="pointer-events-auto bg-black/80 backdrop-blur border border-white/20 text-white rounded-full p-3 shadow-lg hover:bg-white hover:text-black transition animate-bounce-in"
                        >
                            <ArrowUpIcon className="w-6 h-6" />
                        </button>
                    </div>
                )}
          </div>
      </div>

      {/* Profile & Settings Modals (Existing code remains same, included for completeness) */}
      {showProfile && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
             <div className={`${cardBgClass} border ${borderClass} rounded-xl w-full max-w-sm p-8 relative flex flex-col animate-bounce-in max-h-[90vh] overflow-y-auto custom-scroll shadow-2xl`}>
                 <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">{t('profile_settings')}</h2>
                    <button onClick={() => setShowProfile(false)} className={`${secondaryTextClass} hover:opacity-100`}><XMarkIcon className="w-6 h-6" /></button>
                 </div>
                 
                 <div className="flex flex-col gap-6">
                     <div className="flex flex-col gap-2">
                         <label className="text-xs uppercase tracking-widest text-gray-500 font-bold">{t('nickname')}</label>
                         <div className="relative group">
                            <input value={localPlayer.name} onChange={(e) => setPlayerName(e.target.value)} className={`${inputStyle} w-full text-lg focus:border-blue-500`} placeholder={t('nickname')} />
                        </div>
                     </div>
                     <div>
                         <label className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3 block">{t('shape')}</label>
                         <div className="flex justify-between gap-2">
                            {(['box', 'sphere', 'cone', 'cylinder'] as ShapeType[]).map((s) => (
                                <button key={s} onClick={() => { updateLocalPlayerConfig({ shape: s }); }} className={`w-14 h-14 flex items-center justify-center rounded-xl border-2 transition-all ${btnClass} ${localPlayer.shape === s ? `border-blue-500 ${isDark ? 'text-white bg-white/10' : 'text-black bg-gray-100'}` : 'border-transparent text-gray-500 hover:border-gray-500/50'}`}>
                                    <div className={`w-6 h-6 bg-current ${s === 'sphere' ? 'rounded-full' : s==='box' ? 'rounded-sm' : ''}`} style={s === 'cone' ? { width:0, height:0, backgroundColor:'transparent', borderLeft:'10px solid transparent', borderRight:'10px solid transparent', borderBottom:'20px solid currentColor' } : {}} />
                                </button>
                            ))}
                         </div>
                     </div>
                     <div>
                        <label className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3 block">{t('color')}</label>
                        <div className="flex flex-wrap gap-3">
                            {COLORS.map(c => (
                                <button key={c} onClick={() => { updateLocalPlayerConfig({ color: c }); }} className={`w-9 h-9 rounded-full border-2 transition-transform ${btnClass} ${localPlayer.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>

                    {/* My Rooms Section */}
                    {myRooms.length > 0 && (
                        <div>
                            <label className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3 block">My Rooms</label>
                            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto custom-scroll border border-white/10 rounded-lg p-1">
                                {myRooms.map(r => (
                                    <button 
                                        key={r.id} 
                                        onClick={() => { setShowProfile(false); handleRoomClick(r); }}
                                        className="flex items-center justify-between p-2 hover:bg-white/5 rounded transition text-left"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white truncate max-w-[150px]">{r.name}</span>
                                            <span className="text-[10px] text-gray-500">{r.currentPlayers} online</span>
                                        </div>
                                        <div className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded uppercase">Owner</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button onClick={() => { setShowProfile(false); logout(); }} className={`mt-4 w-full flex items-center justify-center gap-2 text-red-400 text-sm hover:opacity-100 transition px-4 py-4 border border-red-500/30 rounded-xl hover:bg-red-500/10 ${btnClass}`}>
                        <ArrowLeftOnRectangleIcon className="w-5 h-5" /><span>{t('logout')}</span>
                    </button>
                 </div>
             </div>
        </div>
      )}

      {showSettings && (
          <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={`${cardBgClass} border ${borderClass} rounded-xl w-full max-w-sm p-8 relative flex flex-col animate-bounce-in shadow-2xl max-h-[90vh] overflow-y-auto custom-scroll`}>
                  <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold">{t('settings_title')}</h2>
                      <button onClick={() => setShowSettings(false)} className="hover:opacity-70 p-1"><XMarkIcon className="w-6 h-6" /></button>
                  </div>
                  <div className="space-y-6">
                      <div className={`border-b ${borderClass} pb-6`}>
                          <label className="text-xs uppercase text-gray-500 mb-3 block font-bold">Theme</label>
                          <div className={`flex items-center justify-between p-3 rounded-xl border ${borderClass} bg-black`}>
                             <div className="flex items-center gap-2">
                                 {isDark ? <MoonIcon className="w-5 h-5 text-purple-400"/> : <SunIcon className="w-5 h-5 text-orange-400"/>}
                                 <span className="text-sm font-medium">{isDark ? 'Dark Mode' : 'Light Mode (Gray)'}</span>
                             </div>
                             <Toggle label="" checked={!isDark} onChange={() => setTheme(isDark ? 'light' : 'dark')} />
                          </div>
                      </div>
                      <div className={`border-b ${borderClass} pb-6`}>
                          <label className="text-xs uppercase text-gray-500 mb-3 block font-bold">{t('language')}</label>
                          <div className="grid grid-cols-2 gap-2">
                              {(Object.keys(LANG_FLAGS) as Language[]).map(l => (
                                  <button key={l} onClick={() => { setLanguage(l); }} className={`py-3 px-3 text-sm rounded-lg border text-left transition ${language === l ? 'bg-blue-600 text-white border-blue-500 font-bold' : `${borderClass} ${secondaryTextClass} hover:opacity-80`}`}>{LANG_FLAGS[l]}</button>
                              ))}
                          </div>
                      </div>
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('mic')}</label>
                         <select className={`w-full ${inputStyle} text-sm focus:border-blue-500`} value={selectedMicId} onChange={(e) => setAudioDevice('mic', e.target.value)}>
                            <option value="">{t('mic_default')}</option>
                            {devices.filter(d => d.kind === 'audioinput').map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.substr(0, 5)}`}</option>
                            ))}
                         </select>
                     </div>
                     <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-2">{t('sound')} (Output)</label>
                         <select className={`w-full ${inputStyle} text-sm focus:border-blue-500`} value={selectedSpeakerId} onChange={(e) => setAudioDevice('speaker', e.target.value)}>
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
    </div>
  );
};
