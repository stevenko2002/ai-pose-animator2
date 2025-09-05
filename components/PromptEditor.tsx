import React from 'react';

interface PromptEditorProps {
  prompt: string | null;
  onPromptChange: (prompt: string) => void;
  suggestion: string | null;
  onRandomize: () => void;
}

const PromptEditor: React.FC<PromptEditorProps> = ({ prompt, onPromptChange, suggestion, onRandomize }) => {

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onPromptChange(event.target.value);
  };

  const handleClear = () => {
    onPromptChange('');
  };

  const handleUseSuggestion = () => {
    if (suggestion) {
      onPromptChange(suggestion);
    }
  };

  const hasSuggestion = suggestion && suggestion.trim().length > 0;

  return (
    <div className="flex flex-col items-center justify-start w-full h-full p-4 bg-slate-800 rounded-lg shadow-lg">
      <h3 className="text-xl font-semibold text-white mb-4">2. Describe Your Edit</h3>
      
      {hasSuggestion && (
        <div className="w-full max-w-[350px] mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-slate-400">AI Suggestion ✨</p>
            <button 
              onClick={onRandomize} 
              className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-sky-400 transition-colors"
              title="Get another suggestion"
              aria-label="Get another suggestion"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.5 13.5a9 9 0 0114.28-4.28l-1.5 1.5M20 20v-5h-5m-1.5-1.5a9 9 0 01-14.28 4.28l1.5-1.5" />
              </svg>
            </button>
          </div>
          <div className="p-3 bg-slate-700 rounded-md border border-slate-600 relative group">
            <p className="text-sm text-slate-300 italic pr-12">"{suggestion}"</p>
            <button 
              onClick={handleUseSuggestion} 
              className="absolute top-1/2 right-2 -translate-y-1/2 px-3 py-1 text-xs bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-700 transition-all opacity-80 group-hover:opacity-100"
              title="Use this suggestion"
            >
              Use
            </button>
          </div>
        </div>
      )}

      <textarea
        value={prompt || ''}
        onChange={handlePromptChange}
        placeholder="e.g., 'make the person wear a red hat', 'change the background to a beach', 'turn the photo into a watercolor painting'..."
        className={`w-[350px] p-4 bg-slate-900 border-2 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all resize-none ${hasSuggestion ? 'h-[350px]' : 'h-[444px]'}`}
        aria-label="Prompt for image editing"
      />
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <button
          onClick={handleClear}
          className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
        >
          Clear Prompt
        </button>
      </div>
    </div>
  );
};

export default PromptEditor;