import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
  meetingCode?: string;
}

export interface ParticipantEvent {
  participantId: string;
  participantName: string;
  isHost?: boolean;
  joinedAt?: string;
  leftAt?: string;
  meetingCode?: string;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    // Use environment variable or default to backend port
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://krishnabarasiya.space';
    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.IO server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
      this.isConnected = false;
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Join a meeting room for real-time updates
  joinMeetingRoom(meetingCode: string, participantName: string, participantId?: string, isHost?: boolean): void {
    if (this.socket) {
      this.socket.emit('join-meeting', {
        meetingCode,
        participantId: participantId || Date.now().toString(), // Generate ID if not provided
        participantName,
        isHost: isHost || false,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Leave a meeting room
  leaveMeetingRoom(meetingCode: string, participantName: string): void {
    if (this.socket) {
      this.socket.emit('leave-meeting', {
        meetingCode,
        participantName,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Send a chat message
  sendChatMessage(meetingCode: string, sender: string, message: string): void {
    if (this.socket) {
      const chatMessage: ChatMessage = {
        id: Date.now().toString(),
        sender,
        message,
        timestamp: new Date().toISOString(),
        meetingCode,
      };
      
      this.socket.emit('chat-message', chatMessage);
    }
  }

  // Listen for chat messages
  onChatMessage(callback: (message: ChatMessage) => void): void {
    if (this.socket) {
      this.socket.on('chat-message', callback);
    }
  }

  // Listen for participant joined events
  onParticipantJoined(callback: (data: ParticipantEvent) => void): void {
    if (this.socket) {
      this.socket.on('participant-joined', callback);
    }
  }

  // Listen for participant left events
  onParticipantLeft(callback: (data: ParticipantEvent) => void): void {
    if (this.socket) {
      this.socket.on('participant-left', callback);
    }
  }

  // Listen for error events
  onError(callback: (error: any) => void): void {
    if (this.socket) {
      this.socket.on('error', callback);
    }
  }

  // Remove all listeners for a specific event
  removeListener(event: string): void {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  // Remove all listeners
  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // WebRTC signaling methods
  sendOffer(offer: RTCSessionDescriptionInit, to?: string): void {
    if (this.socket) {
      this.socket.emit('offer', { offer, to });
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit, to?: string): void {
    if (this.socket) {
      this.socket.emit('answer', { answer, to });
    }
  }

  sendIceCandidate(candidate: RTCIceCandidate, to?: string): void {
    if (this.socket) {
      this.socket.emit('ice-candidate', { candidate, to });
    }
  }

  // Media control events
  toggleAudio(enabled: boolean): void {
    if (this.socket) {
      this.socket.emit('toggle-audio', { enabled });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.socket) {
      this.socket.emit('toggle-video', { enabled });
    }
  }

  // Screen sharing events
  startScreenShare(): void {
    if (this.socket) {
      this.socket.emit('start-screen-share', { timestamp: new Date().toISOString() });
    }
  }

  stopScreenShare(): void {
    if (this.socket) {
      this.socket.emit('stop-screen-share', { timestamp: new Date().toISOString() });
    }
  }

  sendScreenShareOffer(offer: RTCSessionDescriptionInit): void {
    if (this.socket) {
      this.socket.emit('screen-share-offer', { offer });
    }
  }

  sendScreenShareAnswer(answer: RTCSessionDescriptionInit): void {
    if (this.socket) {
      this.socket.emit('screen-share-answer', { answer });
    }
  }

  sendScreenShareIceCandidate(candidate: RTCIceCandidate): void {
    if (this.socket) {
      this.socket.emit('screen-share-ice-candidate', { candidate });
    }
  }

  // Event listeners for WebRTC signaling
  onOffer(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('offer', callback);
    }
  }

  onAnswer(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('answer', callback);
    }
  }

  onIceCandidate(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('ice-candidate', callback);
    }
  }

  onParticipantAudioToggle(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('participant-audio-toggle', callback);
    }
  }

  onParticipantVideoToggle(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('participant-video-toggle', callback);
    }
  }

  onScreenShareStarted(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('screen-share-started', callback);
    }
  }

  onScreenShareStopped(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('screen-share-stopped', callback);
    }
  }

  onScreenShareOffer(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('screen-share-offer', callback);
    }
  }

  onScreenShareAnswer(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('screen-share-answer', callback);
    }
  }

  onScreenShareIceCandidate(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('screen-share-ice-candidate', callback);
    }
  }
}

// Export a singleton instance
export const socketService = new SocketService();
export default socketService;