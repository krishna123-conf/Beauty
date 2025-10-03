import React, { useState } from 'react';
import { meetingAPI, Meeting, Participant, ApiResponse } from '../services/apiService';

interface MeetingJoinerProps {
  onMeetingJoined: (meeting: Meeting, participant: Participant) => void;
  onError: (error: string) => void;
}

const MeetingJoiner: React.FC<MeetingJoinerProps> = ({ onMeetingJoined, onError }) => {
  const [formData, setFormData] = useState({
    meetingCode: '',
    participantName: 'Test Participant'
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response: ApiResponse<{ participant: Participant; meeting: Meeting }> = 
        await meetingAPI.joinMeeting(formData);
      
      if (response.success && response.data) {
        onMeetingJoined(response.data.meeting, response.data.participant);
      } else {
        onError(response.error || 'Failed to join meeting');
      }
    } catch (error: any) {
      onError(error.message || 'Failed to join meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="meeting-joiner">
      <h2>🎯 Join Existing Meeting</h2>
      <form onSubmit={handleSubmit} className="meeting-form">
        <div className="form-group">
          <label htmlFor="meetingCode">Meeting Code:</label>
          <input
            type="text"
            id="meetingCode"
            name="meetingCode"
            value={formData.meetingCode}
            onChange={handleInputChange}
            placeholder="Enter 6-digit meeting code"
            required
            disabled={loading}
            maxLength={6}
          />
        </div>

        <div className="form-group">
          <label htmlFor="participantName">Your Name:</label>
          <input
            type="text"
            id="participantName"
            name="participantName"
            value={formData.participantName}
            onChange={handleInputChange}
            required
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading || !formData.meetingCode} className="join-btn">
          {loading ? '⏳ Joining...' : '🚀 Join Meeting'}
        </button>
      </form>
    </div>
  );
};

export default MeetingJoiner;