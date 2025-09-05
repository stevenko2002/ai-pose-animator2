import React, { useState, useRef, useEffect } from 'react';
import { optimizePrompt, generateInspiration } from '../services/geminiService';

interface PromptEditorProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  negativePrompt: string;
  onNegativePromptChange: (prompt: string) => void;
  templates: string[];
  onSaveTemplate: (prompt: string) => void;
  onDeleteTemplate: (prompt: string) => void;
  onUpdateTemplate: (index: number, newText: string) => void;
  uploadedImageCount: number;
  promptHistory: string[];
  onClearPromptHistory: () => void;
}

const PromptEditor: React.FC<PromptEditorProps> = ({ 
    prompt, onPromptChange,
    negativePrompt, onNegativePromptChange,
    templates, onSaveTemplate, onDeleteTemplate, onUpdateTemplate,
    uploadedImageCount,
    promptHistory, onClearPromptHistory
}) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  const [isInspiring, setIsInspiring] = useState(false);
  const [inspireError, setInspireError] = useState<string | null>(null);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);
  const [editingTemplateIndex, setEditingTemplateIndex] = useState<number | null>(null);
  const [editingTemplateText, setEditingTemplateText] = useState('');


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
            setIsHistoryOpen(false);
        }
        if (templatesRef.current && !templatesRef.current.contains(event.target as Node)) {
            setIsTemplatesOpen(false);
            setEditingTemplateIndex(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onPromptChange(event.target.value);
    if(optimizeError) setOptimizeError(null);
    if(inspireError) setInspireError(null);
  };

  const handleClear = () => {
    onPromptChange('');
    if(optimizeError) setOptimizeError(null);
    if(inspireError) setInspireError(null);
  };
  
  const handleSave = () => {
    if (prompt) {
      onSaveTemplate(prompt);
    }
  };

  const handleOptimize = async () => {
    if (!prompt || isOptimizing) return;
    setIsOptimizing(true);
    setOptimizeError(null);
    setInspireError(null);
    try {
        const optimized = await optimizePrompt(prompt, uploadedImageCount);
        onPromptChange(optimized);
    } catch (err: any) {
        console.error("Failed to optimize prompt:", err);
        setOptimizeError(err.message || "最佳化失敗。");
    } finally {
        setIsOptimizing(false);
    }
  };

  const handleInspire = async () => {
    if (isInspiring) return;
    setIsInspiring(true);
    setInspireError(null);
    setOptimizeError(null);
    try {
        const inspiredPrompt = await generateInspiration(prompt);
        onPromptChange(inspiredPrompt);
    } catch (err: any) {
        console.error("Failed to generate inspiration:", err);
        setInspireError(err.message || "無法獲取靈感。");
    } finally {
        setIsInspiring(false);
    }
  };

  const isActionDisabled = !prompt || prompt.trim().length === 0;

  const isCreateMode = uploadedImageCount === 0;
  const title = isCreateMode ? "2. 描述要創造的圖片" : "2. 描述你的編輯";
  const placeholderText = isCreateMode
    ? "例如：一頭戴著皇冠的雄偉獅子，寫實風格..."
    : "例如：將圖片 1 的人物放到圖片 2 的沙灘上，或給圖片 1 的人物戴上一頂紅帽子...";

  return (
    <div className="flex flex-col items-center justify-start w-full h-full p-4 bg-slate-800 rounded-lg shadow-lg">
      <h3 className="text-xl font-semibold text-white mb-4">{title}</h3>
      
      <div className="w-full max-w-[350px] mb-4 relative" ref={historyRef}>
        <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-400">歷史紀錄 (最近 50 筆)</p>
            {promptHistory.length > 0 && (
                <button 
                  onClick={() => {
                    onClearPromptHistory();
                    setIsHistoryOpen(false);
                  }} 
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  清除
                </button>
            )}
        </div>
        <button 
          onClick={() => setIsHistoryOpen(prev => !prev)} 
          disabled={promptHistory.length === 0}
          className="w-full text-left px-3 py-2 bg-slate-700 rounded-md text-slate-300 hover:bg-slate-600 transition-colors flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed"
          aria-haspopup="true"
          aria-expanded={isHistoryOpen}
        >
          <span className="truncate">{promptHistory.length > 0 ? '從歷史紀錄中選擇...' : '尚無歷史紀錄'}</span>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${isHistoryOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {isHistoryOpen && promptHistory.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-700">
                {promptHistory.map((p, index) => (
                    <button 
                      key={index} 
                      onClick={() => { 
                        onPromptChange(p); 
                        setIsHistoryOpen(false); 
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-sky-600 transition-colors truncate"
                      title={p}
                    >
                      {p}
                    </button>
                ))}
            </div>
        )}
      </div>

      <div className="w-full max-w-[350px] mb-4 relative" ref={templatesRef}>
        <p className="text-sm font-medium text-slate-400 mb-2">範本</p>
        <button
            onClick={() => setIsTemplatesOpen(prev => !prev)}
            disabled={templates.length === 0}
            className="w-full text-left px-3 py-2 bg-slate-700 rounded-md text-slate-300 hover:bg-slate-600 transition-colors flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed"
            aria-haspopup="true"
            aria-expanded={isTemplatesOpen}
        >
            <span className="truncate">{templates.length > 0 ? '從範本中選擇...' : '尚無範本'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${isTemplatesOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
        </button>
        {isTemplatesOpen && templates.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-700 p-1">
                {templates.map((template, index) => (
                    <div key={index} className="w-full text-left text-sm text-slate-200 rounded-md">
                        {editingTemplateIndex === index ? (
                            <div className="p-2 space-y-2 bg-slate-700 rounded-md">
                                <textarea
                                    value={editingTemplateText}
                                    onChange={(e) => setEditingTemplateText(e.target.value)}
                                    className="w-full px-2 py-1 bg-slate-800 border border-slate-500 rounded text-white text-sm resize-y"
                                    rows={3}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingTemplateIndex(null)} className="px-2 py-1 text-xs bg-slate-500 rounded hover:bg-slate-400 transition-colors">取消</button>
                                    <button 
                                        onClick={() => {
                                            onUpdateTemplate(index, editingTemplateText);
                                            setEditingTemplateIndex(null);
                                        }} 
                                        className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-500 transition-colors"
                                    >
                                        儲存
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="group flex items-center justify-between p-2 hover:bg-sky-600 rounded-md">
                                <span 
                                    className="flex-grow cursor-pointer truncate" 
                                    title={template}
                                    onClick={() => { 
                                        onPromptChange(template); 
                                        setIsTemplatesOpen(false); 
                                    }}
                                >
                                    {template}
                                </span>
                                <div className="flex items-center gap-2 pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setEditingTemplateIndex(index);
                                            setEditingTemplateText(template);
                                        }}
                                        className="text-slate-400 hover:text-white"
                                        title="編輯範本"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                    </button>
                                    <button
                                        onClick={() => onDeleteTemplate(template)}
                                        className="text-slate-400 hover:text-red-400"
                                        title="刪除範本"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>

      <textarea
        value={prompt}
        onChange={handlePromptChange}
        placeholder={placeholderText}
        className="w-full max-w-[350px] p-4 bg-slate-900 border-2 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all resize-none min-h-[140px]"
        aria-label="圖片編輯提示詞"
      />
      <div className="w-full max-w-[350px] mt-3">
        <label htmlFor="negative-prompt" className="text-sm font-medium text-slate-400 mb-1 block">負面提示詞 (選填)</label>
        <textarea
          id="negative-prompt"
          value={negativePrompt}
          onChange={(e) => onNegativePromptChange(e.target.value)}
          placeholder="需要避免的內容... 例如：文字、浮水印、模糊"
          className="w-full p-2 bg-slate-900 border-2 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all resize-none min-h-[60px]"
          aria-label="圖片生成負面提示詞"
        />
      </div>
      {(optimizeError || inspireError) && <p className="w-full max-w-[350px] text-red-400 text-xs mt-2 text-center">{optimizeError || inspireError}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          onClick={handleClear}
          className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
        >
          清除
        </button>
        <button
          onClick={handleOptimize}
          disabled={isActionDisabled || isOptimizing || isInspiring}
          className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isOptimizing ? '最佳化中...' : '✨ 最佳化'}
        </button>
        <button
          onClick={handleInspire}
          disabled={isOptimizing || isInspiring}
          className="px-5 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isInspiring ? '生成中...' : '💡 給我靈感'}
        </button>
        <button
          onClick={handleSave}
          disabled={isActionDisabled}
          className="px-5 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          儲存為範本
        </button>
      </div>
    </div>
  );
};

export default PromptEditor;