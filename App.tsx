
import React, { useState, useMemo } from 'react';
import { Viewport } from './components/Viewport';
import { Terminal } from './components/Terminal';
import { generateSceneFromPrompt, analyzeTextureImage } from './services/geminiService';
import { SceneData, ChatMessage, GeometryType, SceneNode } from './types';
import { Box, Code, Folder, Download, BrainCircuit, FileCode, Layers, FolderArchive, Circle, Triangle, Square, Hexagon, Component, Spline } from 'lucide-react';
import JSZip from 'jszip';

const INITIAL_SCENE: SceneData = {
  nodes: [],
  environment: 'city',
  ambientLightIntensity: 0.5
};

export default function App() {
  const [sceneData, setSceneData] = useState<SceneData>(INITIAL_SCENE);
  const [history, setHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: 'Gen-Blender Pro v3.3 (Explorer Fixed) готов.\n\nТеперь я корректно отображаю список объектов слева. Попробуйте создать сложную сцену, например: "Киберпанк комната хакера".',
      timestamp: Date.now()
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Extract hierarchy for Explorer: Group -> Nodes[]
  const hierarchy = useMemo(() => {
    const groups: Record<string, SceneNode[]> = {};
    // Sort nodes by name for cleaner list
    const sortedNodes = [...sceneData.nodes].sort((a, b) => a.name.localeCompare(b.name));

    sortedNodes.forEach(node => {
        const g = node.group || 'Ungrouped';
        if (!groups[g]) groups[g] = [];
        groups[g].push(node);
    });

    // Return sorted groups
    return Object.keys(groups).sort().reduce(
      (obj, key) => { 
        obj[key] = groups[key]; 
        return obj;
      }, 
      {} as Record<string, SceneNode[]>
    );
  }, [sceneData]);

  // Helper to choose icons based on geometry type
  const getNodeIcon = (type: GeometryType) => {
    switch (type) {
      case GeometryType.BOX:
      case GeometryType.WALL:
      case GeometryType.FLOOR:
      case GeometryType.STAIRS:
      case GeometryType.PLANE:
      case GeometryType.WINDOW:
        return <Square size={12} className="text-blue-400" />;
      case GeometryType.SPHERE:
        return <Circle size={12} className="text-orange-400" />;
      case GeometryType.CONE:
      case GeometryType.ROOF:
      case GeometryType.WEDGE:
      case GeometryType.TETRAHEDRON:
        return <Triangle size={12} className="text-red-400" />;
      case GeometryType.ICOSAHEDRON:
      case GeometryType.DODECAHEDRON:
        return <Hexagon size={12} className="text-purple-400" />;
      case GeometryType.EXTRUSION:
        return <Spline size={12} className="text-yellow-400" />;
      case GeometryType.CYLINDER:
      case GeometryType.PILLAR:
        return <Component size={12} className="text-green-400" />;
      default:
        return <Component size={12} className="text-gray-500" />;
    }
  };

  const handleExport = async (targetGroup?: string) => {
    const zip = new JSZip();
    const groupedNodes: Record<string, typeof sceneData.nodes> = {};
    
    const nodesToExport = targetGroup 
        ? sceneData.nodes.filter(n => (n.group || 'Ungrouped') === targetGroup)
        : sceneData.nodes;

    if (nodesToExport.length === 0) return;

    nodesToExport.forEach(node => {
        const groupName = node.group || 'Ungrouped';
        if (!groupedNodes[groupName]) groupedNodes[groupName] = [];
        groupedNodes[groupName].push(node);
    });

    Object.keys(groupedNodes).forEach(groupName => {
        const folder = zip.folder(groupName);
        if (!folder) return;

        let objOutput = `# Group: ${groupName}\n# Exported from Gen-Blender Pro\n\n`;
        let vertexOffset = 1;

        groupedNodes[groupName].forEach((node, idx) => {
            objOutput += `o ${node.name}_${idx}\n`;
            objOutput += `usemtl ${node.material.color.replace('#', 'Mat_')}\n`;
            
            const { position: pos, scale: scl, rotation: rot } = node;
            
            const addGeometry = () => {
                let v = [
                    [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1],
                    [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1]
                ];
                
                if (node.type === GeometryType.PLANE || node.type === GeometryType.WINDOW) {
                    v = [[-1, -1, 0], [1, -1, 0], [-1, 1, 0], [1, 1, 0]];
                }
                
                v = v.map(p => [p[0]*scl[0]*0.5, p[1]*scl[1]*0.5, p[2]*scl[2]*0.5]);

                const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]);
                const cy = Math.cos(rot[1]), sy = Math.sin(rot[1]);
                const cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);

                v = v.map(p => {
                    let [x, y, z] = p;
                    let y1 = y*cx - z*sx; let z1 = y*sx + z*cx; y = y1; z = z1;
                    let x1 = x*cy + z*sy; let z2 = -x*sy + z*cy; x = x1; z = z2;
                    let x2 = x*cz - y*sz; let y2 = x*sz + y*cz; x = x2; y = y2;
                    return [x, y, z];
                });

                v = v.map(p => [p[0] + pos[0], p[1] + pos[1], p[2] + pos[2]]);

                v.forEach(vert => {
                    objOutput += `v ${vert[0].toFixed(4)} ${vert[1].toFixed(4)} ${vert[2].toFixed(4)}\n`;
                });

                const o = vertexOffset;
                if (v.length === 4) {
                    objOutput += `f ${o} ${o+1} ${o+3} ${o+2}\n`;
                    vertexOffset += 4;
                } else {
                    const faces = [
                        [o, o+1, o+3, o+2], [o+2, o+3, o+7, o+6], [o+6, o+7, o+5, o+4],
                        [o+4, o+5, o+1, o+0], [o+2, o+6, o+4, o+0], [o+7, o+3, o+1, o+5]
                    ];
                    faces.forEach(f => objOutput += `f ${f.join(' ')}\n`);
                    vertexOffset += 8;
                }
            };
            addGeometry();
            objOutput += `\n`;
        });
        folder.file(`${groupName}.obj`, objOutput);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetGroup ? `${targetGroup}.zip` : `Full_Project_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async (text: string, attachment?: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text, attachment, timestamp: Date.now() };
    setHistory(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      let aiResponseText = "";
      let finalPrompt = text;

      if (attachment) {
        setHistory(prev => [...prev, { id: 'analyzing', role: 'system', text: 'Считываю стиль и материалы с фото...', timestamp: Date.now() }]);
        const analysis = await analyzeTextureImage(attachment.split(',')[1]);
        finalPrompt = `SOURCE MATERIAL: ${analysis} \n\n USER REQUEST: ${text}`;
      }

      const currentContext = JSON.stringify(sceneData.nodes.map(n => ({ 
          name: n.name, 
          grp: n.group, 
          pos: n.position, 
          sz: n.scale 
      })));
      
      const response = await generateSceneFromPrompt(finalPrompt, currentContext);
      
      if (response.data) {
        setSceneData(response.data);
        aiResponseText = response.text || "Сцена обновлена.";
      } else {
        aiResponseText = response.text;
      }

      setHistory(prev => {
          const filtered = prev.filter(m => m.id !== 'analyzing');
          return [...filtered, { id: Date.now().toString(), role: 'ai', text: aiResponseText, timestamp: Date.now() }];
      });

    } catch (e) {
      console.error(e);
      setHistory(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: "Ошибка системы.", timestamp: Date.now() }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-[#0f0f11] text-white overflow-hidden font-sans">
      <header className="h-14 border-b border-gray-800 flex items-center px-6 justify-between bg-[#0a0a0c]">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-600 to-blue-700 p-1.5 rounded-lg shadow-lg shadow-cyan-900/20">
            <Layers size={20} className="text-white" />
          </div>
          <h1 className="font-bold tracking-wider text-lg font-mono text-gray-100">GEN-BLENDER <span className="text-[10px] text-cyan-400 ml-1 border border-cyan-900 px-1 rounded bg-cyan-900/10">PRO</span></h1>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: Project Explorer */}
        <div className="w-64 border-r border-gray-800 bg-[#0c0c0e] flex flex-col">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Explorer</span>
                <span className="text-xs text-gray-600 font-mono">{sceneData.nodes.length} Items</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-800">
                {Object.keys(hierarchy).length === 0 ? (
                    <div className="text-gray-600 text-xs text-center mt-10 p-4">No structures defined.<br/>Start by prompting.</div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(hierarchy).map(([groupName, nodes]) => (
                            <div key={groupName}>
                                <div className="flex items-center justify-between p-1.5 mb-1 hover:bg-gray-800 rounded group transition-colors select-none">
                                    <div className="flex items-center gap-2 text-gray-300">
                                        <Folder size={14} className={groupName === 'Ungrouped' ? "text-gray-600" : "text-yellow-600"} />
                                        <span className="text-xs font-mono font-bold truncate max-w-[120px]" title={groupName}>{groupName}</span>
                                        <span className="text-[10px] text-gray-600">({nodes.length})</span>
                                    </div>
                                    <button 
                                        onClick={() => handleExport(groupName)}
                                        className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                        title={`Download ${groupName}`}
                                    >
                                        <Download size={12} />
                                    </button>
                                </div>
                                <div className="pl-3 border-l border-gray-800 ml-2 space-y-0.5">
                                    {nodes.map(node => (
                                        <div key={node.id} className="flex items-center gap-2 p-1 text-gray-500 hover:text-gray-200 hover:bg-gray-800/50 rounded cursor-default transition-colors group/item">
                                            <div className="opacity-70 group-hover/item:opacity-100 transition-opacity">
                                              {getNodeIcon(node.type)}
                                            </div>
                                            <span className="text-[10px] font-mono truncate w-full" title={node.name}>
                                              {node.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {sceneData.nodes.length > 0 && (
                <div className="p-3 border-t border-gray-800">
                    <button 
                        onClick={() => handleExport()}
                        className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-2 rounded transition-colors"
                    >
                        <FolderArchive size={14} />
                        <span>Download Full Project</span>
                    </button>
                </div>
            )}
        </div>

        {/* MIDDLE: Viewport */}
        <div className="flex-1 p-4 relative bg-[#050505] flex flex-col">
            <Viewport sceneData={sceneData} />
        </div>

        {/* RIGHT: Terminal */}
        <Terminal 
            history={history} 
            onSendMessage={handleSendMessage} 
            isProcessing={isProcessing}
            onExport={() => handleExport()} 
        />
      </main>
    </div>
  );
}
