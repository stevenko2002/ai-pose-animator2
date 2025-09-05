import React from 'react';

interface SettingsManagerProps {
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const SettingsManager: React.FC<SettingsManagerProps> = ({ onExport, onImport }) => {
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    // Reset the input value to allow re-uploading the same file
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
    importInputRef.current?.click();
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <input
        type="file"
        ref={importInputRef}
        accept=".json,application/json"
        className="hidden"
        onChange={onImport}
        aria-hidden="true"
      />
      <button
        onClick={handleImportClick}
        className="px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
      >
        Import Settings
      </button>
      <button
        onClick={onExport}
        className="px-4 py-2 text-sm bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors"
      >
        Export Settings
      </button>
    </div>
  );
};

export default SettingsManager;