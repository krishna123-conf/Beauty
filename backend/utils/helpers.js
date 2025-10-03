/**
 * Utility functions for the Beauty LMS Video Conferencing Backend
 */

/**
 * Generate a random string of specified length
 */
const generateRandomString = (length = 10) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Format timestamp to readable string
 */
const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
};

/**
 * Sanitize string input to prevent XSS
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

/**
 * Validate meeting code format (6 digits)
 */
const isValidMeetingCode = (code) => {
    return /^\d{6}$/.test(code);
};

/**
 * Create error response object
 */
const createErrorResponse = (error, message, statusCode = 500) => {
    return {
        error,
        message,
        statusCode,
        timestamp: new Date().toISOString()
    };
};

/**
 * Create success response object
 */
const createSuccessResponse = (data, message = 'Success') => {
    return {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    };
};

/**
 * Log API request details
 */
const logRequest = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
};

/**
 * Rate limiting utility
 */
const rateLimitMap = new Map();

const isRateLimited = (identifier, maxRequests = 100, windowMs = 60000) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitMap.has(identifier)) {
        rateLimitMap.set(identifier, []);
    }
    
    const requests = rateLimitMap.get(identifier);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    rateLimitMap.set(identifier, validRequests);
    
    // Check if limit exceeded
    if (validRequests.length >= maxRequests) {
        return true;
    }
    
    // Add current request
    validRequests.push(now);
    return false;
};

module.exports = {
    generateRandomString,
    isValidEmail,
    formatTimestamp,
    sanitizeInput,
    isValidMeetingCode,
    createErrorResponse,
    createSuccessResponse,
    logRequest,
    isRateLimited
};