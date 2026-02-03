export type ShapeType = 'box' | 'sphere' | 'cone' | 'cylinder';

export enum WorldType {
  DAY = 'DAY',
  NIGHT = 'NIGHT',
  OFFICE = 'OFFICE'
}

export interface PlayerState {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  shape: ShapeType;
  nickname: string;
  faceTexture?: string; // Base64
  faceSplitRatio?: number; // 0 to 1, default 0.5
  isSpeaking: boolean;
  isLoudspeaker: boolean; // Megaphone status
  isScreenSharing?: boolean;
  reaction?: string;
  lastUpdate: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface AppSettings {
  nickname: string;
  color: string;
  shape: ShapeType;
  faceTexture: string | null;
  faceSplitRatio: number;
  world: WorldType;
  language: string;
}

export interface StreamData {
  stream: MediaStream;
  type: 'audio' | 'video' | 'screen';
}