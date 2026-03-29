#!/bin/bash

echo "Pulling latest code..."
git pull

echo "Installing frontend..."
cd admin-ui
npm install
npm run build

echo "Copying frontend build..."
rm -rf ../server/public
cp -r dist ../server/public

echo "Installing backend..."
cd ../server
npm install
npm run build

echo "Starting server..."
node dist/server.js
