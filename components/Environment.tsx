
import React from 'react';
import { EnvironmentType } from '../types';
import { AmphitheaterScene, getAmphitheaterHeight, isAmphObstacle } from './environments/Amphitheater';
import { DayScene } from './environments/Day';
import { NightScene } from './environments/Night';
import { RoofsScene } from './environments/Roofs';
import { OfficeScene } from './environments/Office';
import { LobbyScene } from './environments/Lobby';
import { ConferenceScene, getConferenceSeat, isConferenceObstacle } from './environments/Conference';
import { CallScene } from './environments/Call';

interface Props {
  type: EnvironmentType;
}

// --- ARCHIPELAGO TERRAIN MATH ---

// Island Centers
const CENTER_ISLAND = { x: 0, z: 0, r: 35 };
const PIANO_ISLAND = { x: -80, z: 0, r: 30 }; // West
const CLIFF_ISLAND = { x: 80, z: 0, r: 30 };  // East
const SHRINE_ISLAND = { x: 0, z: 80, r: 25 }; // South
const TREE_ISLAND = { x: 0, z: -80, r: 35 }; // North (Was Observatory)

// Smooth Hill Function
const getHillHeight = (x: number, z: number, centerX: number, centerZ: number, radius: number, peakHeight: number) => {
    const dx = x - centerX;
    const dz = z - centerZ;
    const dist = Math.sqrt(dx*dx + dz*dz);
    
    if (dist > radius) return -100; // Void

    // Cosine hill shape
    const normalizedDist = dist / radius;
    // Edges taper to 0, Center creates hills
    const base = Math.cos(normalizedDist * Math.PI / 2); 
    
    // Add some noise simulation for "rough terrain" feeling (simple waves)
    const noise = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.5;
    
    return (base * peakHeight) + noise;
};

// Bridge Function with Slope
const getBridgeHeight = (x: number, z: number, start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}, width: number) => {
    // Distance from point to line segment (XZ plane)
    const l2 = (start.x - end.x)**2 + (start.z - end.z)**2;
    if (l2 === 0) return -100;
    
    let t = ((x - start.x) * (end.x - start.x) + (z - start.z) * (end.z - start.z)) / l2;
    t = Math.max(0, Math.min(1, t));
    
    const projX = start.x + t * (end.x - start.x);
    const projZ = start.z + t * (end.z - start.z);
    
    const distToLine = Math.sqrt((x - projX)**2 + (z - projZ)**2);
    
    if (distToLine < width) {
        // Interpolate Height (Slope)
        const baseY = start.y + t * (end.y - start.y);
        // Add Arch (sin wave)
        const arch = Math.sin(t * Math.PI) * 0.5; 
        return baseY + arch; 
    }
    return -100;
};

const getArchipelagoHeight = (x: number, z: number) => {
    let h = -100;

    // FLATTENED PEAK HEIGHT: 5 * 0.5 (heightScale) = 2.5
    const FLAT_PEAK = 2.5;

    // 1. Central Island (Spawn)
    const hCenter = getHillHeight(x, z, CENTER_ISLAND.x, CENTER_ISLAND.z, CENTER_ISLAND.r, FLAT_PEAK); 
    if (hCenter > -50) h = Math.max(h, hCenter);

    // 2. Piano Island (West)
    const hPiano = getHillHeight(x, z, PIANO_ISLAND.x, PIANO_ISLAND.z, PIANO_ISLAND.r, FLAT_PEAK); 
    if (hPiano > -50) h = Math.max(h, hPiano);

    // 3. Cliff Island (East)
    const hCliff = getHillHeight(x, z, CLIFF_ISLAND.x, CLIFF_ISLAND.z, CLIFF_ISLAND.r, FLAT_PEAK); 
    if (hCliff > -50) h = Math.max(h, hCliff);

    // 4. Shrine Island (South)
    const hShrine = getHillHeight(x, z, SHRINE_ISLAND.x, SHRINE_ISLAND.z, SHRINE_ISLAND.r, FLAT_PEAK); 
    if (hShrine > -50) h = Math.max(h, hShrine);

    // 5. Tree Island (North)
    const hTree = getHillHeight(x, z, TREE_ISLAND.x, TREE_ISLAND.z, TREE_ISLAND.r, FLAT_PEAK); 
    if (hTree > -50) h = Math.max(h, hTree);

    // --- BRIDGES (Slope Adjusted to 1.0) ---
    const bridgeWidth = 4.0;
    const BRIDGE_H = 1.0;
    
    // Center -> West
    const b1 = getBridgeHeight(x, z, {x:-25, y:BRIDGE_H, z:0}, {x:-55, y:BRIDGE_H, z:0}, bridgeWidth);
    if (b1 > -50) h = Math.max(h, b1);
    
    // Center -> East
    const b2 = getBridgeHeight(x, z, {x:25, y:BRIDGE_H, z:0}, {x:55, y:BRIDGE_H, z:0}, bridgeWidth);
    if (b2 > -50) h = Math.max(h, b2);

    // Center -> South
    const b3 = getBridgeHeight(x, z, {x:0, y:BRIDGE_H, z:25}, {x:0, y:BRIDGE_H, z:60}, bridgeWidth);
    if (b3 > -50) h = Math.max(h, b3);

    // Center -> North
    const b4 = getBridgeHeight(x, z, {x:0, y:BRIDGE_H, z:-25}, {x:0, y:BRIDGE_H, z:-55}, bridgeWidth);
    if (b4 > -50) h = Math.max(h, b4);

    return h;
};

