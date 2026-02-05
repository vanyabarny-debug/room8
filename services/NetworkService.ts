
import { joinRoom } from 'trystero';
import { useStore } from '../store';
import { PlayerState } from '../types';

// RE-THINK: New App ID to reset all peer discovery.
const APP_ID = 'room8_v15_reborn'; 

class NetworkService {
  private room: any = null;
  
  // Action handles
  private actions: Record<string, any> = {};
  
  // State throttling
  private lastUpdate = 0;
  private updateInterval = 30; // 30ms for smooth movement
  
  // Intervals
  private heartbeatInterval: any = null;
  private burstInterval: any = null;

  // Cache to send reliable heartbeats
  private cachedState: any = null;

  connect(roomId: string) {
    // 1. Cleanup previous connection if exists
    this.disconnect();

    const cleanId = roomId.trim().toUpperCase();
    console.log(`[Network] 🚀 Connecting to ${cleanId}...`);

    // 2. Massive Tracker List for redundancy
    const config = { 
        appId: APP_ID,
        trackerUrls: [
            'wss://tracker.webtorrent.dev',
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.files.fm:7073/announce',
            'wss://tracker.btorrent.xyz',
            'wss://tracker.sloppyta.co:443/announce',
            'wss://tracker.novage.com.ua:443/announce',
            'wss://tracker.lab.vvc.niif.hu:443/announce'
        ],
        rtcConfig: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    };

    // 3. Initialize Room
    try {
        this.room = joinRoom(config, cleanId);
    } catch (e) {
        console.error("Failed to join room:", e);
        return;
    }

    // 4. Register Actions (Data Channels)
    const [sendUpdate, getUpdate] = this.room.makeAction('pUp'); // Shortened keys for less bandwidth
    const [sendReaction, getReaction] = this.room.makeAction('re');
    const [sendTeleport, getTeleport] = this.room.makeAction('tp');
    const [sendFriend, getFriend] = this.room.makeAction('fr');

    this.actions = {
        update: sendUpdate,
        reaction: sendReaction,
        teleport: sendTeleport,
        friend: sendFriend
    };

    // 5. Peer Lifecycle
    this.room.onPeerJoin((peerId: string) => {
        console.log(`[Network] 👋 Peer Found: ${peerId}`);
        
        // Immediate handshake
        this.broadcastMyState(true);

        // Safe stream adding with retry
        this.retryAddStreams(peerId);
    });

    this.room.onPeerLeave((peerId: string) => {
        console.log(`[Network] 💨 Peer Lost: ${peerId}`);
        useStore.getState().removePeer(peerId);
        useStore.getState().removeStream(peerId);
    });

    this.room.onPeerStream((stream: MediaStream, peerId: string, metadata: any) => {
        const meta = metadata || { type: 'audio' };
        console.log(`[Network] 📡 Stream from ${peerId} (${meta.type})`);
        useStore.getState().addStream(peerId, stream, meta);
    });

    // 6. Data Handlers
    getUpdate((data: any, peerId: string) => {
        // Direct update to store
        useStore.getState().updatePeer(peerId, { ...data, id: peerId });
    });

    getReaction((emoji: string, peerId: string) => {
        useStore.getState().updatePeer(peerId, { 
            lastReaction: emoji, 
            lastReactionTs: Date.now() 
        });
    });

    getTeleport((data: any, peerId: string) => {
        if (data.t === 'req') {
            useStore.getState().setIncomingTeleport({ fromId: peerId, fromName: data.n });
        } else if (data.t === 'res' && data.ok) {
            const targetPeer = useStore.getState().peers[peerId];
            if (targetPeer) {
                window.dispatchEvent(new CustomEvent('teleport-to', { detail: targetPeer.position }));
            }
        }
    });

    getFriend((data: any, peerId: string) => {
        if (data.t === 'req') {
            useStore.getState().setIncomingFriendRequest({ fromId: peerId, fromName: data.n });
        } else if (data.t === 'res' && data.ok) {
            useStore.getState().addFriend(peerId);
        }
    });

    // 7. STARTUP SEQUENCE
    // "Burst Mode": Send state rapidly for 5 seconds to ensure discovery
    let burstCount = 0;
    this.burstInterval = setInterval(() => {
        this.broadcastMyState(true);
        burstCount++;
        if (burstCount > 50) { // Stop after ~5 seconds (50 * 100ms)
            clearInterval(this.burstInterval);
            this.burstInterval = null;
        }
    }, 100);

    // Heartbeat: Ensure we stay alive in other's view every 1s
    this.heartbeatInterval = setInterval(() => {
        this.broadcastMyState(true);
    }, 1000);
  }

