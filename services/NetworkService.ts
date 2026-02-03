
import { joinRoom } from 'trystero';
import { useStore } from '../store';
import { PlayerState } from '../types';

// Updated App ID to ensure fresh connections for everyone
const APP_ID = 'room8_v4_stable_connect'; 

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

  connect(roomId: string) {
    if (this.room) this.disconnect();

    console.log(`[Network] Connecting to room: ${roomId}`);
    // Using a specific namespace to avoid collisions
    this.room = joinRoom({ appId: APP_ID, password: roomId }, 'room8_main');

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
        // Immediately send my state to the new peer
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
            // They accepted my request, add them
            useStore.getState().addFriend(peerId);
        }
    });

    // 4. Heartbeat & Initial Broadcast
    // Broadcast immediately to announce presence to existing peers
    setTimeout(() => this.broadcastMyState(true), 500);
    setTimeout(() => this.broadcastMyState(true), 1500);

    this.heartbeatInterval = setInterval(() => {
        this.broadcastMyState(true);
    }, 2000);
  }

  broadcastMyState(force = false) {
    if (!this.room || !this.sendAction) return;
    const { localPlayer, micEnabled, screenShareEnabled } = useStore.getState();
    
    // Always send full state on heartbeat/join
    this.sendAction({
        ...localPlayer,
        isMicOn: micEnabled,
        isScreenSharing: screenShareEnabled
    });
  }

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

  sendFriendRequest(targetId: string, myName: string) {
      if(this.sendFriendAction) this.sendFriendAction({ type: 'request', name: myName }, targetId);
  }

  sendFriendResponse(targetId: string, accepted: boolean) {
      if(this.sendFriendAction) this.sendFriendAction({ type: 'response', accepted }, targetId);
  }

  addStream(stream: MediaStream, type: 'audio' | 'screen') {
      if(this.room) {
          // Explicitly pass metadata object
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
