
import React, { useEffect } from 'react';
import { useStore } from './store';
import { Lobby } from './components/Lobby';
import { GameCanvas } from './components/GameCanvas';
import { Interface } from './components/UI/Interface';

const App = () => {
  const { isInGame, theme } = useStore();

  return (
    <div className={`w-full h-full relative ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-200'}`}>
      {!isInGame && <Lobby />}
      {isInGame && (
        <>
          <GameCanvas />
          <Interface />
        </>
      )}
    </div>
  );
};

export default App;
