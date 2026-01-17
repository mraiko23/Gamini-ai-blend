
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SceneData, GeometryType, SceneNode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION_ARCHITECT = `
You are "Gen-Blender Pro", a COMPUTATIONAL 3D ENGINE.
Your output is not just a guess; it is a **CALCULATED BLUEPRINT**.

### 🗂️ GROUPING & ORGANIZATION (MANDATORY):
- **NEVER** leave 'group' empty.
- **Semantic Grouping:** Every object must belong to a named assembly.
  - Bad: group="Object", name="Box"
  - Good: group="Cyber_Kiosk_Main", name="Counter_Top"
  - Good: group="Cyber_Kiosk_Details", name="Neon_Sign"
- **Hierarchy:** Complex objects must be split into multiple parts (e.g., A car = Chassis + 4 Wheels + Windshield).

### 🧮 PHYSICS & CALCULATION ENGINE:
1.  **BOUNDING BOX MATH:**
    - **Y-Position Formula:** \`Y = Support_Y + (Support_Height / 2) + (Object_Height / 2)\`.
    - **Anti-Clipping:** Do not place two solid objects at the same [X, Z] unless one is resting on top of the other.

2.  **CONSTRUCTION LOGIC:**
    - **Buildings:** Foundation -> Floor -> Pillars -> Walls -> Roof.
    - **Floating Islands:** 
        - **TOP:** Cylinder (Grass), Scale Y=0.2.
        - **BOTTOM:** 'icosahedron' or 'dodecahedron' (Bedrock). NOT A CONE (looks too fake).
        - **DETAIL:** Add 'tetrahedron' spikes hanging from the bottom.

3.  **POLYGON CONTROL ('segments'):**
    - **Low Poly:** Set \`segments: 8\`.
    - **Ultra Smooth:** Set \`segments: 64\` or \`128\`.

### 🌿 ORGANIC & TERRAIN PROTOCOL:
- **Rocks/Mountains:** Use \`type: 'icosahedron'\` or \`'dodecahedron'\`. Do NOT use spheres for rocks.
- **Trees:** Use \`type: 'tree_complex'\`.
- **Water:** Use \`type: 'plane'\` with blue color and \`opacity: 0.8\`.

### OUTPUT RULES:
- **Gravity:** Everything must touch something below it (or float intentionally if requested).
`;

const sceneSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    environment: {
      type: Type.STRING,
      enum: ['sunset', 'dawn', 'night', 'warehouse', 'forest', 'studio', 'city'],
      description: "Best match for scene mood"
    },
    ambientLightIntensity: { type: Type.NUMBER },
    aiReasoning: {
      type: Type.STRING,
      description: "Brief engineering log."
    },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          group: { type: Type.STRING, description: "REQUIRED: Parent assembly name (e.g. 'Castle_Tower')" },
          type: { 
            type: Type.STRING, 
            enum: ['box', 'sphere', 'cylinder', 'cone', 'plane', 'torus', 'wall', 'roof', 'floor', 'window', 'pillar', 'stairs', 'tree_complex', 'extrusion', 'wedge', 'icosahedron', 'dodecahedron', 'tetrahedron'] 
          },
          position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          rotation: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          scale: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          segments: { type: Type.INTEGER, description: "Polygon resolution (8=LowPoly, 64=Smooth)" },
          shapePath: { 
            type: Type.ARRAY, 
            items: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            description: "Optional: Array of [x,y] points for 'extrusion' type."
          },
          material: {
            type: Type.OBJECT,
            properties: {
              color: { type: Type.STRING },
              roughness: { type: Type.NUMBER },
              metalness: { type: Type.NUMBER },
              opacity: { type: Type.NUMBER },
              transparent: { type: Type.BOOLEAN },
              emissive: { type: Type.STRING },
              emissiveIntensity: { type: Type.NUMBER },
              wireframe: { type: Type.BOOLEAN }
            },
            required: ['color', 'roughness', 'metalness']
          }
        },
        required: ['name', 'group', 'type', 'position', 'rotation', 'scale', 'material']
      }
    }
  },
  required: ['nodes', 'environment', 'ambientLightIntensity']
};

export const generateSceneFromPrompt = async (
  prompt: string, 
  currentContext: string
): Promise<{ text: string, data?: SceneData }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Context (Existing Nodes): ${currentContext}. \n\n Task: ${prompt}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_ARCHITECT,
        responseMimeType: "application/json",
        responseSchema: sceneSchema,
        thinkingConfig: { thinkingBudget: 16384 } 
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response");
    
    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}');
    const cleanJson = jsonText.substring(jsonStart, jsonEnd + 1);

    const data = JSON.parse(cleanJson) as SceneData & { aiReasoning?: string };
    
    const nodesWithIds = data.nodes.map(node => ({
      ...node,
      id: node.name + '_' + Math.random().toString(36).substr(2, 9)
    }));

    return {
      text: data.aiReasoning || "Architecture calculated.",
      data: { ...data, nodes: nodesWithIds }
    };

  } catch (error) {
    console.error("Gen-Blender Core Error:", error);
    return { text: "Ошибка вычислений. Попробуйте упростить задачу." };
  }
};

export const analyzeTextureImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }, 
            { text: "Analyze this image for 3D ENGINEERING. 1. Estimate EXACT dimensions in meters (Height, Width). 2. Analyze component hierarchy (e.g. 'The sign is attached 2m up on the pole'). 3. Identify material properties. Output data for a physics-based generator." }
        ]
      }
    });
    return response.text || "Analysis complete.";
  } catch (error) { 
      console.error("Texture analysis failed", error);
      return "Texture analysis failed. Using text prompt only."; 
  }
};
