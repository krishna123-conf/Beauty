import React, { useState } from 'react';
import { healthCheck, liveCourseAPI } from '../services/apiService';
import socketService from '../services/socketService';

const APITester: React.FC = () => {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (test: string, success: boolean, data?: any, error?: string) => {
    const result = {
      test,
      success,
      data,
      error,
      timestamp: new Date().toISOString(),
    };
    setTestResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runAllTests = async () => {
    setTesting(true);
    clearResults();

    // Test 1: Health Check
    try {
      const healthResponse = await healthCheck();
      addResult('Health Check', healthResponse.success, healthResponse.data, healthResponse.error);
    } catch (error: any) {
      addResult('Health Check', false, null, error.message);
    }

    // Test 2: Get All Live Courses
    try {
      const coursesResponse = await liveCourseAPI.getAllCourses();
      addResult('Get All Live Courses', coursesResponse.success, coursesResponse.data, coursesResponse.error);
    } catch (error: any) {
      addResult('Get All Live Courses', false, null, error.message);
    }

    // Test 3: Get Specific Live Course
    try {
      const courseResponse = await liveCourseAPI.getCourseById('test123');
      addResult('Get Live Course by ID', courseResponse.success, courseResponse.data, courseResponse.error);
    } catch (error: any) {
      addResult('Get Live Course by ID', false, null, error.message);
    }

    // Test 4: Start Live Course (creates meeting room)
    let testCourseId = 'test789';
    let meetingCode = '';
    try {
      const startResponse = await liveCourseAPI.startCourse(testCourseId, {
        instructorId: 'test_instructor_123',
        instructorName: 'API Test Instructor'
      });
      
      if (startResponse.success && startResponse.data?.videoConferencing?.meetingCode) {
        meetingCode = startResponse.data.videoConferencing.meetingCode;
        addResult('Start Live Course', true, startResponse.data);
      } else {
        addResult('Start Live Course', false, null, startResponse.error);
      }
    } catch (error: any) {
      addResult('Start Live Course', false, null, error.message);
    }

    // Test 5: Socket.IO Connection (if we have a meeting code)
    if (meetingCode) {
      try {
        socketService.connect();
        
        // Set up event listeners
        let socketTestCompleted = false;
        let chatMessageReceived = false;
        
        const socketTestTimeout = setTimeout(() => {
          if (!socketTestCompleted) {
            addResult('Socket.IO Chat Test', false, null, 'Test timeout - no chat message received');
            socketTestCompleted = true;
          }
        }, 5000);

        socketService.onChatMessage((message) => {
          if (!chatMessageReceived && message.sender === 'API Test User') {
            chatMessageReceived = true;
            clearTimeout(socketTestTimeout);
            addResult('Socket.IO Chat Test', true, { message: message.message, timestamp: message.timestamp });
            socketTestCompleted = true;
          }
        });

        // Join the meeting room
        socketService.joinMeetingRoom(meetingCode, 'API Test User', 'test_participant_123', false);
        
        // Send a test chat message after a short delay
        setTimeout(() => {
          socketService.sendChatMessage(meetingCode, 'API Test User', 'Hello from API test! 👋');
        }, 1500);

        addResult('Socket.IO Connection', true, { meetingCode, status: 'Connected and joined meeting room' });
      } catch (error: any) {
        addResult('Socket.IO Connection', false, null, error.message);
      }
    }

    // Test 6: Complete Live Course (stops recording and ends meeting)
    setTimeout(async () => {
      try {
        const completeResponse = await liveCourseAPI.completeCourse(testCourseId);
        addResult('Complete Live Course', completeResponse.success, completeResponse.data, completeResponse.error);
      } catch (error: any) {
        addResult('Complete Live Course', false, null, error.message);
      }
      
      setTesting(false);
    }, 6000); // Wait for socket test to complete
  };

  return (
    <div className="api-tester">
      <div className="tester-header">
        <h2>🧪 API Tester</h2>
        <p>Test all Beauty LMS Live Course APIs to ensure they work properly</p>
      </div>

      <div className="tester-controls">
        <button 
          onClick={runAllTests} 
          disabled={testing}
          className="test-all-btn"
        >
          {testing ? '⏳ Running Tests...' : '🚀 Run All Tests'}
        </button>
        <button 
          onClick={clearResults} 
          disabled={testing}
          className="clear-btn"
        >
          Clear Results
        </button>
      </div>

      <div className="test-results">
        <h3>Test Results ({testResults.length})</h3>
        {testResults.length === 0 ? (
          <p className="no-results">No tests run yet. Click "Run All Tests" to start.</p>
        ) : (
          <div className="results-list">
            {testResults.map((result, index) => (
              <div 
                key={index} 
                className={`result-item ${result.success ? 'success' : 'failure'}`}
              >
                <div className="result-header">
                  <span className="result-icon">
                    {result.success ? '✅' : '❌'}
                  </span>
                  <span className="result-test">{result.test}</span>
                  <span className="result-time">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                {result.data && (
                  <div className="result-data">
                    <strong>Data:</strong>
                    <pre>{JSON.stringify(result.data, null, 2)}</pre>
                  </div>
                )}
                
                {result.error && (
                  <div className="result-error">
                    <strong>Error:</strong> {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default APITester;