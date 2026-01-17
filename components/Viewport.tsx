
import React, { useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows, Bounds, useBounds } from '@react-three/drei';
import * as THREE from 'three';
import { SceneData, SceneNode, GeometryType } from '../types';

interface ViewportProps {
  sceneData: SceneData;
}

const SelectToZoom = ({ children }: { children: React.ReactNode }) => {
  const api = useBounds();
  return (
    <group onClick={(e) => (e.stopPropagation(), e.delta <= 2 && api.refresh(e.object).fit())} onPointerMissed={(e) => e.button === 0 && api.refresh().fit()}>
      {children}
    </group>
  );
}

// --- Custom Geometry Renderers ---

const ExtrudedMesh: React.FC<{ node: SceneNode }> = ({ node }) => {
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        if (node.shapePath && node.shapePath.length > 2) {
            s.moveTo(node.shapePath[0][0], node.shapePath[0][1]);
            for (let i = 1; i < node.shapePath.length; i++) {
                s.lineTo(node.shapePath[i][0], node.shapePath[i][1]);
            }
            s.closePath();
        } else {
            // Fallback star shape if path missing
            s.moveTo(0, 10); s.lineTo(10, 10); s.lineTo(10, 0); s.lineTo(0, 0);
        }
        return s;
    }, [node.shapePath]);

    const extrudeSettings = {
        steps: 2,
        depth: 1,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 4 // Smooth edges
    };

    return (
        <group position={node.position} rotation={node.rotation} scale={node.scale}>
            <mesh castShadow receiveShadow>
                <extrudeGeometry args={[shape, extrudeSettings]} />
                <meshStandardMaterial {...getMatProps(node)} />
            </mesh>
        </group>
    );
}

const TreeMesh: React.FC<{ node: SceneNode }> = ({ node }) => {
    return (
        <group position={node.position} rotation={node.rotation} scale={node.scale}>
            {/* Trunk */}
            <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.15, 0.2, 1.5, 6]} />
                <meshStandardMaterial color="#3e2723" roughness={1} />
            </mesh>
            {/* Foliage - Layer 1 */}
            <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
                <dodecahedronGeometry args={[0.9, 0]} />
                <meshStandardMaterial color={node.material.color || "#2d5a27"} roughness={0.9} />
            </mesh>
             {/* Foliage - Layer 2 (Variation) */}
             <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
                <dodecahedronGeometry args={[0.6, 0]} />
                <meshStandardMaterial color={node.material.color || "#387030"} roughness={0.9} />
            </mesh>
        </group>
    );
};

const getMatProps = (node: SceneNode) => ({
    color: node.material.color,
    roughness: node.material.roughness,
    metalness: node.material.metalness,
    transparent: node.material.transparent || (node.material.opacity ? node.material.opacity < 1 : false),
    opacity: node.material.opacity ?? 1,
    emissive: node.material.emissive || 'black',
    emissiveIntensity: node.material.emissiveIntensity || 0,
    wireframe: node.material.wireframe,
    side: THREE.DoubleSide
});

