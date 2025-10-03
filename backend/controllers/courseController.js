const { getFirestore } = require('../config/firebase');
const { createRouter } = require('../config/mediasoup');
const recordingManager = require('../utils/recordingManager');
const { createLiveCourseRoom, endLiveCourseRoom, getLiveCourseRoom } = require('./meetingController');
const path = require('path');
const fs = require('fs');

// Mock data for testing without Firebase
const mockCourses = new Map();

// Initialize some mock courses for testing
mockCourses.set('test123', {
    id: 'test123',
    name: 'Beauty Basics Course',
    duration: 60,
    category: 'beauty',
    instructorId: 'instructor_456',
    instructorName: 'Jane Doe',
    status: 'scheduled',
    scheduledDateTime: '2023-12-01T10:00:00Z',
    enrolledUsers: ['user1', 'user2', 'user3'],
    recordingEnabled: true,
    createdAt: '2023-11-15T08:00:00Z',
    updatedAt: '2023-11-20T12:30:00Z'
});

mockCourses.set('test456', {
    id: 'test456',
    name: 'Advanced Makeup Techniques',
    duration: 90,
    category: 'makeup',
    instructorId: 'instructor_789',
    instructorName: 'Sarah Smith',
    status: 'scheduled',
    scheduledDateTime: '2023-12-01T14:00:00Z',
    enrolledUsers: ['user4', 'user5'],
    recordingEnabled: false,
    createdAt: '2023-11-16T09:00:00Z',
    updatedAt: '2023-11-21T10:15:00Z'
});

mockCourses.set('test789', {
    id: 'test789',
    name: 'Hair Styling Masterclass',
    duration: 120,
    category: 'hair',
    instructorId: 'instructor_111',
    instructorName: 'Emma Wilson',
    status: 'scheduled',
    scheduledDateTime: '2023-12-01T16:00:00Z',
    enrolledUsers: ['user6', 'user7', 'user8', 'user9'],
    recordingEnabled: true,
    createdAt: '2023-11-17T10:00:00Z',
    updatedAt: '2023-11-22T14:00:00Z'
});

// Add test courses with future scheduled times for testing
const futureTime15min = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes from now
const futureTime5min = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now
const futureTime30min = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes from now

mockCourses.set('future15', {
    id: 'future15',
    name: 'Future Course - 15 min',
    duration: 60,
    category: 'test',
    instructorId: 'instructor_test',
    instructorName: 'Test Instructor',
    status: 'scheduled',
    scheduledDateTime: futureTime15min,
    enrolledUsers: ['user1', 'user2'],
    recordingEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
});

mockCourses.set('future5', {
    id: 'future5',
    name: 'Future Course - 5 min',
    duration: 60,
    category: 'test',
    instructorId: 'instructor_test',
    instructorName: 'Test Instructor',
    status: 'scheduled',
    scheduledDateTime: futureTime5min,
    enrolledUsers: ['user1', 'user2'],
    recordingEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
});

mockCourses.set('future30', {
    id: 'future30',
    name: 'Future Course - 30 min',
    duration: 60,
    category: 'test',
    instructorId: 'instructor_test',
    instructorName: 'Test Instructor',
    status: 'scheduled',
    scheduledDateTime: futureTime30min,
    enrolledUsers: ['user1', 'user2'],
    recordingEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
});

/**
 * Helper function to get course data from Firebase or mock data
 */
const getCourseData = async (courseId) => {
    const db = getFirestore();
    
    // If Firebase is configured, use it
    if (db) {
        try {
            const courseDoc = await db.collection('live_courses').doc(courseId).get();
            if (courseDoc.exists) {
                return {
                    exists: true,
                    data: { id: courseDoc.id, ...courseDoc.data() },
                    ref: courseDoc.ref
                };
            }
        } catch (error) {
            console.warn('Firebase error, falling back to mock data:', error.message);
        }
    }
    
    // Fall back to mock data for testing
    if (mockCourses.has(courseId)) {
        return {
            exists: true,
            data: mockCourses.get(courseId),
            ref: {
                update: async (updateData) => {
                    const course = mockCourses.get(courseId);
                    mockCourses.set(courseId, { ...course, ...updateData });
                    console.log(`📝 Mock course ${courseId} updated:`, updateData);
                }
            }
        };
    }
    
    return { exists: false };
};

/**
 * Helper function to check if a course can be scheduled
 * @param {Object} course - Course data
 * @returns {Boolean} - Whether course can be scheduled
 */
const canScheduleCourse = (course) => {
    // Don't schedule if already completed
    if (course.status === 'completed') {
        return false;
    }
    
    // Check if scheduledDateTime exists and is in the future
    if (course.scheduledDateTime) {
        const scheduledTime = new Date(course.scheduledDateTime);
        const currentTime = new Date();
        return scheduledTime > currentTime;
    }
    
    return true;
};

/**
 * Helper function to get recording URL for a course if available
 * @param {string} courseId - The course ID
 * @returns {string|null} - Recording URL or null if no recording available
 */
