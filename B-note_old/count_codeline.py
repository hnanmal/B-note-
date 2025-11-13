import os


def count_python_lines(directory):
    total_lines = 0
    total_files = 0
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                        line_count = len(lines)
                        total_lines += line_count
                        total_files += 1
                except Exception as e:
                    print(f"파일 읽기 오류: {path} - {e}")
    print(f"총 파일 수: {total_files}개")
    print(f"총 파이썬 코드 라인 수: {total_lines}줄")


def count_effective_python_lines(directory):
    total_lines = 0
    total_files = 0

    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                        effective_lines = [
                            line
                            for line in lines
                            if line.strip() and not line.strip().startswith("#")
                        ]
                        total_lines += len(effective_lines)
                        total_files += 1
                except Exception as e:
                    print(f"파일 읽기 오류: {path} - {e}")

    print(f"총 파일 수: {total_files}개")
    print(f"실질적인 파이썬 코드 라인 수 (빈 줄 + 주석 제외): {total_lines}줄")


# 현재 디렉토리 기준
count_effective_python_lines(".")


# 현재 디렉토리 기준
count_python_lines(".")
