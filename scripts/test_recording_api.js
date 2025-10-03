#!/usr/bin/env node

/**
 * Test script for Beauty LMS Recording API
 * This script tests all recording endpoints and functionality
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_COURSE_ID = 'test-course-123';

// Colors for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
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

// Test functions
async function testHealthCheck() {
    info('Testing health check endpoint...');
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        if (response.status === 200) {
            success('Health check passed');
            return true;
        } else {
            error(`Health check failed with status: ${response.status}`);
            return false;
        }
    } catch (err) {
        error(`Health check failed: ${err.message}`);
        return false;
    }
}

async function testStartRecording() {
    info('Testing start recording...');
    try {
        const response = await axios.post(`${BASE_URL}/api/courses/${TEST_COURSE_ID}/recording/start`, {
            courseData: {
                name: 'Test Course',
                recordingEnabled: true
            },
            mediaOptions: {
                video: true,
                audio: true
            }
        });
        
        if (response.data.success) {
            success('Recording started successfully');
            log(`   Recording file: ${response.data.recordingInfo?.fileName || 'N/A'}`);
            return true;
        } else {
            error('Failed to start recording');
            log(`   Error: ${response.data.message || 'Unknown error'}`);
            return false;
        }
    } catch (err) {
        error(`Start recording failed: ${err.message}`);
        if (err.response?.data) {
            log(`   Server error: ${JSON.stringify(err.response.data)}`);
        }
        return false;
    }
}

async function testRecordingStatus() {
    info('Testing recording status...');
    try {
        const response = await axios.get(`${BASE_URL}/api/courses/${TEST_COURSE_ID}/recording/status`);
        
        if (response.data.success) {
            success('Recording status retrieved');
            log(`   Status: ${response.data.status}`);
            log(`   Recording: ${response.data.recording ? 'Active' : 'Inactive'}`);
            if (response.data.fileName) {
                log(`   File: ${response.data.fileName}`);
            }
            return true;
        } else {
            error('Failed to get recording status');
            return false;
        }
    } catch (err) {
        error(`Recording status failed: ${err.message}`);
        return false;
    }
}

async function testStopRecording() {
    info('Testing stop recording...');
    try {
        // Wait a bit before stopping
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const response = await axios.post(`${BASE_URL}/api/courses/${TEST_COURSE_ID}/recording/stop`);
        
        if (response.data.success) {
            success('Recording stopped successfully');
            if (response.data.recordingInfo?.recordingUrl) {
                log(`   Recording URL: ${response.data.recordingInfo.recordingUrl}`);
            }
            return true;
        } else {
            error('Failed to stop recording');
            log(`   Error: ${response.data.message || 'Unknown error'}`);
            return false;
        }
    } catch (err) {
        error(`Stop recording failed: ${err.message}`);
        if (err.response?.data) {
            log(`   Server error: ${JSON.stringify(err.response.data)}`);
        }
        return false;
    }
}

async function testListRecordings() {
    info('Testing list recordings...');
    try {
        const response = await axios.get(`${BASE_URL}/api/recordings`);
        
        if (response.data.success) {
            success(`Found ${response.data.recordings.length} recordings`);
            response.data.recordings.forEach((recording, index) => {
                log(`   ${index + 1}. ${recording.fileName} (${recording.courseId})`);
                log(`      URL: ${recording.url}`);
                log(`      Size: ${Math.round(recording.size / 1024)} KB`);
            });
            return true;
        } else {
            error('Failed to list recordings');
            return false;
        }
    } catch (err) {
        error(`List recordings failed: ${err.message}`);
        return false;
    }
}

async function testGetRecordingByCourse() {
    info('Testing get recording by course...');
    try {
        const response = await axios.get(`${BASE_URL}/api/courses/${TEST_COURSE_ID}/recording`);
        
        if (response.status === 200 && response.data.success) {
            success('Recording found for course');
            log(`   URL: ${response.data.recording.url}`);
            log(`   File: ${response.data.recording.fileName}`);
            return true;
        } else if (response.status === 404) {
            warning('No recording found for test course (this is expected for new tests)');
            return true;
        } else {
            error('Unexpected response for get recording');
            return false;
        }
    } catch (err) {
        if (err.response?.status === 404) {
            warning('No recording found for test course (this is expected for new tests)');
            return true;
        } else {
            error(`Get recording failed: ${err.message}`);
            return false;
        }
    }
}

async function testCleanupOldRecordings() {
    info('Testing cleanup old recordings...');
    try {
        const response = await axios.post(`${BASE_URL}/api/recordings/cleanup`, {
            maxAgeDays: 30
        });
        
        if (response.data.success) {
            success('Cleanup completed');
            log(`   Cleaned files: ${response.data.cleanedCount}`);
            return true;
        } else {
            error('Failed to cleanup recordings');
            return false;
        }
    } catch (err) {
        error(`Cleanup failed: ${err.message}`);
        return false;
    }
}

// Main test runner
async function runTests() {
    log('🧪 Starting Beauty LMS Recording API Tests', 'blue');
    log('=' .repeat(50));
    
    const tests = [
        { name: 'Health Check', fn: testHealthCheck },
        { name: 'Start Recording', fn: testStartRecording },
        { name: 'Recording Status', fn: testRecordingStatus },
        { name: 'Stop Recording', fn: testStopRecording },
        { name: 'List Recordings', fn: testListRecordings },
        { name: 'Get Recording by Course', fn: testGetRecordingByCourse },
        { name: 'Cleanup Old Recordings', fn: testCleanupOldRecordings }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        log(`\n📝 Running: ${test.name}`);
        try {
            const result = await test.fn();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            error(`Test ${test.name} threw an exception: ${error.message}`);
            failed++;
        }
    }
    
    log('\n' + '=' .repeat(50));
    log(`🎯 Test Results: ${passed} passed, ${failed} failed`, failed === 0 ? 'green' : 'red');
    
    if (failed === 0) {
        success('All tests passed! 🎉');
        process.exit(0);
    } else {
        error('Some tests failed. Check the output above for details.');
        process.exit(1);
    }
}

// Check if axios is available
try {
    require.resolve('axios');
} catch (e) {
    error('axios is not installed. Please run: npm install axios');
    process.exit(1);
}

// Run the tests
runTests().catch(err => {
    error(`Test runner failed: ${err.message}`);
    process.exit(1);
});