#!/bin/bash
# deploy.sh

echo "Building optimized production build..."
yarn build:prod

echo "Copying files to Raspberry Pi..."
rsync -avz --exclude node_modules --exclude .git ./ pi@192.168.0.235:/home/pi/grpc-explorer/

echo "Setting up on Raspberry Pi..."
ssh pi@192.168.0.235 "cd /home/pi/grpc-explorer && yarn install --production && pm2 restart grpc-explorer || pm2 start yarn --name grpc-explorer -- start:prod"

echo "Deployment complete!"
