import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Cpu, Download, Loader2, Layers, BrainCircuit } from 'lucide-react';
import { ChatMessage } from '../types';

interface TerminalProps {
  history: ChatMessage[];
  onSendMessage: (text: string, attachment?: string) => void;
  isProcessing: boolean;
  onExport: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({ history, onSendMessage, isProcessing, onExport }) => {
  const [input, setInput] = useState('');
  const [base64Image, setBase64Image] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSend = () => {
    if ((!input.trim() && !base64Image) || isProcessing) return;
    onSendMessage(input, base64Image);
    setInput('');
    setBase64Image(undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Image(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] border-l border-gray-800 w-[400px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#131315]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></div>
          <span className="font-mono text-sm font-bold text-gray-100">GEMINI-3: AUTONOMOUS</span>
        </div>
        <button 
            onClick={onExport}
            className="p-2 hover:bg-gray-800 rounded transition-colors text-blue-400" 
            title="Export Scene"
        >
            <Download size={18} />
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm" ref={scrollRef}>
        <div className="text-gray-500 text-xs text-center my-4">--- NEURAL LINK ESTABLISHED ---</div>
        
        {history.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[90%] p-3 rounded-lg border ${
                msg.role === 'user' 
                  ? 'bg-blue-900/20 border-blue-800 text-blue-100' 
                  : 'bg-gray-900 border-gray-700 text-gray-300'
              }`}
            >
              {msg.attachment && (
                <img src={msg.attachment} alt="Upload" className="max-w-full h-auto rounded mb-2 border border-gray-600" />
              )}
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
            <span className="text-[10px] text-gray-600 mt-1 uppercase flex items-center gap-1">
                {msg.role === 'ai' && <BrainCircuit size={10} />}
                {msg.role === 'user' ? 'Operator' : 'Architect'}
            </span>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-start">
             <div className="bg-purple-900/20 border border-purple-700 p-3 rounded-lg flex items-center gap-2 text-purple-200 animate-pulse">
                <BrainCircuit className="animate-pulse" size={16} />
                <span>Продумываю архитектуру...</span>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#131315] border-t border-gray-800">
        {base64Image && (
            <div className="mb-2 relative inline-block">
                <img src={base64Image} className="h-16 rounded border border-gray-600 opacity-80" alt="Preview" />
                <button 
                    onClick={() => setBase64Image(undefined)}
                    className="absolute -top-2 -right-2 bg-red-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                >
                    ×
                </button>
            </div>
        )}
        <div className="flex items-end gap-2">
            <label className="p-3 text-gray-400 hover:text-white cursor-pointer hover:bg-gray-800 rounded transition-colors">
                <ImageIcon size={20} />
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
            <div className="flex-1 relative">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Поставь задачу (напр. 'Летающий замок')..."
                    className="w-full bg-[#0a0a0c] text-gray-200 p-3 rounded border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none font-mono text-sm h-[50px] scrollbar-hide"
                />
            </div>
            <button 
                onClick={handleSend}
                disabled={isProcessing}
                className="p-3 bg-purple-700 hover:bg-purple-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Send size={20} />
            </button>
        </div>
        <div className="mt-2 flex gap-2 text-[10px] text-gray-500 font-mono justify-between">
            <span className="flex items-center gap-1 text-purple-400"><Cpu size={10} /> REASONING: MAX</span>
            <span className="flex items-center gap-1"><Layers size={10} /> AUTO-TOPOLOGY</span>
        </div>
      </div>
    </div>
  );
};
