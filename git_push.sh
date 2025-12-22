#!/bin/bash

# Add all changes
git add .

# Prompt for commit message
read -p "Enter commit message: " message

# Commit with user message
git commit -m "$message"

# Push to GitHub
git push origin main
