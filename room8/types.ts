
import React from 'react';
import { ThreeElements } from '@react-three/fiber';

export type ShapeType = 'box' | 'sphere' | 'cone' | 'cylinder';
export type EnvironmentType = 'nature' | 'space' | 'minimal';
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
  description: string; // New field
  type: EnvironmentType;
  isPrivate: boolean;
  isOfficial: boolean; // Base rooms that never delete
  creatorId?: string;  // To check ownership
  
  subscribers: string[]; // List of user IDs subscribed/joined this community
  createdAt: number;
  
  secretKey?: string;
  rules: RoomRules;
  
  // Metadata for Lobby
  maxPlayers: number;
  currentPlayers: number;
  
  // Gameplay
  allowedReactions: string[]; // Array of 5 emojis
}

export interface TeleportRequest {
  fromId: string;
  fromName: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Core
      mesh: any;
      group: any;
      instancedMesh: any;
      primitive: any;
      
      // Lights
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      spotLight: any;
      
      // Cameras
      orthographicCamera: any;
      perspectiveCamera: any;
      
      // Geometries
      sphereGeometry: any;
      boxGeometry: any;
      planeGeometry: any;
      cylinderGeometry: any;
      coneGeometry: any;
      circleGeometry: any;
      
      // Materials
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      meshPhongMaterial: any;
      
      // Helpers & Misc
      fog: any;
      gridHelper: any;
      
      // Catch-all
      [elemName: string]: any;
    }
  }
}

// Augment React's JSX namespace as well for compatibility
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // Core
      mesh: any;
      group: any;
      instancedMesh: any;
      primitive: any;
      
      // Lights
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      spotLight: any;
      
      // Cameras
      orthographicCamera: any;
      perspectiveCamera: any;
      
      // Geometries
      sphereGeometry: any;
      boxGeometry: any;
      planeGeometry: any;
      cylinderGeometry: any;
      coneGeometry: any;
      circleGeometry: any;
      
      // Materials
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      meshPhongMaterial: any;
      
      // Helpers & Misc
      fog: any;
      gridHelper: any;
      
      // Catch-all
      [elemName: string]: any;
    }
  }
}
