
import { joinRoom } from 'trystero';
import { useStore } from '../store';
import { PlayerState } from '../types';

const APP_ID = 'room8_3d_meet_v2'; // Bumped version to ensure fresh peers

class NetworkService {
  private room: any = null;
  private sendAction: any = null;
  private sendReactionAction: any = null;
  private sendTeleportAction: any = null;
  
  // Throttle updates
  private lastUpdate = 0;
  private updateInterval = 50; // ms
  private heartbeatInterval: any = null;

  connect(roomId: string) {
    if (this.room) this.disconnect();

    console.log(`[Network] Connecting to room: ${roomId}`);
    // Using a simpler config for trystero to ensure better connectivity
    this.room = joinRoom({ appId: APP_ID, password: roomId }, 'room8_channel');

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
        // We defer this slightly to ensure the peer is ready to receive
        setTimeout(() => this.broadcastMyState(true), 500);
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
            const targetPeer = useStore.getState().peers[peerId];
            if (targetPeer) {
                window.dispatchEvent(new CustomEvent('teleport-to', { detail: targetPeer.position }));
            }
        }
    });

    // 4. Heartbeat to keep connection alive and sync new peers who might have missed join event
    this.heartbeatInterval = setInterval(() => {
        this.broadcastMyState(true);
    }, 2000);
  }

  broadcastMyState(force = false) {
    // This method is called by the heartbeat. 
    // It grabs the latest state from the LocalPlayer via the store if available, 
    // but the store's localPlayer doesn't update at 60fps.
    // The reliable way is to let LocalPlayer drive the high-freq updates, 
    // and use this for "I am here" presence.
    
    // We send a lightweight ping with the basic config if we aren't moving
    if (!this.room || !this.sendAction) return;
    
    const { localPlayer, micEnabled, screenShareEnabled } = useStore.getState();
    // Note: Position here might be stale (0,0,0) if we only rely on store.
    // However, the `LocalPlayer` component calls `sendMyUpdate` every frame when moving.
    // We only need this heartbeat to ensure existence is known.
    
    // We can't easily get the ref position from here. 
    // So we just send the static config. The movement updates will handle the rest.
    // Peers will create the entity at (0,0,0) or last known pos.
    
    this.sendAction({
        ...localPlayer,
        isMicOn: micEnabled,
        isScreenSharing: screenShareEnabled
    });
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
    if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
    }
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}

export const networkService = new NetworkService();
