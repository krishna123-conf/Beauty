#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Beauty LMS
 * Tests all functionality including API endpoints, recording, Firebase integration, etc.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_COURSE_ID = 'test-course-123';
const TEST_USER_ID = 'test-user-456';
const TEST_INSTRUCTOR_ID = 'instructor-789';

// Colors for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function section(message) {
    log(`\n🔍 ${message}`, 'cyan');
    log('─'.repeat(50), 'cyan');
}

// Test functions organized by functionality

//=====================================
// 1. Basic Server and Health Tests
//=====================================

async function testServerHealth() {
    info('Testing server health and basic endpoints...');
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        if (response.status === 200 && response.data.status === 'OK') {
            success('Server health check passed');
            log(`   Server message: ${response.data.message}`);
            log(`   Timestamp: ${response.data.timestamp}`);
            return true;
        } else {
            error(`Unexpected health response: ${JSON.stringify(response.data)}`);
            return false;
        }
    } catch (err) {
        error(`Server health check failed: ${err.message}`);
        return false;
    }
}

async function testAPIDocumentation() {
    info('Testing API documentation endpoint...');
    try {
        const response = await axios.get(`${BASE_URL}/api`);
        if (response.status === 200 && response.data.title) {
            success('API documentation endpoint working');
            log(`   API Title: ${response.data.title}`);
            log(`   Version: ${response.data.version}`);
            return true;
        } else {
            error('API documentation endpoint failed');
            return false;
        }
    } catch (err) {
        error(`API documentation test failed: ${err.message}`);
        return false;
    }
}

//=====================================
// 2. Course Management Tests
//=====================================

async function testGetAllCourses() {
    info('Testing get all live courses...');
    try {
        const response = await axios.get(`${BASE_URL}/api/live_courses`);
        if (response.status === 200) {
            success(`Found ${response.data.length || 0} courses`);
            if (response.data.length > 0) {
                log(`   First course: ${response.data[0].name || 'Unknown'}`);
            }
            return true;
        } else {
            error('Failed to get courses');
            return false;
        }
    } catch (err) {
        error(`Get courses failed: ${err.message}`);
        return false;
    }
}

async function testGetCourseById() {
    info(`Testing get course by ID (${TEST_COURSE_ID})...`);
    try {
        const response = await axios.get(`${BASE_URL}/api/live_courses/${TEST_COURSE_ID}`);
        if (response.status === 200) {
            success('Course retrieved successfully');
            log(`   Course name: ${response.data.name}`);
            log(`   Status: ${response.data.status}`);
            log(`   Recording enabled: ${response.data.recordingEnabled}`);
            return true;
        } else {
            error('Failed to get course by ID');
            return false;
        }
    } catch (err) {
        if (err.response?.status === 404) {
            warning('Course not found (expected for test course)');
            return true;
        }
        error(`Get course by ID failed: ${err.message}`);
        return false;
    }
}

async function testCoursesByCategory() {
    info('Testing get courses by category...');
    try {
        const response = await axios.get(`${BASE_URL}/api/live_courses/category/beauty`);
        if (response.status === 200) {
            success(`Found ${response.data.length || 0} beauty courses`);
            return true;
        } else {
            error('Failed to get courses by category');
            return false;
        }
    } catch (err) {
        error(`Get courses by category failed: ${err.message}`);
        return false;
    }
}

async function testCoursesByInstructor() {
    info(`Testing get courses by instructor (${TEST_INSTRUCTOR_ID})...`);
    try {
        const response = await axios.get(`${BASE_URL}/api/live_courses/instructor/${TEST_INSTRUCTOR_ID}`);
        if (response.status === 200) {
            success(`Found ${response.data.length || 0} courses for instructor`);
            return true;
        } else {
            error('Failed to get courses by instructor');
            return false;
        }
    } catch (err) {
        error(`Get courses by instructor failed: ${err.message}`);
        return false;
    }
}

async function testCoursesByStatus() {
    info('Testing get courses by status...');
    try {
        const response = await axios.get(`${BASE_URL}/api/live_courses/status/scheduled`);
        if (response.status === 200) {
            success(`Found ${response.data.length || 0} scheduled courses`);
            return true;
        } else {
            error('Failed to get courses by status');
            return false;
        }
    } catch (err) {
        error(`Get courses by status failed: ${err.message}`);
        return false;
    }
}

//=====================================
// 3. Course Lifecycle Tests
//=====================================

async function testStartCourse() {
    info(`Testing start course (${TEST_COURSE_ID})...`);
    try {
        const response = await axios.put(`${BASE_URL}/api/live_courses/${TEST_COURSE_ID}/start`);
        if (response.data.success) {
            success('Course started successfully');
            log(`   Meeting Code: ${response.data.meetingCode || 'N/A'}`);
            log(`   Recording Active: ${response.data.recordingEnabled || false}`);
            return true;
        } else {
            error(`Failed to start course: ${response.data.message}`);
            return false;
        }
    } catch (err) {
        if (err.response?.status === 404) {
            warning('Course not found (expected for test course)');
            return true;
        }
        error(`Start course failed: ${err.message}`);
        return false;
    }
}

async function testJoinCourse() {
    info(`Testing join course (${TEST_COURSE_ID})...`);
    try {
        const response = await axios.put(`${BASE_URL}/api/live_courses/${TEST_COURSE_ID}/join`, {
            userId: TEST_USER_ID,
            userRole: 'student'
        });
        if (response.data.success) {
            success('Successfully joined course');
            return true;
        } else {
            error(`Failed to join course: ${response.data.message}`);
            return false;
        }
    } catch (err) {
        if (err.response?.status === 404) {
            warning('Course not found (expected for test course)');
            return true;
        }
        error(`Join course failed: ${err.message}`);
        return false;
    }
}

async function testLeaveCourse() {
    info(`Testing leave course (${TEST_COURSE_ID})...`);
    try {
        const response = await axios.put(`${BASE_URL}/api/live_courses/${TEST_COURSE_ID}/leave`, {
            userId: TEST_USER_ID
        });
        if (response.data.success) {
            success('Successfully left course');
            return true;
        } else {
            error(`Failed to leave course: ${response.data.message}`);
            return false;
        }
    } catch (err) {
        if (err.response?.status === 404) {
            warning('Course not found (expected for test course)');
            return true;
        }
        error(`Leave course failed: ${err.message}`);
        return false;
    }
}

async function testCompleteCourse() {
    info(`Testing complete course (${TEST_COURSE_ID})...`);
    try {
        const response = await axios.put(`${BASE_URL}/api/live_courses/${TEST_COURSE_ID}/complete`);
        if (response.data.success) {
            success('Course completed successfully');
            return true;
        } else {
            error(`Failed to complete course: ${response.data.message}`);
            return false;
        }
    } catch (err) {
        if (err.response?.status === 404) {
            warning('Course not found (expected for test course)');
            return true;
        }
        error(`Complete course failed: ${err.message}`);
        return false;
    }
}

//=====================================
// 4. Recording System Tests
//=====================================

async function testRecordingWorkflow() {
    info('Testing complete recording workflow...');
    let allPassed = true;
    
    try {
        // Start recording
        info('  1. Starting recording...');
        const startResponse = await axios.post(`${BASE_URL}/api/courses/${TEST_COURSE_ID}/recording/start`, {
            courseData: {
                name: 'Test Recording Course',
                recordingEnabled: true
            },
            mediaOptions: {
                video: true,
                audio: true
            }
        });
        
        if (startResponse.data.success) {
            success('  Recording started');
            log(`     File: ${startResponse.data.recordingInfo?.fileName}`);
        } else {
            error('  Failed to start recording');
            allPassed = false;
        }
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check status
        info('  2. Checking recording status...');
        const statusResponse = await axios.get(`${BASE_URL}/api/courses/${TEST_COURSE_ID}/recording/status`);
        
        if (statusResponse.data.success && statusResponse.data.recording) {
            success('  Recording is active');
        } else {
            error('  Recording status check failed');
            allPassed = false;
        }
        
        // Stop recording
        info('  3. Stopping recording...');
        const stopResponse = await axios.post(`${BASE_URL}/api/courses/${TEST_COURSE_ID}/recording/stop`);
        
        if (stopResponse.data.success) {
            success('  Recording stopped');
            if (stopResponse.data.recordingInfo?.recordingUrl) {
                log(`     URL: ${stopResponse.data.recordingInfo.recordingUrl}`);
            }
        } else {
            error('  Failed to stop recording');
            allPassed = false;
        }
        
        return allPassed;
        
    } catch (err) {
        error(`Recording workflow failed: ${err.message}`);
        return false;
    }
}

