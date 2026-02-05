
import { create } from 'zustand';
import { PlayerConfig, PlayerState, RoomConfig, TeleportRequest, FriendRequest, Language, Post } from './types';
import { DEFAULT_REACTIONS } from './constants';
import { networkService } from './services/NetworkService';

// --- PERSISTENCE UTILS ---
const STORAGE_KEY_ID = 'room8_uid';
const STORAGE_KEY_NAME = 'room8_uname';
const STORAGE_KEY_LANG = 'room8_lang';
const STORAGE_KEY_THEME = 'room8_theme';
const STORAGE_KEY_FRIENDS = 'room8_friends_list';

const getPersistedId = () => {
  let id = localStorage.getItem(STORAGE_KEY_ID);
  if (!id) {
    id = Math.random().toString(36).substr(2, 9);
    localStorage.setItem(STORAGE_KEY_ID, id);
  }
  return id;
};

const getPersistedName = () => {
  return localStorage.getItem(STORAGE_KEY_NAME) || '';
};

const getPersistedLang = (): Language => {
  const lang = localStorage.getItem(STORAGE_KEY_LANG);
  if (['ru', 'en', 'es', 'th', 'jp', 'cn', 'de', 'fr', 'it'].includes(lang || '')) {
      return lang as Language;
  }
  return 'en';
};

const getPersistedTheme = (): 'dark' | 'light' => {
    return (localStorage.getItem(STORAGE_KEY_THEME) as 'dark' | 'light') || 'dark';
};

const getPersistedFriends = (): string[] => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_FRIENDS) || '[]');
    } catch {
        return [];
    }
}

// Generate default rooms for ALL languages to simulate "Servers"
const LANGUAGES: Language[] = ['ru', 'en', 'es', 'th', 'jp', 'cn', 'de', 'fr', 'it'];
const defaultRooms: Record<string, RoomConfig> = {};

LANGUAGES.forEach(lang => {
    // 1. Day World
    const dayId = `${lang}-public-day`;
    defaultRooms[dayId] = {
        id: dayId, 
        name: 'Day World', 
        description: 'Green grass, blue sky.',
        type: 'day', 
        region: lang,
        isPrivate: false, 
        isOfficial: true,
        rules: { allowScreenShare: true, forbidMicMute: false, preventIgnoring: false },
        maxPlayers: 50, currentPlayers: 0, allowedReactions: DEFAULT_REACTIONS,
        subscribers: [], createdAt: Date.now(),
        posts: [],
        headerGradient: 'linear-gradient(to right, #14532d, #1e3a8a)'
    };

    // 2. Night World
    const nightId = `${lang}-public-night`;
    defaultRooms[nightId] = {
        id: nightId, 
        name: 'Night World', 
        description: 'Dark sky, snow, moon.',
        type: 'night', 
        region: lang,
        isPrivate: false, 
        isOfficial: true,
        rules: { allowScreenShare: true, forbidMicMute: false, preventIgnoring: false },
        maxPlayers: 50, currentPlayers: 0, allowedReactions: DEFAULT_REACTIONS,
        subscribers: [], createdAt: Date.now(),
        posts: [],
        headerGradient: 'linear-gradient(to right, #000000, #312e81)'
    };

    // 3. Room8 Office (Template)
    const officeId = `${lang}-public-office`;
    defaultRooms[officeId] = {
        id: officeId, 
        name: 'Room8 Office', 
        description: 'Template room.',
        type: 'office', 
        region: lang,
        isPrivate: false, // It shows up in list, but UI will prevent join
        isOfficial: true,
        rules: { allowScreenShare: true, forbidMicMute: false, preventIgnoring: false },
        maxPlayers: 0, currentPlayers: 0, allowedReactions: DEFAULT_REACTIONS,
        subscribers: [], createdAt: Date.now(),
        posts: [],
        headerGradient: 'linear-gradient(to right, #312e81, #1e40af)'
    };
});

