import { joinRoom } from 'trystero/torrent';
import { useStore } from '../store';
import { PlayerState } from '../types';

class NetworkService {
  private room: any;
  private updateAction: any;
  private chatAction: any;
  private reactionAction: any;
  private screenShareAction: any;
  
  public connect(roomId: string, initData: Partial<PlayerState>) {
    const appId = 'room9-metaverse-v2-fixed';
    
    // Config with STUN servers for better connectivity
    const config = { appId };
    
    this.room = joinRoom(config, roomId);
    
    // Set my ID in store
    const myId = this.room.selfId;
    useStore.getState().setMyId(myId);

    // Actions
    const [sendUpdate, getUpdate] = this.room.makeAction('pUp'); // Player Update
    const [sendChat, getChat] = this.room.makeAction('msg');
    const [sendReaction, getReaction] = this.room.makeAction('re');
    const [sendScreenMeta, getScreenMeta] = this.room.makeAction('scr'); // Screen Share Metadata

    this.updateAction = sendUpdate;
    this.chatAction = sendChat;
    this.reactionAction = sendReaction;
    this.screenShareAction = sendScreenMeta;

    // Handle Peer Joining
    this.room.onPeerJoin((peerId: string) => {
      console.log(`Peer joined: ${peerId}`);
      // Send immediate update so they know who we are
      this.broadcastMyState();
      
      // Initialize peer placeholder
      useStore.getState().updatePeer(peerId, {
        id: peerId,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        color: '#888',
        shape: 'box',
        nickname: 'Connecting...',
        faceSplitRatio: 0.5,
        isSpeaking: false,
        isLoudspeaker: false,
        isScreenSharing: false,
        lastUpdate: Date.now()
      });
    });

    // Handle Peer Leaving
    this.room.onPeerLeave((peerId: string) => {
      useStore.getState().removePeer(peerId);
    });

    // Handle Updates (High Frequency)
    getUpdate((data: any, peerId: string) => {
       useStore.getState().updatePeer(peerId, {
         position: data.p,
         rotation: data.r,
         color: data.c,
         shape: data.s,
         nickname: data.n,
         faceTexture: data.f,
         faceSplitRatio: data.fs,
         isSpeaking: data.v,
         isLoudspeaker: data.m,
         isScreenSharing: data.ss
       });
    });

    // Handle Chat
    getChat((text: string, peerId: string) => {
      const peer = useStore.getState().peers[peerId];
      useStore.getState().addMessage({
        id: Math.random().toString(36),
        senderId: peerId,
        senderName: peer?.nickname || 'Unknown',
        text,
        timestamp: Date.now()
      });
    });
    
    // Handle Reactions
    getReaction((emoji: string, peerId: string) => {
       // Toggle reaction on then off to ensure UI catches it even if same emoji sent twice
       useStore.getState().updatePeer(peerId, { reaction: emoji });
       setTimeout(() => {
         useStore.getState().updatePeer(peerId, { reaction: undefined });
       }, 2500);
    });

    // Handle Screen Share Metadata
    getScreenMeta((meta: any, peerId: string) => {
        // We might use this if we have multiple streams, 
        // but for now we detect video tracks vs audio tracks
    });

    // Handle Streams
    this.room.onPeerStream((stream: MediaStream, peerId: string, metadata: any) => {
       // Check tracks
       if (stream.getVideoTracks().length > 0) {
           // It's a screen share (since we don't have webcam video in avatar)
           useStore.getState().setScreenShare(peerId, stream);
           useStore.getState().updatePeer(peerId, { isScreenSharing: true });
       } else {
           // It's audio
           useStore.getState().addPeerStream(peerId, stream);
       }
    });
    
    // Add local mic stream if available
    const localStream = useStore.getState().localStream;
    if(localStream) {
        this.room.addStream(localStream);
    }
  }

  // Called periodically by SelfAvatar
  public sendUpdatePacket(data: any) {
    if(this.updateAction) this.updateAction(data);
  }

  // Force broadcast (e.g. on join)
  public broadcastMyState() {
      // Handled by the loop in SelfAvatar mainly, 
      // but could force one packet here if we stored local state in NetworkService
  }

  public sendChatMessage(text: string) {
    if(this.chatAction) this.chatAction(text);
  }

  public sendReaction(emoji: string) {
    if(this.reactionAction) this.reactionAction(emoji);
  }

  public shareScreen(stream: MediaStream) {
      if(this.room) {
          this.room.addStream(stream);
          this.sendScreenMeta({ active: true });
      }
  }

  private sendScreenMeta(data: any) {
      if(this.screenShareAction) this.screenShareAction(data);
  }

  public leave() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}

export const networkService = new NetworkService();