// --- COLLISION MANAGER ---
export const getTerrainHeight = (x: number, z: number, type: EnvironmentType) => {
    if (type === 'amphitheater') return getAmphitheaterHeight(x, z);
    if (type === 'lobby') return getArchipelagoHeight(x, z);
    if (type === 'conference') {
        // Stage Area: Z > 60, approx Width X +/- 15
        // Stage visual height is 2 units (box height 2, positioned at y=1). Top is y=2.
        if (z > 60 && Math.abs(x) < 15) return 2.0; 
        return 0; // Floor
    }
    return 0;
};

// Obstacle Check
export const isObstacle = (x: number, z: number, type: EnvironmentType = 'day') => {
    if (type === 'amphitheater') return isAmphObstacle(x, z);
    if (type === 'conference') return isConferenceObstacle(x, z);
    if (type === 'call') return false; // No movement in call mode anyway
    
    if (type === 'lobby') {
        // Monolith Collision
        if (x > 75 && x < 85 && z > -5 && z < 5) return true;
        
        // Elder Tree Trunk Collision (Now at 0, -80)
        // Trunk is roughly 2-3 radius
        const distToTree = Math.sqrt(x*x + (z+80)*(z+80));
        if (distToTree < 3.5) return true;
        
        // Safety Rails: If close to edge of valid terrain, treat as obstacle unless jumping
        const h = getArchipelagoHeight(x, z);
        if (h < -10) return true; // Hard boundary at void
    }
    return false;
};

export const getClosestSeat = (px: number, pz: number, type: EnvironmentType = 'amphitheater') => {
    if (type === 'conference') {
        return getConferenceSeat(px, pz);
    }
    
    if (type === 'amphitheater') {
        const dist = Math.sqrt(px*px + pz*pz);
        if (dist > 8 && dist < 22) {
            return { x: px, y: getTerrainHeight(px, pz, 'amphitheater'), z: pz, dist: 0 };
        }
    }
    return null;
};

export const getZoneAt = (x: number, z: number) => {
    if (x < -40) return { name: "Harmonic Ruins", color: "#4ade80", fogColor: "#fff", windowColor1: "#000", windowColor2: "#000" };
    if (x > 40) return { name: "Chronicle Peak", color: "#fbbf24", fogColor: "#fff", windowColor1: "#000", windowColor2: "#000" };
    if (z > 40) return { name: "Shrine Lake", color: "#60a5fa", fogColor: "#fff", windowColor1: "#000", windowColor2: "#000" };
    if (z < -40) return { name: "Elder Tree Grove", color: "#f472b6", fogColor: "#fff", windowColor1: "#000", windowColor2: "#000" };
    return { name: "Central Plaza", color: "#fff", fogColor: "#fff", windowColor1: "#fff", windowColor2: "#ccc" };
};

export const WorldEnvironment: React.FC<Props> = ({ type }) => {
  switch (type) {
    case 'amphitheater': return <AmphitheaterScene />;
    case 'conference': return <ConferenceScene />;
    case 'call': return <CallScene />;
    case 'day': return <DayScene />;
    case 'night': return <NightScene />;
    case 'roofs': return <RoofsScene />;
    case 'lobby': return <LobbyScene />;
    case 'office': default: return <OfficeScene />;
  }
};
