#!/bin/bash

# Beauty LMS Firebase Setup Helper Script
# This script helps configure Firebase credentials for production deployment

set -e

echo "🔥 Beauty LMS Firebase Setup Helper"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Default paths
BACKEND_DIR="/home/beautylms/Beauty-lms/backend"
CREDENTIALS_DIR="/home/beautylms/.credentials"
SERVICE_ACCOUNT_FILE="$CREDENTIALS_DIR/serviceAccountKey.json"
ENV_FILE="$BACKEND_DIR/.env.production"

# Check if running as root or beautylms user
if [ "$EUID" -eq 0 ]; then
    USER_PREFIX="sudo -u beautylms"
    log_warning "Running as root. Commands will be executed as beautylms user."
else
    USER_PREFIX=""
    if [ "$USER" != "beautylms" ]; then
        log_warning "Not running as beautylms user. Some operations may require different permissions."
    fi
fi

echo "This script will help you configure Firebase for Beauty LMS."
echo ""
echo "Prerequisites:"
echo "1. You have created a Firebase project"
echo "2. You have enabled Firestore Database and Authentication"
echo "3. You have downloaded the service account key JSON file"
echo ""

# Ask user to confirm
read -p "Do you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

# Step 1: Check if service account file exists
echo ""
echo "Step 1: Checking existing Firebase configuration..."

if [ -f "$SERVICE_ACCOUNT_FILE" ]; then
    log_success "Firebase service account key already exists: $SERVICE_ACCOUNT_FILE"
    
    # Validate JSON
    if jq empty "$SERVICE_ACCOUNT_FILE" 2>/dev/null; then
        log_success "Service account key is valid JSON"
        
        # Extract project ID from the key file
        EXISTING_PROJECT_ID=$(jq -r '.project_id' "$SERVICE_ACCOUNT_FILE" 2>/dev/null || echo "")
        if [ -n "$EXISTING_PROJECT_ID" ]; then
            log_info "Project ID from service account key: $EXISTING_PROJECT_ID"
        fi
    else
        log_error "Service account key file exists but contains invalid JSON"
        echo "Please replace it with a valid Firebase service account key."
        exit 1
    fi
    
    read -p "Do you want to replace the existing service account key? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing service account key."
        SKIP_UPLOAD=true
    fi
fi

# Step 2: Upload new service account key if needed
if [ "$SKIP_UPLOAD" != "true" ]; then
    echo ""
    echo "Step 2: Setting up Firebase service account key..."
    
    echo "Please choose how to provide your Firebase service account key:"
    echo "1) I have the JSON file on this server"
    echo "2) I want to paste the JSON content directly"
    echo "3) I will upload it later manually"
    
    read -p "Choose option (1-3): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            read -p "Enter the full path to your serviceAccountKey.json file: " SOURCE_FILE
            if [ ! -f "$SOURCE_FILE" ]; then
                log_error "File not found: $SOURCE_FILE"
                exit 1
            fi
            
            # Validate JSON
            if ! jq empty "$SOURCE_FILE" 2>/dev/null; then
                log_error "The file is not valid JSON"
                exit 1
            fi
            
            # Create credentials directory
            $USER_PREFIX mkdir -p "$CREDENTIALS_DIR"
            
            # Copy file
            $USER_PREFIX cp "$SOURCE_FILE" "$SERVICE_ACCOUNT_FILE"
            log_success "Service account key copied to $SERVICE_ACCOUNT_FILE"
            ;;
            
        2)
            echo "Paste your Firebase service account key JSON content below."
            echo "Press Ctrl+D when finished:"
            
            # Create credentials directory
            $USER_PREFIX mkdir -p "$CREDENTIALS_DIR"
            
            # Read JSON content from stdin
            $USER_PREFIX tee "$SERVICE_ACCOUNT_FILE" > /dev/null
            
            # Validate JSON
            if ! jq empty "$SERVICE_ACCOUNT_FILE" 2>/dev/null; then
                log_error "The pasted content is not valid JSON"
                $USER_PREFIX rm -f "$SERVICE_ACCOUNT_FILE"
                exit 1
            fi
            
            log_success "Service account key saved to $SERVICE_ACCOUNT_FILE"
            ;;
            
        3)
            log_info "You can upload the service account key manually later to: $SERVICE_ACCOUNT_FILE"
            echo "Remember to set proper permissions: chmod 600 $SERVICE_ACCOUNT_FILE"
            SKIP_PERMISSIONS=true
            SKIP_CONFIG=true
            ;;
            
        *)
            log_error "Invalid option selected"
            exit 1
            ;;
    esac
fi

# Step 3: Set proper permissions
if [ "$SKIP_PERMISSIONS" != "true" ] && [ -f "$SERVICE_ACCOUNT_FILE" ]; then
    echo ""
    echo "Step 3: Setting proper permissions..."
    
    $USER_PREFIX chown beautylms:beautylms "$SERVICE_ACCOUNT_FILE" 2>/dev/null || true
    $USER_PREFIX chmod 600 "$SERVICE_ACCOUNT_FILE"
    
    # Verify permissions
    PERMS=$(ls -la "$SERVICE_ACCOUNT_FILE" | awk '{print $1}')
    if [[ "$PERMS" == "-rw-------"* ]]; then
        log_success "Permissions set correctly: $PERMS"
    else
        log_warning "Permissions may not be optimal: $PERMS"
    fi
