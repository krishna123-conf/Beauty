const { v4: uuidv4 } = require('uuid');
const { createRouter } = require('../config/mediasoup');

// In-memory storage for live course meetings (in production, use Redis or database)
const meetings = new Map();
const participants = new Map();
const liveCourseRooms = new Map(); // courseId -> meetingCode mapping

/**
 * Generate a unique 6-digit meeting code
 */
const generateMeetingCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create a meeting room for a live course
 * @param {string} courseId - The live course ID
 * @param {object} courseData - Course data
 * @param {object} router - MediaSoup router (optional)
 */
const createLiveCourseRoom = async (courseId, courseData, router = null) => {
    try {
        // Check if live course already has a room
        if (liveCourseRooms.has(courseId)) {
            const existingMeetingCode = liveCourseRooms.get(courseId);
            const existingMeeting = meetings.get(existingMeetingCode);
            if (existingMeeting && existingMeeting.status !== 'ended') {
                console.log(`📅 Using existing meeting room for course ${courseId}: ${existingMeetingCode}`);
                return {
                    success: true,
                    meetingCode: existingMeetingCode,
                    meetingId: existingMeeting.id,
                    existed: true
                };
            }
        }

        // Generate unique meeting code for the course
        let meetingCode;
        do {
            meetingCode = generateMeetingCode();
        } while (meetings.has(meetingCode));

        // Use provided router or create a new one
        const meetingRouter = router || await createRouter();

        // Get instructor name from course data
        const hostName = courseData.instructorName || `Course Instructor`;

        // Create meeting object for live course
        const meeting = {
            id: uuidv4(),
            code: meetingCode,
            title: courseData.name || `Live Course ${courseId}`,
            description: `Live course meeting room for: ${courseData.name || 'Unknown Course'}`,
            hostName,
            hostId: courseData.instructorId || uuidv4(),
            router: meetingRouter,
            participants: new Map(),
            createdAt: new Date().toISOString(),
            status: 'active', // Live courses start as active
            courseId: courseId, // Link to course
            isLiveCourse: true
        };

        meetings.set(meetingCode, meeting);
        liveCourseRooms.set(courseId, meetingCode);

        console.log(`📅 Live course meeting room created: ${meetingCode} for course ${courseId}`);

        return {
            success: true,
            meetingCode: meetingCode,
            meetingId: meeting.id,
            routerId: meetingRouter.id,
            created: true
        };

    } catch (error) {
        console.error(`❌ Failed to create meeting room for course ${courseId}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * End a live course meeting room
 * @param {string} courseId - The live course ID
 */
const endLiveCourseRoom = async (courseId) => {
    try {
        const meetingCode = liveCourseRooms.get(courseId);
        if (!meetingCode) {
            console.log(`📅 No meeting room found for course ${courseId}`);
            return { success: true, message: 'No meeting room to end' };
        }

        const meeting = meetings.get(meetingCode);
        if (!meeting) {
            console.log(`📅 Meeting ${meetingCode} not found for course ${courseId}`);
            liveCourseRooms.delete(courseId);
            return { success: true, message: 'Meeting room already cleaned up' };
        }

        // Update meeting status
        meeting.status = 'ended';
        meeting.endedAt = new Date().toISOString();

        // Close MediaSoup router
        if (meeting.router) {
            meeting.router.close();
        }

        // Clean up participants
        meeting.participants.clear();

        // Remove from tracking maps
        liveCourseRooms.delete(courseId);

        console.log(`📅 Live course meeting room ended: ${meetingCode} for course ${courseId}`);

        return {
            success: true,
            meetingCode: meetingCode,
            endedAt: meeting.endedAt
        };

    } catch (error) {
        console.error(`❌ Failed to end meeting room for course ${courseId}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get meeting room info for a live course
 * @param {string} courseId - The live course ID
 */
const getLiveCourseRoom = (courseId) => {
    const meetingCode = liveCourseRooms.get(courseId);
    if (!meetingCode) {
        return null;
    }

    const meeting = meetings.get(meetingCode);
    if (!meeting) {
        liveCourseRooms.delete(courseId);
        return null;
    }

    return {
        meetingCode: meeting.code,
        meetingId: meeting.id,
        title: meeting.title,
        status: meeting.status,
        participantCount: meeting.participants.size,
        createdAt: meeting.createdAt
    };
};

module.exports = {
    createLiveCourseRoom,
    endLiveCourseRoom,
    getLiveCourseRoom,
    meetings,
    participants,
    liveCourseRooms
};