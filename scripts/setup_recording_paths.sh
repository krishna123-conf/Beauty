#!/bin/bash

# Beauty LMS Recording Paths Setup Script
# This script sets up the complete recording directory structure and permissions

set -e  # Exit on any error

# Configuration
RECORDINGS_DIR="/home/beautylms/Beauty-lms/recordings"
USER="beautylms"
GROUP="beautylms"
LOG_FILE="/tmp/recording_setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "This script needs to be run with sudo privileges"
        echo "Usage: sudo ./setup_recording_paths.sh"
        exit 1
    fi
}

# Create user if doesn't exist
create_user() {
    if ! id "$USER" &>/dev/null; then
        log "Creating user: $USER"
        useradd -r -s /bin/bash -d "/home/$USER" -m "$USER"
        success "User $USER created"
    else
        log "User $USER already exists"
    fi
}

# Create recording directory structure
create_directories() {
    log "Creating recording directory structure..."
    
    # Create main directory
    mkdir -p "$RECORDINGS_DIR"
    
    # Create subdirectories
    local subdirs=("active" "completed" "failed" "temp" "private")
    for subdir in "${subdirs[@]}"; do
        mkdir -p "$RECORDINGS_DIR/$subdir"
        log "Created directory: $RECORDINGS_DIR/$subdir"
    done
    
    # Create logs directory
    mkdir -p "$(dirname "$RECORDINGS_DIR")/backend/logs/recordings"
    log "Created logs directory"
    
    success "Directory structure created"
}

# Set proper ownership and permissions
set_permissions() {
    log "Setting ownership and permissions..."
    
    # Set ownership
    chown -R "$USER:$GROUP" "$RECORDINGS_DIR"
    chown -R "$USER:$GROUP" "$(dirname "$RECORDINGS_DIR")/backend/logs"
    
    # Set permissions
    chmod -R 755 "$RECORDINGS_DIR"
    chmod 750 "$RECORDINGS_DIR/private"  # More restrictive for private recordings
    chmod -R 755 "$(dirname "$RECORDINGS_DIR")/backend/logs"
    
    success "Permissions set correctly"
}

# Create nginx configuration snippet
create_nginx_config() {
    local nginx_config="/etc/nginx/sites-available/beauty-lms-recordings"
    
    log "Creating Nginx configuration..."
    
    cat > "$nginx_config" << EOF
# Beauty LMS Recording Configuration
# Include this in your main server block

# Serve recording files directly with proper headers
location /recordings/ {
    alias $RECORDINGS_DIR/;
    
    # Enable range requests for video streaming
    add_header Accept-Ranges bytes;
    
    # Cache recordings for 1 day
    expires 1d;
    add_header Cache-Control "public, no-transform";
    
    # CORS headers for video playback
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
    add_header Access-Control-Allow-Headers "Range";
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    
    # Auto-detect content type for video files
    location ~* \.(mp4|webm|ogg|mp3|wav)$ {
        expires 1w;
        add_header Cache-Control "public, immutable";
    }
}

# Private recordings with authentication (optional)
location /recordings/private/ {
    alias $RECORDINGS_DIR/private/;
    
    # Add authentication logic here
    # auth_basic "Private Recordings";
    # auth_basic_user_file /etc/nginx/.htpasswd;
    
    expires 1d;
    add_header Cache-Control "private, no-transform";
}
EOF

    success "Nginx configuration created at: $nginx_config"
    warning "Don't forget to include this configuration in your main Nginx server block"
}

# Create environment template
create_env_template() {
    local env_template="$(dirname "$RECORDINGS_DIR")/.env.recording"
    
    log "Creating environment template..."
    
    cat > "$env_template" << EOF
# Beauty LMS Recording Configuration
# Copy these variables to your main .env file

# Recording Configuration
RECORDING_ENABLED=true
RECORDINGS_PATH=$RECORDINGS_DIR
RECORDING_BASE_URL=https://yourdomain.com
RECORDING_SECRET=$(openssl rand -base64 32)

# Recording Quality Settings
RECORDING_QUALITY=high
RECORDING_MAX_DURATION=7200
RECORDING_MAX_SIZE_MB=2048

# FFmpeg Settings
FFMPEG_PRESET=fast
FFMPEG_CRF=23
FFMPEG_AUDIO_BITRATE=128k
FFMPEG_VIDEO_BITRATE=2000k

# Cleanup Settings
RECORDING_RETENTION_DAYS=30
RECORDING_AUTO_CLEANUP=true
EOF

    chown "$USER:$GROUP" "$env_template"
    success "Environment template created at: $env_template"
}

# Create test script
create_test_script() {
    local test_script="$(dirname "$RECORDINGS_DIR")/test_recording_setup.sh"
    
    log "Creating test script..."
    
    cat > "$test_script" << 'EOF'
#!/bin/bash

# Test script for recording setup
RECORDINGS_DIR="/home/beautylms/Beauty-lms/recordings"

echo "=== Testing Recording Setup ==="

# Test 1: Check directories
echo "1. Checking directory structure..."
for dir in active completed failed temp private; do
    if [ -d "$RECORDINGS_DIR/$dir" ]; then
        echo "   ✅ $dir/ exists"
    else
        echo "   ❌ $dir/ missing"
    fi
done

# Test 2: Check permissions
echo "2. Checking permissions..."
if [ -w "$RECORDINGS_DIR" ]; then
    echo "   ✅ Recordings directory is writable"
else
    echo "   ❌ Recordings directory is not writable"
fi

# Test 3: Test file creation and movement
echo "3. Testing file operations..."
TEST_FILE="$RECORDINGS_DIR/active/test-$(date +%s).tmp"
if touch "$TEST_FILE" 2>/dev/null; then
    echo "   ✅ Can create files in active directory"
    
    # Test movement
    TARGET_FILE="$RECORDINGS_DIR/completed/$(basename "$TEST_FILE")"
    if mv "$TEST_FILE" "$TARGET_FILE" 2>/dev/null; then
        echo "   ✅ Can move files between directories"
        rm "$TARGET_FILE"
    else
        echo "   ❌ Cannot move files between directories"
        rm "$TEST_FILE" 2>/dev/null
    fi
else
    echo "   ❌ Cannot create files in active directory"
fi

# Test 4: Check disk space
echo "4. Checking disk space..."
DISK_USAGE=$(df "$RECORDINGS_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo "   ✅ Sufficient disk space (${DISK_USAGE}% used)"
else
    echo "   ⚠️ Disk space running low (${DISK_USAGE}% used)"
fi

echo "=== Test Complete ==="
EOF

    chmod +x "$test_script"
    chown "$USER:$GROUP" "$test_script"
    success "Test script created at: $test_script"
}

# Main execution
main() {
    log "Starting Beauty LMS Recording Paths Setup"
    log "Log file: $LOG_FILE"
    
    check_permissions
    create_user
    create_directories
    set_permissions
    create_nginx_config
    create_env_template
    create_test_script
    
    success "Setup completed successfully!"
    echo
    echo "=== Next Steps ==="
    echo "1. Copy environment variables from $(dirname "$RECORDINGS_DIR")/.env.recording to your main .env file"
    echo "2. Include Nginx configuration from /etc/nginx/sites-available/beauty-lms-recordings"
    echo "3. Test the setup: $(dirname "$RECORDINGS_DIR")/test_recording_setup.sh"
    echo "4. Restart your Beauty LMS service"
}

# Run main function
main "$@"