const getRecordingUrlForCourse = (courseId) => {
    try {
        // Get recording status from recording manager
        const recordingStatus = recordingManager.getRecordingStatus(courseId);
        
        // If there's a completed recording, return its URL
        if (recordingStatus && recordingStatus.status === 'completed' && recordingStatus.recordingUrl) {
            return recordingStatus.recordingUrl;
        }
        
        // Try to find completed recording file for this course
        const recordingsDir = recordingManager.getRecordingsDirectory();
        const completedDir = path.join(recordingsDir, 'completed');
        
        // Look for recording files that match this course ID pattern
        if (fs.existsSync(completedDir)) {
            const files = fs.readdirSync(completedDir);
            const courseRecordingFile = files.find(file => 
                file.startsWith(`course-${courseId}-`) && file.endsWith('.mp4')
            );
            
            if (courseRecordingFile) {
                return recordingManager.generateRecordingUrl(`completed/${courseRecordingFile}`);
            }
        }
        
        return null;
    } catch (error) {
        console.error(`Error getting recording URL for course ${courseId}:`, error);
        return null;
    }
};

/**
 * Helper function to add duration to course data
 * @param {Object} course - Course data
 * @returns {Object} - Course data with duration and estimatedDuration
 */
const addDurationToCourse = (course) => {
    // Add duration field if not present (default: 60 minutes)
    const duration = course.duration || 60; // Duration in minutes
    
    // Get recording URL if available
    const recordingUrl = getRecordingUrlForCourse(course.id);
    
    const courseWithDuration = {
        ...course,
        duration: duration,
        estimatedDuration: duration // estimatedDuration equals duration as specified
    };
    
    // Add recording URL if available
    if (recordingUrl) {
        courseWithDuration.recordingUrl = recordingUrl;
    }
    
    return courseWithDuration;
};

/**
 * Get all live courses from Firebase or mock data
 */
const getAllLiveCourses = async (req, res) => {
    try {
        const db = getFirestore();
        
        if (!db) {
            // Use mock data when Firebase is not configured
            console.log('📝 Using mock data for getAllLiveCourses');
            const courses = Array.from(mockCourses.values()).map(course => addDurationToCourse(course));
            return res.status(200).json({
                success: true,
                data: courses,
                count: courses.length,
                message: 'Live courses retrieved from mock data'
            });
        }

        const coursesRef = db.collection('live_courses');
        const snapshot = await coursesRef.get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No live courses found'
            });
        }

        const courses = [];
        snapshot.forEach(doc => {
            const courseData = addDurationToCourse({
                id: doc.id,
                ...doc.data()
            });
            courses.push(courseData);
        });

        res.status(200).json({
            success: true,
            data: courses,
            count: courses.length
        });

    } catch (error) {
        console.error('Error fetching live courses:', error);
        res.status(500).json({
            error: 'Failed to fetch live courses',
            message: error.message
        });
    }
};

/**
 * Get live course by ID from Firebase or mock data
 */
const getLiveCourseById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getFirestore();
        
        if (!db) {
            // Use mock data when Firebase is not configured
            console.log(`📝 Using mock data for getLiveCourseById: ${id}`);
            if (mockCourses.has(id)) {
                const course = addDurationToCourse(mockCourses.get(id));
                return res.status(200).json({
                    success: true,
                    data: course,
                    message: 'Live course retrieved from mock data'
                });
            } else {
                return res.status(404).json({
                    error: 'Live course not found',
                    message: `No live course found with ID: ${id}`
                });
            }
        }

        const courseDoc = await db.collection('live_courses').doc(id).get();

        if (!courseDoc.exists) {
            return res.status(404).json({
                error: 'Live course not found',
                message: `No live course found with ID: ${id}`
            });
        }

        const courseData = addDurationToCourse({
            id: courseDoc.id,
            ...courseDoc.data()
        });

        res.status(200).json({
            success: true,
            data: courseData
        });

    } catch (error) {
        console.error('Error fetching live course:', error);
        res.status(500).json({
            error: 'Failed to fetch live course',
            message: error.message
        });
    }
};

/**
 * Get live courses by instructor from Firebase
 */
const getLiveCoursesByInstructor = async (req, res) => {
    try {
        const { instructorId } = req.params;
        const db = getFirestore();
        
        if (!db) {
            // Use mock data when Firebase is not configured
            console.log(`📝 Using mock data for getLiveCoursesByInstructor: ${instructorId}`);
            const courses = Array.from(mockCourses.values())
                .filter(course => course.instructorId === instructorId)
                .map(course => addDurationToCourse(course));
            return res.status(200).json({
                success: true,
                data: courses,
                count: courses.length,
                instructorId: instructorId,
                message: 'Live courses retrieved from mock data'
            });
        }

        const coursesRef = db.collection('live_courses').where('instructorId', '==', instructorId);
        const snapshot = await coursesRef.get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                data: [],
                message: `No live courses found for instructor: ${instructorId}`
            });
        }

        const courses = [];
        snapshot.forEach(doc => {
            const courseData = addDurationToCourse({
                id: doc.id,
                ...doc.data()
            });
            courses.push(courseData);
        });

        res.status(200).json({
            success: true,
            data: courses,
            count: courses.length,
            instructorId: instructorId
        });

    } catch (error) {
        console.error('Error fetching courses by instructor:', error);
        res.status(500).json({
            error: 'Failed to fetch courses by instructor',
            message: error.message
        });
    }
};

/**
 * Get live courses by status from Firebase
 */
const getLiveCoursesByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const db = getFirestore();
        
        if (!db) {
            // Use mock data when Firebase is not configured
            console.log(`📝 Using mock data for getLiveCoursesByStatus: ${status}`);
            const courses = Array.from(mockCourses.values())
                .filter(course => course.status === status)
                .map(course => addDurationToCourse(course));
            return res.status(200).json({
                success: true,
                data: courses,
                count: courses.length,
                status: status,
                message: 'Live courses retrieved from mock data'
            });
        }

        const coursesRef = db.collection('live_courses').where('status', '==', status);
        const snapshot = await coursesRef.get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                data: [],
                message: `No live courses found with status: ${status}`
            });
        }

        const courses = [];
        snapshot.forEach(doc => {
            const courseData = addDurationToCourse({
                id: doc.id,
                ...doc.data()
            });
            courses.push(courseData);
        });

        res.status(200).json({
            success: true,
            data: courses,
            count: courses.length,
            status: status
        });

    } catch (error) {
        console.error('Error fetching courses by status:', error);
        res.status(500).json({
            error: 'Failed to fetch courses by status',
            message: error.message
        });
    }
};

/**
 * Schedule live courses that need scheduling
 * @desc Process courses to create meeting schedules for enrolled users
 */
// Create a new live course
const createLiveCourse = async (req, res) => {
    try {
        const {
            name,
            description,
            instructorId,
            instructorName,
            category,
            duration,
            scheduledDateTime,
            recordingEnabled = true,
            enrolledUsers = []
        } = req.body;

        // Validate required fields
        if (!name || !instructorId || !instructorName || !category || !duration) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'name, instructorId, instructorName, category, and duration are required'
            });
        }

        const currentDateTime = new Date();
        const courseId = `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const newCourse = {
            id: courseId,
            name,
            description: description || '',
            instructorId,
            instructorName,
            category,
            status: 'scheduled',
            scheduledDateTime: scheduledDateTime || currentDateTime.toISOString(),
            duration: parseInt(duration),
            enrolledUsers,
            recordingEnabled: Boolean(recordingEnabled),
            createdAt: currentDateTime.toISOString(),
            updatedAt: currentDateTime.toISOString()
        };

        const db = getFirestore();
        if (db) {
            // Save to Firebase
            await db.collection('live_courses').doc(courseId).set(newCourse);
            console.log(`✅ Course ${courseId} created in Firebase`);
        } else {
            // Save to mock data for development
            mockCourses.set(courseId, newCourse);
            console.log(`✅ Course ${courseId} created in mock data`);
        }

        res.status(201).json({
            success: true,
            message: 'Course created successfully',
            data: newCourse
        });

    } catch (error) {
        console.error('Error creating live course:', error);
        res.status(500).json({
            error: 'Failed to create live course',
            message: error.message
        });
    }
};

const scheduleliveCourses = async (req, res) => {
    try {
        const db = getFirestore();
        if (!db) {
            return res.status(500).json({
                error: 'Firebase not configured',
                message: 'Please configure Firebase to use this endpoint'
            });
        }

        // Get all live courses that are not completed
        const coursesRef = db.collection('live_courses')
            .where('status', '!=', 'completed');
        const snapshot = await coursesRef.get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                message: 'No courses found that need scheduling',
                data: []
            });
        }

        const schedulingResults = [];
        const currentDateTime = new Date();

        for (const doc of snapshot.docs) {
            const course = addDurationToCourse({ id: doc.id, ...doc.data() });
            
            // Check if course can be scheduled
            if (!canScheduleCourse(course)) {
                schedulingResults.push({
                    courseId: course.id,
                    courseName: course.name || 'Unknown Course',
                    duration: course.duration,
                    status: 'skipped',
                    reason: course.status === 'completed' 
                        ? 'Course already completed' 
                        : 'Course scheduled time has passed'
                });
                continue;
            }

            // Check if course has scheduledDateTime and it matches current time criteria
            if (course.scheduledDateTime) {
                const scheduledTime = new Date(course.scheduledDateTime);
                
                // Only process courses scheduled for now or within the next 30 minutes
                const timeDifference = scheduledTime.getTime() - currentDateTime.getTime();
                const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
                
                if (timeDifference > thirtyMinutes) {
                    schedulingResults.push({
                        courseId: course.id,
                        courseName: course.name || 'Unknown Course',
                        duration: course.duration,
                        status: 'pending',
                        scheduledTime: course.scheduledDateTime,
                        reason: 'Course scheduled for future time'
                    });
                    continue;
                }
            }

            // Process enrolled users for scheduling
            const enrolledUsers = course.enrolledUsers || [];
            if (enrolledUsers.length === 0) {
                schedulingResults.push({
                    courseId: course.id,
                    courseName: course.name || 'Unknown Course',
                    duration: course.duration,
                    status: 'no_users',
                    reason: 'No enrolled users found'
                });
                continue;
            }

            // Update course status to 'scheduled' if it's not already
            if (course.status !== 'scheduled') {
                await doc.ref.update({ 
                    status: 'scheduled',
                    scheduledAt: new Date().toISOString()
                });
            }

            schedulingResults.push({
                courseId: course.id,
                courseName: course.name || 'Unknown Course',
                duration: course.duration,
                status: 'scheduled',
                enrolledUsersCount: enrolledUsers.length,
                enrolledUsers: enrolledUsers,
                scheduledDateTime: course.scheduledDateTime
            });
        }

        res.status(200).json({
            success: true,
            message: 'Course scheduling process completed',
            data: schedulingResults,
            processedAt: currentDateTime.toISOString()
        });

    } catch (error) {
        console.error('Error scheduling live courses:', error);
        res.status(500).json({
            error: 'Failed to schedule live courses',
            message: error.message
        });
    }
};

/**
 * Start a live course
 * @desc Start a scheduled live course with MediaSoup, Socket.io, and recording if enabled
 */
const startLiveCourse = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get course data (from Firebase or mock)
        const courseResult = await getCourseData(id);
        
        if (!courseResult.exists) {
            return res.status(404).json({
                error: 'Live course not found',
                message: `No live course found with ID: ${id}`
            });
        }

        const course = courseResult.data;
        const currentDateTime = new Date();

        // Check if course can be started
        if (course.status === 'completed') {
            return res.status(400).json({
                error: 'Cannot start course',
                message: 'Course is already completed'
            });
        }

        // Handle resuming a paused course (when host rejoins)
        if (course.status === 'paused') {
            console.log(`📤 Host rejoining paused course: ${course.name || 'Unknown Course'} (${id})`);
            
            // Resume recording if it was paused
            const resumeResult = await recordingManager.resumeRecording(id);
            console.log(`▶️ Recording resume result for course ${id}:`, resumeResult.message);

            // Update course status back to active
            const resumeUpdateData = {
                status: 'active',
                hostRejoinedAt: currentDateTime.toISOString(),
                updatedAt: currentDateTime.toISOString()
            };

            // Remove hostLeftAt timestamp
            if (course.hostLeftAt) {
                resumeUpdateData.hostLeftAt = null;
            }

            await courseResult.ref.update(resumeUpdateData);

            // Prepare response for resumed course
            const resumeResponseData = {
                courseId: id,
                courseName: course.name || 'Unknown Course',
                status: 'active',
                hostRejoinedAt: resumeUpdateData.hostRejoinedAt,
                meetingCode: course.meetingCode,
                meetingId: course.meetingId
            };

            // Add recording info if resumed
            if (resumeResult.recording && resumeResult.recordingInfo) {
                resumeResponseData.recordingInfo = {
                    fileName: resumeResult.recordingInfo.fileName,
                    status: resumeResult.recordingInfo.status
                };
            }

            console.log(`✅ Host rejoined course ${id} successfully`);

            return res.status(200).json({
                success: true,
                message: 'Host rejoined successfully. Course resumed.',
                data: resumeResponseData
            });
        }

        if (course.status === 'active') {
            return res.status(400).json({
                error: 'Course already active',
                message: 'Course is already running'
            });
        }

        // Check if course is being started before its scheduled time (skip for mock testing)
        if (course.scheduledDateTime && !process.env.SKIP_SCHEDULE_CHECK) {
            const scheduledTime = new Date(course.scheduledDateTime);
            const timeDifference = scheduledTime.getTime() - currentDateTime.getTime();
            const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
            
            // If trying to start more than 10 minutes before scheduled time, show "start soon" message
            if (timeDifference > tenMinutes) {
                return res.status(400).json({
                    error: 'Course will start soon',
                    message: `Course is scheduled for ${course.scheduledDateTime}. Please wait until 10 minutes before the scheduled time to start.`,
                    scheduledDateTime: course.scheduledDateTime,
                    currentDateTime: currentDateTime.toISOString(),
                    canStartAt: new Date(scheduledTime.getTime() - tenMinutes).toISOString(),
                    minutesUntilCanStart: Math.ceil(timeDifference / (60 * 1000)) - 10
                });
            }
            
            // Allow starting if within 10 minutes before scheduled time or after scheduled time
            console.log(`⏰ Course scheduled for ${course.scheduledDateTime}, starting within allowed window`);
        }

        console.log(`🚀 Starting live course: ${course.name || 'Unknown Course'} (${id})`);

        // Create meeting room for video conferencing
        const meetingRoomResult = await createLiveCourseRoom(id, course);
        if (!meetingRoomResult.success) {
            console.error(`❌ Failed to create meeting room for course ${id}:`, meetingRoomResult.error);
            return res.status(500).json({
                error: 'Failed to initialize video conferencing',
                message: meetingRoomResult.error
            });
        }

        console.log(`✅ Meeting room created for course ${id}: ${meetingRoomResult.meetingCode}`);

        // Start recording if enabled
        const recordingResult = await recordingManager.startRecording(id, course);
        console.log(`📹 Recording result for course ${id}:`, recordingResult.message);

        // Prepare update data
        const updateData = {
            status: 'active',
            startedAt: currentDateTime.toISOString(),
            updatedAt: currentDateTime.toISOString(),
            meetingCode: meetingRoomResult.meetingCode,
            meetingId: meetingRoomResult.meetingId
        };

        // Add recording info if recording started
        if (recordingResult.recording) {
            updateData.recordingActive = true;
            updateData.recordingStartedAt = recordingResult.recordingInfo.startedAt;
            updateData.recordingFileName = recordingResult.recordingInfo.fileName;
        }

        // Update course status
        await courseResult.ref.update(updateData);

        // Prepare response
        const responseData = {
            id: id,
            status: 'active',
            startedAt: currentDateTime.toISOString(),
            courseName: course.name || 'Unknown Course',
            scheduledDateTime: course.scheduledDateTime || null,
            recordingEnabled: course.recordingEnabled || false,
            recording: recordingResult.recording,
            videoConferencing: {
                enabled: true,
                meetingCode: meetingRoomResult.meetingCode,
                meetingId: meetingRoomResult.meetingId,
                socketSupport: true
            }
        };

        // Add recording details if recording started
        if (recordingResult.recording && recordingResult.recordingInfo) {
            responseData.recordingInfo = {
                fileName: recordingResult.recordingInfo.fileName,
                startedAt: recordingResult.recordingInfo.startedAt,
                status: 'recording'
            };
        }

        console.log(`✅ Live course ${id} started successfully`);

        res.status(200).json({
            success: true,
            message: 'Live course started successfully with video conferencing and recording support',
            data: responseData
        });

    } catch (error) {
        console.error('Error starting live course:', error);
        
        // Try to cleanup recording if it was started
        try {
            await recordingManager.stopRecording(req.params.id);
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }

        res.status(500).json({
            error: 'Failed to start live course',
            message: error.message
        });
    }
};

/**
 * Complete a live course
 * @desc Mark a live course as completed, stop recording, and cleanup resources
 */
const completeLiveCourse = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get course data (from Firebase or mock)
        const courseResult = await getCourseData(id);
        
        if (!courseResult.exists) {
            return res.status(404).json({
                error: 'Live course not found',
                message: `No live course found with ID: ${id}`
            });
        }

        const course = courseResult.data;
        const currentDateTime = new Date();

        // Check if course is already completed
        if (course.status === 'completed') {
            return res.status(400).json({
                error: 'Course already completed',
                message: 'This course is already marked as completed'
            });
        }

        console.log(`🏁 Completing live course: ${course.name || 'Unknown Course'} (${id})`);

        // End meeting room for video conferencing
        const meetingEndResult = await endLiveCourseRoom(id);
        console.log(`📅 Meeting room end result for course ${id}:`, meetingEndResult.message || 'Meeting room ended');

        // Stop recording if it was active
        const recordingResult = await recordingManager.stopRecording(id);
        console.log(`📹 Recording stop result for course ${id}:`, recordingResult.message);

        // Prepare update data
        const updateData = {
            status: 'completed',
            completedAt: currentDateTime.toISOString(),
            updatedAt: currentDateTime.toISOString()
        };

        // Add recording completion info if recording was stopped
        if (recordingResult.recording && recordingResult.recordingInfo) {
            updateData.recordingActive = false;
            updateData.recordingCompletedAt = recordingResult.recordingInfo.endedAt;
            updateData.recordingDuration = recordingResult.recordingInfo.duration;
            updateData.recordingFileSize = recordingResult.recordingInfo.size;
            updateData.recordingUrl = recordingResult.recordingInfo.recordingUrl;
        }

        // Clear meeting room info
        if (course.meetingCode) {
            updateData.meetingCode = null;
            updateData.meetingId = null;
        }

        // Update course status
        await courseResult.ref.update(updateData);

        // Prepare response data
        const responseData = {
            id: id,
            status: 'completed',
            completedAt: currentDateTime.toISOString(),
            courseName: course.name || 'Unknown Course'
        };

        // Add recording completion details if available
        if (recordingResult.recording && recordingResult.recordingInfo) {
            responseData.recordingInfo = {
                fileName: recordingResult.recordingInfo.fileName,
                recordingUrl: recordingResult.recordingInfo.recordingUrl,
                duration: recordingResult.recordingInfo.duration,
                size: recordingResult.recordingInfo.size,
                startedAt: recordingResult.recordingInfo.startedAt,
                endedAt: recordingResult.recordingInfo.endedAt,
                status: 'completed'
            };
        }

        // Calculate total course duration if startedAt is available
        if (course.startedAt) {
            const startTime = new Date(course.startedAt);
            const totalDuration = Math.floor((currentDateTime - startTime) / 1000);
            responseData.totalDuration = totalDuration;
        }

        console.log(`✅ Live course ${id} completed successfully`);

        res.status(200).json({
            success: true,
            message: 'Live course completed successfully with recording and resource cleanup',
            data: responseData
        });

    } catch (error) {
        console.error('Error completing live course:', error);
        res.status(500).json({
            error: 'Failed to complete live course',
            message: error.message
        });
    }
};

/**
 * Get live courses by category from Firebase
 */
const getLiveCoursesByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const db = getFirestore();
        
        if (!db) {
            // Use mock data when Firebase is not configured
            console.log(`📝 Using mock data for getLiveCoursesByCategory: ${category}`);
            const courses = Array.from(mockCourses.values())
                .filter(course => course.category === category)
                .map(course => addDurationToCourse(course));
            return res.status(200).json({
                success: true,
                data: courses,
                count: courses.length,
                category: category,
                message: 'Live courses retrieved from mock data'
            });
        }

        const coursesRef = db.collection('live_courses').where('category', '==', category);
        const snapshot = await coursesRef.get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                data: [],
                message: `No live courses found in category: ${category}`
            });
        }

        const courses = [];
        snapshot.forEach(doc => {
            const courseData = addDurationToCourse({
                id: doc.id,
                ...doc.data()
            });
            courses.push(courseData);
        });

        res.status(200).json({
            success: true,
            data: courses,
            count: courses.length,
            category: category
        });

    } catch (error) {
        console.error('Error fetching courses by category:', error);
        res.status(500).json({
            error: 'Failed to fetch courses by category',
            message: error.message
        });
    }
};

/**
 * Get enrolled users for a specific live course
 */
const getLiveCourseUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getFirestore();
        
        if (!db) {
            return res.status(500).json({
                error: 'Firebase not configured',
                message: 'Please configure Firebase to use this endpoint. Set FIREBASE_PROJECT_ID and provide credentials.',
                documentation: 'https://firebase.google.com/docs/admin/setup'
            });
        }

        // First get the course to access enrolledUsers
        console.log(`Fetching course with ID: ${id}`);
        const courseDoc = await db.collection('live_courses').doc(id).get();

        if (!courseDoc.exists) {
            console.log(`Course not found: ${id}`);
            return res.status(404).json({
                error: 'Live course not found',
                message: `No live course found with ID: ${id}`,
                hint: 'Ensure the course exists in the live_courses collection'
            });
        }

        const course = courseDoc.data();
        console.log(`Course found: ${course.name || 'Unknown Course'}`);
        
        // Get enrolled users array with better validation
        const enrolledUserIds = course.enrolledUsers || course.enrolledusers || [];
        console.log(`Enrolled user IDs found: ${JSON.stringify(enrolledUserIds)}`);

        if (!Array.isArray(enrolledUserIds)) {
            console.warn('enrolledUsers field is not an array:', enrolledUserIds);
            return res.status(200).json({
                success: true,
                data: [],
                message: 'Invalid enrolledUsers field format - expected array',
                courseId: id,
                courseName: course.name || 'Unknown Course',
                totalEnrolled: 0,
                debug: {
                    enrolledUsersType: typeof enrolledUserIds,
                    enrolledUsersValue: enrolledUserIds,
                    hint: 'The enrolledUsers field should be an array of user IDs'
                }
            });
        }

        if (enrolledUserIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No enrolled users found for this course',
                courseId: id,
                courseName: course.name || 'Unknown Course',
                totalEnrolled: 0
            });
        }

        // Fetch user details for enrolled users with improved error handling
        const users = [];
        const failedUserIds = [];
        
        console.log(`Fetching details for ${enrolledUserIds.length} enrolled users...`);
        for (const userId of enrolledUserIds) {
            if (!userId || typeof userId !== 'string') {
                console.warn(`Invalid user ID: ${userId}`);
                failedUserIds.push({ id: userId, reason: 'Invalid user ID format' });
                continue;
            }
            
            try {
                console.log(`Fetching user: ${userId}`);
                const userDoc = await db.collection('users').doc(userId).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    users.push({
                        id: userDoc.id,
                        ...userData
                    });
                    console.log(`User ${userId} found: ${userData.name || 'No name'}`);
                } else {
                    console.log(`User ${userId} not found in users collection`);
                    failedUserIds.push({ id: userId, reason: 'User document not found in users collection' });
                }
            } catch (userError) {
                console.warn(`Failed to fetch user ${userId}:`, userError.message);
                failedUserIds.push({ id: userId, reason: userError.message });
            }
        }

        const response = {
            success: true,
            data: users,
            count: users.length,
            courseId: id,
            courseName: course.name || 'Unknown Course',
            totalEnrolled: enrolledUserIds.length,
            // Include course metadata as requested
            scheduledDateTime: course.scheduledDateTime || null,
            estimatedDuration: course.estimatedDuration || course.duration || 60,
            createdAt: course.createdAt || null,
            category: course.category || null,
            updatedAt: course.updatedAt || null
        };

        // Include debugging info if some users failed to load
        if (failedUserIds.length > 0) {
            response.warnings = {
                message: `${failedUserIds.length} out of ${enrolledUserIds.length} user(s) could not be loaded`,
                failedUsers: failedUserIds,
                hint: 'Check if these users exist in the users collection'
            };
        }

        console.log(`Successfully fetched ${users.length} out of ${enrolledUserIds.length} enrolled users`);
        res.status(200).json(response);

    } catch (error) {
        console.error('Error fetching course users:', error);
        
        // Provide specific error messages for common Firebase issues
        let errorMessage = error.message;
        let hint = 'Check server logs for detailed error information';
        
        if (error.message.includes('Could not load the default credentials')) {
            errorMessage = 'Firebase credentials not configured properly';
            hint = 'Set up Firebase service account credentials. See documentation for setup instructions.';
        } else if (error.message.includes('Permission denied')) {
            errorMessage = 'Firebase permissions error';
            hint = 'Check Firestore security rules and ensure the service account has proper permissions.';
        }
        
        res.status(500).json({
            error: 'Failed to fetch course users',
            message: errorMessage,
            hint: hint,
            debug: {
                courseId: req.params.id,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
};

/**
 * Get users who have joined a specific live course
 * Creates the course if it doesn't exist
 */
const getLiveCourseJoinedUsers = async (req, res) => {
    try {
        const { id } = req.params;

        // Get course data (from Firebase or mock)
        let courseResult = await getCourseData(id);
        
        // If course doesn't exist, create it
        if (!courseResult.exists) {
            console.log(`Creating new live course with ID: ${id}`);
            
            // Create a new course with default settings
            const newCourseData = {
                id: id,
                name: `Live Course ${id}`,
                status: 'scheduled',
                category: 'beauty',
                joinedUsers: [],
                joinedAt: {},
                enrolledUsers: [],
                recordingEnabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Try to create in Firebase first, fallback to mock
            const db = getFirestore();
            if (db) {
                try {
                    const courseRef = db.collection('live_courses').doc(id);
                    await courseRef.set(newCourseData);
                    console.log(`✅ Course ${id} created in Firebase`);
                    
                    courseResult = {
                        exists: true,
                        data: newCourseData,
                        ref: courseRef
                    };
                } catch (error) {
                    console.warn('Firebase creation error, using mock data:', error.message);
                    // Fallback to mock storage
                    mockCourses.set(id, newCourseData);
                    courseResult = {
                        exists: true,
                        data: newCourseData,
                        ref: {
                            update: async (updateData) => {
                                const course = mockCourses.get(id);
                                mockCourses.set(id, { ...course, ...updateData });
                                console.log(`📝 Mock course ${id} updated:`, updateData);
                            }
                        }
                    };
                }
            } else {
                // No Firebase, use mock storage
                mockCourses.set(id, newCourseData);
                courseResult = {
                    exists: true,
                    data: newCourseData,
                    ref: {
                        update: async (updateData) => {
                            const course = mockCourses.get(id);
                            mockCourses.set(id, { ...course, ...updateData });
                            console.log(`📝 Mock course ${id} updated:`, updateData);
                        }
                    }
                };
            }
            console.log(`✅ New course created: ${newCourseData.name}`);
        }

        const course = courseResult.data;
        console.log(`Course found: ${course.name || 'Unknown Course'}`);
        
        // Get joined users array
        const joinedUserIds = course.joinedUsers || [];
        const joinedAt = course.joinedAt || {};
        console.log(`Joined user IDs found: ${JSON.stringify(joinedUserIds)}`);

        if (!Array.isArray(joinedUserIds)) {
            console.warn('joinedUsers field is not an array:', joinedUserIds);
            return res.status(200).json({
                success: true,
                data: [],
                message: 'Invalid joinedUsers field format - expected array',
                courseId: id,
                courseName: course.name || 'Unknown Course',
                totalJoined: 0,
                joinusercount: 0
            });
        }

        if (joinedUserIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No users have joined this live course yet',
                courseId: id,
                courseName: course.name || 'Unknown Course',
                totalJoined: 0,
                joinusercount: 0
            });
        }

        // For mock data, create simple user objects with the available information
        const users = joinedUserIds.map(userId => ({
            id: userId,
            name: `User ${userId}`, // In real scenario, this would come from users collection
            joinedAt: joinedAt[userId] || null,
            role: 'student' // Default role
        }));

        const response = {
            success: true,
            data: users,
            count: users.length,
            courseId: id,
            courseName: course.name || 'Unknown Course',
            totalJoined: users.length,
            joinusercount: users.length,
            courseStatus: course.status || 'unknown'
        };

        console.log(`Successfully fetched ${users.length} joined users`);
        res.status(200).json(response);

    } catch (error) {
        console.error('Error fetching joined users:', error);
        
        // Provide specific error messages for common Firebase issues
        let errorMessage = error.message;
        let hint = 'Check server logs for detailed error information';
        
        if (error.message.includes('Could not load the default credentials')) {
            errorMessage = 'Firebase credentials not configured properly';
            hint = 'Set up Firebase service account credentials. See documentation for setup instructions.';
        } else if (error.message.includes('Permission denied')) {
            errorMessage = 'Firebase permissions error';
            hint = 'Check Firestore security rules and ensure the service account has proper permissions.';
        }
        
        res.status(500).json({
            error: 'Failed to fetch joined users',
            message: errorMessage,
            hint: hint,
            debug: {
                courseId: req.params.id,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
};

/**
 * Join a user to a live course
 */
const joinLiveCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, userName } = req.body;

        // Validate required fields
        if (!userId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'userId is required in request body'
            });
        }

        // Get course data (from Firebase or mock)
        const courseResult = await getCourseData(id);
        
        if (!courseResult.exists) {
            return res.status(404).json({
                error: 'Live course not found',
                message: `No live course found with ID: ${id}`
            });
        }

        const course = courseResult.data;
        console.log(`Course found: ${course.name || 'Unknown Course'}, Status: ${course.status}`);

        // Check if course is completed
        if (course.status === 'completed') {
            return res.status(400).json({
                error: 'Course completed',
                message: 'Cannot join a completed course',
                courseId: id,
                courseName: course.name || 'Unknown Course'
            });
        }

        // Get current joined users
        const currentJoinedUsers = course.joinedUsers || [];
        const currentJoinedAt = course.joinedAt || {};

        // Check if user is already joined
        if (currentJoinedUsers.includes(userId)) {
            return res.status(200).json({
                success: true,
                message: 'User is already joined to this course',
                data: {
                    courseId: id,
                    courseName: course.name || 'Unknown Course',
                    userId: userId,
                    userName: userName || 'Unknown User',
                    joinedAt: currentJoinedAt[userId] || null,
                    totalJoinedUsers: currentJoinedUsers.length,
                    joinusercount: currentJoinedUsers.length,
                    courseStatus: course.status || 'unknown',
                    alreadyJoined: true
                }
            });
        }

        // Add user to joined users array and record join time
        const updatedJoinedUsers = [...currentJoinedUsers, userId];
        const updatedJoinedAt = {
            ...currentJoinedAt,
            [userId]: new Date().toISOString()
        };

        // Update the course document
        const updateData = {
            joinedUsers: updatedJoinedUsers,
            joinedAt: updatedJoinedAt,
            updatedAt: new Date().toISOString()
        };

        await courseResult.ref.update(updateData);

        console.log(`User ${userId} successfully joined course ${id}`);

        res.status(200).json({
            success: true,
            message: 'User successfully joined the live course',
            data: {
                courseId: id,
                courseName: course.name || 'Unknown Course',
                userId: userId,
                userName: userName || 'Unknown User',
                joinedAt: updatedJoinedAt[userId],
                totalJoinedUsers: updatedJoinedUsers.length,
                joinusercount: updatedJoinedUsers.length,
                courseStatus: course.status || 'unknown'
            }
        });

    } catch (error) {
        console.error('Error joining live course:', error);
        
        // Provide specific error messages for common Firebase issues
        let errorMessage = error.message;
        let hint = 'Check server logs for detailed error information';
        
        if (error.message.includes('Could not load the default credentials')) {
            errorMessage = 'Firebase credentials not configured properly';
            hint = 'Set up Firebase service account credentials. See documentation for setup instructions.';
        } else if (error.message.includes('Permission denied')) {
            errorMessage = 'Firebase permissions error';
            hint = 'Check Firestore security rules and ensure the service account has proper permissions.';
        }
        
        res.status(500).json({
            error: 'Failed to join live course',
            message: errorMessage,
            hint: hint,
            debug: {
                courseId: req.params.id,
                userId: req.body.userId,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
};

/**
 * Get recording status for a live course
 * @desc Get current recording status and information for a course
 */
const getRecordingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get course data to verify course exists and get course info
        const courseResult = await getCourseData(id);
        
        if (!courseResult.exists) {
            return res.status(404).json({
                error: 'Live course not found',
                message: `No live course found with ID: ${id}`
            });
        }

        const course = courseResult.data;
        
        // Get recording status from recording manager
        const recordingStatus = recordingManager.getRecordingStatus(id);
        
        // Get meeting room info
        const meetingInfo = getLiveCourseRoom(id);
        
        // Prepare response
        const responseData = {
            courseId: id,
            courseName: course.name || 'Unknown Course',
            courseStatus: course.status,
            recordingEnabled: course.recordingEnabled || false,
            recording: recordingStatus
        };

        // Add meeting info if available
        if (meetingInfo) {
            responseData.meeting = meetingInfo;
        }

        res.status(200).json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('Error getting recording status:', error);
        res.status(500).json({
            error: 'Failed to get recording status',
            message: error.message
        });
    }
};

/**
 * Leave a live course (for host to temporarily leave and rejoin)
 * @desc Allow host to leave a live course temporarily while maintaining the session
 */
const leaveLiveCourse = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get course data (from Firebase or mock)
        const courseResult = await getCourseData(id);
        
        if (!courseResult.exists) {
            return res.status(404).json({
                error: 'Live course not found',
                message: `No live course found with ID: ${id}`
            });
        }

        const course = courseResult.data;
        
        // Check if course is active
        if (course.status !== 'active') {
            return res.status(400).json({
                error: 'Course not active',
                message: 'Cannot leave an inactive course'
            });
        }

        console.log(`🚪 Host leaving live course: ${course.name || 'Unknown Course'} (${id})`);

        // Stop recording if active (temporary leave should discard recording data)
        const recordingResult = await recordingManager.discardRecording(id);
        
        // Update course status to 'paused' to indicate host has left temporarily
        const updateData = {
            status: 'paused',
            hostLeftAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await courseResult.ref.update(updateData);

        // Prepare response
        const responseData = {
            courseId: id,
            courseName: course.name || 'Unknown Course',
            status: 'paused',
            hostLeftAt: updateData.hostLeftAt,
            message: 'Host has left the session temporarily. Session is paused.'
        };

        // Add recording info if applicable
        if (recordingResult.recording !== undefined) {
            responseData.recordingInfo = {
                status: 'discarded',
                message: recordingResult.message
            };
        }

        console.log(`✅ Host left live course ${id} successfully`);

        res.status(200).json({
            success: true,
            message: 'Host left the live course successfully. Session paused.',
            data: responseData
        });

    } catch (error) {
        console.error('Error leaving live course:', error);
        res.status(500).json({
            error: 'Failed to leave live course',
            message: error.message
        });
    }
};

module.exports = {
    getAllLiveCourses,
    getLiveCourseById,
    getLiveCoursesByInstructor,
    getLiveCoursesByStatus,
    getLiveCoursesByCategory,
    getLiveCourseUsers,
    getLiveCourseJoinedUsers,
    joinLiveCourse,
    leaveLiveCourse,
    createLiveCourse,
    scheduleliveCourses,
    startLiveCourse,
    completeLiveCourse,
    getRecordingStatus
};