
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Sky, shaderMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// --- SHADERS ---

// Realistic Ocean Shader with Vertex Displacement
const RealisticOceanMaterial = shaderMaterial(
  {
    time: 0,
    colorDeep: new THREE.Color('#0077be'), // Ocean Blue
    colorShallow: new THREE.Color('#40e0d0'), // Turquoise / Cyan
    colorFoam: new THREE.Color('#ffffff'), // Foam/Specular
    sunPosition: new THREE.Vector3(0, 0, 0), // Will be set in component
  },
  // Vertex Shader (Creates the waves)
  `
    uniform float time;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vElevation;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // --- Wave Calculation ---
      float elevation = 0.0;
      
      // Smaller, tighter ripples (Higher frequency, Lower amplitude)
      elevation += sin(pos.x * 0.3 + time * 0.5) * sin(pos.y * 0.3 + time * 0.5) * 0.4;
      
      // Medium detail
      elevation += sin(pos.x * 0.8 + time * 1.0) * 0.15;
      elevation += cos(pos.y * 0.7 + time * 0.9) * 0.15;
      
      // Micro detail
      elevation += sin(pos.x * 2.0 - time * 2.0) * 0.05;
      elevation += cos(pos.y * 1.8 - time * 1.5) * 0.05;

      // Apply elevation to Z (since plane is rotated)
      pos.z += elevation;
      vElevation = elevation;

      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  // Fragment Shader (Coloring based on height and light)
  `
    uniform float time;
    uniform vec3 colorDeep;
    uniform vec3 colorShallow;
    uniform vec3 colorFoam;
    uniform vec3 sunPosition;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vElevation;

    void main() {
      // Calculate normal approximation based on derivatives of position
      vec3 dx = dFdx(vWorldPosition);
      vec3 dy = dFdy(vWorldPosition);
      vec3 normal = normalize(cross(dx, dy));

      // View direction
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);

      // Sun Specular (Reflection)
      // Normalize sunPosition to treat it as a direction for Blinn-Phong
      vec3 lightDir = normalize(sunPosition);
      vec3 halfVec = normalize(lightDir + viewDir);
      float NdotH = max(0.0, dot(normal, halfVec));
      float specular = pow(NdotH, 500.0); // Sharper glints

      // Fresnel effect
      float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 3.0);

      // Color Mixing
      // Mix deep and shallow based on wave height (vElevation)
      float mixFactor = smoothstep(-0.5, 0.5, vElevation);
      vec3 waterColor = mix(colorDeep, colorShallow, mixFactor * 0.8);
      
      // Add "Foam" or highlights on very high tips
      float foam = smoothstep(0.4, 0.6, vElevation);
      waterColor = mix(waterColor, colorFoam, foam * 0.4);

      // Apply Fresnel (Reflection of sky/sun)
      vec3 reflectionColor = vec3(0.8, 0.95, 1.0); // Brighter sky reflection
      waterColor = mix(waterColor, reflectionColor, fresnel * 0.4);

      // Add Specular (Sun Glints)
      waterColor += vec3(1.0) * specular * 1.5;

      gl_FragColor = vec4(waterColor, 0.92); // Slightly more transparent
    }
  `
);

const StylizedGrassMaterial = shaderMaterial(
  {
    time: 0,
    colorBottom: new THREE.Color('#2d4c1e'),
    colorTop: new THREE.Color('#86a354'),
  },
  `
    varying vec2 vUv;
    varying float vHeight;
    uniform float time;
    attribute float aScale;
    
    void main() {
      vUv = uv;
      vHeight = uv.y;
      vec3 pos = position;
      pos.y *= aScale;
      
      vec4 worldPos = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
      float wind = sin(time * 0.5 + worldPos.x * 0.1) * 0.5 + sin(time * 1.0 + worldPos.z * 0.2) * 0.2;
      pos.x += wind * uv.y * uv.y;
      
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    }
  `,
  `
    uniform vec3 colorBottom;
    uniform vec3 colorTop;
    varying float vHeight;
    void main() {
      gl_FragColor = vec4(mix(colorBottom, colorTop, vHeight), 1.0);
    }
  `
);

extend({ RealisticOceanMaterial, StylizedGrassMaterial });

// --- CONSTANTS ---
export const AMPH_STEPS = 6;
export const AMPH_RADIUS_START = 8;
export const AMPH_RADIUS_END = 22;
export const STEP_HEIGHT = 0.6;
// Adjusted to align the top platform with the last step (was AMPH_STEPS + 1)
export const FLOOR_Y = AMPH_STEPS * STEP_HEIGHT; 
export const ISLAND_RADIUS = 65;

// --- COLLISION LOGIC ---
export const getAmphitheaterHeight = (x: number, z: number) => {
    const dist = Math.sqrt(x * x + z * z);

    if (dist < AMPH_RADIUS_START) return 0.5;

    if (dist < AMPH_RADIUS_END) {
        const t = (dist - AMPH_RADIUS_START) / (AMPH_RADIUS_END - AMPH_RADIUS_START);
        const step = Math.floor(t * AMPH_STEPS);
        return 0.5 + (step + 1) * STEP_HEIGHT;
    }

    if (dist < AMPH_RADIUS_END + 12) {
        return FLOOR_Y + 0.5;
    }

    if (dist < ISLAND_RADIUS) {
        const distFromPlat = dist - (AMPH_RADIUS_END + 12);
        const maxDist = ISLAND_RADIUS - (AMPH_RADIUS_END + 12);
        const pct = 1.0 - (distFromPlat / maxDist);
        const slope = Math.pow(pct, 0.8);
        return Math.max(0.2, (FLOOR_Y + 0.5) * slope);
    }

    return -10;
};

export const isAmphObstacle = (x: number, z: number) => {
    const dist = Math.sqrt(x*x + z*z);
    
    // Columns Ring
    const colRadius = AMPH_RADIUS_END + 2;
    if (dist > colRadius - 1.0 && dist < colRadius + 1.0) {
        const angle = Math.atan2(z, x);
        const numCols = 16;
        const step = (Math.PI * 2) / numCols;
        let norm = angle; if(norm < 0) norm += Math.PI*2;
        const idx = Math.round(norm / step);
        const colAngle = idx * step;
        if (Math.abs(norm - colAngle) < 0.2) return true;
    }
    
    return false;
};

// --- COMPONENTS ---

const Architecture = () => {
    const stepsRef = useRef<THREE.InstancedMesh>(null!);
    const colRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = new THREE.Object3D();

    const marbleMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#f0f0f0',
        roughness: 0.2,
        metalness: 0.1,
    }), []);

    const goldMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#ffcc00',
        roughness: 0.2,
        metalness: 0.8,
    }), []);

    useEffect(() => {
        if (!stepsRef.current || !colRef.current) return;

        let idx = 0;
        for (let i = 0; i < AMPH_STEPS; i++) {
            const rInner = AMPH_RADIUS_START + (i * ((AMPH_RADIUS_END - AMPH_RADIUS_START) / AMPH_STEPS));
            const rOuter = AMPH_RADIUS_START + ((i + 1) * ((AMPH_RADIUS_END - AMPH_RADIUS_START) / AMPH_STEPS));
            const rMid = (rInner + rOuter) / 2;
            const depth = rOuter - rInner;
            const h = 0.5 + (i + 1) * STEP_HEIGHT;
            
            const circum = 2 * Math.PI * rMid;
            const count = Math.floor(circum / 4.0);
            const stepAngle = (Math.PI * 2) / count;

            for (let j = 0; j < count; j++) {
                const angle = j * stepAngle;
                const x = Math.cos(angle) * rMid;
                const z = Math.sin(angle) * rMid;
                
                dummy.position.set(x, h/2, z);
                dummy.rotation.set(0, -angle, 0);
                dummy.scale.set(depth, h, 3.8);
                dummy.updateMatrix();
                stepsRef.current.setMatrixAt(idx++, dummy.matrix);
            }
        }
        stepsRef.current.instanceMatrix.needsUpdate = true;

        let colIdx = 0;
        const numCols = 16;
        const colR = AMPH_RADIUS_END + 2;
        for(let i=0; i<numCols; i++) {
            const angle = (i/numCols) * Math.PI * 2;
            const x = Math.cos(angle) * colR;
            const z = Math.sin(angle) * colR;
            
            // Lowered columns: Y = (FLOOR_Y + 0.5) is base + 5 (half height) - 1.5 (offset down)
            dummy.position.set(x, FLOOR_Y + 0.5 + 5 - 1.5, z);
            dummy.scale.set(1.5, 10, 1.5);
            dummy.rotation.set(0,0,0);
            dummy.updateMatrix();
            colRef.current.setMatrixAt(colIdx++, dummy.matrix);
        }
        colRef.current.instanceMatrix.needsUpdate = true;

    }, []);

    return (
        <group>
            <instancedMesh ref={stepsRef} args={[undefined, undefined, 1000]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <primitive object={marbleMat} attach="material" />
            </instancedMesh>

            <instancedMesh ref={colRef} args={[undefined, undefined, 20]} castShadow receiveShadow>
                <cylinderGeometry args={[0.6, 0.8, 1, 16]} />
                <primitive object={marbleMat} attach="material" />
            </instancedMesh>
            
            <mesh position={[0, 0.25, 0]} receiveShadow>
                <cylinderGeometry args={[AMPH_RADIUS_START, AMPH_RADIUS_START, 0.5, 64]} />
                <primitive object={marbleMat} attach="material" />
            </mesh>
            
            <mesh position={[0, 0.51, 0]} rotation={[-Math.PI/2, 0, 0]}>
                <ringGeometry args={[0, 3, 32]} />
                <primitive object={goldMat} attach="material" />
            </mesh>
            
            {/* REMOVED CENTRAL POINT LIGHT to avoid artifact */}
            
            <mesh position={[0, FLOOR_Y + 0.5, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                <ringGeometry args={[AMPH_RADIUS_END - 0.5, AMPH_RADIUS_END + 12, 64]} />
                <primitive object={marbleMat} attach="material" />
            </mesh>
        </group>
    );
};

const Terrain = () => {
    const geo = useMemo(() => {
        const geometry = new THREE.PlaneGeometry(160, 160, 128, 128);
        geometry.rotateX(-Math.PI / 2);
        const pos = geometry.attributes.position;
        for(let i=0; i<pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const dist = Math.sqrt(x*x + z*z);
            let y = -5;
            
            if (dist < ISLAND_RADIUS + 5) {
                if (dist < AMPH_RADIUS_END + 1) {
                    y = -2; 
                } else {
                    const h = getAmphitheaterHeight(x, z);
                    const noise = Math.sin(x*0.3)*0.2 + Math.cos(z*0.3)*0.2;
                    y = h + noise - 0.2;
                }
            }
            pos.setY(i, y);
        }
        geometry.computeVertexNormals();
        return geometry;
    }, []);

    return (
        <mesh geometry={geo} receiveShadow>
            <meshStandardMaterial color="#5c554b" roughness={1} />
        </mesh>
    );
};

const Grass = () => {
    const count = 20000;
    const mesh = useRef<THREE.InstancedMesh>(null!);
    const dummy = new THREE.Object3D();
    const matRef = useRef<THREE.ShaderMaterial>(null!);

    const grassMat = useMemo(() => {
        const m = new StylizedGrassMaterial();
        m.side = THREE.DoubleSide;
        m.transparent = true;
        return m;
    }, []);

    useEffect(() => {
        if (!mesh.current) return;
        let idx = 0;
        const scales = new Float32Array(count);
        
        for(let i=0; i<count; i++) {
            const r = Math.random() * ISLAND_RADIUS;
            
            // Fix: Grass only outside
            if (r > AMPH_RADIUS_END + 2) {
                const theta = Math.random() * Math.PI * 2;
                const x = Math.cos(theta) * r;
                const z = Math.sin(theta) * r;
                const y = getAmphitheaterHeight(x, z);
                
                if (y > 0.1) {
                    dummy.position.set(x, y, z);
                    dummy.rotation.set(0, Math.random() * Math.PI, 0);
                    const s = 0.5 + Math.random() * 0.8;
                    dummy.scale.set(s, s, s);
                    dummy.updateMatrix();
                    mesh.current.setMatrixAt(idx, dummy.matrix);
                    scales[idx] = s;
                    idx++;
                }
            }
        }
        mesh.current.count = idx;
        mesh.current.instanceMatrix.needsUpdate = true;
        mesh.current.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    }, []);

    useFrame((state) => {
        if (matRef.current) matRef.current.uniforms.time.value = state.clock.getElapsedTime();
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]} receiveShadow>
            <planeGeometry args={[0.15, 1, 1, 2]} />
            <primitive object={grassMat} ref={matRef} attach="material" />
        </instancedMesh>
    );
}

export const AmphitheaterScene = () => {
    const waterRef = useRef<THREE.ShaderMaterial>(null!);
    const oceanMat = useMemo(() => new RealisticOceanMaterial(), []);
    
    // SUNSET POSITION: Raised to be "a bit higher" but still late day (Y=35)
    // Normalized in shader, but here we place the actual light source
    const SUN_POS = useMemo(() => new THREE.Vector3(-100, 35, -100), []);

    useEffect(() => {
        if (oceanMat) oceanMat.uniforms.sunPosition.value.copy(SUN_POS);
    }, [oceanMat, SUN_POS]);

    useFrame((state) => {
        if(waterRef.current) waterRef.current.uniforms.time.value = state.clock.getElapsedTime();
    });

    return (
        <group>
            <Sky 
                sunPosition={SUN_POS} 
                turbidity={0.8} 
                rayleigh={0.5} 
                mieCoefficient={0.005} 
                mieDirectionalG={0.8} 
            />
            
            <directionalLight 
                position={SUN_POS} 
                intensity={1.8} 
                color="#ffaa44" 
                castShadow 
                shadow-mapSize={[4096, 4096]} 
                shadow-bias={-0.0005}
                shadow-camera-left={-120}
                shadow-camera-right={120}
                shadow-camera-top={120}
                shadow-camera-bottom={-120}
                shadow-camera-near={0.1}
                shadow-camera-far={600}
            />
            <ambientLight intensity={0.5} color="#6644aa" />

            {/* Realistic Ocean with Vertex Displacement */}
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -3, 0]}>
                {/* Increased segments for wave detail (256x256) */}
                <planeGeometry args={[2000, 2000, 256, 256]} />
                <primitive object={oceanMat} ref={waterRef} attach="material" />
            </mesh>

            <Terrain />
            <Architecture />
            <Grass />

            {/* Global Sparkles - Reduced size to avoid square look */}
            <Sparkles 
                count={250} 
                scale={[130, 30, 130]} 
                size={3} 
                speed={0.4} 
                opacity={0.6} 
                color="#ffaa00" 
                position={[0, 10, 0]} 
            />
        </group>
    );
};
