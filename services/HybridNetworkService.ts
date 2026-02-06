
import { io, Socket } from 'socket.io-client';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track, Participant } from 'livekit-client';
import { useStore } from '../store';

/**
 * HYBRID NETWORK SERVICE
 * 
 * Strategy:
 * 1. Fetch Room Config from Backend.
 * 2. If P2P (<= 5 users): Use Socket.io + RTCPeerConnection.
 * 3. If SFU (> 5 users): Use LiveKit.
 */

const BACKEND_URL = 'http://localhost:3000'; // Change to your deployed backend URL

interface ConnectionStrategy {
    connect(roomId: string, config: any): Promise<void>;
    disconnect(): void;
    sendMyUpdate(data: any): void;
    addStream(stream: MediaStream, type: 'audio' | 'screen'): void;
    removeStream(stream: MediaStream): void;
    sendReaction(emoji: string): void;
}

// --- STRATEGY 1: P2P (Socket.io + RTCPeerConnection) ---
class P2PStrategy implements ConnectionStrategy {
    private socket: Socket | null = null;
    private peers: Record<string, RTCPeerConnection> = {};
    private myStreams: { stream: MediaStream, type: 'audio' | 'screen' }[] = [];
    private roomId: string = '';

    // Free STUN servers from Google
    private rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    };

    async connect(roomId: string, config: any) {
        this.roomId = roomId;
        this.socket = io(BACKEND_URL);

        this.socket.on('connect', () => {
            console.log('[P2P] Connected to Signaling Server');
            this.socket?.emit('join-room', roomId, useStore.getState().localPlayer.id);
        });

        // 1. User Joined -> Create Offer
        this.socket.on('user-connected', async (userId) => {
            console.log('[P2P] User connected:', userId);
            await this.createPeerConnection(userId, true);
        });

        // 2. Handle Signaling Data
        this.socket.on('offer', async (userId, description) => {
            const pc = await this.createPeerConnection(userId, false);
            await pc.setRemoteDescription(description);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.socket?.emit('answer', userId, answer);
        });

        this.socket.on('answer', async (userId, description) => {
            const pc = this.peers[userId];
            if (pc) await pc.setRemoteDescription(description);
        });

        this.socket.on('ice-candidate', async (userId, candidate) => {
            const pc = this.peers[userId];
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        });

        this.socket.on('user-disconnected', (userId) => {
            if (this.peers[userId]) {
                this.peers[userId].close();
                delete this.peers[userId];
                useStore.getState().removePeer(userId);
            }
        });

        // Custom Data Events
        this.socket.on('player-update', (userId, data) => {
            useStore.getState().updatePeer(userId, { ...data, id: userId });
        });

        this.socket.on('reaction', (userId, emoji) => {
            useStore.getState().updatePeer(userId, { lastReaction: emoji, lastReactionTs: Date.now() });
        });
    }

    private async createPeerConnection(userId: string, initiator: boolean) {
        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peers[userId] = pc;

        // Add local tracks
        this.myStreams.forEach(ms => {
            ms.stream.getTracks().forEach(track => pc.addTrack(track, ms.stream));
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket?.emit('ice-candidate', userId, event.candidate);
            }
        };

        pc.ontrack = (event) => {
            console.log(`[P2P] Received track from ${userId}`);
            // Infer type by track kind for simple logic, or use signaling metadata
            const type = event.track.kind === 'video' ? 'screen' : 'audio'; 
            useStore.getState().addStream(userId, event.streams[0], { type });
        };

        if (initiator) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.socket?.emit('offer', userId, offer);
        }

        return pc;
    }

    sendMyUpdate(data: any) {
        this.socket?.emit('player-update', this.roomId, data);
    }

    sendReaction(emoji: string) {
        this.socket?.emit('reaction', this.roomId, emoji);
    }

    addStream(stream: MediaStream, type: 'audio' | 'screen') {
        this.myStreams.push({ stream, type });
        // Add to existing connections
        Object.values(this.peers).forEach(pc => {
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
                // Note: Renegotiation logic is omitted for brevity but required for adding streams mid-call in production
            });
        });
    }

    removeStream(stream: MediaStream) {
        this.myStreams = this.myStreams.filter(s => s.stream.id !== stream.id);
        Object.values(this.peers).forEach(pc => {
            const senders = pc.getSenders();
            senders.forEach(sender => {
                if (sender.track && stream.getTracks().includes(sender.track)) {
                    pc.removeTrack(sender);
                }
            });
        });
    }

    disconnect() {
        this.socket?.disconnect();
        Object.values(this.peers).forEach(pc => pc.close());
        this.peers = {};
    }
}

