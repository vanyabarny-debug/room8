
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Stars, Sparkles, Html, shaderMaterial, Text, Float, Cloud, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store';
import { audioSynth } from '../../services/AudioSynthesizer';
import { getTerrainHeight } from '../Environment';

// --- UTILS ---

// Inject Wind into Standard Material
const windShaderInjection = {
  onBeforeCompile: (shader: any) => {
    shader.uniforms.time = { value: 0 };
    shader.vertexShader = `
      uniform float time;
      attribute float aScale;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
        #include <begin_vertex>
        
        float wind = sin(time * 1.5 + transformed.x * 0.5) * 0.3 + cos(time * 1.0 + transformed.z * 0.2) * 0.1;
        // Apply scale
        transformed.y *= aScale;
        
        // Apply wind bending (mostly to top vertices, assuming uv.y is height)
        // Since we use a plane, we can check position.y or uv.y if available. 
        // For standard geometry, position.y > 0 is the tip.
        float bend = smoothstep(0.0, 1.0, position.y + 0.5); 
        transformed.x += wind * bend * 2.0;
        transformed.z += wind * bend * 0.5;
      `
    );
    // Store reference to uniforms to update time
    shader.userData = { uniforms: shader.uniforms };
  }
};

// --- COMPONENTS ---

// 1. Torch Component (Fire + Light)
const Torch = ({ position }: { position: [number, number, number] }) => {
    const lightRef = useRef<THREE.PointLight>(null);
    
    // Flickering effect
    useFrame(({ clock }) => {
        if (lightRef.current) {
            const t = clock.getElapsedTime();
            // Intense flicker: Base 24.0 (4x previous 6.0)
            lightRef.current.intensity = 24.0 + Math.sin(t * 15) * 4.0 + Math.cos(t * 34) * 4.0;
        }
    });

    return (
        <group position={position}>
            {/* Stick */}
            <mesh position={[0, 1, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
                <meshStandardMaterial color="#261a15" roughness={1} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 2, 0]}>
                <cylinderGeometry args={[0.12, 0.08, 0.4, 8]} />
                <meshStandardMaterial color="#111" />
            </mesh>
            {/* Light source (Intensity x4) */}
            <pointLight 
                ref={lightRef} 
                position={[0, 2.5, 0]} 
                color="#ff6600" 
                distance={40} 
                decay={2} 
                castShadow 
                shadow-bias={-0.001}
            />
            {/* Fire Particles (Simple) */}
            <Sparkles count={15} scale={[0.5, 1, 0.5]} position={[0, 2.4, 0]} size={6} speed={2} color="#ffaa00" />
        </group>
    );
};

// 2. Bridges (Now using Standard Material for lighting)
const RopeBridge = ({ start, end }: { start: [number,number,number], end: [number,number,number] }) => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const length = startVec.distanceTo(endVec);
    const mid = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const angleY = Math.atan2(dx, dz);
    const dy = end[1] - start[1];
    const angleX = Math.atan2(dy, Math.sqrt(dx*dx + dz*dz));

    return (
        <group>
            {/* Add Torches at ends of bridge */}
            <Torch position={start} />
            <Torch position={end} />
            
            <group position={mid} rotation={[0, angleY, 0]}>
                 <group rotation={[angleX, 0, 0]}>
                     {Array.from({ length: 20 }).map((_, i) => {
                         const t = i / 19; 
                         const z = (t - 0.5) * length;
                         const archY = Math.sin(t * Math.PI) * 0.5; 
                         return (
                             <mesh key={i} position={[0, archY, z]} receiveShadow castShadow>
                                 <boxGeometry args={[4, 0.2, length/20 + 0.1]} />
                                 <meshStandardMaterial color="#3e2723" roughness={1} />
                             </mesh>
                         )
                     })}
                     <mesh position={[-2.1, 1.0, 0]} rotation={[Math.PI/2, 0, 0]} castShadow>
                         <cylinderGeometry args={[0.05, 0.05, length, 8]} />
                         <meshStandardMaterial color="#1a1008" />
                     </mesh>
                     <mesh position={[2.1, 1.0, 0]} rotation={[Math.PI/2, 0, 0]} castShadow>
                         <cylinderGeometry args={[0.05, 0.05, length, 8]} />
                         <meshStandardMaterial color="#1a1008" />
                     </mesh>
                 </group>
            </group>
        </group>
    );
}

