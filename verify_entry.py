
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_create_gate_entry():
    # 1. Login as Security
    login_data = {"username": "security", "password": "sec123"}
    resp = requests.post(f"{BASE_URL}/token", data=login_data)
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Entry with new minimal fields
    payload = {
        "vendor_name": "Test Vendor Corp",
        "vendor_location": "Mumbai",
        "request_officer_id": 3,
        # Default/Optional fields
        "vehicle_number": None,
        "driver_name": None,
        "driver_phone": None,
        "material_type_desc": "Test Supply",
        "approx_quantity": 0
    }
    
    resp = requests.post(f"{BASE_URL}/gate-entry/", json=payload, headers=headers)
    if resp.status_code == 200:
        print("Success! Entry created:")
        print(resp.json())
    else:
        print(f"Failed: {resp.status_code}")
        print(resp.text)

if __name__ == "__main__":
    test_create_gate_entry()
