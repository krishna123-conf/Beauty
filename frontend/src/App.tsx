import React, { useState } from 'react';
import './App.css';
import { LiveCourse, Participant } from './services/apiService';
import CourseCreator from './components/CourseCreator';
import MeetingJoiner from './components/MeetingJoiner';
import MeetingRoom from './components/MeetingRoom';
import APITester from './components/APITester';
import LiveCoursesList from './components/LiveCoursesList';

type AppState = 'home' | 'meeting' | 'testing' | 'live-courses';

function App() {
  const [currentState, setCurrentState] = useState<AppState>('live-courses');
  const [currentCourse, setCurrentCourse] = useState<LiveCourse | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleLiveCoursesHostConnect = (course: LiveCourse, hostMode: boolean) => {
    setCurrentCourse(course);
    
    // Create appropriate participant
    const participant: Participant = {
      id: hostMode ? course.instructorId : 'participant_' + Date.now(),
      name: hostMode ? course.instructorName : 'Test Participant',
      joinedAt: new Date().toISOString(),
      isHost: hostMode
    };
    setCurrentParticipant(participant);
    setCurrentState('meeting');
    setErrorMessage('');
  };

  const handleCourseCreated = (course: LiveCourse) => {
    setCurrentCourse(course);
    // Create a host participant
    const hostParticipant: Participant = {
      id: course.instructorId,
      name: course.instructorName,
      joinedAt: course.createdAt,
      isHost: true
    };
    setCurrentParticipant(hostParticipant);
    setCurrentState('meeting');
    setErrorMessage('');
  };

  const handleMeetingJoined = (meeting: any, participant: Participant) => {
    // Convert meeting to course format if needed
    const course: LiveCourse = {
      id: meeting.meetingId || meeting.id,
      name: meeting.title || meeting.name || 'Unknown Course',
      instructorId: meeting.hostId,
      instructorName: meeting.hostName,
      category: 'general',
      status: 'active',
      scheduledDateTime: meeting.createdAt,
      duration: 60,
      enrolledUsers: [],
      recordingEnabled: false,
      meetingCode: meeting.meetingCode,
      meetingId: meeting.meetingId,
      createdAt: meeting.createdAt,
      updatedAt: meeting.createdAt
    };
    setCurrentCourse(course);
    setCurrentParticipant(participant);
    setCurrentState('meeting');
    setErrorMessage('');
  };

  const handleLeaveMeeting = () => {
    setCurrentCourse(null);
    setCurrentParticipant(null);
    setCurrentState('home');
    setErrorMessage('');
  };

  const handleCourseCompleted = (completedCourse: LiveCourse) => {
    // Course was completed successfully, go back to live courses list
    setCurrentCourse(null);
    setCurrentParticipant(null);
    setCurrentState('live-courses');
    setErrorMessage('');
  };

  const handleError = (error: string) => {
    setErrorMessage(error);
    setTimeout(() => setErrorMessage(''), 5000); // Clear error after 5 seconds
  };

  const goToLiveCourses = () => {
    setCurrentState('live-courses');
    setErrorMessage('');
  };

  const goToTesting = () => {
    setCurrentState('testing');
    setErrorMessage('');
  };

  const goHome = () => {
    setCurrentState('home');
    setErrorMessage('');
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🎥 Beauty LMS - Video Conferencing System</h1>
        <nav className="app-nav">
          <button 
            onClick={goToLiveCourses} 
            className={currentState === 'live-courses' ? 'active' : ''}
          >
            🎓 Live Courses
          </button>
          <button 
            onClick={goHome} 
            className={currentState === 'home' ? 'active' : ''}
          >
            🏠 Create/Join
          </button>
          <button 
            onClick={goToTesting} 
            className={currentState === 'testing' ? 'active' : ''}
          >
            🧪 API Testing
          </button>
        </nav>
      </header>

      {errorMessage && (
        <div className="error-banner">
          ❌ {errorMessage}
        </div>
      )}

      <main className="app-main">
        {currentState === 'live-courses' && (
          <LiveCoursesList 
            onHostConnect={handleLiveCoursesHostConnect}
            onError={handleError}
          />
        )}

        {currentState === 'home' && (
          <div className="home-screen">
            <div className="welcome-section">
              <h2>Welcome to Beauty LMS Video Conferencing</h2>
              <p>Create or join meetings to test video conferencing, chat, and participant features.</p>
            </div>

            <div className="meeting-actions">
              <CourseCreator 
                onCourseCreated={handleCourseCreated}
                onError={handleError}
              />
              
              <div className="divider">
                <span>OR</span>
              </div>
              
              <MeetingJoiner 
                onMeetingJoined={handleMeetingJoined}
                onError={handleError}
              />
            </div>
          </div>
        )}

        {currentState === 'meeting' && currentCourse && currentParticipant && (
          <MeetingRoom 
            meeting={currentCourse}
            currentParticipant={currentParticipant}
            onLeaveMeeting={handleLeaveMeeting}
            onError={handleError}
            onCourseCompleted={handleCourseCompleted}
          />
        )}

        {currentState === 'testing' && (
          <APITester />
        )}
      </main>

      <footer className="app-footer">
        <p>Beauty LMS © 2024 | Backend running on localhost:3000</p>
      </footer>
    </div>
  );
}

export default App;