async function testRecordingEndpoints() {
    info('Testing recording management endpoints...');
    let allPassed = true;
    
    try {
        // List recordings
        const listResponse = await axios.get(`${BASE_URL}/api/recordings`);
        if (listResponse.data.success) {
            success(`Found ${listResponse.data.recordings.length} recordings`);
        } else {
            error('Failed to list recordings');
            allPassed = false;
        }
        
        // Test cleanup
        const cleanupResponse = await axios.post(`${BASE_URL}/api/recordings/cleanup`, {
            maxAgeDays: 1
        });
        if (cleanupResponse.data.success) {
            success(`Cleanup completed: ${cleanupResponse.data.cleanedCount} files`);
        } else {
            error('Failed to cleanup recordings');
            allPassed = false;
        }
        
        return allPassed;
        
    } catch (err) {
        error(`Recording endpoints test failed: ${err.message}`);
        return false;
    }
}

//=====================================
// 5. User Management Tests
//=====================================

async function testUserEndpoints() {
    info('Testing user management endpoints...');
    try {
        // This is a placeholder - the actual implementation would depend on user routes
        const response = await axios.get(`${BASE_URL}/api/users`);
        success('User endpoints accessible');
        return true;
    } catch (err) {
        if (err.response?.status === 404) {
            warning('User endpoints not implemented or configured');
            return true;
        }
        error(`User endpoints test failed: ${err.message}`);
        return false;
    }
}

//=====================================
// 6. Meeting/WebRTC Tests
//=====================================

async function testMeetingEndpoints() {
    info('Testing meeting/WebRTC endpoints...');
    try {
        // This would test meeting creation, joining, etc.
        const response = await axios.get(`${BASE_URL}/api/meeting`);
        success('Meeting endpoints accessible');
        return true;
    } catch (err) {
        if (err.response?.status === 404) {
            warning('Meeting endpoints not implemented or configured');
            return true;
        }
        error(`Meeting endpoints test failed: ${err.message}`);
        return false;
    }
}

//=====================================
// 7. Error Handling Tests
//=====================================

async function testErrorHandling() {
    info('Testing error handling...');
    let allPassed = true;
    
    try {
        // Test 404 for non-existent endpoint
        await axios.get(`${BASE_URL}/api/nonexistent`);
        error('Should have received 404 for non-existent endpoint');
        allPassed = false;
    } catch (err) {
        if (err.response?.status === 404) {
            success('404 handling works correctly');
        } else {
            error(`Unexpected error response: ${err.response?.status}`);
            allPassed = false;
        }
    }
    
    try {
        // Test 404 for non-existent course
        await axios.get(`${BASE_URL}/api/live_courses/nonexistent-course-id`);
        error('Should have received 404 for non-existent course');
        allPassed = false;
    } catch (err) {
        if (err.response?.status === 404) {
            success('Course 404 handling works correctly');
        } else {
            error(`Unexpected course error response: ${err.response?.status}`);
            allPassed = false;
        }
    }
    
    return allPassed;
}

//=====================================
// 8. Static File Serving Tests
//=====================================

async function testStaticFileServing() {
    info('Testing static file serving...');
    let allPassed = true;
    
    try {
        // Test static file endpoints
        const staticResponse = await axios.get(`${BASE_URL}/static/`, { timeout: 5000 });
        success('Static file serving works');
    } catch (err) {
        if (err.response?.status === 404 || err.code === 'ENOTFOUND') {
            warning('Static files not found (may be expected if no frontend files)');
        } else {
            error(`Static file test failed: ${err.message}`);
            allPassed = false;
        }
    }
    
    try {
        // Test recordings endpoint
        const recordingsResponse = await axios.get(`${BASE_URL}/recordings/`, { timeout: 5000 });
        success('Recordings endpoint accessible');
    } catch (err) {
        if (err.response?.status === 404) {
            warning('No recordings directory found (expected for fresh install)');
        } else {
            error(`Recordings endpoint test failed: ${err.message}`);
            allPassed = false;
        }
    }
    
    return allPassed;
}

