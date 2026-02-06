import { useStore } from '../store';
import { PlayerState } from '../types';

let interval: number | null = null;
const bots: Record<string, { 
    target: [number, number, number], 
    state: 'moving' | 'idle', 
    waitTime: number,
    nextTalkTime: number
}> = {};

export const startMockNetwork = () => {
  const store = useStore.getState();
  
  // Create 3 Bots
  for(let i=1; i<=3; i++) {
    const botId = `bot_${i}`;
    // Init Bot State
    bots[botId] = {
        target: [Math.random() * 10 - 5, 0, Math.random() * 10 - 5],
        state: 'moving',
        waitTime: 0,
        nextTalkTime: Date.now() + Math.random() * 5000
    };

    store.updatePeer(botId, {
        id: botId,
        name: `AI_Bot_${i}`,
        color: i === 1 ? '#ff0000' : i === 2 ? '#00ff00' : '#0000ff',
        shape: i === 1 ? 'sphere' : i === 2 ? 'box' : 'cone',
        position: [bots[botId].target[0], 0, bots[botId].target[2]],
        rotation: [0, 0, 0],
        isSpeaking: false,
        isBot: true
    });
  }

  // Loop
  interval = window.setInterval(() => {
    const store = useStore.getState();
    const now = Date.now();

    Object.keys(bots).forEach((botId) => {
        const bot = bots[botId];
        const peer = store.peers[botId];
        if(!peer) return;

        // 1. Movement Logic
        let newPos = [...peer.position] as [number, number, number];
        let newRot = peer.rotation;
        
        if (bot.state === 'moving') {
            const dx = bot.target[0] - newPos[0];
            const dz = bot.target[2] - newPos[2];
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist < 0.5) {
                // Reached target, switch to idle
                bot.state = 'idle';
                bot.waitTime = now + 2000 + Math.random() * 3000; // Wait 2-5s
            } else {
                // Move towards target
                const speed = 0.08;
                newPos[0] += (dx / dist) * speed;
                newPos[2] += (dz / dist) * speed;
                // Face target
                newRot = [0, Math.atan2(dx, dz), 0];
            }
        } else {
            // Idle
            if (now > bot.waitTime) {
                bot.state = 'moving';
                bot.target = [(Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30];
            }
        }

        // 2. Speaking Logic
        let isSpeaking = peer.isSpeaking;
        if (now > bot.nextTalkTime) {
            isSpeaking = !isSpeaking;
            // Speak for 2-4s, Silence for 3-8s
            const duration = isSpeaking ? (2000 + Math.random() * 2000) : (3000 + Math.random() * 5000);
            bot.nextTalkTime = now + duration;
        }

        store.updatePeer(botId, {
            position: newPos,
            rotation: newRot,
            isSpeaking
        });
    });
  }, 30); // 30fps update
};

export const stopMockNetwork = () => {
  if (interval) {
      clearInterval(interval);
      interval = null;
  }
  const store = useStore.getState();
  // Cleanup bots
  Object.keys(store.peers).forEach(id => {
      if(store.peers[id].isBot) store.removePeer(id);
  });
};