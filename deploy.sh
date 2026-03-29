#!/bin/bash

# Exit immediately if any command fails
set -e

echo "⬇️ Pulling latest code..."
# Update the existing repository instead of cloning a new one
git pull origin main

echo "📦 Installing and building frontend..."
cd admin-ui
npm install
npm run build
cd ..

echo "📂 Copying frontend build to backend..."
rm -rf server/public
mkdir -p server/public
# Copy the contents of the 'admin' folder directly into public
cp -r admin/* server/public/

echo "⚙️ Installing and building backend..."
cd server
npm install
npm run build

echo "🚀 Starting server..."
# For now, this will run in the terminal. 
# (Press Ctrl+C to stop it when you are done testing).
node dist/server.js