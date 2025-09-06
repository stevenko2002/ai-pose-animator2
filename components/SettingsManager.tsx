import React, { useState, useRef } from 'react';
import type { WorkflowPreset } from '../types';

interface SettingsManagerProps {
  onExportProject: () => void;
  onImportProject: (event: React.ChangeEvent<HTMLInputElement>) => void;
  presets: WorkflowPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: WorkflowPreset) => void;
  onDeletePreset: (presetName: string) => void;
}

const SettingsManager: React.FC<SettingsManagerProps> = ({ 
  onExportProject, onImportProject,
  presets, onSavePreset, onLoadPreset, onDeletePreset
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  const handleImportClick = () => {
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
    importInputRef.current?.click();
  };

  const handleSavePreset = () => {
    const name = prompt('請為此預設集命名:', `預設集 ${presets.length + 1}`);
    if (name && name.trim()) {
      onSavePreset(name.trim());
    }
  };

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="w-full">
            <h4 className="text-lg font-semibold text-white mb-2 text-center">專案 & 工作流程</h4>
            <div className="flex items-center justify-center gap-4">
                <input
                    type="file"
                    ref={importInputRef}
                    accept=".json,application/json"
                    className="hidden"
                    onChange={onImportProject}
                    aria-hidden="true"
                />
                <button
                    onClick={handleImportClick}
                    className="px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                    匯入專案
                </button>
                <button
                    onClick={onExportProject}
                    className="px-4 py-2 text-sm bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors"
                >
                    匯出專案
                </button>
            </div>
        </div>
        <div className="w-full border-t border-slate-700"></div>
        <div className="w-full relative">
            <div className="flex justify-center gap-4">
                 <button
                    onClick={handleSavePreset}
                    className="px-4 py-2 text-sm bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                >
                    儲存為預設集
                </button>
                <button 
                    onClick={() => setIsPresetsOpen(p => !p)}
                    disabled={presets.length === 0}
                    className="px-4 py-2 text-sm bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 transition-colors disabled:opacity-50"
                >
                    載入預設集
                </button>
            </div>

            {isPresetsOpen && presets.length > 0 && (
                <div className="absolute bottom-full mb-2 w-full max-w-xs mx-auto bg-slate-700 rounded-lg shadow-lg z-20 p-2 max-h-60 overflow-y-auto">
                    <ul className="space-y-1">
                        {presets.map((preset) => (
                            <li key={preset.name} className="group flex items-center justify-between text-sm text-white p-2 rounded-md hover:bg-sky-600">
                                <span className="truncate flex-grow cursor-pointer" onClick={() => { onLoadPreset(preset); setIsPresetsOpen(false); }}>
                                    {preset.name}
                                </span>
                                <button
                                    onClick={() => onDeletePreset(preset.name)}
                                    className="ml-2 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100"
                                    title={`刪除 ${preset.name}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    </div>
  );
};

export default React.memo(SettingsManager);