const DetailedMesh: React.FC<{ node: SceneNode }> = ({ node }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  if (node.type === GeometryType.TREE_COMPLEX) return <TreeMesh node={node} />;
  if (node.type === GeometryType.EXTRUSION) return <ExtrudedMesh node={node} />;

  const geometry = useMemo(() => {
    // Dynamic segments: If not specified by AI, default to 64 (smooth). 
    // AI can set 8 for Low Poly look.
    const segments = node.segments || 64; 
    
    switch (node.type) {
      case GeometryType.BOX: return <boxGeometry args={[1, 1, 1]} />;
      case GeometryType.SPHERE: return <sphereGeometry args={[0.5, segments, segments]} />;
      case GeometryType.CYLINDER: return <cylinderGeometry args={[0.5, 0.5, 1, segments]} />;
      case GeometryType.CONE: return <coneGeometry args={[0.5, 1, segments]} />;
      case GeometryType.TORUS: return <torusGeometry args={[0.5, 0.2, 32, 100]} />;
      
      // Organic / Rocks
      case GeometryType.ICOSAHEDRON: return <icosahedronGeometry args={[0.5, 0]} />; // Low poly rock look
      case GeometryType.DODECAHEDRON: return <dodecahedronGeometry args={[0.5, 0]} />; // Blocky rock
      case GeometryType.TETRAHEDRON: return <tetrahedronGeometry args={[0.5, 0]} />; // Sharp rock
      
      case GeometryType.WEDGE: return <cylinderGeometry args={[0, 1, 1, 4, 1]} />; // Pyramid/Ramp
      
      // Architecture
      case GeometryType.WALL: return <boxGeometry args={[1, 1, 1]} />;
      case GeometryType.FLOOR: return <boxGeometry args={[1, 1, 1]} />;
      case GeometryType.PILLAR: return <cylinderGeometry args={[0.5, 0.5, 1, segments]} />;
      case GeometryType.WINDOW: return <planeGeometry args={[1, 1]} />;
      case GeometryType.ROOF: return <coneGeometry args={[0.71, 1, 4]} />; // Roof usually 4 sided
      case GeometryType.STAIRS: return <boxGeometry args={[1, 1, 1]} />;
      case GeometryType.PLANE: return <planeGeometry args={[1, 1]} />; 
      default: return <boxGeometry args={[1, 1, 1]} />;
    }
  }, [node.type, node.segments]);

  // Adjust geometry alignment
  let finalRotation = node.rotation;
  
  if (node.type === GeometryType.WEDGE) {
       finalRotation = [node.rotation[0], node.rotation[1] + Math.PI/4, node.rotation[2]] as any;
  }
  // Randomize rotation slightly for organic shapes if rotation is exactly 0 (AI default) to make rocks look natural
  if ((node.type === GeometryType.ICOSAHEDRON || node.type === GeometryType.DODECAHEDRON) && node.rotation[0] === 0) {
      // Note: We don't actually change the prop here to avoid re-renders, assuming AI might handle it, 
      // but purely visual randomization could happen here. For now, we trust the AI or user.
  }

  return (
    <group position={node.position} rotation={finalRotation} scale={node.scale}>
        <mesh
            ref={meshRef}
            castShadow={node.type !== GeometryType.WINDOW && node.type !== GeometryType.PLANE}
            receiveShadow
        >
            {geometry}
            <meshStandardMaterial {...getMatProps(node)} />
        </mesh>
    </group>
  );
};

export const Viewport: React.FC<ViewportProps> = ({ sceneData }) => {
  return (
    <div className="w-full h-full bg-[#050505] relative overflow-hidden rounded-xl border border-gray-800 shadow-2xl">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [8, 8, 8], fov: 40 }}>
        <fog attach="fog" args={['#050505', 10, 80]} />
        <Environment preset={sceneData.environment || 'studio'} background blur={0.8} />
        
        {/* Cinematic Lighting Setup */}
        <ambientLight intensity={sceneData.ambientLightIntensity * 0.4} />
        <spotLight 
            position={[20, 40, 20]} 
            angle={0.3} 
            penumbra={0.5} 
            intensity={3} 
            castShadow 
            shadow-bias={-0.0001}
            shadow-mapSize={[2048, 2048]} 
        />
        <pointLight position={[-10, 10, -10]} intensity={1} color="#4455ff" />
        <pointLight position={[10, 5, 10]} intensity={0.5} color="#ffaa44" />

        <Bounds fit clip observe margin={1.2}>
            <SelectToZoom>
                {sceneData.nodes.map((node) => (
                    <DetailedMesh key={node.id} node={node} />
                ))}
            </SelectToZoom>
        </Bounds>

        <Grid 
            position={[0, -0.01, 0]} 
            args={[100, 100]} 
            cellSize={1} 
            cellThickness={0.5} 
            cellColor="#222" 
            sectionSize={5} 
            sectionThickness={1} 
            sectionColor="#444" 
            fadeDistance={60} 
        />
        <ContactShadows opacity={0.6} scale={100} blur={2.5} far={4} resolution={512} color="#000000" />
        
        <OrbitControls 
            makeDefault 
            minDistance={0.1} 
            maxDistance={50}
            rotateSpeed={0.4}
            zoomSpeed={0.4}
            panSpeed={0.4}
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 2.05} 
            dampingFactor={0.05} 
        />
      </Canvas>
      
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <div className="flex gap-4 text-[10px] font-mono text-gray-500 bg-black/80 p-2 rounded backdrop-blur-md border border-gray-800">
            <span>MESHES: {sceneData.nodes.length}</span>
            <span>POLY: {sceneData.nodes.some(n => (n.segments || 64) < 16) ? 'MIXED' : 'HIGH'}</span>
            <span>CAM: STABILIZED</span>
        </div>
      </div>
    </div>
  );
};
