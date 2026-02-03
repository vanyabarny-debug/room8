
import { joinRoom } from 'trystero';
import { useStore } from '../store';
import { PlayerState } from '../types';

const APP_ID = 'room8_3d_meet_v1';

class NetworkService {
  private room: any = null;
  private sendAction: any = null;
  private sendReactionAction: any = null;
  private sendTeleportAction: any = null;
  
  // Throttle updates
  private lastUpdate = 0;
  private updateInterval = 50; // ms

  connect(roomId: string) {
    if (this.room) this.disconnect();

    console.log(`[Network] Connecting to room: ${roomId}`);
    this.room = joinRoom({ appId: APP_ID, password: roomId }, 'room8_root_channel');

    // 1. Data Channels
    const [sendUpdate, getUpdate] = this.room.makeAction('playerUpdate');
    const [sendReaction, getReaction] = this.room.makeAction('reaction');
    const [sendTeleport, getTeleport] = this.room.makeAction('teleport');

    this.sendAction = sendUpdate;
    this.sendReactionAction = sendReaction;
    this.sendTeleportAction = sendTeleport;

    // 2. Event Listeners
    this.room.onPeerJoin((peerId: string) => {
        console.log(`[Network] Peer joined: ${peerId}`);
        // Send my state immediately to the new peer
        this.broadcastMyState(true);
    });

    this.room.onPeerLeave((peerId: string) => {
        console.log(`[Network] Peer left: ${peerId}`);
        useStore.getState().removePeer(peerId);
        useStore.getState().removeStream(peerId);
    });

    this.room.onPeerStream((stream: MediaStream, peerId: string, metadata: any) => {
        console.log(`[Network] Received stream from ${peerId}`, metadata);
        useStore.getState().addStream(peerId, stream, metadata);
    });

    // 3. Handle Incoming Data
    getUpdate((data: Partial<PlayerState>, peerId: string) => {
        // Assume data contains { position, rotation, ... }
        useStore.getState().updatePeer(peerId, { ...data, id: peerId });
    });

    getReaction((emoji: string, peerId: string) => {
        useStore.getState().updatePeer(peerId, { 
            lastReaction: emoji, 
            lastReactionTs: Date.now() 
        });
    });

    getTeleport((data: any, peerId: string) => {
        if (data.type === 'request') {
            useStore.getState().setIncomingTeleport({ fromId: peerId, fromName: data.name });
        } else if (data.type === 'response' && data.accepted) {
            // Teleport me to them
            const targetPeer = useStore.getState().peers[peerId];
            if (targetPeer) {
                window.dispatchEvent(new CustomEvent('teleport-to', { detail: targetPeer.position }));
            }
        }
    });
  }

  broadcastMyState(force = false) {
    if (!this.room || !this.sendAction) return;

    const now = Date.now();
    if (!force && now - this.lastUpdate < this.updateInterval) return;
    
    const { localPlayer, micEnabled, screenShareEnabled } = useStore.getState();
    
    // We get position/rotation from the store, but usually they are updated by 
    // the UI/Canvas logic directly into the store? 
    // Actually, in this app, LocalPlayer logic drives movement.
    // We need to fetch the LATEST position from the LocalPlayer logic.
    // However, store.ts localPlayer object doesn't auto-update with 60fps coords 
    // to avoid re-renders.
    
    // FIX: We will trust that whoever calls `broadcastMyState` passes the data,
    // OR we rely on what's in the store if it's updated there.
    // In `Player.tsx`, we should update the store throttled, or call this service directly.
    // For now, let's assume `LocalPlayer` updates the store via `updateLocalPlayerConfig` occasionally?
    // No, `LocalPlayer` uses refs. 
    
    // STRATEGY: `LocalPlayer` component will call `networkService.sendUpdate(...)` inside useFrame.
  }

  // Called directly from LocalPlayer useFrame
  sendMyUpdate(data: any) {
    if (!this.room || !this.sendAction) return;
    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) return;

    this.sendAction(data);
    this.lastUpdate = now;
  }

  sendReaction(emoji: string) {
      if(this.sendReactionAction) this.sendReactionAction(emoji);
  }

  sendTeleportRequest(targetId: string, myName: string) {
      if(this.sendTeleportAction) this.sendTeleportAction({ type: 'request', name: myName }, targetId);
  }

  sendTeleportResponse(targetId: string, accepted: boolean) {
      if(this.sendTeleportAction) this.sendTeleportAction({ type: 'response', accepted }, targetId);
  }

  addStream(stream: MediaStream, type: 'audio' | 'screen') {
      if(this.room) {
          this.room.addStream(stream, { type });
      }
  }

  removeStream(stream: MediaStream) {
      if(this.room) {
          this.room.removeStream(stream);
      }
  }

  disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}

export const networkService = new NetworkService();
