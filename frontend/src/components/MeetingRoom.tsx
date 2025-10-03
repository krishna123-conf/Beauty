import React, { useState, useEffect, useRef } from 'react';
import { LiveCourse, Participant, liveCourseAPI } from '../services/apiService';
import socketService, { ChatMessage } from '../services/socketService';
import webrtcService from '../services/webrtcService';
import ParticipantsList from './ParticipantsList';
import ChatPanel from './ChatPanel';

interface MeetingRoomProps {
  meeting: LiveCourse;
  currentParticipant: Participant;
  onLeaveMeeting: () => void;
  onError: (error: string) => void;
  onCourseCompleted?: (course: LiveCourse) => void;
}

const MeetingRoom: React.FC<MeetingRoomProps> = ({ 
  meeting, 
  currentParticipant, 
  onLeaveMeeting, 
  onError,
  onCourseCompleted
}) => {
  const [participants, setParticipants] = useState<Participant[]>([currentParticipant]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [meetingInfo, setMeetingInfo] = useState<LiveCourse>(meeting);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isInitializingMedia, setIsInitializingMedia] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initializeMedia = async () => {
      setIsInitializingMedia(true);
      try {
        // Initialize local media
        const stream = await webrtcService.initializeLocalMedia();
        if (stream && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error: any) {
        console.error('Failed to initialize media:', error);
        onError('Failed to access camera/microphone. Please check permissions.');
      } finally {
        setIsInitializingMedia(false);
      }
    };

    // Connect to Socket.IO and join meeting room
    socketService.connect();
    
    // Only join meeting room if we have a meeting code
    if (meeting.meetingCode) {
      socketService.joinMeetingRoom(
        meeting.meetingCode, 
        currentParticipant.name, 
        currentParticipant.id,
        currentParticipant.isHost
      );
    } else {
      console.warn('No meeting code available, skipping socket room join');
      onError('Meeting room not properly initialized. Please try reconnecting.');
    }

    // Initialize media
    initializeMedia();

    // Load existing participants
    loadParticipants();

    // Set up socket event listeners
    socketService.onChatMessage((message: ChatMessage) => {
      setChatMessages(prev => [...prev, message]);
    });

    socketService.onParticipantJoined((data) => {
      setParticipants(prev => {
        // Check if participant already exists
        const exists = prev.some(p => p.id === data.participantId);
        if (!exists) {
          const newParticipant: Participant = {
            id: data.participantId,
            name: data.participantName,
            isHost: data.isHost || false,
            joinedAt: data.joinedAt || new Date().toISOString()
          };
          return [...prev, newParticipant];
        }
        return prev;
      });
      
      // Add system message
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'System',
        message: `${data.participantName} joined the meeting`,
        timestamp: new Date().toISOString(),
        meetingCode: meeting.meetingCode,
      };
      setChatMessages(prev => [...prev, systemMessage]);

      // Create WebRTC offer for the new participant
      webrtcService.createOffer(data.participantId);
    });

    socketService.onParticipantLeft((data) => {
      setParticipants(prev => prev.filter(p => p.id !== data.participantId));
      
      // Add system message
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'System',
        message: `${data.participantName} left the meeting`,
        timestamp: new Date().toISOString(),
        meetingCode: meeting.meetingCode,
      };
      setChatMessages(prev => [...prev, systemMessage]);

      // Remove participant from WebRTC
      webrtcService.removeParticipant(data.participantId);
    });

    // Set up WebRTC event listeners
    webrtcService.onRemoteStream((stream: MediaStream) => {
      // Handle remote video streams
      console.log('📺 Received remote stream:', stream);
      // You can add logic here to display remote streams
    });

    // Set up media control listeners
    socketService.onParticipantAudioToggle((data) => {
      console.log(`🎤 ${data.participantName} ${data.audioEnabled ? 'enabled' : 'disabled'} audio`);
    });

    socketService.onParticipantVideoToggle((data) => {
      console.log(`📹 ${data.participantName} ${data.videoEnabled ? 'enabled' : 'disabled'} video`);
    });

    socketService.onScreenShareStarted((data) => {
      console.log(`🖥️ ${data.hostName} started screen sharing`);
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'System',
        message: `${data.hostName} started screen sharing`,
        timestamp: new Date().toISOString(),
        meetingCode: meeting.meetingCode,
      };
      setChatMessages(prev => [...prev, systemMessage]);
    });

    socketService.onScreenShareStopped((data) => {
      console.log(`🖥️ ${data.hostName} stopped screen sharing`);
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'System',
        message: `${data.hostName} stopped screen sharing`,
        timestamp: new Date().toISOString(),
        meetingCode: meeting.meetingCode,
      };
      setChatMessages(prev => [...prev, systemMessage]);
    });

    socketService.onError((error) => {
      console.error('Socket error:', error);
      onError(error.message || 'Connection error occurred');
    });

    // Cleanup on unmount
    return () => {
      if (meeting.meetingCode) {
        socketService.leaveMeetingRoom(meeting.meetingCode, currentParticipant.name);
      }
      socketService.removeAllListeners();
      webrtcService.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.meetingCode, currentParticipant.name]);

  const loadParticipants = async () => {
    try {
      // For now, we'll rely on socket events to manage participants
      // The deprecated meetingAPI.getMeetingParticipants is no longer used
      // Participants are managed through socket events (onParticipantJoined, onParticipantLeft)
      setParticipants([currentParticipant]);
    } catch (error: any) {
      onError('Failed to load participants');
      // Fallback to showing just the current participant
      setParticipants([currentParticipant]);
    }
  };

  const handleSendMessage = (message: string) => {
    if (meeting.meetingCode) {
      socketService.sendChatMessage(meeting.meetingCode, currentParticipant.name, message);
    } else {
      onError('Meeting room not properly initialized for chat');
    }
  };

  const handleEndMeeting = async () => {
    if (!currentParticipant.isHost) {
      onError('Only the host can complete the course');
      return;
    }

    try {
      const response = await liveCourseAPI.completeCourse(meeting.id);
      if (response.success) {
        // Notify parent component that course was completed
        if (onCourseCompleted) {
          onCourseCompleted({
            ...meeting,
            status: 'completed'
          });
        }
        onLeaveMeeting();
      } else {
        onError(response.error || 'Failed to complete course');
      }
    } catch (error: any) {
      onError('Failed to complete course');
    }
  };

  const refreshMeetingInfo = async () => {
    try {
      const response = await liveCourseAPI.getCourseById(meeting.id);
      if (response.success && response.data) {
        setMeetingInfo(response.data);
      }
    } catch (error: any) {
      onError('Failed to refresh course info');
    }
  };

  // Media control functions
  const handleToggleAudio = () => {
    const newState = webrtcService.toggleAudio();
    setIsAudioEnabled(newState);
  };

  const handleToggleVideo = () => {
    const newState = webrtcService.toggleVideo();
    setIsVideoEnabled(newState);
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await webrtcService.stopScreenShare();
        setIsScreenSharing(false);
        // Switch back to camera
        const stream = webrtcService.getLocalStream();
        if (stream && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } else {
        const screenStream = await webrtcService.startScreenShare();
        setIsScreenSharing(true);
        // Show screen share in local video
        if (screenStream && localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
      }
    } catch (error: any) {
      console.error('Screen share error:', error);
      onError('Failed to toggle screen sharing. Please try again.');
    }
  };

  return (
    <div className="meeting-room">
      <div className="meeting-header">
        <div className="meeting-info">
          <h2>🎥 {meetingInfo.name || 'Meeting Room'}</h2>
          <div className="meeting-details">
            <span className="meeting-code">Code: <strong>{meeting.meetingCode}</strong></span>
            <span className="participant-count">👥 {participants.length} participants</span>
            <span className="connection-status">
              {socketService.getConnectionStatus() ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="meeting-controls">
          <button onClick={() => setIsChatVisible(!isChatVisible)} className="toggle-chat-btn">
            {isChatVisible ? '💬 Hide Chat' : '💬 Show Chat'}
          </button>
          <button onClick={refreshMeetingInfo} className="refresh-btn">
            🔄 Refresh
          </button>
          <button onClick={onLeaveMeeting} className="leave-btn">
            🚪 Leave Meeting
          </button>
          {currentParticipant.isHost && (
            <button onClick={handleEndMeeting} className="end-btn">
              ✅ Complete Course
            </button>
          )}
        </div>
      </div>

      <div className="meeting-content">
        <div className="video-area">
          <div className="video-container">
            {isInitializingMedia ? (
              <div className="video-placeholder">
                <h3>🔄 Initializing Camera...</h3>
                <p>Please allow access to camera and microphone</p>
              </div>
            ) : (
              <>
                <div className="local-video">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="video-element"
                  />
                  <div className="video-label">
                    You ({isScreenSharing ? 'Screen' : 'Camera'})
                  </div>
                </div>
                
                <div className="remote-videos">
                  {participants
                    .filter(p => p.id !== currentParticipant.id)
                    .map(participant => (
                      <div key={participant.id} className="remote-video">
                        <div className="video-placeholder-remote">
                          <span>📺</span>
                          <div className="video-label">{participant.name}</div>
                        </div>
                      </div>
                    ))
                  }
                  {participants.length === 1 && (
                    <div className="no-participants">
                      <p>👥 Waiting for other participants to join...</p>
                    </div>
                  )}
                </div>
              </>
            )}
            
            <div className="video-controls">
              <button 
                className={`control-btn audio-btn ${isAudioEnabled ? 'enabled' : 'disabled'}`}
                onClick={handleToggleAudio}
                disabled={isInitializingMedia}
              >
                {isAudioEnabled ? '🎤' : '🎤❌'} {isAudioEnabled ? 'Mute' : 'Unmute'}
              </button>
              
              <button 
                className={`control-btn video-btn ${isVideoEnabled ? 'enabled' : 'disabled'}`}
                onClick={handleToggleVideo}
                disabled={isInitializingMedia}
              >
                {isVideoEnabled ? '📹' : '📹❌'} {isVideoEnabled ? 'Stop Video' : 'Start Video'}
              </button>
              
              <button 
                className={`control-btn screen-btn ${isScreenSharing ? 'enabled' : 'disabled'}`}
                onClick={handleToggleScreenShare}
                disabled={isInitializingMedia || !currentParticipant.isHost}
                title={!currentParticipant.isHost ? 'Only hosts can share screen' : ''}
              >
                {isScreenSharing ? '🖥️❌' : '🖥️'} 
                {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
              </button>
            </div>
          </div>
        </div>

        <div className="sidebar">
          <ParticipantsList 
            participants={participants} 
            currentParticipant={currentParticipant}
            onRefresh={loadParticipants}
          />
          
          {isChatVisible && (
            <ChatPanel 
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              currentUser={currentParticipant.name}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;