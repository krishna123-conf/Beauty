import React, { useState, useEffect } from 'react';
import { liveCourseAPI, LiveCourse, ApiResponse } from '../services/apiService';

interface LiveCoursesListProps {
  onHostConnect: (course: LiveCourse, isHost: boolean) => void;
  onError: (error: string) => void;
}

const LiveCoursesList: React.FC<LiveCoursesListProps> = ({ onHostConnect, onError }) => {
  const [courses, setCourses] = useState<LiveCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingCourseId, setConnectingCourseId] = useState<string | null>(null);

  const loadCourses = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response: ApiResponse<LiveCourse[]> = await liveCourseAPI.getAllCourses();
      
      if (response.success && response.data) {
        setCourses(response.data);
      } else {
        onError(response.error || 'Failed to load courses');
      }
    } catch (error: any) {
      onError(error.message || 'Failed to load courses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      await loadCourses();
    };
    fetchCourses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    loadCourses(true);
  };

  const handleHostConnect = async (course: LiveCourse) => {
    setConnectingCourseId(course.id);
    
    try {
      // If course is already active and has meeting code, directly join as host
      if (course.status === 'active' && course.meetingCode) {
        console.log('Course already active, joining as host...');
        onHostConnect(course, true);
        return;
      }

      // First, get recording status to check if recording is working
      const recordingResponse = await liveCourseAPI.getRecordingStatus(course.id);
      
      if (recordingResponse.success) {
        console.log('Recording status:', recordingResponse.data);
      }

      // Start the course as host
      const startResponse = await liveCourseAPI.startCourse(course.id, {
        instructorId: course.instructorId,
        instructorName: course.instructorName,
      });

      if (startResponse.success) {
        // Update course status locally with meeting code from response
        const updatedCourse = {
          ...course,
          status: 'active' as const,
          meetingCode: startResponse.data?.videoConferencing?.meetingCode,
          meetingId: startResponse.data?.videoConferencing?.meetingId
        };
        
        setCourses(prev => prev.map(c => 
          c.id === course.id ? updatedCourse : c
        ));
        
        onHostConnect(updatedCourse, true);
      } else {
        onError(startResponse.error || 'Failed to start course as host');
      }
    } catch (error: any) {
      onError(error.message || 'Failed to connect as host');
    } finally {
      setConnectingCourseId(null);
    }
  };

  const handleParticipantConnect = async (course: LiveCourse) => {
    setConnectingCourseId(course.id);
    
    try {
      // Join as participant
      const joinResponse = await liveCourseAPI.joinCourse(course.id, {
        userId: 'participant_' + Date.now(),
        userName: 'Test Participant',
      });

      if (joinResponse.success) {
        onHostConnect(course, false);
      } else {
        onError(joinResponse.error || 'Failed to join course');
      }
    } catch (error: any) {
      onError(error.message || 'Failed to connect as participant');
    } finally {
      setConnectingCourseId(null);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#28a745';
      case 'completed': return '#6c757d';
      case 'scheduled': return '#007bff';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'active': return '🔴';
      case 'completed': return '✅';
      case 'scheduled': return '📅';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="live-courses-loading">
        <div className="spinner">⏳</div>
        <p>Loading live courses...</p>
      </div>
    );
  }

  return (
    <div className="live-courses-list">
      <div className="courses-header">
        <h2>🎓 Live Courses</h2>
        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="refresh-btn"
        >
          {refreshing ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="no-courses">
          <p>No live courses available at the moment.</p>
          <button onClick={handleRefresh} className="retry-btn">
            Try Again
          </button>
        </div>
      ) : (
        <div className="courses-grid">
          {courses.map((course) => (
            <div key={course.id} className="course-card">
              <div className="course-header">
                <h3>{course.name}</h3>
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(course.status) }}
                >
                  {getStatusIcon(course.status)} {course.status.toUpperCase()}
                </span>
              </div>

              <div className="course-info">
                <p className="course-description">
                  {course.description || 'No description available'}
                </p>
                
                <div className="course-details">
                  <div className="detail-item">
                    <span className="label">👨‍🏫 Instructor:</span>
                    <span className="value">{course.instructorName}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">📂 Category:</span>
                    <span className="value">{course.category}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">⏱️ Duration:</span>
                    <span className="value">{course.duration} min</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">👥 Enrolled:</span>
                    <span className="value">{course.enrolledUsers?.length || 0} users</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">📹 Recording:</span>
                    <span className="value">
                      {course.recordingEnabled ? '✅ Enabled' : '❌ Disabled'}
                    </span>
                  </div>

                  {course.scheduledDateTime && (
                    <div className="detail-item">
                      <span className="label">📅 Scheduled:</span>
                      <span className="value">
                        {new Date(course.scheduledDateTime).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {course.meetingCode && (
                    <div className="detail-item">
                      <span className="label">🔑 Meeting Code:</span>
                      <span className="value meeting-code">{course.meetingCode}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="course-actions">
                <button
                  onClick={() => handleHostConnect(course)}
                  disabled={connectingCourseId === course.id}
                  className="host-btn"
                >
                  {connectingCourseId === course.id ? '⏳ Connecting...' : '🎯 Host'}
                </button>
                
                <button
                  onClick={() => handleParticipantConnect(course)}
                  disabled={connectingCourseId === course.id}
                  className="join-btn"
                >
                  {connectingCourseId === course.id ? '⏳ Joining...' : '👥 Join'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveCoursesList;