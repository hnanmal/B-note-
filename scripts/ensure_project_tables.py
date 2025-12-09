from pathlib import Path
import sqlite3
project_dir = Path('backend/pjt_db')
for db_file in project_dir.glob('*.db'):
    conn = sqlite3.connect(db_file)
    try:
        conn.execute('CREATE TABLE IF NOT EXISTS standard_item_work_master_select (id INTEGER PRIMARY KEY, standard_item_id INTEGER NOT NULL UNIQUE, work_master_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);')
        cursor = conn.cursor()
        cursor.execute('PRAGMA table_info(work_masters)')
        columns = [row[1] for row in cursor.fetchall()]
        if 'add_spec' not in columns:
            conn.execute('ALTER TABLE work_masters ADD COLUMN add_spec TEXT;')
        if 'gauge' not in columns:
            conn.execute('ALTER TABLE work_masters ADD COLUMN gauge TEXT;')
        conn.commit()
    finally:
        conn.close()
