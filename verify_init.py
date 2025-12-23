import sys
import traceback

try:
    from backend import init_db
    print("Imported init_db")
    init_db.init_db()
    print("Ran init_db")
    with open("init_success.txt", "w") as f:
        f.write("User count checked and verified.")
except Exception as e:
    with open("init_error.txt", "w") as f:
        f.write(str(e))
        f.write(traceback.format_exc())
