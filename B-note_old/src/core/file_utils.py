# src/core/file_utils.py

import json
from tkinter import filedialog, ttk

import openpyxl
import xlwings as xw

from src.core.fp_utils import *
from src.core.app_update import APP_VERSION
from src.views.widget.widget import (
    open_dialog,
    open_filesave_dialog,
    open_filesave_dialog_opening,
)


def save_to_json_teamStdInfo(state, _file_path=None):
    # 파일 저장 위치 선택
    if _file_path and _file_path != "resource/PlantArch_BIM Standard.bnote":
        file_path = _file_path
    else:
        file_path = filedialog.asksaveasfilename(
            defaultextension=state.defaultextension, filetypes=state.filetypes
        )
        if file_path:
            state.current_filepath = file_path
        else:
            return  # 파일 경로가 없으면 저장 취소

    # 상태 객체에서 데이터를 저장
    try:
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(state.team_std_info, file, indent=4, ensure_ascii=False)
            # json.dump(state.project_info, file, indent=4, ensure_ascii=False)
        print(f"Data successfully saved to {file_path}")
        state.root.title(
            f"B-note  {APP_VERSION} :: Hyundai Engineering Plant Architecture Bim Note"
            + "    " * 22
            + f"[   {state.current_filepath}   ]"
        )
        open_dialog(
            state,
            f"데이터가 \n\n ◾ {state.current_filepath} \n\n에 저장 되었습니다.",
            width=800,
        )

        exist_recent_files = go(
            state.recent_files["recent_items"],
            map(lambda x: x["name"]),
            list,
        )
        if file_path != "resource/PlantArch_BIM Standard.bnote":
            if file_path not in exist_recent_files:
                state.recent_files["recent_items"].insert(0, {"name": file_path})
            elif file_path in exist_recent_files:
                tgt_idx = exist_recent_files.index(file_path)
                tgt = state.recent_files["recent_items"].pop(tgt_idx)
                state.recent_files["recent_items"].insert(0, tgt)
            with open("resource/recent_files.json", "w", encoding="utf-8") as file:
                json.dump(state.recent_files, file, indent=4, ensure_ascii=False)

        state.recent_page.load_items()

        state.init_db_hash = state.get_db_hash()

    except Exception as e:
        print(f"Error saving data to JSON: {e}")


def load_std_calcdict(state, _file_path=None):
    pass


def load_from_json(state, _file_path=None):
    # 파일 열기 위치 선택
    if _file_path:
        file_path = _file_path

        state.current_filepath = file_path
    else:
        file_path = filedialog.askopenfilename(filetypes=state.filetypes)
        if file_path:
            state.current_filepath = file_path
        else:
            state.log_widget.write("파일 로드 취소\n")
            return  # 파일 경로가 없으면 로드 취소

    # JSON 파일에서 데이터 로드
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            loaded_data = json.load(file)

            state.update_team_standard_info(loaded_data, data_kind="std-GWM")
            state.update_team_standard_info(loaded_data, data_kind="std-SWM")
            state.update_team_standard_info(loaded_data, data_kind="common-input")
            state.update_team_standard_info(loaded_data, data_kind="std-familylist")
            state.update_team_standard_info(loaded_data, data_kind="std-calcdict")
            state.update_team_standard_info(loaded_data, data_kind="project-info")
            state.update_team_standard_info(loaded_data, data_kind="project-GWM")
            state.update_team_standard_info(loaded_data, data_kind="project-SWM")
            state.update_team_standard_info(
                loaded_data, data_kind="project-buildinglist"
            )
            state.update_team_standard_info(loaded_data, data_kind="project-assigntype")
            state.update_team_standard_info(
                loaded_data, data_kind="project-assigntype-WM"
            )
            state.update_team_standard_info(loaded_data, data_kind="dynamo-calculation")

            if loaded_data.get("WMs"):
                state.update_team_standard_info(loaded_data, data_kind="WMs")
            else:
                loadedWMs = load_from_excel(
                    state, _file_path="resource/WorkMaster_DB.xlsx"
                )[6:]
                state.update_team_standard_info({"WMs": loadedWMs}, data_kind="WMs")

        state.log_widget.write(f"Data successfully loaded from {file_path}\n")
        state.root.title(
            f"B-note  {APP_VERSION} :: Hyundai Engineering Plant Architecture Bim Note"
            + "    " * 22
            + f"[   {state.current_filepath}   ]"
        )
        open_dialog(
            state,
            f"데이터가 \n\n ◾ {state.current_filepath} \n\n으로부터 로드 되었습니다.",
            width=800,
        )

        exist_recent_files = go(
            state.recent_files["recent_items"],
            map(lambda x: x["name"]),
            list,
        )
        if file_path != "resource/PlantArch_BIM Standard.bnote":
            if file_path not in exist_recent_files:
                state.recent_files["recent_items"].insert(0, {"name": file_path})
            elif file_path in exist_recent_files:
                tgt_idx = exist_recent_files.index(file_path)
                tgt = state.recent_files["recent_items"].pop(tgt_idx)
                state.recent_files["recent_items"].insert(0, tgt)
            with open("resource/recent_files.json", "w", encoding="utf-8") as file:
                json.dump(state.recent_files, file, indent=4, ensure_ascii=False)

        state.recent_page.load_items()

        state.init_db_hash = state.get_db_hash()

        return True
    except Exception as e:
        state.log_widget.write(f"Error loading data from JSON: {e}\n")
        return False


