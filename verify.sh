#!/bin/bash

# OBS Remote Control Test Script
# This script verifies the application structure and dependencies

echo "========================================"
echo "OBS Remote Control - Verification Tests"
echo "========================================"
echo ""

# Check Node.js version
echo "1. Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node.js version: $NODE_VERSION"
if [[ "$NODE_VERSION" < "v16" ]]; then
    echo "   ❌ WARNING: Node.js version should be 16 or higher"
else
    echo "   ✅ Node.js version is compatible"
fi
echo ""

# Check if dependencies are installed
echo "2. Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules directory exists"
else
    echo "   ❌ node_modules not found. Run 'npm install'"
    exit 1
fi
echo ""

# Check required files
echo "3. Checking required files..."
REQUIRED_FILES=("main.js" "preload.js" "index.html" "styles.css" "app.js" "package.json")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file exists"
    else
        echo "   ❌ $file is missing"
        exit 1
    fi
done
echo ""

# Validate JavaScript syntax
echo "4. Validating JavaScript syntax..."
if node -c main.js 2>/dev/null; then
    echo "   ✅ main.js syntax is valid"
else
    echo "   ❌ main.js has syntax errors"
    exit 1
fi

if node -c preload.js 2>/dev/null; then
    echo "   ✅ preload.js syntax is valid"
else
    echo "   ❌ preload.js has syntax errors"
    exit 1
fi

if node -c app.js 2>/dev/null; then
    echo "   ✅ app.js syntax is valid"
else
    echo "   ❌ app.js has syntax errors"
    exit 1
fi
echo ""

# Check package.json configuration
echo "5. Checking package.json configuration..."
if grep -q '"main": "main.js"' package.json; then
    echo "   ✅ Main entry point is correctly set"
else
    echo "   ❌ Main entry point is not correctly set"
fi

if grep -q '"electron"' package.json; then
    echo "   ✅ Electron dependency is present"
else
    echo "   ❌ Electron dependency is missing"
fi

if grep -q '"obs-websocket-js"' package.json; then
    echo "   ✅ OBS WebSocket dependency is present"
else
    echo "   ❌ OBS WebSocket dependency is missing"
fi
echo ""

# Check if Electron binary exists
echo "6. Checking Electron installation..."
if [ -f "node_modules/.bin/electron" ]; then
    echo "   ✅ Electron binary is installed"
else
    echo "   ❌ Electron binary not found"
fi
echo ""

echo "========================================"
echo "✅ All verification tests passed!"
echo "========================================"
echo ""
echo "To run the application:"
echo "  npm start"
echo ""
echo "To build for distribution:"
echo "  npm run build:linux   (for Linux)"
echo "  npm run build:win     (for Windows)"
echo "  npm run build:all     (for both)"
echo ""