// 3. Volumetric Grass (Standard Material)
const LobbyGrass = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    // Increased grass count from 30k to 80k
    const count = 80000;
    const dummy = new THREE.Object3D();
    // Keep reference to compiled shader to update time
    const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

    useEffect(() => {
        if (!meshRef.current) return;

        const scales = new Float32Array(count);
        let idx = 0;
        const islandCenters = [
            { x: 0, z: 0, r: 35 },
            { x: -80, z: 0, r: 30 },
            { x: 80, z: 0, r: 30 },
            { x: 0, z: 80, r: 25 },
            { x: 0, z: -80, r: 35 }
        ];

        const isOnPath = (x: number, z: number) => {
            const dx = x + Math.sin(z * 0.1) * 1.5;
            const dz = z + Math.cos(x * 0.1) * 1.5;
            if (Math.abs(dz) < 2.8 && Math.abs(dx) < 30) return true;
            if (Math.abs(dx) < 2.8 && Math.abs(dz) < 30) return true;
            return false;
        };

        for (let i = 0; i < count; i++) {
            const island = islandCenters[Math.floor(Math.random() * islandCenters.length)];
            const r = Math.sqrt(Math.random()) * (island.r - 2); 
            const theta = Math.random() * Math.PI * 2;
            const x = island.x + r * Math.cos(theta);
            const z = island.z + r * Math.sin(theta);
            
            const h = getTerrainHeight(x, z, 'lobby');
            
            // Only place grass on relatively flat ground
            if (h > 0.5 && !isOnPath(x - island.x, z - island.z)) {
                // Lower grass by 0.5 to sink roots into ground (Prevent floating)
                dummy.position.set(x, h - 0.5, z); 
                dummy.rotation.set(0, Math.random() * Math.PI, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(idx, dummy.matrix);
                scales[idx] = 0.5 + Math.random() * 0.8; 
                idx++;
            }
        }
        meshRef.current.count = idx;
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
        meshRef.current.computeBoundingSphere(); 
    }, []);

    useFrame((state) => {
        // Update shader time for wind
        if (materialRef.current && materialRef.current.userData.uniforms) {
            materialRef.current.userData.uniforms.time.value = state.clock.getElapsedTime();
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} receiveShadow castShadow frustumCulled={false}>
            <planeGeometry args={[0.1, 0.6, 1, 2]} /> 
            <meshStandardMaterial 
                ref={materialRef}
                color="#2d4c1e" 
                side={THREE.DoubleSide} 
                onBeforeCompile={windShaderInjection.onBeforeCompile}
                roughness={1}
            />
        </instancedMesh>
    );
};

// 4. Procedural Island (Standard Material with Vertex Colors)
const ProceduralIsland = ({ position, radius, heightScale = 1, seed = 0 }: any) => {
    const meshRef = useRef<THREE.Mesh>(null!);

    const geometry = useMemo(() => {
        const geo = new THREE.CylinderGeometry(radius, radius * 0.4, 30, 64, 10); 
        geo.translate(0, -15, 0);
        const pos = geo.attributes.position;
        const count = pos.count;
        const colors = new Float32Array(count * 3);
        const vertex = new THREE.Vector3();
        
        // Define colors
        const cGrass = new THREE.Color('#1a2614'); // Dark Night Grass
        const cCliff = new THREE.Color('#14100e'); // Dark Stone
        const cPath = new THREE.Color('#2e251e');  // Dark Path

        for (let i = 0; i < count; i++) {
            vertex.fromBufferAttribute(pos, i);
            const angle = Math.atan2(vertex.z, vertex.x);
            const dist = Math.sqrt(vertex.x**2 + vertex.z**2);
            
            // Noise
            const noise1 = Math.sin(vertex.x * 0.15 + seed) * Math.cos(vertex.z * 0.15 + seed);
            const noise2 = Math.sin(angle * 4 + seed);
            
            // Shape Terrain
            if (vertex.y > -5) {
                const normalizedDist = dist / radius;
                const hillShape = Math.cos(normalizedDist * Math.PI / 2) * 5 * heightScale;
                vertex.y += hillShape + noise1 * 0.5;
            } else {
                const deepness = (1 - (dist/radius)) * 20;
                vertex.y -= deepness * Math.abs(noise2) + Math.random();
                vertex.x *= 0.8;
                vertex.z *= 0.8;
            }
            pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        // Recompute normals for lighting and slope detection
        geo.computeVertexNormals();
        const normals = geo.attributes.normal;

        // Apply Vertex Colors based on Slope and Path logic
        for (let i = 0; i < count; i++) {
            vertex.fromBufferAttribute(pos, i);
            const ny = normals.getY(i);
            const upDot = ny; // Dot product with (0,1,0) is just y component of normal

            let distToPath = 1000;
            
            // 4-Way paths logic simplified: Check if near axis
            const pX = vertex.x + Math.sin(vertex.z * 0.1) * 1.5;
            const pZ = vertex.z + Math.cos(vertex.x * 0.1) * 1.5;
            
            // Increase path range to 90 to cover bridges to other islands
            if (Math.abs(pZ) < 3.0 && Math.abs(pX) < 90) distToPath = 0; // East/West
            if (Math.abs(pX) < 3.0 && Math.abs(pZ) < 90) distToPath = 0; // North/South

            let finalColor = cCliff;

            if (upDot > 0.6) {
                // Flat enough for grass
                finalColor = cGrass;
                if (distToPath < 2.0 && vertex.y > -2) {
                    finalColor = cPath;
                }
            }

            colors[i * 3] = finalColor.r;
            colors[i * 3 + 1] = finalColor.g;
            colors[i * 3 + 2] = finalColor.b;
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeBoundingSphere();
        return geo;
    }, [radius, heightScale, seed]);

    return (
        <group position={position}>
            <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow frustumCulled={false}>
                <meshStandardMaterial vertexColors roughness={0.9} />
            </mesh>
        </group>
    );
};

// --- POI: ELDER TREE ---
const ElderTree = () => {
    // Generate spiral vines using TubeGeometry + CatmullRom
    const vines = useMemo(() => {
        return Array.from({ length: 5 }).map((_, i) => {
            const points = [];
            const height = 18;
            const turns = 2;
            const steps = 40;
            const radiusBase = 3;
            const phase = (i / 5) * Math.PI * 2;
            for(let j=0; j<=steps; j++) {
                const t = j/steps;
                const angle = (t * Math.PI * 2 * turns) + phase;
                const r = radiusBase * (1 - t*0.6); 
                const x = Math.cos(angle) * r;
                const z = Math.sin(angle) * r;
                const y = t * height;
                points.push(new THREE.Vector3(x, y, z));
            }
            return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.6 * (1 - (i*0.1)), 8, false);
        });
    }, []);

    // Create Instance Mesh for High Density Leaves
    const leafCount = 400;
    const leafMesh = useRef<THREE.InstancedMesh>(null!);
    const dummy = new THREE.Object3D();

    useEffect(() => {
        if(!leafMesh.current) return;
        let idx = 0;
        for(let i=0; i<leafCount; i++) {
            // Random sphere distribution near top
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 5 + Math.random() * 8;
            
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = 16 + r * Math.sin(phi) * Math.sin(theta) * 0.6; // Flattened Y
            const z = r * Math.cos(phi);

            dummy.position.set(x, y, z);
            dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
            const s = 1 + Math.random() * 2;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            leafMesh.current.setMatrixAt(idx++, dummy.matrix);
        }
        leafMesh.current.instanceMatrix.needsUpdate = true;
    }, []);

    const crystalRef = useRef<THREE.Mesh>(null!);
    const canopyLightsRef = useRef<THREE.Group>(null!);

    useFrame((state) => {
        if(crystalRef.current) {
            crystalRef.current.position.y = 8 + Math.sin(state.clock.getElapsedTime()) * 0.5;
            crystalRef.current.rotation.y += 0.01;
        }
        if(leafMesh.current) {
            leafMesh.current.rotation.y = state.clock.getElapsedTime() * 0.05;
        }
        // Pulse the canopy lights
        if(canopyLightsRef.current) {
            const intensity = 200 + Math.sin(state.clock.getElapsedTime() * 2) * 50;
            canopyLightsRef.current.children.forEach((l) => {
                if (l instanceof THREE.PointLight) l.intensity = intensity;
            });
        }
    });

    return (
        <group position={[0, 2.5, -80]}>
             {/* Roots and Trunk */}
             <group>
                 {vines.map((geo, i) => (
                     <mesh key={i} geometry={geo} castShadow receiveShadow>
                         <meshStandardMaterial color="#1a1008" roughness={0.9} />
                     </mesh>
                 ))}
             </group>

             {/* Glowing Core Crystal (Max Intensity x4) */}
             <mesh ref={crystalRef} position={[0, 8, 0]}>
                 <octahedronGeometry args={[2, 0]} />
                 <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={100} toneMapped={false} />
                 {/* Increased intensity to 800 */}
                 <pointLight color="#ff00ff" distance={120} intensity={800} decay={2} castShadow />
             </mesh>

             {/* EXTRA CANOPY LIGHTING - Illuminates leaves specifically */}
             <group ref={canopyLightsRef}>
                 <pointLight position={[6, 16, 0]} color="#f0abfc" distance={40} intensity={200} decay={1.5} />
                 <pointLight position={[-6, 16, 0]} color="#f0abfc" distance={40} intensity={200} decay={1.5} />
                 <pointLight position={[0, 16, 6]} color="#f0abfc" distance={40} intensity={200} decay={1.5} />
                 <pointLight position={[0, 16, -6]} color="#f0abfc" distance={40} intensity={200} decay={1.5} />
             </group>

             {/* High Density Glowing Foliage */}
             <instancedMesh ref={leafMesh} args={[undefined, undefined, leafCount]} frustumCulled={false}>
                 <planeGeometry args={[1, 1]} />
                 {/* Basic material makes leaves look like they glow themselves */}
                 <meshBasicMaterial color="#f0abfc" side={THREE.DoubleSide} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
             </instancedMesh>

             {/* Reduced Particle Cloud */}
             <Sparkles count={30} scale={[25, 20, 25]} position={[0, 16, 0]} color="#e879f9" size={8} speed={0.3} opacity={0.8} />
             
             {/* Ground Glow (Increased to 120) */}
             <pointLight position={[0, 2, 0]} color="#ff00ff" distance={50} intensity={120} />
            
            <Text position={[0, 26, 0]} fontSize={2} color="#f0abfc" outlineWidth={0.05} outlineColor="#5b21b6">ELDER SPIRIT</Text>
        </group>
    );
};

const AncientPiano = () => {
    const keysRef = useRef<THREE.InstancedMesh>(null!);
    const blackKeysRef = useRef<THREE.InstancedMesh>(null!);
    const keyStates = useRef<number[]>(new Array(48).fill(0)); 
    const lastTrigger = useRef<number[]>(new Array(48).fill(0));
    const dummy = new THREE.Object3D();
    const POS_Y = 2.5; 
    const POS_X = -80;
    const OCTAVES = 4;
    const WHITE_KEY_WIDTH = 1.0;
    
    const keyData = useMemo(() => {
        const white = []; const black = []; let xPos = 0;
        for (let o = 0; o < OCTAVES; o++) {
            const notes = [0, 2, 4, 5, 7, 9, 11];
            for (let i = 0; i < 7; i++) { white.push({ x: xPos, z: 0, note: 65.41 * Math.pow(2, o + notes[i]/12), idx: o * 12 + notes[i] }); xPos += WHITE_KEY_WIDTH + 0.1; }
            const octaveStart = xPos - (7 * (WHITE_KEY_WIDTH + 0.1));
            const blackOffsets = [0.5, 1.5, 3.5, 4.5, 5.5];
            const blackNotes = [1, 3, 6, 8, 10];
            for(let i=0; i<5; i++) black.push({ x: octaveStart + (blackOffsets[i] * 1.1), z: -1.0, note: 65.41 * Math.pow(2, o + blackNotes[i]/12), idx: o * 12 + blackNotes[i] });
        }
        const totalWidth = xPos;
        white.forEach(k => k.x -= totalWidth / 2); black.forEach(k => k.x -= totalWidth / 2);
        return { white, black };
    }, []);

    useFrame((state) => {
        const playerPos = useStore.getState().gameRefs.localPlayerPosition;
        const now = state.clock.getElapsedTime();
        const center = new THREE.Vector3(POS_X, POS_Y, 0); 
        keyData.white.forEach((k, i) => {
            const worldKx = center.x + k.x; const worldKz = center.z + k.z; let pressed = false;
            if (Math.abs(playerPos.x - worldKx) < 0.5 && Math.abs(playerPos.z - worldKz) < 2.0 && Math.abs(playerPos.y - center.y) < 3.0) pressed = true;
            if (pressed && now - lastTrigger.current[k.idx] > 0.2) { audioSynth.playNote(k.note); lastTrigger.current[k.idx] = now; window.dispatchEvent(new CustomEvent('local-reaction', { detail: '🎵' })); }
            keyStates.current[k.idx] = THREE.MathUtils.lerp(keyStates.current[k.idx], pressed ? -0.2 : 0, 0.2);
            dummy.position.set(k.x, keyStates.current[k.idx], k.z); dummy.scale.set(WHITE_KEY_WIDTH, 0.4, 4.0); dummy.updateMatrix();
            keysRef.current.setMatrixAt(i, dummy.matrix); keysRef.current.setColorAt(i, pressed ? new THREE.Color('#60a5fa') : new THREE.Color('#ddd'));
        });
        keysRef.current.instanceMatrix.needsUpdate = true; if(keysRef.current.instanceColor) keysRef.current.instanceColor.needsUpdate = true;
        keyData.black.forEach((k, i) => {
            const worldKx = center.x + k.x; const worldKz = center.z + k.z; let pressed = false;
            if (Math.abs(playerPos.x - worldKx) < 0.4 && Math.abs(playerPos.z - worldKz) < 2.0 && Math.abs(playerPos.y - center.y) < 3.0) pressed = true;
            if (pressed && now - lastTrigger.current[k.idx] > 0.2) { audioSynth.playNote(k.note); lastTrigger.current[k.idx] = now; }
            keyStates.current[k.idx] = THREE.MathUtils.lerp(keyStates.current[k.idx], pressed ? 0.3 : 0.5, 0.2);
            dummy.position.set(k.x, keyStates.current[k.idx], k.z); dummy.scale.set(0.6, 0.4, 2.5); dummy.updateMatrix();
            blackKeysRef.current.setMatrixAt(i, dummy.matrix); blackKeysRef.current.setColorAt(i, pressed ? new THREE.Color('#a78bfa') : new THREE.Color('#111'));
        });
        blackKeysRef.current.instanceMatrix.needsUpdate = true; if(blackKeysRef.current.instanceColor) blackKeysRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <group position={[POS_X, POS_Y, 0]}>
             <Torch position={[-15, 0, -10]} />
             <Torch position={[15, 0, -10]} />
             <Text position={[0, 4, -5]} fontSize={2} color="#555">HARMONIC RUINS</Text>
             <instancedMesh ref={keysRef} args={[undefined, undefined, keyData.white.length]} receiveShadow castShadow><boxGeometry /><meshStandardMaterial /></instancedMesh>
             <instancedMesh ref={blackKeysRef} args={[undefined, undefined, keyData.black.length]} receiveShadow castShadow><boxGeometry /><meshStandardMaterial /></instancedMesh>
             {[-15, 15].map((x, i) => <mesh key={i} position={[x, 5, -10]} castShadow><cylinderGeometry args={[1, 1, 10, 6]} /><meshStandardMaterial color="#333" roughness={0.5} /></mesh>)}
             {/* Increased light intensity to 16 */}
             <pointLight position={[0, 10, 0]} intensity={16} distance={40} color="#a78bfa" />
        </group>
    );
};

const ChroniclePeak = () => {
    const [sigs, setSigs] = useState<{id: string, text: string, pos: [number,number,number]}[]>([]);
    const [input, setInput] = useState(""); const [signing, setSigning] = useState(false); const [clickPos, setClickPos] = useState<THREE.Vector3 | null>(null); const POS_Y = 2.5;
    const handleClick = (e: any) => { e.stopPropagation(); if(signing) return; setClickPos(e.point); setSigning(true); audioSynth.playUiClick(); };
    const saveSig = () => { if(input.trim() && clickPos) { setSigs([...sigs, { id: Math.random().toString(), text: input.substring(0,8), pos: [clickPos.x, clickPos.y, clickPos.z] }]); audioSynth.playUiSuccess(); window.dispatchEvent(new CustomEvent('local-reaction', { detail: '✍️' })); } setSigning(false); setInput(""); }
    return (
        <group position={[80, POS_Y, 0]}>
            <mesh onClick={handleClick} position={[0, 5, 0]} castShadow receiveShadow>
                <coneGeometry args={[8, 15, 5]} />
                <meshStandardMaterial color="#222" roughness={0.9} />
            </mesh>
            <Text position={[0, 14, 0]} fontSize={2} color="#fbbf24">CHRONICLE PEAK</Text>
            {sigs.map(s => <group key={s.id} position={s.pos} lookAt={new THREE.Vector3(s.pos[0]*2, s.pos[1], s.pos[2]*2)}><Text position={[0,0,0.1]} fontSize={0.4} color="gold" anchorX="center" anchorY="middle">{s.text}</Text></group>)}
            {signing && <Html position={[0, 10, 0]} center><div className="bg-black/80 p-4 rounded-xl border border-yellow-500 flex gap-2"><input autoFocus maxLength={8} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveSig()} className="bg-transparent text-white border-b border-white outline-none w-24 text-center" placeholder="Name" /><button onClick={saveSig} className="text-yellow-500 font-bold">CARVE</button></div></Html>}
            {/* Increased light intensity to 16 */}
            <pointLight position={[0, 10, 0]} intensity={16} distance={40} color="#fbbf24" />
        </group>
    );
};

const ShrineLake = () => {
    const ref = useRef<THREE.Group>(null!); const POS_Y = 2.5;
    useFrame((state) => { ref.current.rotation.y = state.clock.getElapsedTime() * 0.2; });
    return (
        <group position={[0, POS_Y, 80]}>
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
                <circleGeometry args={[15, 32]} />
                <meshStandardMaterial color="#60a5fa" roughness={0.1} metalness={0.8} />
            </mesh>
            <group ref={ref} position={[0, 4, 0]}>
                <mesh castShadow>
                    <octahedronGeometry args={[2]} />
                    <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1} wireframe />
                </mesh>
            </group>
            {/* Increased light intensity to 32 */}
            <pointLight position={[0, 5, 0]} color="#00ffff" distance={30} intensity={32} />
            <Text position={[0, 8, 0]} fontSize={2} color="#60a5fa">SHRINE LAKE</Text>
        </group>
    );
};

export const LobbyScene = React.memo(() => {
    return (
        <group>
            {/* NIGHT ATMOSPHERE */}
            <color attach="background" args={['#050b14']} />
            <fog attach="fog" args={['#050b14', 30, 180]} />
            <Stars radius={200} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            {/* MOONLIGHT - Casts Shadows (Intensity x4 to 4.0) */}
            <ambientLight intensity={1.2} color="#1e293b" />
            <directionalLight 
                position={[-50, 100, -50]} 
                intensity={4.0} 
                color="#c7d2fe" 
                castShadow 
                shadow-mapSize={[4096, 4096]}
                shadow-camera-left={-200} shadow-camera-right={200} shadow-camera-top={200} shadow-camera-bottom={-200}
                shadow-bias={-0.0005}
            />
            
            {/* Lowered Clouds to -18 */}
            <Cloud position={[-50, -18, 50]} speed={0.1} opacity={0.2} segments={40} bounds={[100, 10, 100]} volume={50} color="#6366f1" />
            
            <ProceduralIsland position={[0, 0, 0]} radius={35} heightScale={0.5} seed={1} /> 
            <ProceduralIsland position={[-80, 0, 0]} radius={30} heightScale={0.5} seed={2} /> 
            <ProceduralIsland position={[80, 0, 0]} radius={30} heightScale={0.5} seed={3} /> 
            <ProceduralIsland position={[0, 0, 80]} radius={25} heightScale={0.5} seed={4} /> 
            <ProceduralIsland position={[0, 0, -80]} radius={35} heightScale={0.5} seed={5} /> 

            <LobbyGrass />

            <RopeBridge start={[-25, 1.0, 0]} end={[-55, 1.0, 0]} />
            <RopeBridge start={[25, 1.0, 0]} end={[55, 1.0, 0]} />
            <RopeBridge start={[0, 1.0, 25]} end={[0, 1.0, 60]} />
            <RopeBridge start={[0, 1.0, -25]} end={[0, 1.0, -55]} />

            <ElderTree />
            <AncientPiano />
            <ChroniclePeak />
            <ShrineLake />

            {/* REDUCED MULTICOLORED FIREFLIES (Less clutter) */}
            <Sparkles count={30} scale={[200, 40, 200]} size={6} speed={0.4} opacity={0.8} color="#facc15" position={[0, 10, 0]} />
            <Sparkles count={30} scale={[200, 40, 200]} size={6} speed={0.3} opacity={0.8} color="#22d3ee" position={[0, 15, 0]} />
            <Sparkles count={30} scale={[200, 40, 200]} size={6} speed={0.5} opacity={0.8} color="#e879f9" position={[0, 5, 0]} />

            <Float speed={2} rotationIntensity={0.5} floatIntensity={2}>
                {[...Array(10)].map((_, i) => (
                    <mesh key={i} position={[Math.random()*100-50, 40+Math.random()*20, Math.random()*100-50]}>
                        <coneGeometry args={[0.2, 1, 3]} />
                        <meshBasicMaterial color="#fff" />
                    </mesh>
                ))}
            </Float>
        </group>
    );
});