def on_closing(root, state):
    """앱 종료 시 저장 확인창을 띄우고, 선택에 따라 동작을 수행."""
    if state.init_db_hash != "not loaded yet":
        is_change = state.init_db_hash != state.get_db_hash()

        if is_change:
            open_filesave_dialog(
                state,
                "변경 내용을 이 파일에 저장하시겠습니까?",
            )
        else:
            root.destroy()
    else:
        root.destroy()


def on_opening(state):
    """앱 종료 시 저장 확인창을 띄우고, 선택에 따라 동작을 수행."""
    if state.init_db_hash != "not loaded yet":
        is_change = state.init_db_hash != state.get_db_hash()

        if is_change:
            open_filesave_dialog_opening(
                state,
                "변경 내용을 이 파일에 저장하시겠습니까?",
            )
        else:
            load_from_json(state)
    else:
        load_from_json(state)


def load_from_excel(state, _file_path=None):
    # 파일 열기 위치 선택
    if _file_path:
        file_path = _file_path
    else:
        file_path = filedialog.askopenfilename(filetypes=state.filetypes)
        if not file_path:
            return  # 파일 경로가 없으면 로드 취소

    try:
        # Excel 파일에서 데이터 로드
        workbook = openpyxl.load_workbook(file_path)
        sheet = workbook.active

        # 시트 데이터를 리스트 형태로 저장
        sheet_data = []
        for row in sheet.iter_rows(values_only=True):
            sheet_data.append(list(row))

        # # tksheet에 데이터 설정
        # state.update_team_standard_info(sheet_data[6:], data_kind="WMs")
        # print(f"Data successfully loaded from {file_path}")
        return sheet_data
    except Exception as e:
        print(f"Error loading data from Excel: {e}")


def read_excel_data_with_xw(
    file_path: str,
    sheet_name: str = "AR",
    header_row_index: int = 8,
    password: str = None,
):
    """
    엑셀 파일에서 특정 시트의 헤더와 데이터를 리스트로 읽어옵니다.

    :param file_path: 엑셀 파일 경로
    :param sheet_name: 시트 이름 (기본값 "AR")
    :param header_row_index: 헤더로 사용할 행 번호 (1부터 시작, 기본값 8)
    :param password: 암호가 걸린 경우 비밀번호 입력
    :return: (header: list, data: list of lists)
    """
    app = xw.App(visible=False)  # 엑셀 창 안 띄우고 백그라운드에서 실행
    app.display_alerts = False  # 경고창 비활성화
    app.screen_updating = False  # 화면 업데이트 비활성화

    # 엑셀 파일 열기
    if password:
        wb = xw.Book(file_path, password=password)
    else:
        wb = xw.Book(file_path)

    try:
        sheet = wb.sheets[sheet_name]

        # 1. 헤더 읽기 (8행)
        header_range = sheet.range(f"A{header_row_index}").expand("right")
        header = header_range.value
        num_cols = header_range.columns.count

        # 2. 전체 행 수 직접 계산 (UsedRange 활용)
        used_range = sheet.used_range
        last_row = used_range.last_cell.row

        # 3. 데이터 읽기 (빈 행 포함)
        data_start_row = header_row_index + 1
        data_range = sheet.range((data_start_row, 1), (last_row, num_cols)).value

        # 4. 보장: 2차원 리스트 형태
        if isinstance(data_range[0], (str, int, float, type(None))):
            data_range = [data_range]

        return header, data_range

    finally:
        wb.close()
        app.quit()


# Load HTML file content
def load_html_file(filepath):
    with open(filepath, "r", encoding="utf-8") as file:
        return file.read()
