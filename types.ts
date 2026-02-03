
export type ShapeType = 'box' | 'sphere' | 'cone' | 'cylinder';
// Renamed environments
export type EnvironmentType = 'day' | 'night' | 'office';
export type Language = 'ru' | 'en' | 'es' | 'th' | 'jp' | 'cn' | 'de' | 'fr' | 'it';

export interface PlayerConfig {
  name: string;
  color: string;
  shape: ShapeType;
  id: string;
}

export interface PlayerState extends PlayerConfig {
  position: [number, number, number];
  rotation: [number, number, number];
  isMoving: boolean;
  isSpeaking: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  mutedByMe?: boolean;
  isBot?: boolean;
  
  // Reaction System
  lastReaction?: string;
  lastReactionTs?: number;
}

export interface RoomRules {
  allowScreenShare: boolean;
  forbidMicMute: boolean;
  preventIgnoring: boolean;
}

export interface RoomConfig {
  id: string;
  name: string;
  description: string; 
  type: EnvironmentType;
  region: Language; // Added region/language lock
  isPrivate: boolean;
  isOfficial: boolean; // Base rooms that never delete
  creatorId?: string;  // To check ownership
  
  subscribers: string[]; 
  createdAt: number;
  
  secretKey?: string;
  rules: RoomRules;
  
  // Metadata for Lobby
  maxPlayers: number;
  currentPlayers: number;
  
  // Gameplay
  allowedReactions: string[]; 
}

export interface TeleportRequest {
  fromId: string;
  fromName: string;
}

export interface FriendRequest {
  fromId: string;
  fromName: string;
}