fi

# Step 4: Configure environment file
if [ "$SKIP_CONFIG" != "true" ]; then
    echo ""
    echo "Step 4: Configuring environment file..."
    
    if [ -f "$SERVICE_ACCOUNT_FILE" ]; then
        # Extract project ID from service account key
        PROJECT_ID=$(jq -r '.project_id' "$SERVICE_ACCOUNT_FILE" 2>/dev/null || echo "")
        
        if [ -n "$PROJECT_ID" ]; then
            log_info "Detected Firebase Project ID: $PROJECT_ID"
            
            if [ -f "$ENV_FILE" ]; then
                # Update existing environment file
                if grep -q "FIREBASE_PROJECT_ID=" "$ENV_FILE"; then
                    $USER_PREFIX sed -i "s/FIREBASE_PROJECT_ID=.*/FIREBASE_PROJECT_ID=$PROJECT_ID/" "$ENV_FILE"
                    log_success "Updated FIREBASE_PROJECT_ID in $ENV_FILE"
                else
                    echo "FIREBASE_PROJECT_ID=$PROJECT_ID" | $USER_PREFIX tee -a "$ENV_FILE" > /dev/null
                    log_success "Added FIREBASE_PROJECT_ID to $ENV_FILE"
                fi
                
                if grep -q "GOOGLE_APPLICATION_CREDENTIALS=" "$ENV_FILE"; then
                    $USER_PREFIX sed -i "s|GOOGLE_APPLICATION_CREDENTIALS=.*|GOOGLE_APPLICATION_CREDENTIALS=$SERVICE_ACCOUNT_FILE|" "$ENV_FILE"
                    log_success "Updated GOOGLE_APPLICATION_CREDENTIALS in $ENV_FILE"
                else
                    echo "GOOGLE_APPLICATION_CREDENTIALS=$SERVICE_ACCOUNT_FILE" | $USER_PREFIX tee -a "$ENV_FILE" > /dev/null
                    log_success "Added GOOGLE_APPLICATION_CREDENTIALS to $ENV_FILE"
                fi
            else
                log_warning "Environment file not found: $ENV_FILE"
                log_info "You'll need to create it and add:"
                echo "FIREBASE_PROJECT_ID=$PROJECT_ID"
                echo "GOOGLE_APPLICATION_CREDENTIALS=$SERVICE_ACCOUNT_FILE"
            fi
        else
            log_error "Could not extract project ID from service account key"
        fi
    fi
fi

# Step 5: Test Firebase configuration
echo ""
echo "Step 5: Testing Firebase configuration..."

if [ -f "$SERVICE_ACCOUNT_FILE" ] && [ -f "$ENV_FILE" ]; then
    log_info "Testing Firebase connectivity..."
    
    # Check if the application is running
    if command -v pm2 >/dev/null 2>&1; then
        if pm2 describe beauty-lms-backend >/dev/null 2>&1; then
            log_info "Restarting Beauty LMS application to apply changes..."
            $USER_PREFIX pm2 restart beauty-lms-backend
            
            # Wait a bit for startup
            sleep 3
            
            # Check logs for Firebase initialization
            log_info "Checking application logs for Firebase status..."
            pm2 logs beauty-lms-backend --lines 10 --nostream | grep -i firebase | tail -3
        else
            log_info "Beauty LMS application is not running. Start it with: pm2 start beauty-lms-backend"
        fi
    else
        log_info "PM2 not found. You may need to restart the application manually."
    fi
else
    log_warning "Cannot test configuration - missing service account key or environment file"
fi

# Final summary
echo ""
echo "🎉 Firebase Setup Complete!"
echo "=========================="
echo ""

if [ -f "$SERVICE_ACCOUNT_FILE" ]; then
    log_success "Service account key: $SERVICE_ACCOUNT_FILE"
    
    # Show file info
    echo "File details:"
    ls -la "$SERVICE_ACCOUNT_FILE"
    
    # Show project info from key
    PROJECT_ID=$(jq -r '.project_id' "$SERVICE_ACCOUNT_FILE" 2>/dev/null || echo "")
    CLIENT_EMAIL=$(jq -r '.client_email' "$SERVICE_ACCOUNT_FILE" 2>/dev/null || echo "")
    
    if [ -n "$PROJECT_ID" ]; then
        echo "Project ID: $PROJECT_ID"
    fi
    if [ -n "$CLIENT_EMAIL" ]; then
        echo "Service Account: $CLIENT_EMAIL"
    fi
fi

if [ -f "$ENV_FILE" ]; then
    log_success "Environment configured: $ENV_FILE"
    echo "Firebase configuration:"
    grep "FIREBASE" "$ENV_FILE" || echo "No Firebase configuration found in environment file"
fi

echo ""
echo "Next steps:"
echo "1. Ensure your Firebase project has Firestore and Authentication enabled"
echo "2. Test the application: curl http://localhost:3000/health"
echo "3. Check logs for Firebase connection: pm2 logs beauty-lms-backend | grep Firebase"
echo "4. If issues persist, refer to the troubleshooting guide in HOSTINGER_VPS_DEPLOYMENT_GUIDE.md"

log_success "Firebase setup completed successfully! 🚀"