// --- STRATEGY 2: LiveKit (SFU) ---
class LiveKitStrategy implements ConnectionStrategy {
    private room: Room | null = null;

    async connect(roomId: string, config: any) {
        // config contains { token, url } from backend
        this.room = new Room();
        
        await this.room.connect(config.url, config.token);
        console.log('[LiveKit] Connected to Room:', this.room.name);

        this.room
            .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
                    const type = track.kind === Track.Kind.Video ? 'screen' : 'audio';
                    const mediaStream = new MediaStream([track.mediaStreamTrack]);
                    useStore.getState().addStream(participant.identity, mediaStream, { type });
                }
            })
            .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
               // Cleanup handled by store usually, or explicit remove
            })
            .on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
                if (!participant) return;
                const str = new TextDecoder().decode(payload);
                const data = JSON.parse(str);

                if (topic === 'update') {
                    useStore.getState().updatePeer(participant.identity, { ...data, id: participant.identity });
                } else if (topic === 'reaction') {
                    useStore.getState().updatePeer(participant.identity, { lastReaction: data.emoji, lastReactionTs: Date.now() });
                }
            })
            .on(RoomEvent.ParticipantDisconnected, (participant) => {
                useStore.getState().removePeer(participant.identity);
                useStore.getState().removeStream(participant.identity);
            });
    }

    sendMyUpdate(data: any) {
        if (!this.room) return;
        const str = JSON.stringify(data);
        const bytes = new TextEncoder().encode(str);
        this.room.localParticipant.publishData(bytes, { reliable: false, topic: 'update' });
    }

    sendReaction(emoji: string) {
        if (!this.room) return;
        const str = JSON.stringify({ emoji });
        const bytes = new TextEncoder().encode(str);
        this.room.localParticipant.publishData(bytes, { reliable: true, topic: 'reaction' });
    }

    async addStream(stream: MediaStream, type: 'audio' | 'screen') {
        if (!this.room) return;
        const tracks = stream.getTracks();
        for (const track of tracks) {
            if (track.kind === 'audio') {
                await this.room.localParticipant.publishTrack(track);
            } else if (track.kind === 'video') {
                await this.room.localParticipant.publishTrack(track);
            }
        }
    }

    removeStream(stream: MediaStream) {
        if (!this.room) return;
        stream.getTracks().forEach(track => {
            const pub = this.room!.localParticipant.getTrackPublication(track.id as any); // Simplification
            if (pub) this.room!.localParticipant.unpublishTrack(track);
        });
    }

    disconnect() {
        this.room?.disconnect();
    }
}

// --- MANAGER ---
class HybridNetworkService {
    private activeStrategy: ConnectionStrategy | null = null;

    async connect(roomId: string) {
        try {
            // 1. Ask Backend for Room Config (Mode + Tokens)
            const response = await fetch(`${BACKEND_URL}/api/join?room=${roomId}&userId=${useStore.getState().localPlayer.id}`);
            const config = await response.json();

            // 2. Select Strategy
            if (config.mode === 'livekit') {
                console.log('[Network] Mode: LiveKit (SFU)');
                this.activeStrategy = new LiveKitStrategy();
            } else {
                console.log('[Network] Mode: P2P (Socket.io)');
                this.activeStrategy = new P2PStrategy();
            }

            // 3. Connect
            await this.activeStrategy.connect(roomId, config);

        } catch (e) {
            console.error("Backend Connection Failed. Is the Node.js server running?", e);
            alert("Backend error. Check console.");
        }
    }

    disconnect() {
        this.activeStrategy?.disconnect();
        this.activeStrategy = null;
    }

    sendMyUpdate(data: any) {
        this.activeStrategy?.sendMyUpdate(data);
    }

    sendReaction(emoji: string) {
        this.activeStrategy?.sendReaction(emoji);
    }

    addStream(stream: MediaStream, type: 'audio' | 'screen') {
        this.activeStrategy?.addStream(stream, type);
    }

    removeStream(stream: MediaStream) {
        this.activeStrategy?.removeStream(stream);
    }
    
    // Compatibility stubs for existing calls that might exist
    sendTeleportRequest() {} 
    sendFriendRequest() {}
    // ... implement these similarly via data channels/socket events
}

export const hybridNetworkService = new HybridNetworkService();