interface AppState {
  language: Language;
  theme: 'dark' | 'light';
  isInGame: boolean;
  hasOnboarded: boolean;
  localPlayer: PlayerConfig;
  
  rooms: Record<string, RoomConfig>;
  activeRoomId: string | null;

  peers: Record<string, PlayerState>;
  peerStreams: Record<string, { audio?: MediaStream, screen?: MediaStream }>;
  
  friends: string[];
  
  incomingTeleport: TeleportRequest | null;
  incomingFriendRequest: FriendRequest | null;
  
  controls: { forward: number; turn: number; };
  isLocalPlayerMoving: boolean;
  isJoystickActive: boolean;

  micEnabled: boolean;
  audioEnabled: boolean;
  screenShareEnabled: boolean;
  activeCinemaStream: MediaStream | null;
  
  selectedMicId: string;
  selectedSpeakerId: string;
  
  micStream: MediaStream | null;
  screenStream: MediaStream | null;

  // Actions
  setLanguage: (lang: Language) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setInGame: (val: boolean) => void;
  setOnboarded: (val: boolean) => void;
  logout: () => void;
  updateLocalPlayerConfig: (config: Partial<PlayerConfig>) => void;
  setPlayerName: (name: string) => void;
  
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  registerRoom: (room: RoomConfig) => void;
  
  toggleRoomSubscription: (roomId: string) => void;
  updateRoomDetails: (roomId: string, updates: Partial<RoomConfig>) => void;
  
  // Social Actions
  addRoomPost: (roomId: string, post: Post) => void;
  togglePostReaction: (roomId: string, postId: string, emoji: string) => void;
  togglePostGoing: (roomId: string, postId: string) => void;
  votePoll: (roomId: string, postId: string, optionId: string) => void;
  
  updatePeer: (id: string, data: Partial<PlayerState>) => void;
  removePeer: (id: string) => void;
  addStream: (id: string, stream: MediaStream, meta?: any) => void;
  removeStream: (id: string) => void;

  requestFriend: (id: string) => void;
  respondToFriendRequest: (accepted: boolean) => void;
  setIncomingFriendRequest: (req: FriendRequest | null) => void;
  addFriend: (id: string) => void;
  removeFriend: (id: string) => void;
  
  setControls: (controls: Partial<{ forward: number; turn: number }>) => void;
  setLocalPlayerMoving: (val: boolean) => void;
  setJoystickActive: (val: boolean) => void;

  requestTeleport: (targetId: string) => void;
  respondToTeleport: (accepted: boolean) => void;
  setIncomingTeleport: (req: TeleportRequest | null) => void;
  triggerReaction: (emoji: string) => void;

  toggleMic: () => Promise<void>;
  toggleAudio: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  setActiveCinemaStream: (stream: MediaStream | null) => void;

