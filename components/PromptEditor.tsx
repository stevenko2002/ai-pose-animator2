import React, { useState } from 'react';
import { optimizePrompt } from '../services/geminiService';

interface PromptEditorProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  templates: string[];
  onSaveTemplate: (prompt: string) => void;
  onDeleteTemplate: (prompt: string) => void;
  uploadedImageCount: number;
}

const PromptEditor: React.FC<PromptEditorProps> = ({ 
    prompt, onPromptChange,
    templates, onSaveTemplate, onDeleteTemplate, uploadedImageCount
}) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onPromptChange(event.target.value);
    if(optimizeError) setOptimizeError(null); // Clear error on new input
  };

  const handleClear = () => {
    onPromptChange('');
    if(optimizeError) setOptimizeError(null);
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
    try {
        const optimized = await optimizePrompt(prompt);
        onPromptChange(optimized);
    } catch (err: any) {
        console.error("Failed to optimize prompt:", err);
        setOptimizeError(err.message || "Optimization failed.");
    } finally {
        setIsOptimizing(false);
    }
  };

  const isActionDisabled = !prompt || prompt.trim().length === 0;

  const isCreateMode = uploadedImageCount === 0;
  const title = isCreateMode ? "2. Describe Image to Create" : "2. Describe Your Edit";
  const placeholderText = isCreateMode
    ? "e.g., 'a majestic lion wearing a crown, photorealistic'..."
    : "e.g., 'put the person from image 1 on the beach from image 2', or 'give the person in image 1 a red hat'...";

  return (
    <div className="flex flex-col items-center justify-start w-full h-full p-4 bg-slate-800 rounded-lg shadow-lg">
      <h3 className="text-xl font-semibold text-white mb-4">{title}</h3>
      
      <div className="w-full max-w-[350px] mb-4">
        <p className="text-sm font-medium text-slate-400 mb-2">Templates</p>
        <div className="flex items-center gap-2 pb-2 -mx-4 px-4 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-900">
            {templates.map((template, index) => (
                <div key={index} className="group relative flex-shrink-0 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors flex items-center">
                    <button
                        onClick={() => onPromptChange(template)}
                        className="pl-3 pr-2 py-1 text-sm text-slate-200"
                        title={template}
                    >
                        <span className="truncate max-w-[120px] inline-block align-middle">{template}</span>
                    </button>
                    <button
                        onClick={() => onDeleteTemplate(template)}
                        className="pr-2 text-slate-500 hover:text-red-400 transition-colors opacity-50 group-hover:opacity-100"
                        aria-label={`Delete template: ${template}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
            {templates.length === 0 && (
                 <p className="text-xs text-slate-500 italic">Save prompts to use them again later.</p>
            )}
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={handlePromptChange}
        placeholder={placeholderText}
        className="w-full max-w-[350px] flex-grow p-4 bg-slate-900 border-2 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all resize-none min-h-[250px]"
        aria-label="Prompt for image editing"
      />
      {optimizeError && <p className="w-full max-w-[350px] text-red-400 text-xs mt-2 text-center">{optimizeError}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <button
          onClick={handleClear}
          className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleOptimize}
          disabled={isActionDisabled || isOptimizing}
          className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isOptimizing ? 'Optimizing...' : '✨ Optimize'}
        </button>
        <button
          onClick={handleSave}
          disabled={isActionDisabled}
          className="px-5 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Template
        </button>
      </div>
    </div>
  );
};

export default PromptEditor;
