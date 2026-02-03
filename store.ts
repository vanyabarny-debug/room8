import { create } from 'zustand';
import { PlayerState, AppSettings, WorldType, ChatMessage } from './types';

interface StoreState {
  // App Status
  isInRoom: boolean;
  roomId: string;
  
  // Local Player Settings
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;

  // Network/Game State
  myId: string;
  peers: Record<string, PlayerState>;
  
  // Media State
  micOn: boolean;
  setMicOn: (on: boolean) => void;
  
  // Streams
  peerStreams: Record<string, MediaStream>; // Audio streams
  screenShareStream: { peerId: string; stream: MediaStream } | null;

  // Actions
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  setMyId: (id: string) => void;
  updatePeer: (id: string, data: Partial<PlayerState>) => void;
  removePeer: (id: string) => void;
  
  // Local Media
  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream | null) => void;
  
  // Handling Streams
  addPeerStream: (peerId: string, stream: MediaStream) => void;
  setScreenShare: (peerId: string, stream: MediaStream | null) => void;
}

export const useStore = create<StoreState>((set) => ({
  isInRoom: false,
  roomId: 'lobby',
  
  settings: {
    nickname: `Guest_${Math.floor(Math.random() * 999)}`,
    color: '#00f3ff',
    shape: 'box',
    faceTexture: null,
    faceSplitRatio: 0.5,
    world: WorldType.NIGHT,
    language: 'en',
  },

  myId: '',
  peers: {},
  peerStreams: {},
  screenShareStream: null,
  localStream: null,
  micOn: true,

  setSettings: (newSettings) => 
    set((state) => ({ settings: { ...state.settings, ...newSettings } })),

  joinRoom: (roomId) => set({ isInRoom: true, roomId }),
  
  leaveRoom: () => set({ 
    isInRoom: false, 
    roomId: 'lobby', 
    peers: {}, 
    peerStreams: {},
    screenShareStream: null 
  }),
  
  setMyId: (id) => set({ myId: id }),
  
  updatePeer: (id, data) => 
    set((state) => ({
      peers: {
        ...state.peers,
        [id]: { ...state.peers[id], ...data, lastUpdate: Date.now() }
      }
    })),

  removePeer: (id) => 
    set((state) => {
      const newPeers = { ...state.peers };
      delete newPeers[id];
      const newStreams = { ...state.peerStreams };
      delete newStreams[id];
      return { peers: newPeers, peerStreams: newStreams };
    }),
    
  setLocalStream: (stream) => set({ localStream: stream }),
  setMicOn: (on) => set({ micOn: on }),

  addPeerStream: (peerId, stream) => 
    set((state) => ({ 
      peerStreams: { ...state.peerStreams, [peerId]: stream } 
    })),

  setScreenShare: (peerId, stream) => 
    set({ screenShareStream: stream ? { peerId, stream } : null }),
}));