
import React, { useEffect } from 'react';

interface ImageModalProps {
  src: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ src, onClose }) => {
  // Close modal on 'Escape' key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 transition-opacity duration-300 animate-fadeIn"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
      <div
        className="relative max-w-[90vw] max-h-[90vh] bg-slate-900 p-2 rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image container
      >
        <img src={src} alt="Zoomed view" className="w-auto h-auto max-w-full max-h-[calc(90vh-1rem)] object-contain" />
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-red-600 text-white rounded-full h-10 w-10 flex items-center justify-center text-xl font-bold hover:bg-red-700 transition-all transform hover:scale-110 shadow-lg"
          aria-label="Close zoomed image view"
        >
          &times;
        </button>
      </div>
    </div>
  );
};

export default ImageModal;
