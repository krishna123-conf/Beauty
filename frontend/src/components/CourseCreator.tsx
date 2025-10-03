import React, { useState } from 'react';
import { liveCourseAPI, LiveCourse, ApiResponse } from '../services/apiService';

interface CourseCreatorProps {
  onCourseCreated: (course: LiveCourse) => void;
  onError: (error: string) => void;
}

const CourseCreator: React.FC<CourseCreatorProps> = ({ onCourseCreated, onError }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructorId: 'instructor_default',
    instructorName: 'Default Instructor',
    category: 'beauty',
    duration: 60,
    recordingEnabled: true
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
                      type === 'number' ? parseInt(value) || 0 : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Add current timestamp + 1 minute as scheduled time for immediate availability
      const scheduledDateTime = new Date(Date.now() + 60000).toISOString();
      
      const courseData = {
        ...formData,
        scheduledDateTime,
        enrolledUsers: [] // Start with empty enrollment
      };

      const response: ApiResponse<LiveCourse> = await liveCourseAPI.createCourse(courseData);
      
      if (response.success && response.data) {
        onCourseCreated(response.data);
        // Reset form
        setFormData({
          name: '',
          description: '',
          instructorId: 'instructor_default',
          instructorName: 'Default Instructor',
          category: 'beauty',
          duration: 60,
          recordingEnabled: true
        });
      } else {
        onError(response.error || 'Failed to create course');
      }
    } catch (error: any) {
      onError(error.message || 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="course-creator">
      <h2>🎓 Create New Course</h2>
      <form onSubmit={handleSubmit} className="course-form">
        <div className="form-group">
          <label htmlFor="name">Course Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            disabled={loading}
            placeholder="Enter course name"
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
            placeholder="Enter course description"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="instructorName">Instructor Name:</label>
            <input
              type="text"
              id="instructorName"
              name="instructorName"
              value={formData.instructorName}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category:</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              required
              disabled={loading}
            >
              <option value="beauty">Beauty</option>
              <option value="makeup">Makeup</option>
              <option value="hair">Hair</option>
              <option value="skincare">Skincare</option>
              <option value="nail">Nail Art</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="duration">Duration (minutes):</label>
            <input
              type="number"
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
              min="15"
              max="240"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="recordingEnabled"
                checked={formData.recordingEnabled}
                onChange={handleInputChange}
                disabled={loading}
              />
              Enable Recording (Host Screen Only)
            </label>
          </div>
        </div>

        <button type="submit" disabled={loading || !formData.name.trim()} className="create-btn">
          {loading ? '⏳ Creating...' : '🚀 Create Course'}
        </button>
      </form>
    </div>
  );
};

export default CourseCreator;