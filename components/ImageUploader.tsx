import React, { useState, useCallback, useEffect, useRef } from 'react';
import ImageCropperModal from './ImageCropperModal';

const generateRandomString = () => Math.random().toString(36).substring(2, 10);

interface CharacterLock {
    index: number;
    lockAppearance: boolean;
    lockClothing: boolean;
}

interface ImageUploaderProps {
  onImageUpload: (images: (string | null)[]) => void;
  images: (string | null)[];
  cropAspectRatio: number | undefined;
  onAnalyzePose: (image: string) => void;
  analyzingPoseIndex: number | null;
  onAnalyzeStyle: (index: number) => void;
  analyzingStyleIndex: number | null;
  onGenerateControlMap: (index: number, type: 'canny' | 'depth') => void;
  generatingControlMapIndex: { index: number; type: 'canny' | 'depth' } | null;
  lockedCharacter: CharacterLock | null;
  onSetCharacterLock: (index: number, lock: { appearance: boolean; clothing: boolean; }) => void;
  styleReferenceIndex: number | null;
  onToggleStyleReference: (index: number) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
    onImageUpload, images: imagesProp, cropAspectRatio, 
    onAnalyzePose, analyzingPoseIndex,
    onAnalyzeStyle, analyzingStyleIndex,
    onGenerateControlMap, generatingControlMapIndex,
    lockedCharacter, onSetCharacterLock,
    styleReferenceIndex, onToggleStyleReference
}) => {
  const [images, setImages] = useState<(string | null)[]>(imagesProp);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [croppingImage, setCroppingImage] = useState<{ src: string; index: number } | null>(null);
  const [activeLockMenu, setActiveLockMenu] = useState<number | null>(null);
  const lockMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImages(imagesProp);
  }, [imagesProp]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (lockMenuRef.current && !lockMenuRef.current.contains(event.target as Node)) {
            setActiveLockMenu(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
  }, [images, updateImagesAndNotify]);

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
    if(images[index] !== null) return;

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

  const handleCropClick = (index: number) => {
    const imageSrc = images[index];
    if (imageSrc) {
        setCroppingImage({ src: imageSrc, index });
    }
  };
  
  const handleAnalyzePoseClick = (index: number) => {
    const imageSrc = images[index];
    if (imageSrc) {
        onAnalyzePose(imageSrc);
    }
  }
  
  const handleAnalyzeStyleClick = (index: number) => {
      onAnalyzeStyle(index);
  }

  const handleCropComplete = (croppedImageUrl: string) => {
    if (croppingImage !== null) {
      const newImages = [...images];
      newImages[croppingImage.index] = croppedImageUrl;
      updateImagesAndNotify(newImages);
    }
    setCroppingImage(null);
  };

  const UploadSlot = ({ index }: { index: number }) => {
    const imagePreview = images[index];
    const isDraggingOver = draggingIndex === index;
    const isAnalyzingPose = analyzingPoseIndex === index;
    const isAnalyzingStyle = analyzingStyleIndex === index;
    const isGeneratingControlMap = generatingControlMapIndex?.index === index;
    const controlMapType = generatingControlMapIndex?.type;
    const isBusy = isAnalyzingPose || isAnalyzingStyle || isGeneratingControlMap;
    
    const characterLock = lockedCharacter?.index === index ? lockedCharacter : null;
    const isCharacterLocked = !!characterLock;

    const isStyleReferenced = styleReferenceIndex === index;
    
    let lockBadgeText = '';
    if (characterLock) {
        const parts = [];
        if (characterLock.lockAppearance) parts.push('外貌');
        if (characterLock.lockClothing) parts.push('服裝');
        lockBadgeText = `${parts.join('與')}已鎖定`;
    }

    const handleSetLock = (lock: { appearance: boolean; clothing: boolean; }) => {
        onSetCharacterLock(index, lock);
        setActiveLockMenu(null);
    }

    const busyMessage = () => {
        if (isAnalyzingPose) return '分析姿勢中...';
        if (isAnalyzingStyle) return '分析風格中...';
        if (isGeneratingControlMap) {
            return controlMapType === 'canny' ? '生成線條稿中...' : '生成深度圖中...';
        }
        return '';
    };

    return (
      <div className="w-full flex flex-col items-center">
        <div 
            className={`relative w-full h-[200px] border-2 rounded-md flex items-center justify-center bg-slate-900 overflow-hidden transition-all duration-300 ${isDraggingOver ? 'border-solid border-sky-500 scale-105' : 'border-dashed border-slate-600'} ${isCharacterLocked ? '!border-solid !border-purple-500' : ''} ${isStyleReferenced ? '!border-solid !border-teal-500' : ''}`}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
        >
          <div className="absolute top-2 left-2 bg-slate-900/80 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold border-2 border-slate-600 z-10">
            {index + 1}
          </div>
          {lockBadgeText && (
            <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-md z-10">{lockBadgeText}</div>
          )}
          {isStyleReferenced && (
              <div className={`absolute ${lockBadgeText ? 'top-10' : 'top-2'} right-2 bg-teal-600 text-white text-xs font-bold px-2 py-1 rounded-md z-10`}>風格參考</div>
          )}
          {imagePreview ? (
            <img src={imagePreview} alt={`Preview ${index + 1}`} className={`w-full h-full object-contain transition-opacity ${isBusy ? 'opacity-30' : 'opacity-100'}`} />
          ) : (
            <div className="text-center text-slate-400 p-4 pointer-events-none">
                {isDraggingOver ? (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <p className="mt-2 font-semibold">將圖片拖放到此處</p>
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <p className="mt-2 text-sm">拖放或選擇檔案</p>
                    </>
                )}
            </div>
          )}
          {isBusy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-400"></div>
                  <p className="text-white mt-2 text-sm">{busyMessage()}</p>
              </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <label htmlFor={`file-input-${index}`} className={`cursor-pointer px-4 py-1.5 text-sm bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}>
            選擇檔案
          </label>
          <input id={`file-input-${index}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, index)} disabled={isBusy} />
          {imagePreview && (
              <>
                  <div className="relative" ref={activeLockMenu === index ? lockMenuRef : null}>
                      <button onClick={() => setActiveLockMenu(activeLockMenu === index ? null : index)} className={`px-4 py-1.5 text-sm ${isCharacterLocked ? 'bg-purple-800' : 'bg-purple-600'} text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50`} disabled={isBusy}>
                          {isCharacterLocked ? '修改鎖定' : '鎖定角色'}
                      </button>
                      {activeLockMenu === index && (
                          <div className="absolute bottom-full mb-2 w-48 bg-slate-700 rounded-lg shadow-lg z-20 p-1 flex flex-col items-stretch text-left">
                              <button onClick={() => handleSetLock({ appearance: true, clothing: false })} className="block w-full text-left px-3 py-2 text-sm text-white rounded-md hover:bg-purple-600 transition-colors">鎖定外貌</button>
                              <button onClick={() => handleSetLock({ appearance: false, clothing: true })} className="block w-full text-left px-3 py-2 text-sm text-white rounded-md hover:bg-purple-600 transition-colors">鎖定服裝</button>
                              <button onClick={() => handleSetLock({ appearance: true, clothing: true })} className="block w-full text-left px-3 py-2 text-sm text-white rounded-md hover:bg-purple-600 transition-colors">鎖定外貌與服裝</button>
                              {isCharacterLocked && <div className="border-t border-slate-600 my-1"></div>}
                              {isCharacterLocked && <button onClick={() => handleSetLock({ appearance: false, clothing: false })} className="block w-full text-left px-3 py-2 text-sm text-red-400 rounded-md hover:bg-red-600 hover:text-white transition-colors">解鎖角色</button>}
                          </div>
                      )}
                  </div>
                  <button onClick={() => onToggleStyleReference(index)} className={`px-4 py-1.5 text-sm ${isStyleReferenced ? 'bg-teal-800' : 'bg-teal-600'} text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50`} disabled={isBusy}>
                      {isStyleReferenced ? '取消參考' : '參考風格'}
                  </button>
                  <button onClick={() => handleAnalyzePoseClick(index)} className="px-4 py-1.5 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50" disabled={isBusy}>
                      分析姿勢
                  </button>
                  <button onClick={() => handleAnalyzeStyleClick(index)} className="px-4 py-1.5 text-sm bg-pink-600 text-white font-semibold rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50" disabled={isBusy}>
                      分析風格
                  </button>
                  <button onClick={() => onGenerateControlMap(index, 'canny')} className="px-4 py-1.5 text-sm bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50" disabled={isBusy}>
                      生成線條稿
                  </button>
                  <button onClick={() => onGenerateControlMap(index, 'depth')} className="px-4 py-1.5 text-sm bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50" disabled={isBusy}>
                      生成深度圖
                  </button>
                  <button onClick={() => handleCropClick(index)} className="px-4 py-1.5 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50" disabled={isBusy}>
                      裁剪
                  </button>
                  <button onClick={() => handleRemoveImage(index)} className="px-4 py-1.5 text-sm bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50" disabled={isBusy}>
                      移除
                  </button>
                  <button onClick={() => downloadImage(imagePreview, `uploaded_image_${index + 1}_${generateRandomString()}.png`)} className="px-4 py-1.5 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50" disabled={isBusy}>
                      儲存
                  </button>
              </>
          )}
        </div>
      </div>
    );
  };


  return (
    <>
      {croppingImage && (
          <ImageCropperModal
              src={croppingImage.src}
              aspectRatio={cropAspectRatio}
              onClose={() => setCroppingImage(null)}
              onCrop={handleCropComplete}
          />
      )}
      <div className="flex flex-col items-center justify-start w-full h-full p-4 bg-slate-800 rounded-lg shadow-lg">
         <div className="text-center mb-4">
              <h3 className="text-xl font-semibold text-white">1. 上傳圖片</h3>
              <p className="text-sm text-slate-400 mt-1">在提示詞中以 1、2、3 來引用圖片。</p>
         </div>
         <div className="w-full max-w-sm space-y-6">
            <UploadSlot index={0} />
            <UploadSlot index={1} />
            <UploadSlot index={2} />
         </div>
      </div>
    </>
  );
};

export default ImageUploader;