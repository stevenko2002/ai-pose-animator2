import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';

interface ImageCropperModalProps {
  src: string;
  aspectRatio: number | undefined;
  onClose: () => void;
  onCrop: (croppedImageUrl: string) => void;
}

function getCroppedImg(
  image: HTMLImageElement,
  crop: Crop
): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return Promise.reject(new Error('Canvas context is not available.'));
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    resolve(canvas.toDataURL('image/png'));
  });
}


const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ src, aspectRatio, onClose, onCrop }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const newCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspectRatio,
        width,
        height
      ),
      width,
      height
    );
    setCrop(newCrop);
  }

  const handleCropConfirm = async () => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
      try {
        const croppedImageUrl = await getCroppedImg(
          imgRef.current,
          completedCrop
        );
        onCrop(croppedImageUrl);
        onClose();
      } catch (e) {
        console.error('Cropping failed:', e);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-4xl w-full bg-slate-900 p-6 rounded-lg shadow-2xl flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">裁剪圖片</h2>
        <div className="max-w-full max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspectRatio}
            minWidth={100}
            minHeight={100}
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={src}
              onLoad={onImageLoad}
              style={{ maxHeight: '60vh' }}
            />
          </ReactCrop>
        </div>
        <div className="mt-6 flex gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCropConfirm}
            disabled={!completedCrop?.width || !completedCrop?.height}
            className="px-6 py-2 text-sm bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            確認裁剪
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;