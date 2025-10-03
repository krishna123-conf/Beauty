#!/bin/bash

# MediaSoup Configuration Test Script
# Tests MediaSoup ports, connectivity, and worker initialization

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "================================================"
echo "🔧 Beauty LMS MediaSoup Configuration Test"
echo "================================================"
echo ""

# Load environment variables
if [ -f "/home/beautylms/Beauty-lms/backend/.env.production" ]; then
    log_info "Loading production environment..."
    set -a
    source /home/beautylms/Beauty-lms/backend/.env.production
    set +a
else
    log_warning "Production environment file not found, using defaults"
    MEDIASOUP_MIN_PORT=40000
    MEDIASOUP_MAX_PORT=49999
    MEDIASOUP_LISTEN_IP=0.0.0.0
    MEDIASOUP_ANNOUNCED_IP=$(curl -s ifconfig.me)
fi

log_info "MediaSoup Configuration:"
echo "  - Listen IP: ${MEDIASOUP_LISTEN_IP:-0.0.0.0}"
echo "  - Announced IP: ${MEDIASOUP_ANNOUNCED_IP:-auto-detect}"
echo "  - Port Range: ${MEDIASOUP_MIN_PORT:-40000}-${MEDIASOUP_MAX_PORT:-49999}"
echo ""

# Test 1: Port Range Availability
log_info "Test 1: Checking MediaSoup port range availability..."
START_PORT=${MEDIASOUP_MIN_PORT:-40000}
END_PORT=${MEDIASOUP_MAX_PORT:-49999}
SAMPLE_END=$((START_PORT + 50))  # Test first 50 ports
if [ $SAMPLE_END -gt $END_PORT ]; then
    SAMPLE_END=$END_PORT
fi

AVAILABLE_PORTS=0
USED_PORTS=0

for port in $(seq $START_PORT $SAMPLE_END); do
    if ! sudo netstat -tuln | grep -q ":$port "; then
        AVAILABLE_PORTS=$((AVAILABLE_PORTS + 1))
    else
        USED_PORTS=$((USED_PORTS + 1))
    fi
done

TOTAL_TESTED=$(($SAMPLE_END - $START_PORT + 1))
log_info "Port availability test results:"
echo "  - Tested ports: $START_PORT-$SAMPLE_END ($TOTAL_TESTED ports)"
echo "  - Available: $AVAILABLE_PORTS"
echo "  - In use: $USED_PORTS"

if [ $AVAILABLE_PORTS -gt $((TOTAL_TESTED * 8 / 10)) ]; then
    log_success "Excellent port availability (${AVAILABLE_PORTS}/${TOTAL_TESTED} free)"
elif [ $AVAILABLE_PORTS -gt $((TOTAL_TESTED / 2)) ]; then
    log_warning "Good port availability (${AVAILABLE_PORTS}/${TOTAL_TESTED} free)"
else
    log_error "Poor port availability (${AVAILABLE_PORTS}/${TOTAL_TESTED} free) - may affect performance"
fi

echo ""

# Test 2: UDP Connectivity Test
log_info "Test 2: Testing UDP connectivity..."
TEST_PORT=$((START_PORT + 10))

if command -v nc >/dev/null 2>&1; then
    # Test UDP binding
    timeout 5 nc -u -l $TEST_PORT </dev/null &
    NC_PID=$!
    sleep 2
    
    if kill -0 $NC_PID 2>/dev/null; then
        log_success "UDP binding test successful on port $TEST_PORT"
        kill $NC_PID 2>/dev/null || true
    else
        log_warning "UDP binding test failed on port $TEST_PORT"
    fi
else
    log_warning "netcat not available, skipping UDP connectivity test"
fi

echo ""

# Test 3: Firewall Configuration
log_info "Test 3: Checking firewall configuration..."
if command -v ufw >/dev/null 2>&1; then
    UFW_STATUS=$(sudo ufw status | head -1)
    log_info "UFW Status: $UFW_STATUS"
    
    # Check if MediaSoup ports are allowed
    if sudo ufw status | grep -q "$START_PORT:$END_PORT"; then
        log_success "MediaSoup port range is allowed in firewall"
    else
        log_warning "MediaSoup ports may not be explicitly allowed in firewall"
        log_info "To allow MediaSoup ports, run:"
        echo "  sudo ufw allow $START_PORT:$END_PORT/udp"
        echo "  sudo ufw allow $START_PORT:$END_PORT/tcp"
    fi