  // --- Methods ---

  private retryAddStreams(peerId: string, attempt = 1) {
      if (!this.room || attempt > 3) return;
      
      const { micStream, screenStream } = useStore.getState();
      
      try {
          if (micStream) this.room.addStream(micStream, peerId, { type: 'audio' });
          if (screenStream) this.room.addStream(screenStream, peerId, { type: 'screen' });
      } catch (e) {
          console.warn(`[Network] Stream add failed for ${peerId}, retrying...`);
          setTimeout(() => this.retryAddStreams(peerId, attempt + 1), 1000);
      }
  }

  broadcastMyState(force = false) {
    if (!this.room || !this.actions.update) return;

    // Prepare Payload
    const state = useStore.getState();
    const payload = {
        name: state.localPlayer.name,
        color: state.localPlayer.color,
        shape: state.localPlayer.shape,
        position: this.cachedState?.position || state.localPlayer.position || [0,0,0],
        rotation: this.cachedState?.rotation || state.localPlayer.rotation || [0,0,0],
        isMoving: state.isLocalPlayerMoving,
        isMicOn: state.micEnabled,
        isScreenSharing: state.screenShareEnabled,
        // Send small flags to save bandwidth
        isBot: false 
    };

    // Throttle checks
    const now = Date.now();
    if (!force && now - this.lastUpdate < this.updateInterval) return;

    this.actions.update(payload);
    this.lastUpdate = now;
  }

  // External Access Methods
  sendMyUpdate(data: any) {
      // Cache position for heartbeats (so we don't send [0,0,0] if standing still)
      if (data.position) {
          this.cachedState = { ...this.cachedState, position: data.position };
      }
      if (data.rotation) {
          this.cachedState = { ...this.cachedState, rotation: data.rotation };
      }
      
      this.broadcastMyState();
  }

  sendReaction(emoji: string) {
      if(this.actions.reaction) this.actions.reaction(emoji);
  }

  sendTeleportRequest(targetId: string, myName: string) {
      if(this.actions.teleport) this.actions.teleport({ t: 'req', n: myName }, targetId);
  }

  sendTeleportResponse(targetId: string, accepted: boolean) {
      if(this.actions.teleport) this.actions.teleport({ t: 'res', ok: accepted }, targetId);
  }

  sendFriendRequest(targetId: string, myName: string) {
      if(this.actions.friend) this.actions.friend({ t: 'req', n: myName }, targetId);
  }

  sendFriendResponse(targetId: string, accepted: boolean) {
      if(this.actions.friend) this.actions.friend({ t: 'res', ok: accepted }, targetId);
  }

  addStream(stream: MediaStream, type: 'audio' | 'screen') {
      if(this.room) {
          // Add to all existing peers safely
          try {
             this.room.addStream(stream, null, { type });
          } catch(e) {
              console.error("[Network] Global addStream error", e);
          }
      }
  }

  removeStream(stream: MediaStream) {
      if(this.room) {
          try {
            this.room.removeStream(stream);
          } catch(e) { console.warn("Remove stream error", e); }
      }
  }

  disconnect() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.burstInterval) clearInterval(this.burstInterval);
    
    if (this.room) {
      try {
        this.room.leave();
      } catch(e) { console.error("Leave room error", e); }
      this.room = null;
    }
    
    this.actions = {};
    this.cachedState = null;
  }
}

export const networkService = new NetworkService();
