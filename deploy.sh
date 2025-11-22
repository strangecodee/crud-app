#!/bin/bash
cd /home/CRUD

echo "🚀 Fetching latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm install --production

echo "♻️ Reloading PM2..."
pm2 reload crudapp --update-env

echo "✨ Deployment Completed Successfully!"