else
    log_warning "UFW not available, cannot check firewall status"
fi

echo ""

# Test 4: Network Interface Check
log_info "Test 4: Checking network interface configuration..."
PUBLIC_IP=${MEDIASOUP_ANNOUNCED_IP:-$(curl -s ifconfig.me 2>/dev/null)}
LISTEN_IP=${MEDIASOUP_LISTEN_IP:-0.0.0.0}

log_info "Network configuration:"
echo "  - Public IP (announced): $PUBLIC_IP"
echo "  - Listen IP: $LISTEN_IP"

# Validate IPs
if [[ $PUBLIC_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    log_success "Public IP format is valid"
else
    log_error "Invalid public IP format: $PUBLIC_IP"
fi

if [[ $LISTEN_IP == "0.0.0.0" ]]; then
    log_success "Listen IP configured to bind to all interfaces"
elif [[ $LISTEN_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    log_success "Listen IP format is valid"
else
    log_error "Invalid listen IP format: $LISTEN_IP"
fi

echo ""

# Test 5: Application Status
log_info "Test 5: Checking application status..."
if command -v pm2 >/dev/null 2>&1; then
    APP_STATUS=$(sudo -u beautylms pm2 list 2>/dev/null | grep beauty-lms-backend || echo "not found")
    if echo "$APP_STATUS" | grep -q "online"; then
        log_success "Beauty LMS application is running"
        
        # Test MediaSoup initialization
        log_info "Checking MediaSoup worker logs..."
        LOGS=$(sudo -u beautylms pm2 logs beauty-lms-backend --lines 20 --nostream 2>/dev/null | grep -i mediasoup || echo "No MediaSoup logs found")
        
        if echo "$LOGS" | grep -q "workers created"; then
            log_success "MediaSoup workers appear to be initialized"
        elif echo "$LOGS" | grep -q "MediaSoup"; then
            log_warning "MediaSoup mentioned in logs, check for any errors"
            echo "$LOGS" | tail -5
        else
            log_warning "No MediaSoup initialization logs found"
        fi
    else
        log_warning "Beauty LMS application is not running"
        echo "  Status: $APP_STATUS"
    fi
else
    log_warning "PM2 not available, cannot check application status"
fi

echo ""

# Test 6: System Resource Check
log_info "Test 6: Checking system resources..."
MEMORY_MB=$(free -m | awk 'NR==2{printf "%.0f", $3}')
CPU_CORES=$(nproc)
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | cut -d',' -f1 | xargs)

echo "  - Memory usage: ${MEMORY_MB}MB"
echo "  - CPU cores: $CPU_CORES"
echo "  - Load average: $LOAD_AVG"

if [ "$MEMORY_MB" -gt 1000 ]; then
    log_success "Good memory availability"
elif [ "$MEMORY_MB" -gt 500 ]; then
    log_warning "Moderate memory usage"
else
    log_error "High memory usage - may affect MediaSoup performance"
fi

echo ""

# Summary
echo "================================================"
echo "📊 MediaSoup Test Summary"  
echo "================================================"
echo ""
log_info "Recommendations:"

if [ $AVAILABLE_PORTS -lt $((TOTAL_TESTED / 2)) ]; then
    echo "❌ Consider increasing MediaSoup port range or freeing up ports"
fi

if [ "$MEMORY_MB" -gt 1500 ]; then
    echo "✅ System resources look good for MediaSoup"
else
    echo "⚠️  Monitor system resources during video conferences"
fi

echo "✅ Test logging and monitoring with: pm2 logs beauty-lms-backend"
echo "✅ Monitor MediaSoup activity in application logs"
echo "✅ Test actual video conferencing with multiple clients"

echo ""
log_success "MediaSoup configuration test completed!"
echo ""
echo "💡 For production troubleshooting:"
echo "   - Check application logs: pm2 logs beauty-lms-backend"
echo "   - Monitor port usage: netstat -tuln | grep 4000"
echo "   - Test from external network using your VPS IP"
echo "   - Verify firewall settings allow MediaSoup ports"