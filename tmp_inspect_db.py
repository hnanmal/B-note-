import argparse
import json
import os
import sqlite3
import zipfile
from collections import Counter
from pathlib import Path


SQLITE_HEADER = b"SQLite format 3\x00"
ZIP_HEADER = b"PK\x03\x04"
JSON_OBJECT_HEADER = b"{"
JSON_ARRAY_HEADER = b"["


def looks_like_sqlite(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            return f.read(len(SQLITE_HEADER)) == SQLITE_HEADER
    except OSError:
        return False


def read_magic(path: Path, n: int = 32) -> bytes:
    try:
        with path.open("rb") as f:
            return f.read(n)
    except OSError:
        return b""


def summarize_zip(path: Path, max_entries: int = 30) -> dict:
    with zipfile.ZipFile(path, "r") as zf:
        infos = zf.infolist()
        entries = [
            {
                "name": i.filename,
                "size": i.file_size,
                "compressed": i.compress_size,
            }
            for i in infos[: max(0, max_entries)]
        ]
        # find likely embedded sqlite
        sqlite_candidates = [
            i.filename
            for i in infos
            if i.file_size > 0
            and any(
                i.filename.lower().endswith(ext)
                for ext in (".db", ".sqlite", ".sqlite3")
            )
        ]
        return {
            "entry_count": len(infos),
            "entries": entries,
            "sqlite_candidates": sqlite_candidates,
        }


def inspect_sqlite(path: Path, max_tables: int, max_counts: int) -> dict:
    conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        cur = conn.cursor()

        cur.execute("PRAGMA quick_check(1)")
        quick_check = cur.fetchone()[0]

        cur.execute("PRAGMA journal_mode")
        journal_mode = cur.fetchone()[0]

        cur.execute("PRAGMA page_size")
        page_size = cur.fetchone()[0]

        cur.execute("PRAGMA page_count")
        page_count = cur.fetchone()[0]

        cur.execute("PRAGMA freelist_count")
        freelist_count = cur.fetchone()[0]

        cur.execute(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table','index') ORDER BY type, name"
        )
        objects = cur.fetchall()
        tables = [
            name
            for (name, typ) in objects
            if typ == "table" and name != "sqlite_sequence"
        ]
        indexes = [name for (name, typ) in objects if typ == "index"]

        row_counts = {}
        for t in tables[: max(0, max_counts)]:
            try:
                cur.execute(f'SELECT COUNT(1) FROM "{t}"')
                row_counts[t] = cur.fetchone()[0]
            except Exception as exc:  # pragma: no cover
                row_counts[t] = f"error: {exc}"

        return {
            "quick_check": quick_check,
            "journal_mode": journal_mode,
            "page_size": page_size,
            "page_count": page_count,
            "freelist_count": freelist_count,
            "page_size": page_size,
            "page_count": page_count,
            "freelist_count": freelist_count,
            "tables": tables[: max(0, max_tables)],
            "table_count": len(tables),
            "indexes": indexes,
            "index_count": len(indexes),
            "row_counts_sample": row_counts,
        }
    finally:
        conn.close()


def get_index_details(conn: sqlite3.Connection, table: str) -> list[dict]:
    cur = conn.cursor()
    rows = cur.execute(f"PRAGMA index_list('{table}')").fetchall()
    index_details: list[dict] = []
    for row in rows:
        # (seq, name, unique, origin, partial)
        name = row[1]
        unique = int(row[2] or 0)
        cols = [r[2] for r in cur.execute(f"PRAGMA index_info('{name}')").fetchall()]
        sql_row = cur.execute(
            "SELECT sql FROM sqlite_master WHERE type='index' AND name=?", (name,)
        ).fetchone()
        sql = sql_row[0] if sql_row else None
        index_details.append(
            {
                "name": name,
                "unique": unique,
                "columns": cols,
                "sql": sql,
            }
        )
    return index_details


def looks_like_json(magic: bytes) -> bool:
    magic = magic.lstrip()
    return magic.startswith(JSON_OBJECT_HEADER) or magic.startswith(JSON_ARRAY_HEADER)


def summarize_json_bnote(
    path: Path,
    root_key: str | None,
    max_leaves: int,
    max_leaf_examples: int,
) -> dict:
    with path.open("r", encoding="utf-8", errors="replace") as f:
        data = json.load(f)

    if root_key and isinstance(data, dict) and root_key in data:
        data = data[root_key]

    top_level_type = type(data).__name__
    top_level_keys = list(data.keys()) if isinstance(data, dict) else []

    node_count = 0
    leaf_count = 0
    max_depth = 0
    leaf_field_count_hist = Counter()
    leaf_field_count_examples: dict[int, list[str]] = {}

    stack: list[tuple[object, int]] = [(data, 1)]
    while stack:
        obj, depth = stack.pop()
        max_depth = max(max_depth, depth)

        if isinstance(obj, dict):
            node_count += 1
            children = obj.get("children")
            if isinstance(children, list):
                for child in reversed(children):
                    stack.append((child, depth + 1))
            for k, v in obj.items():
                if k == "children":
                    continue
                stack.append((v, depth + 1))
            continue

        if isinstance(obj, list):
            for child in reversed(obj):
                stack.append((child, depth + 1))
            continue

        if isinstance(obj, str):
            leaf_count += 1
            if max_leaves > 0 and leaf_count > max_leaves:
                break
            fields = obj.split(" | ")
            fc = len(fields)
            leaf_field_count_hist[fc] += 1
            if max_leaf_examples > 0:
                ex = leaf_field_count_examples.setdefault(fc, [])
                if len(ex) < max_leaf_examples:
                    ex.append(obj[:200])
            continue

    return {
        "top_level_type": top_level_type,
        "top_level_keys": top_level_keys[:50],
        "node_count": node_count,
        "leaf_count_scanned": leaf_count,
        "max_depth": max_depth,
        "leaf_field_count_hist": dict(leaf_field_count_hist),
        "leaf_field_count_examples": leaf_field_count_examples,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect .bnote / SQLite DB files")
    parser.add_argument(
        "paths",
        nargs="*",
        help="Paths to inspect (.bnote/.db). If omitted, defaults to standard bnote candidates.",
    )
    parser.add_argument("--max-tables", type=int, default=30)
    parser.add_argument("--max-counts", type=int, default=12)
    parser.add_argument(
        "--index-tables",
        type=str,
        default="",
        help="Comma-separated table names to print index details for when inspecting SQLite.",
    )
    parser.add_argument("--json-max-leaves", type=int, default=200000)
    parser.add_argument("--json-leaf-examples", type=int, default=2)
    parser.add_argument("--json-root", type=str, default="")
    args = parser.parse_args()

    default_candidates = [
        Path(__file__).resolve().parent
        / "B-note_old"
        / "resource"
        / "PlantArch_BIM Standard.bnote",
        Path(__file__).resolve().parent
        / "B-note_old"
        / "dist"
        / "resource"
        / "PlantArch_BIM Standard.bnote",
        Path(__file__).resolve().parent / "bnote샘플.bnote",
        Path(__file__).resolve().parent / "2025 DQRU 입찰 (Rev.AB)_20251107_RC.bnote",
        Path(__file__).resolve().parent
        / "2025 DQRU 입찰 (Rev.AB)_20251107_Steel.bnote",
    ]

    targets = [Path(p) for p in args.paths] if args.paths else default_candidates

    for p in targets:
        print("\n==", p)
        if not p.exists():
            print("missing")
            continue
        st = p.stat()
        print("size", st.st_size)
        print("mtime", st.st_mtime)
        magic = read_magic(p, 32)
        sqlite = looks_like_sqlite(p)
        print("sqlite", sqlite)
        if not sqlite:
            print("magic_hex", magic.hex())
            try:
                print("magic_ascii", magic[:16].decode("ascii", errors="replace"))
            except Exception:
                pass
            if magic.startswith(ZIP_HEADER):
                try:
                    zip_info = summarize_zip(p)
                    print("zip_entries", zip_info["entry_count"])
                    for e in zip_info["entries"]:
                        print("zip", e["name"], e["size"], e["compressed"])
                    if zip_info["sqlite_candidates"]:
                        print(
                            "zip_sqlite_candidates",
                            ", ".join(zip_info["sqlite_candidates"][:10]),
                        )
                except Exception as exc:
                    print("zip_error", str(exc))
            elif looks_like_json(magic):
                try:
                    info = summarize_json_bnote(
                        p,
                        root_key=(args.json_root.strip() or None),
                        max_leaves=args.json_max_leaves,
                        max_leaf_examples=args.json_leaf_examples,
                    )
                    print("json", True)
                    print("json_top_level", info["top_level_type"])
                    if info["top_level_keys"]:
                        print("json_keys", ", ".join(info["top_level_keys"][:10]))
                    print("json_nodes", info["node_count"])
                    print("json_leaf_scanned", info["leaf_count_scanned"])
                    print("json_max_depth", info["max_depth"])
                    if info["leaf_field_count_hist"]:
                        items = sorted(
                            info["leaf_field_count_hist"].items(),
                            key=lambda kv: (-kv[1], kv[0]),
                        )
                        print(
                            "json_leaf_field_counts",
                            ", ".join(f"{k}:{v}" for k, v in items[:10]),
                        )
                        # show a couple examples for outlier field counts
                        common_counts = {k for k, _ in items[:2]}
                        for fc, examples in sorted(
                            info["leaf_field_count_examples"].items()
                        ):
                            if fc in common_counts:
                                continue
                            for ex in examples[:2]:
                                print("json_leaf_example", fc, ex)
                except json.JSONDecodeError as exc:
                    print("json", False)
                    print(
                        "json_error", f"line {exc.lineno}, col {exc.colno}: {exc.msg}"
                    )
                except Exception as exc:
                    print("json", False)
                    print("json_error", str(exc))
            continue

        try:
            info = inspect_sqlite(
                p, max_tables=args.max_tables, max_counts=args.max_counts
            )
            print("quick_check", info["quick_check"])
            print("journal_mode", info["journal_mode"])
            print("tables", info["table_count"])
            for t, c in info["row_counts_sample"].items():
                print("count", t, c)
            if info["table_count"] > len(info["tables"]):
                print(f"(tables truncated to first {len(info['tables'])})")
            print("indexes", info["index_count"])

            index_tables = [
                t.strip() for t in (args.index_tables or "").split(",") if t.strip()
            ]
            if index_tables:
                conn = sqlite3.connect(f"file:{p.as_posix()}?mode=ro", uri=True)
                try:
                    for tname in index_tables:
                        details = get_index_details(conn, tname)
                        print("index_table", tname, "count", len(details))
                        for d in details:
                            cols = ",".join(d["columns"]) if d["columns"] else ""
                            print(
                                "index",
                                d["name"],
                                "unique" if d["unique"] else "nonunique",
                                cols,
                            )
                            if d["sql"]:
                                print("index_sql", d["sql"])
                finally:
                    conn.close()
        except Exception as exc:
            print("sqlite_error", str(exc))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
