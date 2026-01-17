
export enum GeometryType {
  // Basic Primitives (High Poly Capable)
  BOX = 'box',
  SPHERE = 'sphere',
  CYLINDER = 'cylinder',
  CONE = 'cone',
  TORUS = 'torus',
  
  // Organic / Low Poly Nature
  ICOSAHEDRON = 'icosahedron', // Great for rocks/geodes
  DODECAHEDRON = 'dodecahedron', // Great for stylized stones
  TETRAHEDRON = 'tetrahedron', // Spikes
  
  // Advanced Modeling
  EXTRUSION = 'extrusion', // AI draws a shape path
  WEDGE = 'wedge', // Ramp/Slope for cars/roofs
  
  // Landscape
  PLANE = 'plane', 
  
  // Construction
  WALL = 'wall',
  ROOF = 'roof',
  FLOOR = 'floor',
  WINDOW = 'window',
  PILLAR = 'pillar',
  STAIRS = 'stairs',
  
  // Nature
  TREE_COMPLEX = 'tree_complex'
}

export interface PBRMaterial {
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  transparent?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  wireframe?: boolean;
}

export interface SceneNode {
  id: string;
  name: string;
  group: string; 
  type: GeometryType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  segments?: number; // AI controls poly count (e.g. 8 for retro, 64 for smooth)
  material: PBRMaterial;
  shapePath?: number[][]; // Array of [x,y] points for EXTRUSION
}

export interface SceneData {
  nodes: SceneNode[];
  environment: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'studio' | 'city';
  ambientLightIntensity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  attachment?: string;
  timestamp: number;
}

export type ExportFormat = 'zip' | 'obj';
