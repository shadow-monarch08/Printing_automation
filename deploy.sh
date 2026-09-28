#!/bin/bash

# Exit immediately if any command fails
set -e

echo "⬇️ Pulling latest code..."
git fetch origin && git reset --hard origin/main

echo "📦 Installing and building customer-ui..."
cd customer-ui
npm install
npm run build
cd ..

echo "📦 Installing and building admin-ui..."
cd admin-ui
npm install
npm run build
cd ..

echo "📦 Installing and building kiosk-ui..."
cd kiosk-ui
npm install
npm run build
cd ..

echo "⚙️ Installing and building backend..."
cd server
npm install
npm run build

echo "📂 Copying config files to build directory..."
mkdir -p dist/config
cp -r src/config/* dist/config/ 2>/dev/null || true

echo "🚀 Starting server..."
node dist/server.js