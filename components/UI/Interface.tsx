import React, { useState } from 'react';
import { useStore } from '../../store';
import { networkService } from '../../services/NetworkService';
import { audioSynth } from '../../services/AudioSynthesizer';

export const Interface: React.FC = () => {
  const { peers, micOn, setMicOn, leaveRoom } = useStore();
  const [showEmoji, setShowEmoji] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const toggleMic = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drag-look
    const newVal = !micOn;
    setMicOn(newVal);
    // In a real app, we would enable/disable the track here
    if (useStore.getState().localStream) {
        useStore.getState().localStream?.getAudioTracks().forEach(t => t.enabled = newVal);
    }
    audioSynth.playClick();
  };

  const toggleScreenShare = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isScreenSharing) {
          try {
              const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
              networkService.shareScreen(stream);
              setIsScreenSharing(true);
              
              stream.getVideoTracks()[0].onended = () => {
                  setIsScreenSharing(false);
                  networkService.sendUpdatePacket({ ss: false }); // Notify stop
              };
          } catch (e) {
              console.error("Screen share failed", e);
          }
      } else {
          setIsScreenSharing(false);
          // Logic to stop handled by track end usually
      }
      audioSynth.playClick();
  };

  const handleLeave = (e: React.MouseEvent) => {
      e.stopPropagation();
      networkService.leave();
      leaveRoom(); // This resets state and shows Lobby
  };

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 overflow-hidden ui-panel">
      
      {/* HEADER: Room Info (Minimal) */}
      <div className="flex justify-between items-start pointer-events-auto">
         <div className="glass px-4 py-2 rounded-full border border-white/10" onMouseDown={stopProp}>
            <h2 className="font-display text-sm text-neon-blue tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                LIVE // {Object.keys(peers).length + 1}
            </h2>
         </div>
         
         <div className="text-gray-400 text-xs font-mono opacity-50 select-none">
             Drag to look • WASD to walk
         </div>
      </div>

      {/* FOOTER: Call Controls */}
      <div className="flex justify-center w-full mb-6">
         <div 
            className="pointer-events-auto glass-light backdrop-blur-xl rounded-2xl p-2 flex gap-4 items-center shadow-2xl border border-white/10"
            onMouseDown={stopProp} // Important: stops camera rotation when clicking toolbar
         >
             
             {/* Mic Toggle */}
             <button 
                onClick={toggleMic}
                className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${micOn ? 'bg-dark-800 text-white hover:bg-dark-700' : 'bg-red-500 text-white shadow-[0_0_15px_red]'}`}
             >
                 {micOn ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                 ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                 )}
             </button>

             {/* Screen Share */}
             <button 
                onClick={toggleScreenShare}
                className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${isScreenSharing ? 'bg-neon-green text-black shadow-[0_0_15px_#0aff0a]' : 'bg-dark-800 hover:bg-dark-700 text-white'}`}
             >
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
             </button>

             {/* Reactions Menu */}
             <div className="relative">
                 <button 
                    onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); }}
                    className="w-14 h-14 rounded-xl bg-dark-800 hover:bg-dark-700 text-white flex items-center justify-center transition-all"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                 </button>
                 {showEmoji && (
                    <div 
                        className="absolute bottom-20 left-1/2 -translate-x-1/2 glass p-4 rounded-2xl grid grid-cols-4 gap-3 min-w-[240px] animate-in slide-in-from-bottom-5"
                        onMouseDown={stopProp}
                    >
                        {['😂','👍','❤️','👋','🕺','👀','🔥','💀'].map(e => (
                            <button 
                                key={e} 
                                onClick={(ev) => { ev.stopPropagation(); networkService.sendReaction(e); setShowEmoji(false); audioSynth.playClick(); }} 
                                className="text-3xl hover:scale-125 transition-transform"
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                 )}
             </div>

             <div className="w-px h-8 bg-white/10 mx-2" />

             {/* Leave Button */}
             <button 
                onClick={handleLeave}
                className="w-14 h-14 rounded-xl bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-all shadow-lg"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
             </button>
         </div>
      </div>
    </div>
  );
};