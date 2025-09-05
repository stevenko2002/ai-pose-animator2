import React, { useState, useCallback, useEffect } from 'react';

interface ImageUploaderProps {
  onImageUpload: (images: (string | null)[]) => void;
  images: (string | null)[];
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, images: imagesProp }) => {
  const [images, setImages] = useState<(string | null)[]>(imagesProp);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    // Sync state with prop changes from parent (e.g., for "Use as Input")
    setImages(imagesProp);
  }, [imagesProp]);

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const updateImagesAndNotify = (newImages: (string | null)[]) => {
    setImages(newImages);
    onImageUpload(newImages);
  };

  const processFile = useCallback((file: File, index: number) => {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const newImages = [...images];
            newImages[index] = base64String;
            updateImagesAndNotify(newImages);
        };
        reader.readAsDataURL(file);
    }
  }, [images]); // Dependency on images to create a correct copy

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file, index);
    }
  };
  
  const handleRemoveImage = (index: number) => {
      const newImages = [...images];
      newImages[index] = null;
      updateImagesAndNotify(newImages);
      const input = document.getElementById(`file-input-${index}`) as HTMLInputElement;
      if (input) {
          input.value = '';
      }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    if(images[index] === null) {
      setDraggingIndex(index);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingIndex(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    setDraggingIndex(null);
    if(images[index] !== null) return; // Don't drop on an existing image

    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file, index);
      const input = document.getElementById(`file-input-${index}`) as HTMLInputElement;
      if (input) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
      }
    }
  };

  const UploadSlot = ({ index }: { index: number }) => {
    const imagePreview = images[index];
    const isDraggingOver = draggingIndex === index;

    return (
      <div className="w-full flex flex-col items-center">
        <div 
            className={`w-full h-[200px] border-2 rounded-md flex items-center justify-center bg-slate-900 overflow-hidden transition-all duration-300 ${isDraggingOver ? 'border-solid border-sky-500 scale-105' : 'border-dashed border-slate-600'}`}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
        >
          {imagePreview ? (
            <img src={imagePreview} alt={`Preview ${index + 1}`} className="w-full h-full object-contain" />
          ) : (
            <div className="text-center text-slate-400 p-4 pointer-events-none">
                {isDraggingOver ? (
                    <>
                        <svg xmlns="http://www.w.org/2000/svg" className="mx-auto h-12 w-12 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <p className="mt-2 font-semibold">Drop image here</p>
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <p className="mt-2 text-sm">Drag & drop or choose file</p>
                    </>
                )}
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <label htmlFor={`file-input-${index}`} className="cursor-pointer px-4 py-1.5 text-sm bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors">
            Choose File
          </label>
          <input id={`file-input-${index}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, index)} />
          {imagePreview && (
              <>
                  <button onClick={() => handleRemoveImage(index)} className="px-4 py-1.5 text-sm bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors">
                      Remove
                  </button>
                  <button onClick={() => downloadImage(imagePreview, `uploaded_image_${index + 1}.png`)} className="px-4 py-1.5 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">
                      Save
                  </button>
              </>
          )}
        </div>
      </div>
    );
  };


  return (
    <div className="flex flex-col items-center justify-start w-full h-full p-4 bg-slate-800 rounded-lg shadow-lg">
       <h3 className="text-xl font-semibold text-white mb-4">1. Upload Images (up to 3)</h3>
       <div className="w-full max-w-sm space-y-6">
          <UploadSlot index={0} />
          <UploadSlot index={1} />
          <UploadSlot index={2} />
       </div>
    </div>
  );
};

export default ImageUploader;