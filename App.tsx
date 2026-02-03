import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useStore } from './store';
import { networkService } from './services/NetworkService';
import { Lobby } from './components/UI/Lobby';
import { Interface } from './components/UI/Interface';
import { SelfAvatar } from './components/World/SelfAvatar';
import { RemoteAvatar } from './components/World/RemoteAvatar';
import { Environment } from './components/World/Environment';
import { PlayerState } from './types';

const SceneContent: React.FC = () => {
  const { peers } = useStore();
  
  return (
    <>
      <Environment />
      <SelfAvatar />
      {Object.values(peers).map((peer: PlayerState) => (
        <RemoteAvatar key={peer.id} peer={peer} />
      ))}
    </>
  );
};

const App: React.FC = () => {
  const { isInRoom, roomId, settings } = useStore();

  useEffect(() => {
    if (isInRoom) {
      networkService.connect(roomId, {
        nickname: settings.nickname,
        color: settings.color,
        shape: settings.shape,
        faceTexture: settings.faceTexture || undefined
      });
      return () => {
        networkService.leave();
      }
    }
  }, [isInRoom, roomId]);

  return (
    <div className="w-full h-screen bg-black relative">
      {!isInRoom ? (
        <Lobby />
      ) : (
        <>
           <div className="absolute inset-0 cursor-default active:cursor-grabbing">
              <Canvas shadows camera={{ position: [0, 5, 10], fov: 50 }}>
                  <SceneContent />
              </Canvas>
           </div>
           <Interface />
        </>
      )}
    </div>
  );
};

export default App;