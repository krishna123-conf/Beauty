const express = require('express');
const router = express.Router();
const { 
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
} = require('../controllers/courseController');

/**
 * @route GET /api/live_courses
 * @desc Get all live courses from Firebase
 */
router.get('/', getAllLiveCourses);

/**
 * @route GET /api/live_courses/category/:category
 * @desc Get live courses by category from Firebase
 */
router.get('/category/:category', getLiveCoursesByCategory);

/**
 * @route GET /api/live_courses/:id/users
 * @desc Get enrolled users for a specific live course
 */
router.get('/:id/users', getLiveCourseUsers);

/**
 * @route GET /api/live_courses/:id/users/join
 * @desc Get users who have joined a specific live course
 */
router.get('/:id/users/join', getLiveCourseJoinedUsers);

/**
 * @route GET /api/live_courses/instructor/:instructorId
 * @desc Get live courses by instructor from Firebase
 */
router.get('/instructor/:instructorId', getLiveCoursesByInstructor);

/**
 * @route GET /api/live_courses/status/:status
 * @desc Get live courses by status from Firebase
 */
router.get('/status/:status', getLiveCoursesByStatus);

/**
 * @route GET /api/live_courses/:id
 * @desc Get live course by ID from Firebase
 */
router.get('/:id', getLiveCourseById);

/**
 * @route POST /api/live_courses
 * @desc Create a new live course
 */
router.post('/', createLiveCourse);

/**
 * @route POST /api/live_courses/schedule
 * @desc Schedule live courses based on datetime and enrollment
 */
router.post('/schedule', scheduleliveCourses);

/**
 * @route PUT /api/live_courses/:id/start
 * @desc Start a live course
 */
router.put('/:id/start', startLiveCourse);

/**
 * @route PUT /api/live_courses/:id/complete
 * @desc Complete a live course
 */
router.put('/:id/complete', completeLiveCourse);

/**
 * @route PUT /api/live_courses/:id/join
 * @desc Join a user to a live course
 */
router.put('/:id/join', joinLiveCourse);

/**
 * @route PUT /api/live_courses/:id/leave
 * @desc Leave a live course (host temporarily leaves)
 */
router.put('/:id/leave', leaveLiveCourse);

/**
 * @route GET /api/live_courses/:id/recording
 * @desc Get recording status for a live course
 */
router.get('/:id/recording', getRecordingStatus);

module.exports = router;