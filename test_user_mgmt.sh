#!/bin/bash

# Base URL
BASE_URL="http://localhost:8000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "--- Starting User Management API Tests ---"

# 1. Login as Admin
echo -e "\n1. Logging in as Admin..."
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123")

ADMIN_TOKEN=$(echo $ADMIN_LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}Failed to login as Admin. Response: $ADMIN_LOGIN_RESPONSE${NC}"
    exit 1
fi
echo -e "${GREEN}Admin login successful.${NC}"

# 2. Setup: Get a user to manipulate or create one
echo -e "\n2. Creating a test Security User..."
CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "test_sec_user_99", "email": "test_sec99@example.com", "password": "password123", "role": "SECURITY"}')

USER_ID=$(echo $CREATE_USER_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

if [ -z "$USER_ID" ]; then
    echo "User might already exist. Trying to login with that user to see if it works..."
    SEC_LOGIN=$(curl -s -X POST "$BASE_URL/token" -d "username=test_sec_user_99&password=password123")
    SEC_TOKEN=$(echo $SEC_LOGIN | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$SEC_TOKEN" ]; then
        echo -e "${GREEN}Test user already exists and can login.${NC}"
        # Using a hardcoded ID for testing based on DB info if creation fails is tricky without a GET users endpoint.
        # But we know creation worked or didn't. Let's just create a unique one.
    fi
fi

# Let's create a guaranteed unique one
UNIQUE_ID=$(date +%s)
echo -e "\nCreating unique test user: test_user_$UNIQUE_ID"
CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"test_user_$UNIQUE_ID\", \"email\": \"test_$UNIQUE_ID@example.com\", \"password\": \"testpwd123\", \"role\": \"SECURITY\"}")

USER_ID=$(echo $CREATE_USER_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo "Created User ID: $USER_ID"

if [ -n "$USER_ID" ]; then
    # 3. Admin: Deactivate the user
    echo -e "\n3. Admin deactivating user $USER_ID..."
    DEACTIVATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/admin/users/$USER_ID/status" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}" \
      -d '{"is_active": false}')
      
    echo "$DEACTIVATE_RESPONSE"
    echo -e "${GREEN}Deactivation requested.${NC}"
    
    # Verify deactivation by trying to log in
    echo "Testing login of deactivated user..."
    TEST_LOGIN=$(curl -s -X POST "$BASE_URL/token" -d "username=test_user_$UNIQUE_ID&password=testpwd123" | grep -o "Inactive user")
    if [ -n "$TEST_LOGIN" ]; then
        echo -e "${GREEN}Confirmed: User cannot login (Inactive user error).${NC}"
    else
        echo -e "${RED}Warning: User might still be able to login.${NC}"
    fi

    # 4. Admin: Change the user's password
    echo -e "\n4. Admin changing password for user $USER_ID..."
    CHANGE_PWD_RESPONSE=$(curl -s -X PUT "$BASE_URL/admin/users/$USER_ID/password" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}" \
      -d '{"new_password": "new_admin_set_pwd"}')
      
    echo "$CHANGE_PWD_RESPONSE"
    echo -e "${GREEN}Password change requested.${NC}"
fi

# 5. Create a test Officer User
echo -e "\n5. Creating a test Officer User..."
OFFICER_UNIQUE_ID=$(date +%s)_off
CREATE_OFFICER_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"test_officer_$OFFICER_UNIQUE_ID\", \"email\": \"officer_$OFFICER_UNIQUE_ID@example.com\", \"password\": \"officer123\", \"role\": \"OFFICER\"}")

OFFICER_ID=$(echo $CREATE_OFFICER_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo "Created Officer ID: $OFFICER_ID"

if [ -n "$OFFICER_ID" ]; then
    # 6. Admin attempting to change an Officer's password (should fail)
    echo -e "\n6. Admin attempting to change an Officer's password (should fail)..."
    TRY_CHANGE_OFFICER=$(curl -s -X PUT "$BASE_URL/admin/users/$OFFICER_ID/password" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}" \
      -d '{"new_password": "hacked"}')
    echo "$TRY_CHANGE_OFFICER"
    if [[ "$TRY_CHANGE_OFFICER" == *"HTTP_STATUS:400"* ]]; then
        echo -e "${GREEN}Confirmed: Admin cannot change officer password.${NC}"
    else
        echo -e "${RED}Warning: Admin could change officer password or got unexpected error.${NC}"
    fi

    # 7. Officer self password change
    echo -e "\n7. Testing Officer Self Password Change..."
    echo "Logging in as test_officer..."
    OFFICER_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "username=test_officer_$OFFICER_UNIQUE_ID&password=officer123")

    OFFICER_TOKEN=$(echo $OFFICER_LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

    if [ -z "$OFFICER_TOKEN" ]; then
        echo -e "${RED}Failed to login as Officer. Cannot test self password change. Response: $OFFICER_LOGIN_RESPONSE${NC}"
    else
        echo -e "${GREEN}Officer login successful.${NC}"
        echo "Officer changing own password..."
        
        TEMP_PWD="officertemp123"
        
        OFFICER_CHANGE_PWD=$(curl -s -X PUT "$BASE_URL/users/me/password" \
          -H "Authorization: Bearer $OFFICER_TOKEN" \
          -H "Content-Type: application/json" \
          -w "\nHTTP_STATUS:%{http_code}" \
          -d "{\"current_password\": \"officer123\", \"new_password\": \"$TEMP_PWD\"}")
          
        echo "$OFFICER_CHANGE_PWD"
        if [[ "$OFFICER_CHANGE_PWD" == *"HTTP_STATUS:200"* ]]; then
            echo -e "${GREEN}Self password change succeeded.${NC}"
            
            # Verify login with new password
            echo "Verifying login with new password..."
            NEW_LOGIN=$(curl -s -X POST "$BASE_URL/token" -d "username=test_officer_$OFFICER_UNIQUE_ID&password=$TEMP_PWD")
            NEW_TOKEN=$(echo $NEW_LOGIN | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
            if [ -n "$NEW_TOKEN" ]; then
               echo -e "${GREEN}Confirmed: Can login with new password.${NC}"
            else
               echo -e "${RED}Failed to login with new password.${NC}"
            fi
        else
            echo -e "${RED}Self password change failed.${NC}"
        fi
    fi
fi

echo -e "\n--- API Tests Completed ---"