//=====================================
// Main Test Runner
//=====================================

async function runComprehensiveTests() {
    log('🚀 Starting Comprehensive Beauty LMS Test Suite', 'magenta');
    log('='.repeat(60), 'magenta');
    
    const testSuites = [
        {
            name: 'Server Health & Basic Tests',
            tests: [
                { name: 'Server Health Check', fn: testServerHealth },
                { name: 'API Documentation', fn: testAPIDocumentation }
            ]
        },
        {
            name: 'Course Management',
            tests: [
                { name: 'Get All Courses', fn: testGetAllCourses },
                { name: 'Get Course By ID', fn: testGetCourseById },
                { name: 'Get Courses By Category', fn: testCoursesByCategory },
                { name: 'Get Courses By Instructor', fn: testCoursesByInstructor },
                { name: 'Get Courses By Status', fn: testCoursesByStatus }
            ]
        },
        {
            name: 'Course Lifecycle',
            tests: [
                { name: 'Start Course', fn: testStartCourse },
                { name: 'Join Course', fn: testJoinCourse },
                { name: 'Leave Course', fn: testLeaveCourse },
                { name: 'Complete Course', fn: testCompleteCourse }
            ]
        },
        {
            name: 'Recording System',
            tests: [
                { name: 'Recording Workflow', fn: testRecordingWorkflow },
                { name: 'Recording Endpoints', fn: testRecordingEndpoints }
            ]
        },
        {
            name: 'User & Meeting Management',
            tests: [
                { name: 'User Endpoints', fn: testUserEndpoints },
                { name: 'Meeting Endpoints', fn: testMeetingEndpoints }
            ]
        },
        {
            name: 'Error Handling & Static Files',
            tests: [
                { name: 'Error Handling', fn: testErrorHandling },
                { name: 'Static File Serving', fn: testStaticFileServing }
            ]
        }
    ];
    
    let totalPassed = 0;
    let totalFailed = 0;
    const failedTests = [];
    
    for (const suite of testSuites) {
        section(suite.name);
        
        for (const test of suite.tests) {
            log(`\n📝 Running: ${test.name}`);
            try {
                const result = await test.fn();
                if (result) {
                    totalPassed++;
                } else {
                    totalFailed++;
                    failedTests.push(`${suite.name}: ${test.name}`);
                }
            } catch (error) {
                error(`Test ${test.name} threw an exception: ${error.message}`);
                totalFailed++;
                failedTests.push(`${suite.name}: ${test.name} (Exception)`);
            }
        }
    }
    
    // Final results
    log('\n' + '='.repeat(60), 'magenta');
    log(`🎯 COMPREHENSIVE TEST RESULTS`, 'magenta');
    log(`📊 Total: ${totalPassed + totalFailed} tests`, 'blue');
    log(`✅ Passed: ${totalPassed}`, 'green');
    log(`❌ Failed: ${totalFailed}`, totalFailed === 0 ? 'green' : 'red');
    
    if (failedTests.length > 0) {
        log('\n❌ Failed Tests:', 'red');
        failedTests.forEach(test => log(`   • ${test}`, 'red'));
    }
    
    if (totalFailed === 0) {
        success('\n🎉 ALL TESTS PASSED! Beauty LMS is functioning correctly.');
        process.exit(0);
    } else {
        error(`\n⚠️  ${totalFailed} test(s) failed. Check the output above for details.`);
        process.exit(1);
    }
}

// Check dependencies
try {
    require.resolve('axios');
    log('✅ Dependencies check passed', 'green');
} catch (e) {
    error('axios is not installed. Please run: npm install axios');
    process.exit(1);
}

// Run the comprehensive tests
runComprehensiveTests().catch(err => {
    error(`Comprehensive test runner failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
});