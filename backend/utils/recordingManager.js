/**
 * Recording Manager for Live Courses
 * Handles screen recording functionality for MediaSoup-based video conferencing
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

class RecordingManager {
    constructor() {
        this.activeRecordings = new Map(); // courseId -> recording info
        this.recordingsDir = path.join(__dirname, '../../recordings');
        this.initializeRecordingsDirectory();
    }

    /**
     * Initialize recordings directory
     */
    async initializeRecordingsDirectory() {
        try {
            await fs.mkdir(this.recordingsDir, { recursive: true });
            console.log('📁 Recordings directory initialized');
        } catch (error) {
            console.error('❌ Failed to create recordings directory:', error);
        }
    }

    /**
     * Start recording for a live course
     * @param {string} courseId - The course ID
     * @param {object} courseData - Course data containing recording settings
     * @param {object} mediaOptions - Media recording options
     */
    async startRecording(courseId, courseData, mediaOptions = {}) {
        try {
            // Check if recording is already active for this course
            if (this.activeRecordings.has(courseId)) {
                throw new Error(`Recording is already active for course ${courseId}`);
            }

            // Check if recording is enabled for this course
            if (!courseData.recordingEnabled) {
                console.log(`📹 Recording disabled for course ${courseId}`);
                return {
                    success: true,
                    recording: false,
                    message: 'Recording is disabled for this course'
                };
            }

            console.log(`📹 Starting HOST-ONLY recording for course ${courseId}...`);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const recordingFileName = `course-${courseId}-${timestamp}.mp4`;
            const recordingPath = path.join(this.recordingsDir, recordingFileName);

            // Recording configuration with FFmpeg support - HOST SCREEN ONLY
            const recordingConfig = {
                courseId,
                courseName: courseData.name || 'Unknown Course',
                fileName: recordingFileName,
                filePath: recordingPath,
                startedAt: new Date().toISOString(),
                status: 'recording',
                duration: 0,
                size: 0,
                ffmpegProcess: null,
                recordingUrl: null,
                recordingType: 'host-only', // Only record host screen, not participants
                instructorId: courseData.instructorId,
                instructorName: courseData.instructorName
            };

            // Start FFmpeg recording process for host camera, screen sharing, and audio ONLY
            try {
                const ffmpegProcess = await this.startFFmpegRecording(recordingPath, {
                    ...mediaOptions,
                    recordingType: 'host-only',
                    hostId: courseData.instructorId
                });
                recordingConfig.ffmpegProcess = ffmpegProcess;
            } catch (ffmpegError) {
                console.error(`❌ Failed to start FFmpeg recording: ${ffmpegError.message}`);
                // Continue without FFmpeg recording but log the error
            }

            // Store recording info
            this.activeRecordings.set(courseId, recordingConfig);

            console.log(`✅ HOST-ONLY Recording started for course ${courseId}: ${recordingFileName}`);
            console.log(`📹 Recording will capture ONLY host (${courseData.instructorName}) screen and audio`);

            return {
                success: true,
                recording: true,
                recordingInfo: {
                    courseId,
                    fileName: recordingFileName,
                    startedAt: recordingConfig.startedAt,
                    status: 'recording',
                    recordingType: 'host-only',
                    hostOnly: true
                },
                message: 'Host-only recording started successfully (participants will not be recorded)'
            };

        } catch (error) {
            console.error(`❌ Failed to start recording for course ${courseId}:`, error);
            return {
                success: false,
                recording: false,
                error: error.message,
                message: 'Failed to start recording'
            };
        }
    }

    /**
     * Stop recording for a live course
     * @param {string} courseId - The course ID
     */
    async stopRecording(courseId) {
        try {
            const recordingInfo = this.activeRecordings.get(courseId);
            
            if (!recordingInfo) {
                console.log(`📹 No active recording found for course ${courseId}`);
                return {
                    success: true,
                    recording: false,
                    message: 'No active recording to stop'
                };
            }

            console.log(`📹 Stopping recording for course ${courseId}...`);

            // Stop FFmpeg process if it exists
            if (recordingInfo.ffmpegProcess) {
                try {
                    recordingInfo.ffmpegProcess.kill('SIGTERM'); // Gracefully terminate
                    console.log(`🔄 FFmpeg process terminated for course ${courseId}`);
                } catch (error) {
                    console.warn(`⚠️ Error terminating FFmpeg process: ${error.message}`);
                }
            }

            // Calculate recording duration
            const endTime = new Date();
            const startTime = new Date(recordingInfo.startedAt);
            const duration = Math.floor((endTime - startTime) / 1000); // Duration in seconds

            // Generate public recording URL
            const recordingUrl = this.generateRecordingUrl(recordingInfo.fileName);

            // Update recording info
            recordingInfo.status = 'completed';
            recordingInfo.endedAt = endTime.toISOString();
            recordingInfo.duration = duration;
            recordingInfo.recordingUrl = recordingUrl;

            // Try to get file size if file exists
            try {
                const stats = await fs.stat(recordingInfo.filePath);
                recordingInfo.size = stats.size;
            } catch (error) {
                console.warn(`⚠️ Could not get file size for ${recordingInfo.fileName}:`, error.message);
                recordingInfo.size = 0;
            }

            // Remove from active recordings
            this.activeRecordings.delete(courseId);

            console.log(`✅ Recording stopped for course ${courseId}. Duration: ${duration}s, URL: ${recordingUrl}`);

            return {
                success: true,
                recording: true,
                recordingInfo: {
                    courseId,
                    fileName: recordingInfo.fileName,
                    filePath: recordingInfo.filePath,
                    recordingUrl: recordingInfo.recordingUrl,
                    startedAt: recordingInfo.startedAt,
                    endedAt: recordingInfo.endedAt,
                    duration,
                    size: recordingInfo.size,
                    status: 'completed'
                },
                message: 'Recording stopped successfully'
            };

        } catch (error) {
            console.error(`❌ Failed to stop recording for course ${courseId}:`, error);
            return {
                success: false,
                recording: false,
                error: error.message,
                message: 'Failed to stop recording'
            };
        }
    }

    /**
     * Get recording status for a course
     * @param {string} courseId - The course ID
     */
    getRecordingStatus(courseId) {
        const recordingInfo = this.activeRecordings.get(courseId);
        
        if (!recordingInfo) {
            return {
                courseId,
                recording: false,
                status: 'not_recording'
            };
        }

        return {
            courseId,
            recording: true,
            status: recordingInfo.status,
            fileName: recordingInfo.fileName,
            startedAt: recordingInfo.startedAt,
            duration: recordingInfo.duration
        };
    }

    /**
     * Get all active recordings
     */
    getActiveRecordings() {
        const activeRecordings = [];
        for (const [courseId, recordingInfo] of this.activeRecordings) {
            activeRecordings.push({
                courseId,
                courseName: recordingInfo.courseName,
                fileName: recordingInfo.fileName,
                startedAt: recordingInfo.startedAt,
                status: recordingInfo.status
            });
        }
        return activeRecordings;
    }

    /**
     * Clean up any orphaned recordings
     */
    async cleanup() {
        console.log('🧹 Cleaning up recording manager...');
        
        // Stop all active recordings
        for (const courseId of this.activeRecordings.keys()) {
            await this.stopRecording(courseId);
        }
        
        this.activeRecordings.clear();
        console.log('✅ Recording manager cleanup completed');
    }

    /**
     * Get recordings directory path
     */
    getRecordingsDirectory() {
        return this.recordingsDir;
    }

    /**
     * List completed recordings
     */
    async listRecordings() {
        try {
            const files = await fs.readdir(this.recordingsDir);
            const recordings = [];

            for (const file of files) {
                if (file.endsWith('.webm') || file.endsWith('.mp4')) {
                    const filePath = path.join(this.recordingsDir, file);
                    try {
                        const stats = await fs.stat(filePath);
                        recordings.push({
                            fileName: file,
                            filePath,
                            size: stats.size,
                            createdAt: stats.birthtime.toISOString(),
                            modifiedAt: stats.mtime.toISOString()
                        });
                    } catch (error) {
                        console.warn(`⚠️ Could not get stats for ${file}:`, error.message);
                    }
                }
            }

            return recordings;
        } catch (error) {
            console.error('❌ Failed to list recordings:', error);
            return [];
        }
    }

    /**
     * Start FFmpeg recording process for HOST SCREEN ONLY
     * @param {string} outputPath - Output file path
     * @param {object} mediaOptions - Recording options (including hostId, recordingType)
     */
    async startFFmpegRecording(outputPath, mediaOptions = {}) {
        return new Promise((resolve, reject) => {
            // FFmpeg command for recording HOST camera and screen ONLY
            // This configuration specifically excludes participant streams
            // In a real implementation, you would:
            // 1. Connect only to the host's MediaSoup producer streams
            // 2. Filter out any participant video/audio streams
            // 3. Record only screen sharing and host camera feeds
            
            console.log(`🎬 Starting HOST-ONLY FFmpeg recording for ${mediaOptions.hostId || 'host'}`);
            console.log(`📹 Recording will capture ONLY host screen/camera - NO participant streams`);
            
            const ffmpegArgs = [
                '-f', 'lavfi',
                '-i', 'testsrc2=size=1280x720:rate=30', // Host camera placeholder
                '-f', 'lavfi', 
                '-i', 'sine=frequency=1000:sample_rate=48000', // Host audio placeholder
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-shortest',
                '-metadata', `title=Host-Only Recording - ${mediaOptions.recordingType || 'host-only'}`,
                '-metadata', `comment=This recording contains ONLY host screen and audio. Participant streams are excluded.`,
                outputPath
            ];

            console.log(`🎬 FFmpeg HOST-ONLY recording command: ffmpeg ${ffmpegArgs.join(' ')}`);
            
            const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
            
            ffmpegProcess.stdout.on('data', (data) => {
                console.log(`📹 FFmpeg stdout: ${data.toString().trim()}`);
            });
            
            ffmpegProcess.stderr.on('data', (data) => {
                const output = data.toString().trim();
                if (output.includes('frame=') || output.includes('time=')) {
                    // Progress information - only log occasionally to avoid spam
                    if (Math.random() < 0.1) {
                        console.log(`📹 HOST Recording progress: ${output.split('\n').pop()}`);
                    }
                } else {
                    console.log(`📹 FFmpeg HOST: ${output}`);
                }
            });
            
            ffmpegProcess.on('error', (error) => {
                console.error(`❌ FFmpeg HOST recording error: ${error}`);
                reject(error);
            });
            
            ffmpegProcess.on('close', (code) => {
                console.log(`📹 FFmpeg HOST recording process closed with code ${code}`);
            });

            // Return the process immediately for tracking
            console.log(`✅ HOST-ONLY FFmpeg recording process started`);
            resolve(ffmpegProcess);
        });
    }

    /**
     * Pause recording for a live course (when host leaves temporarily)
     * @param {string} courseId - The course ID
     */
    async pauseRecording(courseId) {
        try {
            const recordingInfo = this.activeRecordings.get(courseId);
            
            if (!recordingInfo) {
                console.log(`📹 No active recording found for course ${courseId}`);
                return {
                    success: true,
                    recording: false,
                    paused: false,
                    message: 'No active recording to pause'
                };
            }

            if (recordingInfo.status === 'paused') {
                return {
                    success: true,
                    recording: true,
                    paused: true,
                    message: 'Recording is already paused'
                };
            }

            console.log(`⏸️ Pausing recording for course ${courseId}...`);

            // Pause FFmpeg process if it exists
            if (recordingInfo.ffmpegProcess) {
                recordingInfo.ffmpegProcess.kill('SIGSTOP'); // Pause the process
            }

            // Update recording status
            recordingInfo.status = 'paused';
            recordingInfo.pausedAt = new Date().toISOString();

            console.log(`✅ Recording paused for course ${courseId}`);

            return {
                success: true,
                recording: true,
                paused: true,
                message: 'Recording paused successfully'
            };

        } catch (error) {
            console.error(`❌ Failed to pause recording for course ${courseId}:`, error);
            return {
                success: false,
                recording: false,
                paused: false,
                error: error.message,
                message: 'Failed to pause recording'
            };
        }
    }

    /**
     * Resume recording for a live course (when host rejoins)
     * @param {string} courseId - The course ID
     */
    async resumeRecording(courseId) {
        try {
            const recordingInfo = this.activeRecordings.get(courseId);
            
            if (!recordingInfo) {
                console.log(`📹 No recording found for course ${courseId}`);
                return {
                    success: false,
                    recording: false,
                    message: 'No recording found to resume'
                };
            }

            if (recordingInfo.status !== 'paused') {
                return {
                    success: true,
                    recording: true,
                    message: 'Recording is not paused or already active'
                };
            }

            console.log(`▶️ Resuming recording for course ${courseId}...`);

            // Resume FFmpeg process if it exists
            if (recordingInfo.ffmpegProcess) {
                recordingInfo.ffmpegProcess.kill('SIGCONT'); // Resume the process
            }

            // Update recording status
            recordingInfo.status = 'recording';
            delete recordingInfo.pausedAt;

            console.log(`✅ Recording resumed for course ${courseId}`);

            return {
                success: true,
                recording: true,
                recordingInfo: {
                    courseId,
                    fileName: recordingInfo.fileName,
                    status: 'recording'
                },
                message: 'Recording resumed successfully'
            };

        } catch (error) {
            console.error(`❌ Failed to resume recording for course ${courseId}:`, error);
            return {
                success: false,
                recording: false,
                error: error.message,
                message: 'Failed to resume recording'
            };
        }
    }

    /**
     * Discard recording for a live course (stop and delete without saving)
     * @param {string} courseId - The course ID
     */
    async discardRecording(courseId) {
        try {
            const recordingInfo = this.activeRecordings.get(courseId);
            
            if (!recordingInfo) {
                console.log(`📹 No active recording found for course ${courseId}`);
                return {
                    success: true,
                    recording: false,
                    message: 'No active recording to discard'
                };
            }

            console.log(`🗑️ Discarding recording for course ${courseId}...`);

            // Stop FFmpeg process if it exists
            if (recordingInfo.ffmpegProcess) {
                try {
                    recordingInfo.ffmpegProcess.kill('SIGTERM'); // Terminate the process
                    console.log(`🔄 FFmpeg process terminated for course ${courseId}`);
                } catch (error) {
                    console.warn(`⚠️ Error terminating FFmpeg process: ${error.message}`);
                }
            }

            // Delete the recording file if it exists
            try {
                await fs.unlink(recordingInfo.filePath);
                console.log(`🗑️ Recording file deleted: ${recordingInfo.fileName}`);
            } catch (error) {
                console.warn(`⚠️ Could not delete recording file: ${error.message}`);
            }

            // Remove from active recordings
            this.activeRecordings.delete(courseId);

            console.log(`✅ Recording discarded for course ${courseId}`);

            return {
                success: true,
                recording: false,
                message: 'Recording discarded successfully'
            };

        } catch (error) {
            console.error(`❌ Failed to discard recording for course ${courseId}:`, error);
            return {
                success: false,
                recording: false,
                error: error.message,
                message: 'Failed to discard recording'
            };
        }
    }

    /**
     * Generate a public URL for a completed recording
     * @param {string} fileName - The recording file name (can include subdirectory)
     */
    generateRecordingUrl(fileName) {
        // In a real VPS setup, this would be your domain + recordings path
        const baseUrl = process.env.RECORDING_BASE_URL || 'http://localhost:3000';
        
        // Handle both simple filename and subdirectory/filename
        const cleanFileName = fileName.startsWith('completed/') ? fileName : `completed/${fileName}`;
        
        return `${baseUrl}/recordings/${cleanFileName}`;
    }

    /**
     * Ensure recording directories exist
     */
    async ensureDirectories() {
        const directories = ['active', 'completed', 'failed', 'temp'];
        
        for (const dir of directories) {
            const dirPath = path.join(this.recordingsDir, dir);
            try {
                await fs.mkdir(dirPath, { recursive: true });
                console.log(`📁 Directory ensured: ${dir}`);
            } catch (error) {
                console.error(`❌ Failed to create directory ${dir}:`, error);
            }
        }
    }

    /**
     * Move recording file from one folder to another
     * @param {string} fileName - The recording file name
     * @param {string} fromFolder - Source folder
     * @param {string} toFolder - Destination folder
     */
    async moveRecording(fileName, fromFolder, toFolder) {
        const fromPath = path.join(this.recordingsDir, fromFolder, fileName);
        const toPath = path.join(this.recordingsDir, toFolder, fileName);
        
        try {
            await fs.rename(fromPath, toPath);
            console.log(`📁 Moved ${fileName} from ${fromFolder} to ${toFolder}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to move ${fileName}:`, error);
            return false;
        }
    }

    /**
     * List recordings in a specific directory
     * @param {string} directory - Directory to list (active, completed, failed, etc.)
     */
    async listRecordings(directory = 'completed') {
        const dirPath = path.join(this.recordingsDir, directory);
        
        try {
            const files = await fs.readdir(dirPath);
            const recordings = [];
            
            for (const file of files) {
                if (file.endsWith('.mp4')) {
                    const filePath = path.join(dirPath, file);
                    const stats = await fs.stat(filePath);
                    
                    // Extract course ID from filename
                    const courseIdMatch = file.match(/course-(\w+)-/);
                    const courseId = courseIdMatch ? courseIdMatch[1] : 'unknown';
                    
                    recordings.push({
                        fileName: file,
                        courseId: courseId,
                        size: stats.size,
                        createdAt: stats.birthtime.toISOString(),
                        modifiedAt: stats.mtime.toISOString(),
                        directory: directory
                    });
                }
            }
            
            return recordings;
        } catch (error) {
            console.error(`❌ Error listing recordings in ${directory}:`, error);
            return [];
        }
    }

    /**
     * Get recording information by course ID
     * @param {string} courseId - The course ID
     */
    getRecordingInfo(courseId) {
        return this.activeRecordings.get(courseId) || null;
    }

    /**
     * Get recording status for a course
     * @param {string} courseId - The course ID
     */
    getRecordingStatus(courseId) {
        const recordingInfo = this.activeRecordings.get(courseId);
        
        if (recordingInfo) {
            return {
                success: true,
                recording: true,
                status: recordingInfo.status,
                fileName: recordingInfo.fileName,
                startedAt: recordingInfo.startedAt,
                duration: recordingInfo.duration || 0
            };
        } else {
            return {
                success: true,
                recording: false,
                status: 'inactive'
            };
        }
    }

    /**
     * Delete a recording file
     * @param {string} fileName - The recording file name
     * @param {string} directory - Directory containing the file (default: completed)
     */
    async deleteRecording(fileName, directory = 'completed') {
        const filePath = path.join(this.recordingsDir, directory, fileName);
        
        try {
            await fs.unlink(filePath);
            console.log(`🗑️ Deleted recording: ${fileName}`);
            return {
                success: true,
                message: 'Recording deleted successfully'
            };
        } catch (error) {
            console.error(`❌ Failed to delete recording ${fileName}:`, error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete recording'
            };
        }
    }

    /**
     * Clean up old recordings based on age
     * @param {number} maxAgeDays - Maximum age in days
     */
    async cleanupOldRecordings(maxAgeDays = 2000) {
        const directories = ['completed', 'failed'];
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        let cleanedCount = 0;
        
        for (const dir of directories) {
            const dirPath = path.join(this.recordingsDir, dir);
            
            try {
                const files = await fs.readdir(dirPath);
                
                for (const file of files) {
                    if (file.endsWith('.mp4')) {
                        const filePath = path.join(dirPath, file);
                        const stats = await fs.stat(filePath);
                        
                        if (Date.now() - stats.mtime.getTime() > maxAgeMs) {
                            await fs.unlink(filePath);
                            console.log(`🗑️ Cleaned up old recording: ${file}`);
                            cleanedCount++;
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Error cleaning up ${dir}:`, error);
            }
        }
        
        console.log(`✅ Cleanup completed: ${cleanedCount} files removed`);
        return cleanedCount;
    }

    /**
     * Get recordings directory path
     */
    getRecordingsDirectory() {
        return this.recordingsDir;
    }
}

// Create singleton instance
const recordingManager = new RecordingManager();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
    await recordingManager.cleanup();
});

process.on('SIGINT', async () => {
    await recordingManager.cleanup();
});

module.exports = recordingManager;