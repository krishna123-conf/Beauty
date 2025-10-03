const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, getUsersByRole } = require('../controllers/userController');

/**
 * @route GET /api/users
 * @desc Get all users from Firebase
 */
router.get('/', getAllUsers);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID from Firebase
 */
router.get('/:id', getUserById);

/**
 * @route GET /api/users/role/:role
 * @desc Get users by role from Firebase
 */
router.get('/role/:role', getUsersByRole);

module.exports = router;