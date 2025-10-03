import socketService from './socketService';

export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private mediaStreamCallbacks: Map<string, (stream: MediaStream, participantId: string) => void> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private isAudioEnabled = true;
  private isVideoEnabled = true;
  private isScreenSharing = false;

  constructor() {
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    socketService.onOffer(this.handleOffer.bind(this));
    socketService.onAnswer(this.handleAnswer.bind(this));
    socketService.onIceCandidate(this.handleIceCandidate.bind(this));
    socketService.onScreenShareOffer(this.handleScreenShareOffer.bind(this));
    socketService.onScreenShareAnswer(this.handleScreenShareAnswer.bind(this));
    socketService.onScreenShareIceCandidate(this.handleScreenShareIceCandidate.bind(this));
  }

  // Initialize local media (camera and microphone)
  async initializeLocalMedia(): Promise<MediaStream | null> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      console.log('✅ Local media initialized');
      return this.localStream;
    } catch (error) {
      console.error('❌ Failed to initialize local media:', error);
      throw error;
    }
  }

  // Create peer connection for a participant
  private createPeerConnection(participantId: string): RTCPeerConnection {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    
    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      console.log('📺 Received remote stream from', participantId);
      if (event.streams && event.streams[0]) {
        this.remoteStreams.set(participantId, event.streams[0]);
        const callback = this.mediaStreamCallbacks.get('remoteStream');
        if (callback) {
          callback(event.streams[0], participantId);
        }
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(event.candidate, participantId);
      }
    };

    // Add local stream to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) {
          peerConnection.addTrack(track, this.localStream);
        }
      });
    }

    this.peerConnections.set(participantId, peerConnection);
    return peerConnection;
  }

  // Handle incoming offer
  private async handleOffer(data: any): Promise<void> {
    try {
      const { offer, from } = data;
      const peerConnection = this.createPeerConnection(from);
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      socketService.sendAnswer(answer, from);
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  }

  // Handle incoming answer
  private async handleAnswer(data: any): Promise<void> {
    try {
      const { answer, from } = data;
      const peerConnection = this.peerConnections.get(from);
      
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }

  // Handle incoming ICE candidate
  private async handleIceCandidate(data: any): Promise<void> {
    try {
      const { candidate, from } = data;
      const peerConnection = this.peerConnections.get(from);
      
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  }

  // Create offer for a new participant
  async createOffer(participantId: string): Promise<void> {
    try {
      const peerConnection = this.createPeerConnection(participantId);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socketService.sendOffer(offer, participantId);
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  }

  // Toggle audio
  toggleAudio(): boolean {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.isAudioEnabled = !this.isAudioEnabled;
      socketService.toggleAudio(this.isAudioEnabled);
      return this.isAudioEnabled;
    }
    return false;
  }

  // Toggle video
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.isVideoEnabled = !this.isVideoEnabled;
      socketService.toggleVideo(this.isVideoEnabled);
      return this.isVideoEnabled;
    }
    return false;
  }

  // Start screen sharing
  async startScreenShare(): Promise<MediaStream | null> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      this.isScreenSharing = true;
      socketService.startScreenShare();

      // Replace video track in all peer connections
      const videoTrack = this.screenStream.getVideoTracks()[0];
      this.peerConnections.forEach(async (peerConnection, participantId) => {
        const sender = peerConnection.getSenders().find((s: RTCRtpSender) => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      });

      // Listen for screen share end
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      return this.screenStream;
    } catch (error) {
      console.error('❌ Failed to start screen sharing:', error);
      throw error;
    }
  }

  // Stop screen sharing
  async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
      this.isScreenSharing = false;
      socketService.stopScreenShare();

      // Replace back to camera
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        this.peerConnections.forEach(async (peerConnection, participantId) => {
          const sender = peerConnection.getSenders().find((s: RTCRtpSender) => 
            s.track && s.track.kind === 'video'
          );
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
          }
        });
      }
    }
  }

  // Screen sharing signaling handlers
  private async handleScreenShareOffer(data: any): Promise<void> {
    // Handle screen share offers from other participants
    console.log('📺 Received screen share offer:', data);
  }

  private async handleScreenShareAnswer(data: any): Promise<void> {
    // Handle screen share answers
    console.log('📺 Received screen share answer:', data);
  }

  private async handleScreenShareIceCandidate(data: any): Promise<void> {
    // Handle screen share ICE candidates
    console.log('📺 Received screen share ICE candidate:', data);
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote streams
  getRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  // Set callback for remote streams
  onRemoteStream(callback: (stream: MediaStream, participantId: string) => void): void {
    this.mediaStreamCallbacks.set('remoteStream', callback);
  }

  // Get media states
  getMediaStates(): { audio: boolean; video: boolean; screenSharing: boolean } {
    return {
      audio: this.isAudioEnabled,
      video: this.isVideoEnabled,
      screenSharing: this.isScreenSharing
    };
  }

  // Clean up resources
  cleanup(): void {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Stop screen stream
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    this.peerConnections.forEach((peerConnection, participantId) => {
      peerConnection.close();
    });

    // Clear maps
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.mediaStreamCallbacks.clear();
  }

  // Remove participant
  removeParticipant(participantId: string): void {
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
    }
    this.remoteStreams.delete(participantId);
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService();
export default webrtcService;