  setAudioDevice: (kind: 'mic' | 'speaker', deviceId: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  language: getPersistedLang(),
  theme: getPersistedTheme(),
  isInGame: false,
  hasOnboarded: false,
  localPlayer: {
    id: getPersistedId(),
    name: getPersistedName(),
    color: '#ffffff',
    shape: 'box'
  },
  
  rooms: defaultRooms,
  activeRoomId: null,

  peers: {},
  peerStreams: {},
  friends: getPersistedFriends(),
  incomingTeleport: null,
  incomingFriendRequest: null,
  
  controls: { forward: 0, turn: 0 },
  isLocalPlayerMoving: false,
  isJoystickActive: false,

  micEnabled: false,
  audioEnabled: false,
  screenShareEnabled: false,
  activeCinemaStream: null,
  micStream: null,
  screenStream: null,
  
  selectedMicId: '',
  selectedSpeakerId: '',

  setLanguage: (lang) => {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
      set({ language: lang });
  },

  setTheme: (theme) => {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
      set({ theme });
  },

  setInGame: (val) => set({ isInGame: val }),
  setOnboarded: (val) => set({ hasOnboarded: val }),
  
  logout: () => {
    localStorage.removeItem(STORAGE_KEY_NAME);
    set({ 
        hasOnboarded: false, 
        isInGame: false, 
        activeRoomId: null,
        localPlayer: { ...get().localPlayer, name: '' }
    });
  },

  updateLocalPlayerConfig: (config) => set((state) => ({
    localPlayer: { ...state.localPlayer, ...config }
  })),

  setPlayerName: (name) => {
      localStorage.setItem(STORAGE_KEY_NAME, name);
      set((state) => ({
          localPlayer: { ...state.localPlayer, name }
      }));
  },

  registerRoom: (room) => set((state) => ({
      rooms: { ...state.rooms, [room.id]: room }
  })),

  toggleRoomSubscription: (roomId) => set((state) => {
      const room = state.rooms[roomId];
      if (!room) return state;
      const userId = state.localPlayer.id;
      const isSubscribed = room.subscribers.includes(userId);
      let newSubs = isSubscribed ? room.subscribers.filter(id => id !== userId) : [...room.subscribers, userId];
      return { rooms: { ...state.rooms, [roomId]: { ...room, subscribers: newSubs } } };
  }),

  updateRoomDetails: (roomId, updates) => set((state) => ({
      rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], ...updates } }
  })),

  addRoomPost: (roomId, post) => set((state) => {
      const room = state.rooms[roomId];
      if (!room) return state;
      const newPosts = [post, ...(room.posts || [])];
      return { rooms: { ...state.rooms, [roomId]: { ...room, posts: newPosts } } };
  }),

  togglePostReaction: (roomId, postId, emoji) => set((state) => {
      const room = state.rooms[roomId];
      if (!room || !room.posts) return state;
      const userId = state.localPlayer.id;
      
      const newPosts = room.posts.map(p => {
          if (p.id === postId) {
              const reactions = { ...(p.reactions || {}) };
              Object.keys(reactions).forEach(key => {
                  if (key !== emoji) {
                      reactions[key] = reactions[key].filter(id => id !== userId);
                      if (reactions[key].length === 0) delete reactions[key];
                  }
              });
              const userList = reactions[emoji] || [];
              if (userList.includes(userId)) {
                  reactions[emoji] = userList.filter(id => id !== userId);
                  if (reactions[emoji].length === 0) delete reactions[emoji];
              } else {
                  reactions[emoji] = [...userList, userId];
              }
              return { ...p, reactions };
          }
          return p;
      });
      return { rooms: { ...state.rooms, [roomId]: { ...room, posts: newPosts } } };
  }),

  togglePostGoing: (roomId, postId) => set((state) => {
      const room = state.rooms[roomId];
      if (!room || !room.posts) return state;
      const userId = state.localPlayer.id;
      
      const newPosts = room.posts.map(p => {
          if (p.id === postId) {
              const going = p.going || [];
              const newGoing = going.includes(userId) 
                  ? going.filter(id => id !== userId) 
                  : [...going, userId];
              return { ...p, going: newGoing };
          }
          return p;
      });
      return { rooms: { ...state.rooms, [roomId]: { ...room, posts: newPosts } } };
  }),

  votePoll: (roomId, postId, optionId) => set((state) => {
      const room = state.rooms[roomId];
      if (!room || !room.posts) return state;
      const userId = state.localPlayer.id;

      const newPosts = room.posts.map(p => {
          if (p.id === postId && p.type === 'poll' && p.pollOptions) {
              const newOptions = p.pollOptions.map(opt => {
                  // Remove user from all options first (single choice)
                  const votes = opt.votes.filter(v => v !== userId);
                  if (opt.id === optionId) {
                      votes.push(userId);
                  }
                  return { ...opt, votes };
              });
              return { ...p, pollOptions: newOptions };
          }
          return p;
      });
      return { rooms: { ...state.rooms, [roomId]: { ...room, posts: newPosts } } };
  }),

  joinRoom: (roomId) => {
    set({ 
        activeRoomId: roomId, 
        peers: {}, 
        peerStreams: {},
        incomingTeleport: null,
        incomingFriendRequest: null
    });
    networkService.connect(roomId);
    const room = get().rooms[roomId];
    if (room && room.rules.forbidMicMute) {
        get().toggleMic();
    }
  },

  leaveRoom: () => {
      const { activeRoomId, rooms, micStream } = get();
      networkService.disconnect();
      get().stopScreenShare();
      if(micStream) {
          micStream.getTracks().forEach(t => t.stop());
      }
      const newRooms = { ...rooms };
      if (activeRoomId && newRooms[activeRoomId]) {
          const room = newRooms[activeRoomId];
          const newCount = Math.max(0, room.currentPlayers - 1);
          if (room.isPrivate && newCount === 0) {
              delete newRooms[activeRoomId];
          } else {
              newRooms[activeRoomId] = { ...room, currentPlayers: newCount };
          }
      }
      set({ 
          activeRoomId: null, rooms: newRooms, peers: {}, peerStreams: {},
          isInGame: false, micEnabled: false, micStream: null, isJoystickActive: false, activeCinemaStream: null
      });
  },

  updatePeer: (id, data) => set((state) => {
    const currentRoom = state.activeRoomId ? state.rooms[state.activeRoomId] : null;
    if (currentRoom?.rules.preventIgnoring && data.mutedByMe === true) {
        data.mutedByMe = false;
    }
    const existing = state.peers[id] || {
      id, name: 'Unknown', color: '#fff', shape: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0],
      isMoving: false, isSpeaking: false, isMicOn: false, isScreenSharing: false
    };
    const newPeers = { ...state.peers, [id]: { ...existing, ...data } };
    const newRoomState = { ...state.rooms };
    if (state.activeRoomId && newRoomState[state.activeRoomId]) {
        newRoomState[state.activeRoomId] = {
            ...newRoomState[state.activeRoomId],
            currentPlayers: Object.keys(newPeers).length + 1
        };
    }
    return { peers: newPeers, rooms: newRoomState };
  }),

  removePeer: (id) => set((state) => {
    const newPeers = { ...state.peers };
    delete newPeers[id];
    const newStreams = { ...state.peerStreams };
    delete newStreams[id];
    const newRoomState = { ...state.rooms };
    if (state.activeRoomId && newRoomState[state.activeRoomId]) {
        newRoomState[state.activeRoomId] = {
            ...newRoomState[state.activeRoomId],
            currentPlayers: Math.max(0, Object.keys(newPeers).length + 1)
        };
    }
    return { peers: newPeers, peerStreams: newStreams, rooms: newRoomState };
  }),

  addStream: (id, stream, meta) => set((state) => {
      const current = state.peerStreams[id] || {};
      const isScreen = meta?.type === 'screen';
      const updated = isScreen ? { ...current, screen: stream } : { ...current, audio: stream };
      const peerUpdate: Partial<PlayerState> = {};
      if (isScreen) peerUpdate.isScreenSharing = true; else peerUpdate.isMicOn = true;
      const newPeers = { ...state.peers };
      if (newPeers[id]) newPeers[id] = { ...newPeers[id], ...peerUpdate };
      else newPeers[id] = {
          id, name: 'Connecting...', color: '#fff', shape: 'box',
          position: [0,0,0], rotation: [0,0,0], isMoving: false, isSpeaking: false, 
          isMicOn: !isScreen, isScreenSharing: isScreen
      };
      return { peerStreams: { ...state.peerStreams, [id]: updated }, peers: newPeers };
  }),
  
  removeStream: (id) => set(state => {
      const newStreams = { ...state.peerStreams };
      delete newStreams[id];
      return { peerStreams: newStreams };
  }),

  requestFriend: (id) => { networkService.sendFriendRequest(id, get().localPlayer.name); },
  setIncomingFriendRequest: (req) => set({ incomingFriendRequest: req }),
  respondToFriendRequest: (accepted) => {
      const req = get().incomingFriendRequest;
      if (req && accepted) {
          networkService.sendFriendResponse(req.fromId, true);
          get().addFriend(req.fromId);
      }
      set({ incomingFriendRequest: null });
  },
  addFriend: (id) => set((state) => {
      if (state.friends.includes(id)) return state;
      const newFriends = [...state.friends, id];
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(newFriends));
      return { friends: newFriends };
  }),
  removeFriend: (id) => set((state) => {
      const newFriends = state.friends.filter(f => f !== id);
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(newFriends));
      return { friends: newFriends };
  }),

  setControls: (controls) => set((state) => ({ controls: { ...state.controls, ...controls } })),
  setLocalPlayerMoving: (val) => set({ isLocalPlayerMoving: val }),
  setJoystickActive: (val) => set({ isJoystickActive: val }),

  requestTeleport: (targetId) => { networkService.sendTeleportRequest(targetId, get().localPlayer.name); },
  setIncomingTeleport: (req) => set({ incomingTeleport: req }),
  respondToTeleport: (accepted) => {
     const req = get().incomingTeleport;
     if(req) networkService.sendTeleportResponse(req.fromId, accepted);
     set({ incomingTeleport: null });
  },

  triggerReaction: (emoji) => {
      networkService.sendReaction(emoji);
      window.dispatchEvent(new CustomEvent('local-reaction', { detail: emoji }));
  },

  setAudioDevice: (kind, deviceId) => {
      if (kind === 'mic') set({ selectedMicId: deviceId });
      if (kind === 'speaker') set({ selectedSpeakerId: deviceId });
      if (kind === 'mic' && get().micEnabled) {
          get().toggleMic().then(() => get().toggleMic());
      }
  },

  toggleMic: async () => {
    const { micEnabled, micStream, activeRoomId, rooms, selectedMicId } = get();
    const room = activeRoomId ? rooms[activeRoomId] : null;
    if (micEnabled && room?.rules.forbidMicMute) {
        alert("Microphone is required by room rules.");
        return;
    }
    if (micEnabled) {
      if (micStream) {
          micStream.getTracks().forEach(t => t.stop());
          networkService.removeStream(micStream);
      }
      set({ micEnabled: false, micStream: null });
      networkService.sendMyUpdate({ isMicOn: false });
    } else {
      try {
        const constraints: MediaStreamConstraints = {
            audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        networkService.addStream(stream, 'audio');
        set({ micEnabled: true, micStream: stream });
        networkService.sendMyUpdate({ isMicOn: true });
      } catch (e) {
        console.error("Mic access denied", e);
        alert("Could not access microphone");
      }
    }
  },

  toggleAudio: () => set((state) => ({ audioEnabled: !state.audioEnabled })),

  startScreenShare: async () => {
    const { activeRoomId, rooms } = get();
    const room = activeRoomId ? rooms[activeRoomId] : null;
    if (room && !room.rules.allowScreenShare) {
        alert("Screen sharing is disabled in this room.");
        return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      networkService.addStream(stream, 'screen');
      networkService.sendMyUpdate({ isScreenSharing: true });
      stream.getVideoTracks()[0].onended = () => { get().stopScreenShare(); };
      set({ screenShareEnabled: true, screenStream: stream });
    } catch (e) { console.error("Screen share failed", e); }
  },

  stopScreenShare: () => {
    const { screenStream } = get();
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        networkService.removeStream(screenStream);
    }
    set({ screenShareEnabled: false, screenStream: null, activeCinemaStream: null });
    networkService.sendMyUpdate({ isScreenSharing: false });
  },

  setActiveCinemaStream: (stream) => set({ activeCinemaStream: stream }),
}));
