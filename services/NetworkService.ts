
import { joinRoom } from 'trystero';
import { useStore } from '../store';
import { PlayerState } from '../types';

// CRITICAL FIX: Updated App ID + Added RTC Config with STUN
// STUN servers are required for peers to connect across different networks (NAT traversal).
// Without STUN, WebRTC often fails to establish a connection.
const APP_ID = 'room8_v14_lowlat'; 

class NetworkService {
  private room: any = null;
  private sendAction: any = null;
  private sendReactionAction: any = null;
  private sendTeleportAction: any = null;
  private sendFriendAction: any = null;
  
  // Throttle updates
  private lastUpdate = 0;
  private updateInterval = 30; // Lowered to 30ms for smoother, real-time sync
  private heartbeatInterval: any = null;

  // Cache last known position to send on heartbeat even if not moving
  private lastPosition: [number, number, number] | null = null;
  private lastRotation: [number, number, number] | null = null;

  connect(roomId: string) {
    if (this.room) this.disconnect();

    // Ensure strictly uppercase ID for matching consistency
    const cleanId = roomId.trim().toUpperCase();

    console.log(`[Network] Connecting to room: ${cleanId} (AppID: ${APP_ID})`);
    
    // Explicit configuration with robust trackers AND STUN servers
    const config = { 
        appId: APP_ID,
        trackerUrls: [
            'wss://tracker.webtorrent.dev',
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.files.fm:7073/announce',
            'wss://tracker.btorrent.xyz'
        ],
        rtcConfig: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    };

    this.room = joinRoom(config, cleanId);

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
        
        // Retrigger streams after a slight delay to ensure P2P handshake is done
        setTimeout(() => {
            if(!this.room) return;
            const { micStream, screenStream } = useStore.getState();
            if (micStream) this.room.addStream(micStream, peerId, { type: 'audio' });
            if (screenStream) this.room.addStream(screenStream, peerId, { type: 'screen' });
        }, 1500); 
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
    // Send immediately to announce presence to anyone already in the room
    this.broadcastMyState(true);
    
    // Multiple broadcasts to ensure arrival over UDP/WebRTC
    setTimeout(() => this.broadcastMyState(true), 500);
    setTimeout(() => this.broadcastMyState(true), 1500);
    setTimeout(() => this.broadcastMyState(true), 3000);

    this.heartbeatInterval = setInterval(() => {
        this.broadcastMyState(true);
    }, 1000); // Heartbeat
  }

  // Sends the full state, utilizing cached position if available
  broadcastMyState(force = false) {
    if (!this.room || !this.sendAction) return;
    const { localPlayer, micEnabled, screenShareEnabled } = useStore.getState();
    
    const payload = {
        ...localPlayer,
        isMicOn: micEnabled,
        isScreenSharing: screenShareEnabled,
        // Include cached position if we have it
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
          // Add stream with a small delay to ensure room mesh is ready
          setTimeout(() => {
             if(this.room) this.room.addStream(stream, null, { type });
          }, 500);
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
