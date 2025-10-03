const { getFirestore } = require('../config/firebase');

// Mock data for testing without Firebase
const mockUsers = new Map();

// Initialize some mock users for testing
mockUsers.set('user1', {
    id: 'user1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'student',
    enrolledCourses: ['test123', 'test789'],
    joinedAt: '2023-11-01T08:00:00Z'
});

mockUsers.set('user2', {
    id: 'user2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    role: 'student',
    enrolledCourses: ['test123'],
    joinedAt: '2023-11-02T09:00:00Z'
});

mockUsers.set('instructor_456', {
    id: 'instructor_456',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'instructor',
    specialties: ['beauty', 'skincare'],
    coursesTeaching: ['test123'],
    joinedAt: '2023-10-15T08:00:00Z'
});

/**
 * Get all users from Firebase or mock data
 */
const getAllUsers = async (req, res) => {
    try {
        const db = getFirestore();
        if (!db) {
            // Use mock data when Firebase is not configured
            console.log('📝 Using mock data for getAllUsers');
            const users = Array.from(mockUsers.values());
            return res.status(200).json({
                success: true,
                data: users,
                count: users.length,
                message: 'Users retrieved from mock data'
            });
        }

        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No users found'
            });
        }

        const users = [];
        snapshot.forEach(doc => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.status(200).json({
            success: true,
            data: users,
            count: users.length
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message
        });
    }
};

/**
 * Get user by ID from Firebase
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getFirestore();
        
        if (!db) {
            return res.status(500).json({
                error: 'Firebase not configured',
                message: 'Please configure Firebase to use this endpoint'
            });
        }

        const userDoc = await db.collection('users').doc(id).get();

        if (!userDoc.exists) {
            return res.status(404).json({
                error: 'User not found',
                message: `No user found with ID: ${id}`
            });
        }

        res.status(200).json({
            success: true,
            data: {
                id: userDoc.id,
                ...userDoc.data()
            }
        });

    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            error: 'Failed to fetch user',
            message: error.message
        });
    }
};

/**
 * Get users by role from Firebase
 */
const getUsersByRole = async (req, res) => {
    try {
        const { role } = req.params;
        const db = getFirestore();
        
        if (!db) {
            return res.status(500).json({
                error: 'Firebase not configured',
                message: 'Please configure Firebase to use this endpoint'
            });
        }

        const usersRef = db.collection('users').where('role', '==', role);
        const snapshot = await usersRef.get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                data: [],
                message: `No users found with role: ${role}`
            });
        }

        const users = [];
        snapshot.forEach(doc => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.status(200).json({
            success: true,
            data: users,
            count: users.length,
            role: role
        });

    } catch (error) {
        console.error('Error fetching users by role:', error);
        res.status(500).json({
            error: 'Failed to fetch users by role',
            message: error.message
        });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    getUsersByRole
};