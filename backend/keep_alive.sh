#!/bin/bash

# Ensure we are in the directory where the script is located (backend directory)
cd "$(dirname "$0")"

# Define the command to run the server
CMD="npm run dev"

echo "Starting Keep-Alive Script for Backend..."
echo "Working Directory: $(pwd)"
echo "Command: $CMD"

while true; do
    echo "----------------------------------------"
    echo "[$(date)] Starting server..."
    
    # Run the command
    $CMD
    
    # Capture the exit code
    EXIT_CODE=$?
    
    echo "[$(date)] Server exited with code $EXIT_CODE."
    
    # Check if we should restart
    echo "Restarting in 5 seconds..."
    echo "----------------------------------------"
    
    # Wait before restarting to prevent rapid loops if there's a startup error
    sleep 5
done
