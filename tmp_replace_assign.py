from backend.database import SessionLocal
from backend import crud
import traceback


def main():
    db = SessionLocal()
    try:
        result = crud.replace_gwm_family_assignments(
            db, family_id=2, standard_item_ids=[1, 2, 3]
        )
        print("success", len(result))
    except Exception:
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
