const { meetings } = require('./meetingController');
const { createWebRtcTransport } = require('../config/mediasoup');

// Store socket connections and their associated meeting info
const socketMeetings = new Map(); // socketId -> meetingInfo
const meetingRooms = new Map(); // meetingCode -> Set of socketIds

/**
 * Handle Socket.IO connections
 */
const handleSocketConnection = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 New socket connection: ${socket.id}`);

        // Handle joining a meeting room
        socket.on('join-meeting', async (data) => {
            try {
                const { meetingCode, participantId, participantName, isHost } = data;

                // Validate meeting exists
                const meeting = meetings.get(meetingCode);
                if (!meeting) {
                    socket.emit('error', {
                        type: 'meeting-not-found',
                        message: `Meeting ${meetingCode} not found`
                    });
                    return;
                }

                // Join the socket room
                socket.join(meetingCode);

                // Store socket meeting info
                socketMeetings.set(socket.id, {
                    meetingCode,
                    participantId,
                    participantName,
                    isHost: isHost || false
                });

                // Add to meeting room tracking
                if (!meetingRooms.has(meetingCode)) {
                    meetingRooms.set(meetingCode, new Set());
                }
                meetingRooms.get(meetingCode).add(socket.id);

                console.log(`👥 ${participantName} joined meeting ${meetingCode}`);

                // Notify other participants
                socket.to(meetingCode).emit('participant-joined', {
                    participantId,
                    participantName,
                    isHost: isHost || false,
                    joinedAt: new Date().toISOString()
                });

                // Send current participants to the new participant
                const currentParticipants = Array.from(meeting.participants.values());
                socket.emit('current-participants', currentParticipants);

                // Confirm successful join
                socket.emit('joined-meeting', {
                    meetingCode,
                    participantId,
                    participantName,
                    participantCount: meeting.participants.size
                });

            } catch (error) {
                console.error('Error joining meeting:', error);
                socket.emit('error', {
                    type: 'join-meeting-error',
                    message: error.message
                });
            }
        });

        // Handle chat messages
        socket.on('chat-message', (data) => {
            try {
                const socketInfo = socketMeetings.get(socket.id);
                if (!socketInfo) {
                    socket.emit('error', {
                        type: 'not-in-meeting',
                        message: 'You are not in a meeting'
                    });
                    return;
                }

                // Extract message from the data
                const messageText = data.message || data;
                
                const chatMessage = {
                    id: data.id || require('uuid').v4(),
                    message: messageText,
                    sender: data.sender || socketInfo.participantName,
                    senderName: socketInfo.participantName,
                    senderId: socketInfo.participantId,
                    isHost: socketInfo.isHost,
                    timestamp: data.timestamp || new Date().toISOString(),
                    meetingCode: socketInfo.meetingCode
                };

                // Broadcast message to all participants in the meeting
                io.to(socketInfo.meetingCode).emit('chat-message', chatMessage);

                console.log(`💬 Chat message in ${socketInfo.meetingCode} from ${socketInfo.participantName}: ${messageText}`);

            } catch (error) {
                console.error('Error handling chat message:', error);
                socket.emit('error', {
                    type: 'chat-error',
                    message: error.message
                });
            }
        });

        // Handle WebRTC signaling for video/audio
        socket.on('offer', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo) {
                const { to } = data;
                // Find target socket by participant ID
                if (to) {
                    const targetSocketId = findSocketByParticipantId(socketInfo.meetingCode, to);
                    if (targetSocketId) {
                        console.log(`📡 Offer from ${socketInfo.participantName} to ${to}`);
                        io.to(targetSocketId).emit('offer', {
                            ...data,
                            from: socketInfo.participantId,
                            fromName: socketInfo.participantName
                        });
                    } else {
                        console.log(`⚠️ Target participant ${to} not found in meeting ${socketInfo.meetingCode}`);
                    }
                } else {
                    // Broadcast to all if no specific target
                    console.log(`📡 Broadcasting offer from ${socketInfo.participantName} to all`);
                    socket.to(socketInfo.meetingCode).emit('offer', {
                        ...data,
                        from: socketInfo.participantId,
                        fromName: socketInfo.participantName
                    });
                }
            }
        });

        socket.on('answer', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo) {
                const { to } = data;
                // Find target socket by participant ID
                if (to) {
                    const targetSocketId = findSocketByParticipantId(socketInfo.meetingCode, to);
                    if (targetSocketId) {
                        console.log(`📡 Answer from ${socketInfo.participantName} to ${to}`);
                        io.to(targetSocketId).emit('answer', {
                            ...data,
                            from: socketInfo.participantId,
                            fromName: socketInfo.participantName
                        });
                    } else {
                        console.log(`⚠️ Target participant ${to} not found in meeting ${socketInfo.meetingCode}`);
                    }
                } else {
                    // Broadcast to all if no specific target
                    console.log(`📡 Broadcasting answer from ${socketInfo.participantName} to all`);
                    socket.to(socketInfo.meetingCode).emit('answer', {
                        ...data,
                        from: socketInfo.participantId,
                        fromName: socketInfo.participantName
                    });
                }
            }
        });

        socket.on('ice-candidate', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo) {
                const { to } = data;
                // Find target socket by participant ID
                if (to) {
                    const targetSocketId = findSocketByParticipantId(socketInfo.meetingCode, to);
                    if (targetSocketId) {
                        io.to(targetSocketId).emit('ice-candidate', {
                            ...data,
                            from: socketInfo.participantId,
                            fromName: socketInfo.participantName
                        });
                    }
                } else {
                    // Broadcast to all if no specific target
                    socket.to(socketInfo.meetingCode).emit('ice-candidate', {
                        ...data,
                        from: socketInfo.participantId,
                        fromName: socketInfo.participantName
                    });
                }
            }
        });

        // Handle media control events
        socket.on('toggle-audio', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo) {
                socket.to(socketInfo.meetingCode).emit('participant-audio-toggle', {
                    participantId: socketInfo.participantId,
                    participantName: socketInfo.participantName,
                    audioEnabled: data.enabled
                });
            }
        });

        socket.on('toggle-video', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo) {
                socket.to(socketInfo.meetingCode).emit('participant-video-toggle', {
                    participantId: socketInfo.participantId,
                    participantName: socketInfo.participantName,
                    videoEnabled: data.enabled
                });
            }
        });

        // Handle screen sharing events (only for hosts)
        socket.on('start-screen-share', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo && socketInfo.isHost) {
                console.log(`🖥️ ${socketInfo.participantName} started screen sharing in ${socketInfo.meetingCode}`);
                
                // Notify all participants that host started screen sharing
                socket.to(socketInfo.meetingCode).emit('screen-share-started', {
                    hostId: socketInfo.participantId,
                    hostName: socketInfo.participantName,
                    startedAt: new Date().toISOString()
                });
                
                // Confirm to host that screen sharing started
                socket.emit('screen-share-started-confirmation', {
                    success: true,
                    message: 'Screen sharing started successfully'
                });
            } else {
                socket.emit('error', {
                    type: 'screen-share-not-allowed',
                    message: 'Only hosts can start screen sharing'
                });
            }
        });

        socket.on('stop-screen-share', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo && socketInfo.isHost) {
                console.log(`🖥️ ${socketInfo.participantName} stopped screen sharing in ${socketInfo.meetingCode}`);
                
                // Notify all participants that screen sharing stopped
                socket.to(socketInfo.meetingCode).emit('screen-share-stopped', {
                    hostId: socketInfo.participantId,
                    hostName: socketInfo.participantName,
                    stoppedAt: new Date().toISOString()
                });
                
                // Confirm to host that screen sharing stopped
                socket.emit('screen-share-stopped-confirmation', {
                    success: true,
                    message: 'Screen sharing stopped successfully'
                });
            } else {
                socket.emit('error', {
                    type: 'screen-share-not-allowed',
                    message: 'Only hosts can stop screen sharing'
                });
            }
        });

        // Handle screen sharing WebRTC signaling
        socket.on('screen-share-offer', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo && socketInfo.isHost) {
                socket.to(socketInfo.meetingCode).emit('screen-share-offer', {
                    ...data,
                    from: socketInfo.participantId,
                    fromName: socketInfo.participantName
                });
            }
        });

        socket.on('screen-share-answer', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo) {
                socket.to(socketInfo.meetingCode).emit('screen-share-answer', {
                    ...data,
                    from: socketInfo.participantId,
                    fromName: socketInfo.participantName
                });
            }
        });

        socket.on('screen-share-ice-candidate', (data) => {
            const socketInfo = socketMeetings.get(socket.id);
            if (socketInfo) {
                socket.to(socketInfo.meetingCode).emit('screen-share-ice-candidate', {
                    ...data,
                    from: socketInfo.participantId,
                    fromName: socketInfo.participantName
                });
            }
        });

        // Handle MediaSoup transport creation
        socket.on('create-transport', async (data) => {
            try {
                const socketInfo = socketMeetings.get(socket.id);
                if (!socketInfo) {
                    socket.emit('error', {
                        type: 'not-in-meeting',
                        message: 'You are not in a meeting'
                    });
                    return;
                }

                const meeting = meetings.get(socketInfo.meetingCode);
                if (!meeting || !meeting.router) {
                    socket.emit('error', {
                        type: 'meeting-router-error',
                        message: 'Meeting router not available'
                    });
                    return;
                }

                const transport = await createWebRtcTransport(meeting.router);

                socket.emit('transport-created', {
                    transportId: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters
                });

            } catch (error) {
                console.error('Error creating transport:', error);
                socket.emit('error', {
                    type: 'transport-creation-error',
                    message: error.message
                });
            }
        });

        // Handle leaving meeting
        socket.on('leave-meeting', () => {
            handleParticipantLeaving(socket);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
            handleParticipantLeaving(socket);
        });
    });

    return io;
};

/**
 * Find socket ID by participant ID in a meeting
 */
const findSocketByParticipantId = (meetingCode, participantId) => {
    const roomSockets = meetingRooms.get(meetingCode);
    if (!roomSockets) return null;

    for (const socketId of roomSockets) {
        const socketInfo = socketMeetings.get(socketId);
        if (socketInfo && socketInfo.participantId === participantId) {
            return socketId;
        }
    }
    return null;
};

/**
 * Handle participant leaving a meeting
 */
const handleParticipantLeaving = (socket) => {
    const socketInfo = socketMeetings.get(socket.id);
    if (socketInfo) {
        const { meetingCode, participantId, participantName } = socketInfo;

        // Remove from meeting tracking
        if (meetingRooms.has(meetingCode)) {
            meetingRooms.get(meetingCode).delete(socket.id);
            
            // If no more participants, clean up the room
            if (meetingRooms.get(meetingCode).size === 0) {
                meetingRooms.delete(meetingCode);
            }
        }

        // Remove from meeting participants
        const meeting = meetings.get(meetingCode);
        if (meeting) {
            meeting.participants.delete(participantId);
            
            // If host left or no participants remain, end the meeting
            if (socketInfo.isHost || meeting.participants.size === 0) {
                meeting.status = 'ended';
                meeting.endedAt = new Date().toISOString();
                
                // Close MediaSoup router
                if (meeting.router) {
                    meeting.router.close();
                }
                
                console.log(`📅 Meeting ${meetingCode} ended (host left or no participants)`);
            }
        }

        // Notify other participants
        socket.to(meetingCode).emit('participant-left', {
            participantId,
            participantName,
            leftAt: new Date().toISOString()
        });

        // Clean up socket tracking
        socketMeetings.delete(socket.id);
        
        console.log(`👤 ${participantName} left meeting ${meetingCode}`);
    }
};

module.exports = {
    handleSocketConnection,
    socketMeetings,
    meetingRooms
};