#!/bin/bash

# E2E Test Runner for Solid Octo Invention
# This script manages the full lifecycle of e2e testing:
# 1. Starts backend and frontend servers
# 2. Waits for servers to be ready
# 3. Runs Playwright e2e tests
# 4. Cleans up servers regardless of test outcome

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=3001
FRONTEND_PORT=5173
BACKEND_HEALTH_URL="http://localhost:${BACKEND_PORT}/health"
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
MAX_WAIT_TIME=120 # seconds
CHECK_INTERVAL=2 # seconds

# PID files for cleanup
BACKEND_PID_FILE="/tmp/e2e-backend.pid"
FRONTEND_PID_FILE="/tmp/e2e-frontend.pid"

# Function to log messages with timestamps and colors
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[${timestamp}] ℹ️  ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[${timestamp}] ✅ ${message}${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}[${timestamp}] ⚠️  ${message}${NC}"
            ;;
        "ERROR")
            echo -e "${RED}[${timestamp}] ❌ ${message}${NC}"
            ;;
    esac
}

# Function to check if a port is in use
is_port_in_use() {
    local port=$1
    lsof -i :$port >/dev/null 2>&1
}

# Function to wait for a URL to be ready
wait_for_url() {
    local url=$1
    local service_name=$2
    local max_attempts=$((MAX_WAIT_TIME / CHECK_INTERVAL))
    local attempt=1
    
    log "INFO" "Waiting for ${service_name} to be ready at ${url}..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            log "SUCCESS" "${service_name} is ready!"
            return 0
        fi
        
        if [ $((attempt % 5)) -eq 0 ]; then
            log "INFO" "Still waiting for ${service_name}... (attempt ${attempt}/${max_attempts})"
        fi
        
        sleep $CHECK_INTERVAL
        attempt=$((attempt + 1))
    done
    
    log "ERROR" "${service_name} failed to start within ${MAX_WAIT_TIME} seconds"
    return 1
}

# Function to start the backend server
start_backend() {
    log "INFO" "Starting backend server on port ${BACKEND_PORT}..."
    
    if is_port_in_use $BACKEND_PORT; then
        log "WARNING" "Port ${BACKEND_PORT} is already in use. Attempting to use existing server..."
        if wait_for_url "$BACKEND_HEALTH_URL" "Backend (existing)"; then
            return 0
        else
            log "ERROR" "Existing server on port ${BACKEND_PORT} is not responding properly"
            return 1
        fi
    fi
    
    cd packages/backend
    pnpm dev > /tmp/e2e-backend.log 2>&1 &
    local backend_pid=$!
    echo $backend_pid > "$BACKEND_PID_FILE"
    cd ../..
    
    log "INFO" "Backend server started with PID ${backend_pid}"
    
    # Wait for backend to be ready
    if wait_for_url "$BACKEND_HEALTH_URL" "Backend"; then
        return 0
    else
        log "ERROR" "Backend server failed to start properly"
        return 1
    fi
}

# Function to start the frontend server
start_frontend() {
    log "INFO" "Starting frontend server on port ${FRONTEND_PORT}..."
    
    if is_port_in_use $FRONTEND_PORT; then
        log "WARNING" "Port ${FRONTEND_PORT} is already in use. Attempting to use existing server..."
        if wait_for_url "$FRONTEND_URL" "Frontend (existing)"; then
            return 0
        else
            log "ERROR" "Existing server on port ${FRONTEND_PORT} is not responding properly"
            return 1
        fi
    fi
    
    cd packages/frontend
    pnpm dev > /tmp/e2e-frontend.log 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$FRONTEND_PID_FILE"
    cd ../..
    
    log "INFO" "Frontend server started with PID ${frontend_pid}"
    
    # Wait for frontend to be ready
    if wait_for_url "$FRONTEND_URL" "Frontend"; then
        return 0
    else
        log "ERROR" "Frontend server failed to start properly"
        return 1
    fi
}

