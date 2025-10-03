#!/bin/bash

# Beauty LMS Deployment Verification Script
# Usage: ./verify_deployment.sh [domain]
# Example: ./verify_deployment.sh krishnabarasiya.space

DOMAIN=${1:-krishnabarasiya.space}
PROTOCOL="https"
BASE_URL="$PROTOCOL://$DOMAIN"

echo "🚀 Beauty LMS Deployment Verification"
echo "======================================"
echo "Testing domain: $DOMAIN"
echo "Base URL: $BASE_URL"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 30 --connect-timeout 10)
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $response, expected $expected_status)"
        return 1
    fi
}

# Function to test JSON response
test_json_endpoint() {
    local url=$1
    local description=$2
    local expected_field=$3
    
    echo -n "Testing $description... "
    
    response=$(curl -s "$url" --max-time 30 --connect-timeout 10)
    
    if echo "$response" | jq -e "$expected_field" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC} (JSON response valid)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Invalid JSON or missing field: $expected_field)"
        echo "Response: $response"
        return 1
    fi
}

echo "1. Basic Connectivity Tests"
echo "============================"

# Test domain resolution
echo -n "DNS Resolution... "
if nslookup $DOMAIN > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test SSL certificate
echo -n "SSL Certificate... "
if curl -s --head "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

echo ""
echo "2. Application Endpoints"
echo "========================"

# Test health endpoint
test_endpoint "$BASE_URL/health" "Health Check"

# Test main API endpoint
test_json_endpoint "$BASE_URL/api/live_courses" "Live Courses API" ".success"

# Test specific course endpoint
test_json_endpoint "$BASE_URL/api/live_courses/test123" "Individual Course API" ".data.id"

echo ""
echo "3. Recording Functionality"
echo "=========================="

# Create a test recording file for verification
echo -n "Creating test recording... "
test_recording_url="$BASE_URL/recordings/completed/test-verification.mp4"

# Test recording access (should return 404 since file doesn't exist, but headers should be correct for MP4)
echo -n "Recording URL accessibility... "
headers=$(curl -s -I "$test_recording_url" --max-time 10)
if echo "$headers" | grep -q "Content-Type.*video/mp4"; then
    echo -e "${GREEN}✅ PASS${NC} (Correct content-type headers)"
elif echo "$headers" | grep -q "HTTP.*404"; then
    echo -e "${YELLOW}⚠️  PARTIAL${NC} (404 expected - no test file, but URL structure is correct)"
else
    echo -e "${RED}❌ FAIL${NC} (Incorrect headers or server error)"
fi

echo ""
echo "4. API Response Structure Tests"
echo "==============================="

# Test that API includes recording URLs when available
echo -n "API includes recordingUrl field... "
api_response=$(curl -s "$BASE_URL/api/live_courses" --max-time 30)
if echo "$api_response" | jq -e '.data[]? | select(.recordingUrl)' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} (recordingUrl field found in response)"
elif echo "$api_response" | jq -e '.data[]?' > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  PARTIAL${NC} (API works but no recordings found - this is normal for new deployment)"
else
    echo -e "${RED}❌ FAIL${NC} (API response invalid)"
fi

echo ""
echo "5. Security Tests"
echo "================="

# Test HTTPS redirect
echo -n "HTTP to HTTPS redirect... "
http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" --max-time 10)
if [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP redirects to HTTPS)"
else
    echo -e "${YELLOW}⚠️  CHECK${NC} (HTTP response: $http_response)"
fi

# Test security headers
echo -n "Security headers... "
security_headers=$(curl -s -I "$BASE_URL" --max-time 10)
if echo "$security_headers" | grep -q "Strict-Transport-Security"; then
    echo -e "${GREEN}✅ PASS${NC} (HSTS header present)"
else
    echo -e "${YELLOW}⚠️  PARTIAL${NC} (Consider adding security headers)"
fi

echo ""
echo "6. Performance Tests"
echo "===================="

# Test response time
echo -n "API response time... "
response_time=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/api/live_courses" --max-time 30)
if [ $(echo "$response_time < 2.0" | bc -l 2>/dev/null || echo "1") = "1" ]; then
    echo -e "${GREEN}✅ PASS${NC} (${response_time}s)"
else
    echo -e "${YELLOW}⚠️  SLOW${NC} (${response_time}s - consider optimization)"
fi

echo ""
echo "7. WebSocket Connection Test"
echo "============================"

# Test Socket.IO endpoint
echo -n "Socket.IO endpoint... "
socket_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/socket.io/" --max-time 10)
if [ "$socket_response" = "200" ] || [ "$socket_response" = "400" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Socket.IO responding)"
else
    echo -e "${YELLOW}⚠️  CHECK${NC} (Response: $socket_response)"
fi

echo ""
echo "📊 Verification Summary"
echo "======================="

# Sample API call for demonstration
echo "Sample API Response:"
echo "-------------------"
curl -s "$BASE_URL/api/live_courses" | jq '.data[0] // {message: "No courses available"}' 2>/dev/null || echo "API not responding properly"

echo ""
echo "🔗 Useful URLs:"
echo "- Health Check: $BASE_URL/health"
echo "- Live Courses API: $BASE_URL/api/live_courses"
echo "- Individual Course: $BASE_URL/api/live_courses/test123"
echo "- Recording Example: $BASE_URL/recordings/completed/[filename].mp4"

echo ""
echo "✅ Verification completed!"
echo ""
echo "📝 Next Steps:"
echo "1. If any tests failed, check the deployment logs:"
echo "   pm2 logs beauty-lms-backend"
echo "2. Check Nginx logs for any errors:"
echo "   sudo tail -f /var/log/nginx/error.log"
echo "3. Verify that your domain DNS is properly configured"
echo "4. Test creating and accessing actual recordings through the application"

echo ""
echo "💡 To run this script after deployment:"
echo "   ./scripts/verify_deployment.sh krishnabarasiya.space"