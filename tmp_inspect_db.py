import sqlite3
import pathlib

db_path = pathlib.Path(__file__).resolve().parent / "backend" / "b-note-dev.db"
conn = sqlite3.connect(db_path)
rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("\n".join(sorted(r[0] for r in rows)))
