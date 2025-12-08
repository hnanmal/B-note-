import sqlite3
conn = sqlite3.connect('backend/b-note-dev.db')
cursor = conn.cursor()
cursor.execute('CREATE TABLE IF NOT EXISTS standard_item_work_master_select (id INTEGER PRIMARY KEY, standard_item_id INTEGER NOT NULL UNIQUE, work_master_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);')
conn.commit()
conn.close()
