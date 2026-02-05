
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

export interface CustomRule {
  text: string;
  type: 'allow' | 'forbid';
}

export interface RoomRules {
  allowScreenShare: boolean;
  forbidMicMute: boolean;
  preventIgnoring: boolean;
  custom?: CustomRule[]; // Typed custom rules
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // array of userIds
}

export interface Post {
  id: string;
  // Events are from the community
  authorId: string; 
  timestamp: number;
  
  type: 'text' | 'image' | 'poll';
  
  // Event Specifics
  title?: string;
  eventDate?: string; // ISO Date or formatted string
  
  content?: string; // Description
  imageUrl?: string; // Base64
  
  // Polls
  pollOptions?: PollOption[]; 
  
  reactions: Record<string, string[]>; // emoji -> array of userIds
  going: string[]; // Array of userIds who clicked the Bell
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
  
  // Customization
  headerGradient?: string; // Custom gradient string

  // Metadata for Lobby
  maxPlayers: number;
  currentPlayers: number;
  
  // Gameplay
  allowedReactions: string[]; 
  
  // Social Wall
  posts: Post[];
}

export interface TeleportRequest {
  fromId: string;
  fromName: string;
}

export interface FriendRequest {
  fromId: string;
  fromName: string;
}
