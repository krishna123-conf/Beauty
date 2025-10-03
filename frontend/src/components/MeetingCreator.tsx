import React, { useState } from 'react';
import { meetingAPI, Meeting, ApiResponse } from '../services/apiService';

interface MeetingCreatorProps {
  onMeetingCreated: (meeting: Meeting) => void;
  onError: (error: string) => void;
}

const MeetingCreator: React.FC<MeetingCreatorProps> = ({ onMeetingCreated, onError }) => {
  const [formData, setFormData] = useState({
    hostName: 'Test Host',
    title: 'Test Meeting',
    description: 'Testing Beauty LMS video conferencing'
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      const response: ApiResponse<Meeting> = await meetingAPI.createMeeting(formData);
      
      if (response.success && response.data) {
        onMeetingCreated(response.data);
      } else {
        onError(response.error || 'Failed to create meeting');
      }
    } catch (error: any) {
      onError(error.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="meeting-creator">
      <h2>🚀 Create New Meeting</h2>
      <form onSubmit={handleSubmit} className="meeting-form">
        <div className="form-group">
          <label htmlFor="hostName">Host Name:</label>
          <input
            type="text"
            id="hostName"
            name="hostName"
            value={formData.hostName}
            onChange={handleInputChange}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="title">Meeting Title:</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading} className="create-btn">
          {loading ? '⏳ Creating...' : '🎥 Create Meeting'}
        </button>
      </form>
    </div>
  );
};

export default MeetingCreator;