#!/bin/bash
set -e

GREEN='\033[0;32m'
NC='\033[0m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'

echo -e "${BLUE}=== Free Claude Code Electron macOS App Builder ===${NC}"

# Step 1: Package the Python server backend
echo -e "${BLUE}[1/4] Compiling Python FastAPI server via PyInstaller...${NC}"
uv run pyinstaller --clean -y desktop/fcc-server.spec

if [ ! -f "dist/fcc-server" ]; then
    echo "Error: PyInstaller build failed to produce dist/fcc-server."
    exit 1
fi
echo -e "${GREEN}Python backend successfully compiled!${NC}"

# Step 2: Set up sidecar binary in Electron extraResources path
echo -e "${BLUE}[2/4] Staging sidecar binary...${NC}"
mkdir -p desktop/binaries
cp dist/fcc-server "desktop/binaries/fcc-server"
echo -e "Sidecar binary staged at: ${GREEN}desktop/binaries/fcc-server${NC}"

# Step 3: Run codesign on the sidecar binary (if Developer ID environment variable is set)
if [ -n "$APPLE_SIGNING_IDENTITY" ]; then
    echo -e "${BLUE}[3/4] Codesigning staged sidecar binary...${NC}"
    codesign --force --options runtime --entitlements "desktop/entitlements.plist" --sign "$APPLE_SIGNING_IDENTITY" "desktop/binaries/fcc-server"
    echo -e "${GREEN}Staged sidecar signed successfully.${NC}"
else
    echo -e "${YELLOW}[3/4] Skipping developer signing step (APPLE_SIGNING_IDENTITY env var not set).${NC}"
fi

# Step 4: Build Electron App Wrapper
echo -e "${BLUE}[4/4] Invoking Electron Builder...${NC}"
cd desktop

# Install npm dependencies
npm install

# Run electron builder package
npm run dist

echo -e "${GREEN}=== Electron macOS app build completed successfully! ===${NC}"
echo -e "Target output: ${BLUE}desktop/dist/Free Claude Code-2.3.15.dmg${NC}"
