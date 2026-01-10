#!/bin/bash

# Deployment Fix Script
# Run this script on your production server to fix login issues

echo "=================================="
echo "STORE MANAGEMENT - LOGIN FIX"
echo "=================================="
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python3."
    exit 1
fi

echo "✓ Python3 found"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt
echo "✓ Dependencies installed"
echo ""

# Initialize database
echo "🗄️  Initializing database..."
python3 backend/init_prod_db.py

if [ $? -eq 0 ]; then
    echo ""
    echo "=================================="
    echo "✓ INITIALIZATION SUCCESSFUL"
    echo "=================================="
    echo ""
    echo "Default user credentials:"
    echo "  admin / admin123 (ADMIN)"
    echo "  security / sec123 (SECURITY)"
    echo "  officer / off123 (OFFICER)"
    echo "  store / store123 (STORE_MANAGER)"
    echo ""
    echo "You can now login with these credentials."
else
    echo ""
    echo "=================================="
    echo "❌ INITIALIZATION FAILED"
    echo "=================================="
    echo ""
    echo "Please check the error messages above."
    exit 1
fi
