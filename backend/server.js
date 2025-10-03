const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import configurations
const { initializeSocket } = require('./config/socket');
const { initializeFirebase } = require('./config/firebase');
const { initializeMediaSoup } = require('./config/mediasoup');

// Import routes
const userRoutes = require('./routes/userRoutes');
const courseRoutes = require('./routes/courseRoutes');

// Import controllers
const { handleSocketConnection } = require('./controllers/socketController');

const app = express();
const server = http.createServer(app);

// Initialize Firebase
initializeFirebase();

// Initialize Socket.IO
const io = initializeSocket(server);

// CORS configuration
const corsOptions = {
    
    origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    //allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for frontend (if needed)
app.use('/static', express.static(path.join(__dirname, '../frontend')));

// Serve recording files for public access (no authentication required)
app.use('/recordings', express.static(path.join(__dirname, '../recordings')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Beauty LMS Video Conferencing Backend is running',
        timestamp: new Date().toISOString()
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    res.status(200).json({
        title: 'Beauty LMS Video Conferencing API',
        description: 'Comprehensive API for managing live courses with video conferencing and recording capabilities',
        version: '1.0.0',
        baseUrl: baseUrl,
        documentation: `${baseUrl}/api/docs`,
        healthCheck: `${baseUrl}/health`,
        endpoints: {
            'System': {
                'GET /health': 'Health check endpoint',
                'GET /api': 'API documentation overview',
                'GET /api/docs': 'Detailed API documentation'
            },
            'Live Courses': {
                'GET /api/live_courses': 'Get all live courses',
                'POST /api/live_courses': 'Create a new live course',
                'GET /api/live_courses/:id': 'Get specific live course',
                'GET /api/live_courses/category/:category': 'Get courses by category',
                'GET /api/live_courses/instructor/:instructorId': 'Get courses by instructor',
                'GET /api/live_courses/status/:status': 'Get courses by status',
                'GET /api/live_courses/:id/users': 'Get enrolled users for a course',
                'GET /api/live_courses/:id/users/join': 'Get joined users for a course',
                'POST /api/live_courses/schedule': 'Schedule live courses',
                'PUT /api/live_courses/:id/start': 'Start a live course with video conferencing and recording',
                'PUT /api/live_courses/:id/complete': 'Complete a live course and stop recording',
                'PUT /api/live_courses/:id/join': 'Join a user to a live course',
                'PUT /api/live_courses/:id/leave': 'Leave a live course',
                'GET /api/live_courses/:id/recording': 'Get recording status for a course'
            },
            'Recording Management': {
                'POST /api/courses/:courseId/recording/start': 'Start recording for a course',
                'POST /api/courses/:courseId/recording/stop': 'Stop recording for a course',
                'GET /api/courses/:courseId/recording/status': 'Get recording status',
                'GET /api/courses/:courseId/recording': 'Get completed recording info',
                'GET /api/recordings': 'List all recordings',
                'DELETE /api/recordings/:fileName': 'Delete a recording',
                'POST /api/recordings/cleanup': 'Cleanup old recordings'
            },
            'User Management': {
                'GET /api/users': 'Get all users',
                'GET /api/users/:id': 'Get user by ID',
                'GET /api/users/role/:role': 'Get users by role'
            }
        },
        features: [
            'MediaSoup-based video conferencing with SFU architecture',
            'Socket.IO real-time communication and events',
            'Automatic recording with FFmpeg integration',
            'Live course room management with unique codes',
            'Firebase integration with fallback to mock data',
            'Course lifecycle management (scheduled → active → completed)',
            'Multi-participant video conferencing',
            'Recording file management and cleanup',
            'Comprehensive error handling and logging',
            'Production-ready deployment scripts'
        ],
        websocket: {
            url: `ws://${req.get('host')}`,
            events: [
                'join-course', 'leave-course', 'course-started', 'course-ended',
                'join-meeting', 'leave-meeting', 'participant-joined', 'participant-left',
                'chat-message', 'toggle-audio', 'toggle-video',
                'getRouterRtpCapabilities', 'createWebRtcTransport', 'connectTransport',
                'produce', 'consume'
            ]
        },
        authentication: {
            development: 'No authentication required (mock data mode)',
            production: 'Firebase Authentication required'
        },
        support: {
            repository: 'https://github.com/krishna123-conf/Beauty-lms',
            documentation: 'See API_DOCUMENTATION.md for complete reference'
        }
    });
});

// Detailed API documentation endpoint
app.get('/api/docs', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    res.status(200).json({
        openapi: '3.0.0',
        info: {
            title: 'Beauty LMS Video Conferencing API',
            description: 'Comprehensive API for managing live courses with video conferencing and recording capabilities',
            version: '1.0.0',
            contact: {
                name: 'Beauty LMS Support',
                url: 'https://github.com/krishna123-conf/Beauty-lms'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: baseUrl,
                description: 'Current server'
            }
        ],
        paths: {
            '/health': {
                get: {
                    summary: 'Health Check',
                    description: 'Check server health and status',
                    responses: {
                        '200': {
                            description: 'Server is healthy',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'string', example: 'OK' },
                                            message: { type: 'string', example: 'Beauty LMS Video Conferencing Backend is running' },
                                            timestamp: { type: 'string', format: 'date-time' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/live_courses': {
                get: {
                    summary: 'Get All Live Courses',
                    description: 'Retrieve all live courses from the database',
                    responses: {
                        '200': {
                            description: 'List of live courses',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            courses: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        id: { type: 'string' },
                                                        name: { type: 'string' },
                                                        description: { type: 'string' },
                                                        instructorId: { type: 'string' },
                                                        instructorName: { type: 'string' },
                                                        category: { type: 'string' },
                                                        status: { type: 'string', enum: ['scheduled', 'active', 'completed'] },
                                                        scheduledAt: { type: 'string', format: 'date-time' },
                                                        duration: { type: 'number' },
                                                        maxParticipants: { type: 'number' },
                                                        recordingEnabled: { type: 'boolean' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/live_courses/{id}/start': {
                put: {
                    summary: 'Start Live Course',
                    description: 'Start a live course, create meeting room, and begin recording if enabled',
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                            description: 'Course ID'
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        instructorId: { type: 'string' },
                                        instructorName: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Course started successfully',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            message: { type: 'string' },
                                            course: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'string' },
                                                    status: { type: 'string' },
                                                    meetingCode: { type: 'string' },
                                                    meetingUrl: { type: 'string' },
                                                    startedAt: { type: 'string', format: 'date-time' }
                                                }
                                            },
                                            recording: {
                                                type: 'object',
                                                properties: {
                                                    started: { type: 'boolean' },
                                                    fileName: { type: 'string' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/courses/{courseId}/recording/start': {
                post: {
                    summary: 'Start Recording',
                    description: 'Start recording for a course',
                    parameters: [
                        {
                            name: 'courseId',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                            description: 'Course ID'
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        courseData: {
                                            type: 'object',
                                            properties: {
                                                name: { type: 'string' },
                                                instructorName: { type: 'string' }
                                            }
                                        },
                                        mediaOptions: {
                                            type: 'object',
                                            properties: {
                                                video: { type: 'boolean' },
                                                audio: { type: 'boolean' },
                                                quality: { type: 'string', enum: ['low', 'medium', 'high'] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Recording started successfully'
                        }
                    }
                }
            }
        },
        components: {
            schemas: {
                Course: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        instructorId: { type: 'string' },
                        instructorName: { type: 'string' },
                        category: { type: 'string' },
                        status: { type: 'string', enum: ['scheduled', 'active', 'completed'] },
                        scheduledAt: { type: 'string', format: 'date-time' },
                        duration: { type: 'number' },
                        maxParticipants: { type: 'number' },
                        enrolledUsers: { type: 'array', items: { type: 'string' } },
                        joinedUsers: { type: 'array', items: { type: 'string' } },
                        recordingEnabled: { type: 'boolean' },
                        meetingCode: { type: 'string', nullable: true }
                    }
                },
                Recording: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        fileName: { type: 'string' },
                        url: { type: 'string' },
                        duration: { type: 'number' },
                        size: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        message: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' }
                    }
                }
            }
        },
        tags: [
            {
                name: 'System',
                description: 'System health and information endpoints'
            },
            {
                name: 'Courses',
                description: 'Live course management'
            },
            {
                name: 'Recordings',
                description: 'Recording management and playback'
            },
            {
                name: 'Users',
                description: 'User management and authentication'
            }
        ]
    });
});

// Import recording manager
const recordingManager = require('./utils/recordingManager');

// Recording API Routes
// Start recording
app.post('/api/courses/:courseId/recording/start', async (req, res) => {
    const { courseId } = req.params;
    const { courseData, mediaOptions } = req.body;
    
    try {
        const result = await recordingManager.startRecording(courseId, courseData, mediaOptions);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop recording
app.post('/api/courses/:courseId/recording/stop', async (req, res) => {
    const { courseId } = req.params;
    
    try {
        const result = await recordingManager.stopRecording(courseId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get recording status
app.get('/api/courses/:courseId/recording/status', (req, res) => {
    const { courseId } = req.params;
    const status = recordingManager.getRecordingStatus(courseId);
    res.json(status);
});

// Get recording URL for a specific course
app.get('/api/courses/:courseId/recording', async (req, res) => {
    const { courseId } = req.params;
    
    try {
        // Check if recording is completed
        const completedRecordings = await recordingManager.listRecordings('completed');
        const recording = completedRecordings.find(r => r.courseId === courseId);
        
        if (recording) {
            res.json({
                success: true,
                recording: {
                    courseId,
                    fileName: recording.fileName,
                    url: recordingManager.generateRecordingUrl(recording.fileName),
                    duration: recording.duration || 0,
                    size: recording.size,
                    createdAt: recording.createdAt
                }
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Recording not found'
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List all recordings
app.get('/api/recordings', async (req, res) => {
    const { directory = 'completed' } = req.query;
    
    try {
        const recordings = await recordingManager.listRecordings(directory);
        res.json({
            success: true,
            recordings: recordings.map(recording => ({
                ...recording,
                url: recordingManager.generateRecordingUrl(recording.fileName)
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete recording
app.delete('/api/recordings/:fileName', async (req, res) => {
    const { fileName } = req.params;
    const { directory = 'completed' } = req.query;
    
    try {
        const result = await recordingManager.deleteRecording(fileName, directory);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cleanup old recordings
app.post('/api/recordings/cleanup', async (req, res) => {
    const { maxAgeDays = 30 } = req.body;
    
    try {
        const cleanedCount = await recordingManager.cleanupOldRecordings(maxAgeDays);
        res.json({
            success: true,
            message: `Cleaned up ${cleanedCount} old recordings`,
            cleanedCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/live_courses', courseRoutes);

// Socket.IO connection handling
handleSocketConnection(io);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
    });
});

const PORT = process.env.PORT || 3000;

// Initialize MediaSoup before starting server
initializeMediaSoup().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Beauty LMS Video Conferencing Server running on port ${PORT}`);
        console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
}).catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
