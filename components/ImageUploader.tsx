import React, { useState, useCallback } from 'react';

interface ImageUploaderProps {
  onImageUpload: (base64: string | null) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setImagePreview(base64String);
            onImageUpload(base64String);
        };
        reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);
  
  const handleRemoveImage = () => {
      setImagePreview(null);
      onImageUpload(null);
      const input = document.getElementById('file-input') as HTMLInputElement;
      if (input) {
          input.value = '';
      }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
      const input = document.getElementById('file-input') as HTMLInputElement;
      if (input) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
      }
    }
  };

  return (
    <div 
      className="flex flex-col items-center justify-center w-full h-full p-4 bg-slate-800 rounded-lg shadow-lg"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
       <h3 className="text-xl font-semibold text-white mb-4">1. Upload an Image</h3>
      <div className={`w-[350px] h-[500px] border-2 rounded-md flex items-center justify-center bg-slate-900 overflow-hidden transition-all duration-300 ${isDraggingOver ? 'border-solid border-sky-500 scale-105' : 'border-dashed border-slate-600'}`}>
        {imagePreview ? (
          <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center text-slate-400 p-4 pointer-events-none">
            {isDraggingOver ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="mt-2 text-lg font-semibold">Drop the image here</p>
              </>
            ) : (
                <>
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2">Drag &amp; drop an image of a person</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 flex space-x-4">
        <label htmlFor="file-input" className="cursor-pointer px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors">
          Choose File
        </label>
        <input id="file-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {imagePreview && (
            <button
            onClick={handleRemoveImage}
            className="px-6 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;