# Function to stop servers
cleanup_servers() {
    log "INFO" "Cleaning up servers..."
    
    # Stop backend
    if [ -f "$BACKEND_PID_FILE" ]; then
        local backend_pid=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$backend_pid" 2>/dev/null; then
            log "INFO" "Stopping backend server (PID: ${backend_pid})"
            kill "$backend_pid" 2>/dev/null || true
            # Wait a moment for graceful shutdown
            sleep 2
            # Force kill if still running
            if kill -0 "$backend_pid" 2>/dev/null; then
                kill -9 "$backend_pid" 2>/dev/null || true
            fi
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    # Stop frontend
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$frontend_pid" 2>/dev/null; then
            log "INFO" "Stopping frontend server (PID: ${frontend_pid})"
            kill "$frontend_pid" 2>/dev/null || true
            # Wait a moment for graceful shutdown
            sleep 2
            # Force kill if still running
            if kill -0 "$frontend_pid" 2>/dev/null; then
                kill -9 "$frontend_pid" 2>/dev/null || true
            fi
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    # Clean up any remaining processes on our ports
    if is_port_in_use $BACKEND_PORT; then
        log "WARNING" "Forcefully cleaning up processes on port ${BACKEND_PORT}"
        lsof -ti :$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    fi
    
    if is_port_in_use $FRONTEND_PORT; then
        log "WARNING" "Forcefully cleaning up processes on port ${FRONTEND_PORT}"
        lsof -ti :$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    fi
    
    log "SUCCESS" "Server cleanup completed"
}

# Function to run the e2e tests
run_tests() {
    log "INFO" "Running Playwright e2e tests..."
    
    cd packages/frontend
    if pnpm exec playwright test "$@"; then
        log "SUCCESS" "E2E tests completed successfully!"
        cd ../..
        return 0
    else
        log "ERROR" "E2E tests failed!"
        cd ../..
        return 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] [PLAYWRIGHT_ARGS...]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -c, --cleanup  Only cleanup existing servers and exit"
    echo "  -s, --start    Only start servers and exit (useful for manual testing)"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run full e2e test suite"
    echo "  $0 --headed                  # Run tests in headed mode"
    echo "  $0 --ui                      # Run tests with Playwright UI"
    echo "  $0 tests/auth.spec.ts        # Run specific test file"
    echo "  $0 --cleanup                 # Cleanup any running servers"
    echo "  $0 --start                   # Start servers for manual testing"
}

# Trap to ensure cleanup on exit
trap cleanup_servers EXIT INT TERM

# Parse command line arguments
CLEANUP_ONLY=false
START_ONLY=false
PLAYWRIGHT_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -c|--cleanup)
            CLEANUP_ONLY=true
            shift
            ;;
        -s|--start)
            START_ONLY=true
            shift
            ;;
        *)
            PLAYWRIGHT_ARGS+=("$1")
            shift
            ;;
    esac
done

# Main execution
main() {
    log "INFO" "🎭 Starting E2E Test Runner for Solid Octo Invention"
    echo "=================================================="
    
    # Handle cleanup-only mode
    if [ "$CLEANUP_ONLY" = true ]; then
        cleanup_servers
        exit 0
    fi
    
    # Ensure we have required dependencies
    if ! command -v pnpm &> /dev/null; then
        log "ERROR" "pnpm is required but not installed"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log "ERROR" "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v lsof &> /dev/null; then
        log "ERROR" "lsof is required but not installed"
        exit 1
    fi
    
    # Start servers
    log "INFO" "Starting development servers..."
    
    if ! start_backend; then
        log "ERROR" "Failed to start backend server"
        exit 1
    fi
    
    if ! start_frontend; then
        log "ERROR" "Failed to start frontend server"
        exit 1
    fi
    
    log "SUCCESS" "All servers are ready!"
    
    # Handle start-only mode
    if [ "$START_ONLY" = true ]; then
        log "INFO" "Servers started successfully. Use --cleanup to stop them."
        log "INFO" "Backend: ${BACKEND_HEALTH_URL}"
        log "INFO" "Frontend: ${FRONTEND_URL}"
        # Don't exit, let the trap handle cleanup when user interrupts
        while true; do
            sleep 1
        done
    fi
    
    # Run the tests
    local test_exit_code=0
    if ! run_tests "${PLAYWRIGHT_ARGS[@]}"; then
        test_exit_code=1
    fi
    
    # Show test results location
    if [ -d "packages/frontend/playwright-report" ]; then
        log "INFO" "Test report available at: packages/frontend/playwright-report/index.html"
        log "INFO" "To view the report, run: pnpm --filter frontend exec playwright show-report"
    fi
    
    # Cleanup will happen automatically via trap
    exit $test_exit_code
}

# Run main function
main "$@"

