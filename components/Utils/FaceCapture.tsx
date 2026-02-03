import React, { useRef, useState, useEffect } from 'react';
import { audioSynth } from '../../services/AudioSynthesizer';

interface FaceCaptureProps {
  onCapture: (base64: string) => void;
  onSplitChange: (val: number) => void;
  initialSplit: number;
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({ onCapture, onSplitChange, initialSplit }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState(false);
  const [splitVal, setSplitVal] = useState(initialSplit);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400 } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (e) {
      console.error("Camera error", e);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    audioSynth.playClick();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.videoWidth === 0) return;

    // Set canvas dimensions to match video (Square aspect ratio for texture)
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    // Center crop
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    // Draw full image first
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    // Apply OVAL Mask (Narrower width = Oval)
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    // radiusX = size * 0.35 (narrow), radiusY = size * 0.45 (tall)
    ctx.ellipse(size / 2, size / 2, size * 0.35, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Add border ring for style
    ctx.beginPath();
    ctx.lineWidth = 15;
    ctx.strokeStyle = '#00f3ff';
    ctx.ellipse(size / 2, size / 2, size * 0.35 - 5, size * 0.45 - 5, 0, 0, Math.PI * 2);
    ctx.stroke();

    const dataUrl = canvas.toDataURL('image/png');
    onCapture(dataUrl);
    setCaptured(true);
    // Don't stop camera immediately so they can adjust split if needed, 
    // but usually we stop. Let's stop to save resource.
    stopCamera();
  };

  const retake = () => {
    setCaptured(false);
    startCamera();
  };

  const handleSplitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSplitVal(val);
    onSplitChange(val);
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-dark-800 rounded-xl border border-white/10 w-full">
      <div className="relative w-[250px] h-[250px] bg-black rounded-xl overflow-hidden border-2 border-neon-blue shadow-[0_0_15px_rgba(58,131,246,0.5)]">
        {!captured ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="absolute top-0 left-0 w-full h-full object-cover" 
            />
            {/* Guide Ring for Oval */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-4 border-white/30 rounded-[50%]" style={{ width: '70%', height: '90%' }} />
            </div>
            
            {/* Split Line Guide */}
            <div 
                className="absolute left-0 w-full h-0.5 bg-neon-pink shadow-[0_0_5px_#ff00ff]"
                style={{ bottom: `${splitVal * 100}%` }}
            />
          </>
        ) : (
          <canvas ref={canvasRef} className="w-full h-full object-contain" />
        )}
      </div>

      <div className="w-full max-w-[250px]">
          <label className="text-xs text-gray-400 mb-1 block flex justify-between">
              <span>Mouth Split Position</span>
              <span>{(splitVal * 100).toFixed(0)}%</span>
          </label>
          <input 
            type="range" 
            min="0.1" 
            max="0.9" 
            step="0.01" 
            value={splitVal}
            onChange={handleSplitChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-pink"
          />
      </div>

      <div className="flex space-x-3">
        {!captured ? (
          <button 
            type="button"
            onClick={takePhoto}
            className="px-6 py-2 bg-neon-blue text-black font-bold font-display rounded-full hover:bg-white transition-all shadow-lg active:scale-95"
          >
            CAPTURE
          </button>
        ) : (
          <button 
            type="button"
            onClick={retake}
            className="px-6 py-2 bg-dark-900 border border-white/20 text-white font-bold rounded-full hover:bg-white/10 transition-all"
          >
            RETAKE
          </button>
        )}
      </div>
    </div>
  );
};