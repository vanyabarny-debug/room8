
import React, { useEffect, useRef, useState } from 'react';

interface Props {
  stream: MediaStream | null;
  active: boolean;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

// Hook to get volume level (0-100) from a stream
export const useAudioVolume = (stream: MediaStream | null, active: boolean) => {
    const [volume, setVolume] = useState(0);
    const frameRef = useRef<number>(0);
    
    useEffect(() => {
        if (!stream || !active) {
            setVolume(0);
            return;
        }

        let ctx: AudioContext | null = null;
        let analyser: AnalyserNode | null = null;
        let source: MediaStreamAudioSourceNode | null = null;
        const dataArray = new Uint8Array(4); // Low resolution enough for just volume

        try {
            const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
            ctx = new AudioContextClass();
            analyser = ctx.createAnalyser();
            source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 32;
        } catch (e) {
            console.warn("Audio Context Error", e);
            return;
        }

        const update = () => {
            if (analyser) {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
                const avg = sum / dataArray.length;
                // Normalize 0-255 to roughly 0-100, with some boost for lower volumes
                setVolume(Math.min(100, (avg / 255) * 150)); 
            }
            frameRef.current = requestAnimationFrame(update);
        };

        update();

        return () => {
            cancelAnimationFrame(frameRef.current);
            if (ctx && ctx.state !== 'closed') ctx.close();
        };
    }, [stream, active]);

    return volume;
};

export const AudioVisualizer: React.FC<Props> = ({ 
  stream, 
  active, 
  color = '#4ade80', 
  width = 10,
  height = 20,
  className = ""
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const cCtx = canvas.getContext('2d');
    if(!cCtx) return;
    
    // Clear immediately if inactive
    if (!active) {
        cCtx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    let animId: number;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    const dataArray = new Uint8Array(4);

    if (stream) {
        try {
            // Check if stream has audio tracks
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
                ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                analyser = ctx.createAnalyser();
                const source = ctx.createMediaStreamSource(stream);
                source.connect(analyser);
                analyser.fftSize = 32;
            }
        } catch(e) {
            console.warn("Audio context error", e);
        }
    }

    const draw = () => {
      animId = requestAnimationFrame(draw);
      cCtx.clearRect(0, 0, canvas.width, canvas.height);
      cCtx.fillStyle = color;

      let heightRatio = 0;

      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        heightRatio = (sum / dataArray.length) / 255;
      } 
      
      if (heightRatio > 0.01) {
          const h = Math.max(1, heightRatio * canvas.height);
          cCtx.fillRect(0, canvas.height - h, canvas.width, h);
      }
    };
    draw();
    
    return () => {
      cancelAnimationFrame(animId);
      if(ctx && ctx.state !== 'closed') ctx.close();
      cCtx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [stream, active, color]);

  return <canvas ref={canvasRef} width={width} height={height} className={className} />;
};
