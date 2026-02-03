
import { joinRoom } from 'trystero';
import { useStore } from '../store';
import { PlayerState } from '../types';

// Updated App ID to ensure fresh connections
const APP_ID = 'room8_v6_p2p_fix'; 

class NetworkService {
  private room: any = null;
  private sendAction: any = null;
  private sendReactionAction: any = null;
  private sendTeleportAction: any = null;
  private sendFriendAction: any = null;
  
  // Throttle updates
  private lastUpdate = 0;
  private updateInterval = 50; // ms
  private heartbeatInterval: any = null;

  // Cache last known position to send on heartbeat even if not moving
  private lastPosition: [number, number, number] | null = null;
  private lastRotation: [number, number, number] | null = null;

  connect(roomId: string) {
    if (this.room) this.disconnect();

    console.log(`[Network] Connecting to room: ${roomId}`);
    
    // FIX: Use roomId as the Trystero room ID (namespace) directly.
    // Removed password to ensure maximum compatibility and visibility.
    // Privacy is handled by the randomness of the roomId itself for private rooms.
    this.room = joinRoom({ appId: APP_ID }, roomId);

    // 1. Data Channels
    const [sendUpdate, getUpdate] = this.room.makeAction('playerUpdate');
    const [sendReaction, getReaction] = this.room.makeAction('reaction');
    const [sendTeleport, getTeleport] = this.room.makeAction('teleport');
    const [sendFriend, getFriend] = this.room.makeAction('friend');

    this.sendAction = sendUpdate;
    this.sendReactionAction = sendReaction;
    this.sendTeleportAction = sendTeleport;
    this.sendFriendAction = sendFriend;

    // 2. Event Listeners
    this.room.onPeerJoin((peerId: string) => {
        console.log(`[Network] Peer joined: ${peerId}`);
        // Immediately send my full state to the new peer
        this.broadcastMyState(true);
    });

    this.room.onPeerLeave((peerId: string) => {
        console.log(`[Network] Peer left: ${peerId}`);
        useStore.getState().removePeer(peerId);
        useStore.getState().removeStream(peerId);
    });

    this.room.onPeerStream((stream: MediaStream, peerId: string, metadata: any) => {
        console.log(`[Network] Received stream from ${peerId}`, metadata);
        // Ensure we pass valid metadata or default to audio
        const meta = metadata || { type: 'audio' };
        useStore.getState().addStream(peerId, stream, meta);
    });

    // 3. Handle Incoming Data
    getUpdate((data: Partial<PlayerState>, peerId: string) => {
        // If we receive data, we update the peer
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

    getFriend((data: any, peerId: string) => {
        if (data.type === 'request') {
            useStore.getState().setIncomingFriendRequest({ fromId: peerId, fromName: data.name });
        } else if (data.type === 'response' && data.accepted) {
            useStore.getState().addFriend(peerId);
        }
    });

    // 4. Heartbeat & Initial Broadcast
    // Send immediately
    this.broadcastMyState(true);
    
    // And a bit later to ensure connection stabilization
    setTimeout(() => this.broadcastMyState(true), 1000);

    this.heartbeatInterval = setInterval(() => {
        this.broadcastMyState(true);
    }, 2000);
  }

  // Sends the full state, utilizing cached position if available
  broadcastMyState(force = false) {
    if (!this.room || !this.sendAction) return;
    const { localPlayer, micEnabled, screenShareEnabled } = useStore.getState();
    
    const payload = {
        ...localPlayer,
        isMicOn: micEnabled,
        isScreenSharing: screenShareEnabled,
        // Include cached position if we have it (from previous movement updates)
        // This ensures standing still doesn't make us invisible/reset
        ...(this.lastPosition ? { position: this.lastPosition } : {}),
        ...(this.lastRotation ? { rotation: this.lastRotation } : {})
    };

    this.sendAction(payload);
  }

  // Called frequently by the game loop
  sendMyUpdate(data: any) {
    if (!this.room || !this.sendAction) return;
    
    // Cache position for heartbeats
    if (data.position) this.lastPosition = data.position;
    if (data.rotation) this.lastRotation = data.rotation;

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

  sendFriendRequest(targetId: string, myName: string) {
      if(this.sendFriendAction) this.sendFriendAction({ type: 'request', name: myName }, targetId);
  }

  sendFriendResponse(targetId: string, accepted: boolean) {
      if(this.sendFriendAction) this.sendFriendAction({ type: 'response', accepted }, targetId);
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
    // Clear caches
    this.lastPosition = null;
    this.lastRotation = null;
  }
}

export const networkService = new NetworkService();
