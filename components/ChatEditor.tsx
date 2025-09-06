import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

// Helper for downloading
const generateRandomString = () => Math.random().toString(36).substring(2, 10);
const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

interface ChatEditorProps {
    history: ChatMessage[];
    onSendMessage: (message: string) => void;
    isGenerating: boolean;
    onZoomImage: (image: string) => void;
}

const ChatEditor: React.FC<ChatEditorProps> = ({ history, onSendMessage, isGenerating, onZoomImage }) => {
    const [message, setMessage] = useState('');
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !isGenerating) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };
    
    if (history.length === 0) {
        return null;
    }

    return (
        <div className="w-full max-w-5xl mt-6 p-4 bg-slate-800/50 rounded-lg shadow-lg border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4 text-center">聊天式編輯</h3>
            <div className="max-h-96 overflow-y-auto pr-4 space-y-4 mb-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                {history.map((msg, index) => (
                    <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       {msg.role === 'model' && (
                           <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c.251.023.501.05.75.082a.75.75 0 01.75.75v5.714c0 .414-.336.75-.75.75H4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75h5.25c.251.023.501.05.75.082zM10.5 9.75h2.25a2.25 2.25 0 002.25-2.25V4.5a2.25 2.25 0 00-2.25-2.25H10.5a.75.75 0 01-.75-.75V1.5a.75.75 0 01.75-.75h2.25a3.75 3.75 0 013.75 3.75v3a3.75 3.75 0 01-3.75 3.75H10.5a.75.75 0 01-.75-.75v-1.5a.75.75 0 01.75-.75z" /></svg>
                           </div>
                       )}
                       <div className={`max-w-md rounded-lg p-2 ${msg.role === 'user' ? 'bg-sky-800 text-white' : 'bg-slate-700'}`}>
                           {msg.text && <p className="text-sm">{msg.text}</p>}
                           {msg.image && (
                               <div className="relative group mt-2">
                                   <img src={msg.image} alt="Chat content" className="rounded-md max-w-xs" />
                                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4 rounded-md">
                                        <button 
                                            onClick={() => msg.image && onZoomImage(msg.image)} 
                                            className="w-12 h-12 bg-slate-800/80 rounded-full flex items-center justify-center text-white hover:bg-slate-700 transition-colors"
                                            title="縮放"
                                            aria-label="Zoom image in chat"
                                        >
                                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                        </button>
                                        <button 
                                            onClick={() => msg.image && downloadImage(msg.image, `chat_image_${generateRandomString()}.png`)} 
                                            className="w-12 h-12 bg-slate-800/80 rounded-full flex items-center justify-center text-white hover:bg-slate-700 transition-colors"
                                            title="儲存"
                                            aria-label="Save image from chat"
                                        >
                                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        </button>
                                   </div>
                               </div>
                           )}
                       </div>
                    </div>
                ))}
                {isGenerating && (
                    <div className="flex items-end gap-2 justify-start">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c.251.023.501.05.75.082a.75.75 0 01.75.75v5.714c0 .414-.336.75-.75.75H4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75h5.25c.251.023.501.05.75.082zM10.5 9.75h2.25a2.25 2.25 0 002.25-2.25V4.5a2.25 2.25 0 00-2.25-2.25H10.5a.75.75 0 01-.75-.75V1.5a.75.75 0 01.75-.75h2.25a3.75 3.75 0 013.75 3.75v3a3.75 3.75 0 01-3.75 3.75H10.5a.75.75 0 01-.75-.75v-1.5a.75.75 0 01.75-.75z" /></svg>
                        </div>
                        <div className="max-w-md rounded-lg p-2 bg-slate-700 flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-sky-400"></div>
                            <p className="text-sm text-slate-300">正在生成...</p>
                        </div>
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>
            <form onSubmit={handleSend} className="flex gap-2">
                <input 
                    type="text" 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    placeholder="輸入編輯指令... (例如：幫他加上太陽眼鏡)"
                    disabled={isGenerating}
                    className="flex-grow bg-slate-900 border-2 border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
                    aria-label="Chat edit prompt"
                />
                <button type="submit" disabled={isGenerating || !message.trim()} className="px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isGenerating ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    ) : '傳送'}
                </button>
            </form>
        </div>
    );
}

export default ChatEditor;