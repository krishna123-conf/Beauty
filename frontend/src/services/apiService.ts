import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

// Configure axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types for API responses
export interface LiveCourse {
  id: string;
  name: string;
  description?: string;
  instructorId: string;
  instructorName: string;
  category: string;
  status: 'scheduled' | 'active' | 'completed';
  scheduledDateTime: string;
  duration: number;
  enrolledUsers: string[];
  joinedUsers?: string[];
  recordingEnabled: boolean;
  meetingCode?: string;
  meetingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  meetingCode: string;
  meetingId: string;
  hostName: string;
  hostId: string;
  title?: string;
  description?: string;
  createdAt: string;
  status?: string;
}

export interface Participant {
  id: string;
  name: string;
  joinedAt: string;
  isHost?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Live Course API functions
export const liveCourseAPI = {
  // Create a new live course
  createCourse: async (courseData: {
    name: string;
    description?: string;
    instructorId: string;
    instructorName: string;
    category: string;
    duration: number;
    scheduledDateTime?: string;
    recordingEnabled?: boolean;
    enrolledUsers?: string[];
  }): Promise<ApiResponse<LiveCourse>> => {
    try {
      const response = await api.post('/live_courses', courseData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create course',
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Get all live courses
  getAllCourses: async (): Promise<ApiResponse<LiveCourse[]>> => {
    try {
      const response = await api.get('/live_courses');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get courses',
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Get live course by id
  getCourseById: async (id: string): Promise<ApiResponse<LiveCourse>> => {
    try {
      const response = await api.get(`/live_courses/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get course',
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Start a live course (creates meeting room automatically)
  startCourse: async (courseId: string, instructorData: {
    instructorId?: string;
    instructorName: string;
  }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.put(`/live_courses/${courseId}/start`, instructorData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to start course',
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Complete a live course (stops recording and ends meeting)
  completeCourse: async (courseId: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.put(`/live_courses/${courseId}/complete`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to complete course',
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Join a user to a live course
  joinCourse: async (courseId: string, participantData: {
    userId: string;
    userName: string;
  }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.put(`/live_courses/${courseId}/join`, participantData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to join course',
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Leave a live course
  leaveCourse: async (courseId: string, participantData: {
    userId: string;
  }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.put(`/live_courses/${courseId}/leave`, participantData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to leave course',
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Get recording status for a course
  getRecordingStatus: async (courseId: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get(`/live_courses/${courseId}/recording`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get recording status',
        message: error.response?.data?.message || error.message,
      };
    }
  },
};

// Keep meetingAPI for backward compatibility but mark as deprecated
export const meetingAPI = {
  // Note: These functions are deprecated. Use liveCourseAPI instead.
  // Meeting rooms are now created automatically when starting live courses.
  
  createMeeting: async (data: {
    hostName: string;
    title?: string;
    description?: string;
  }): Promise<ApiResponse<Meeting>> => {
    console.warn('meetingAPI.createMeeting is deprecated. Use liveCourseAPI.startCourse instead.');
    return {
      success: false,
      error: 'Deprecated API',
      message: 'Meeting creation is now handled through live courses. Use liveCourseAPI.startCourse instead.',
    };
  },

  joinMeeting: async (data: {
    meetingCode: string;
    participantName: string;
  }): Promise<ApiResponse<{ participant: Participant; meeting: Meeting }>> => {
    console.warn('meetingAPI.joinMeeting is deprecated. Use liveCourseAPI.joinCourse instead.');
    return {
      success: false,
      error: 'Deprecated API',
      message: 'Meeting joining is now handled through live courses. Use liveCourseAPI.joinCourse instead.',
    };
  },

  getMeetingInfo: async (meetingCode: string): Promise<ApiResponse<Meeting>> => {
    console.warn('meetingAPI.getMeetingInfo is deprecated. Use liveCourseAPI.getCourseById instead.');
    return {
      success: false,
      error: 'Deprecated API',
      message: 'Meeting info is now available through live course data. Use liveCourseAPI.getCourseById instead.',
    };
  },

  getMeetingParticipants: async (meetingCode: string): Promise<ApiResponse<Participant[]>> => {
    console.warn('meetingAPI.getMeetingParticipants is deprecated.');
    return {
      success: false,
      error: 'Deprecated API',
      message: 'Participant data is now handled through live course APIs and Socket.IO.',
      data: []
    };
  },

  endMeeting: async (meetingCode: string): Promise<ApiResponse<any>> => {
    console.warn('meetingAPI.endMeeting is deprecated. Use liveCourseAPI.completeCourse instead.');
    return {
      success: false,
      error: 'Deprecated API',
      message: 'Meeting ending is now handled through live courses. Use liveCourseAPI.completeCourse instead.',
    };
  },
};

// Health check
export const healthCheck = async (): Promise<ApiResponse<any>> => {
  try {
    const response = await axios.get('http://localhost:3000/health');
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: 'Backend server is not available',
      message: error.message,
    };
  }
};

export default api;
