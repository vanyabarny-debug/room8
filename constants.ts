import { ShapeType } from './types';

export const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];

export const SHAPES: { type: ShapeType; label: string }[] = [
  { type: 'box', label: 'Cube' },
  { type: 'sphere', label: 'Sphere' },
  { type: 'cone', label: 'Cone' },
  { type: 'cylinder', label: 'Cylinder' },
];

// Audio Distances
export const NORMAL_VOICE_DISTANCE = 20;
export const NORMAL_VOICE_REF = 2;
export const MEGAPHONE_DISTANCE = 100;
export const MEGAPHONE_REF = 10;

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'cn', label: '中文' },
  { code: 'jp', label: '日本語' },
  { code: 'th', label: 'ไทย' },
];