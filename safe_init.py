import sys
import traceback

try:
    from backend import init_db
    print("Imported init_db successfully")
    init_db.init_db()
    print("Executed init_db successfully")
    with open("init_status.txt", "w") as f:
        f.write("SUCCESS")
except Exception:
    with open("error.log", "w") as f:
        f.write(traceback.format_exc())
    print("Error occurred")
