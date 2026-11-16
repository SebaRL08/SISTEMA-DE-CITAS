from contextlib import contextmanager
import mysql.connector
from backend.config import DB_CONFIG


@contextmanager
def db_cursor(commit=False):
    """Abre conexión + cursor. Si hay error hace rollback; si commit=True confirma al final."""
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor(dictionary=True)
    try:
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
