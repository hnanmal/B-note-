# src/views/widget/sheet_utils.py
import threading
from tkinter import messagebox
from openpyxl.utils import column_index_from_string
from src.core.file_utils import read_excel_data_with_xw
from src.models.sheet_utils import find_matched_pjtGWM, find_wmStr
from src.controllers.tree_data_navigator import (
    TreeDataManager_treesheet,
    TreeDataManager_treeview,
)
from src.core.fp_utils import *
import tkinter as tk
from tkinter import ttk, simpledialog
from tksheet import (
    Sheet,
    num2alpha as n2a,
)
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from src.controllers.widget.widgets import toggle_stdGWM_widget_mode
from src.views.widget.widget import StateObserver
from src.views.widget.treesheet_editor import TreesheetEditor
import uuid


class DefaultSheetViewStyleManager:
    pass


class SheetViewStateObserver:
    def __init__(self, state, treeview, updateFunc):
        self.state = state
        self.state.observer_manager.add_observer(updateFunc)


class SheetSearchManager:
    def __init__(self, state, sheet_widget):
        self.state = state
        self.sheet_widget = sheet_widget
        self.data_kind = self.sheet_widget.data_kind
        self.sheet = sheet_widget.sheet
        # self.sheetview = sheetview
        # self.original_data = sheet.get_sheet_data(return_copy=True)

    def search_sheet_data(self, search_term):
        """Search for rows containing the search term and update the sheet."""
        search_term = search_term.lower()
        if not search_term:
            # If the search term is empty, reset to the original data
            self.reset_sheet_data()
            return
        # Get all data from the sheet and filter it
        all_data = self.sheet_widget.sheet.get_sheet_data()
        # all_data = self.state.team_std_info.get(self.data_kind, [])
        # all_data = self.state.team_std_info.get("WMs", [])
        filtered_data = [
            row
            for row in all_data
            if any(search_term in str(cell).lower() for cell in row)
        ]

        # Update the sheet with filtered data
        self.sheet.set_sheet_data(filtered_data)
        self.sheet_widget.setup_column_style()

        if self.data_kind == "std-GWM" or "std-SWM":
            try:
                self.sheet_widget.apply_wrap(tgt_idx=3, tgt_width=1000)
            except:
                pass
            self.sheet.set_all_cell_sizes_to_text()
            self.sheet.set_all_row_heights(
                height=50,
                only_set_if_too_small=True,
            )

        self.sheet.redraw()

    def reset_sheet_data(self):
        """Reset the sheet to its original state."""
        # original_data = self.state.team_std_info.get("WMs", [])
        # original_data = self.state.team_std_info.get(self.data_kind, [])
        # self.sheet.set_sheet_data(original_data)
        self.sheet_widget.update()
        self.sheet.redraw()

    def reset_search(self, search_entry):
        """Clear the search entry and reset the sheet data to the original state."""
        search_entry.delete(0, tk.END)  # Clear the search entry
        self.reset_sheet_data()  # Reset the data in the sheet


class BaseSheetView:
    def __init__(self, parent, headers):
        self.sheet = Sheet(parent, headers=headers)
        self.parent = parent

        # config enable_bindings
        self.sheet.enable_bindings(
            "edit_cell",
            "delete",
            "single_select",  # Allow single cell selection
            "drag_select",
            "row_select",  # Allow row selection
            "column_select",  # Allow column selection
            "drag_select",  # Allow drag selection
            "column_width_resize",
            "row_height_resize",
            "double_click_column_resize",
            "copy",
            "paste",
            "ctrl_click_select",
            "right_click_popup_menu",
            "rc_insert_row",
            "rc_delete_row",
            "arrowkeys",
        )

    def setup_columns(self, headers, hdr_widths=None):
        pass

    def insert_data(self, data):
        pass

    def clear_sheetview():
        pass

    def get_sheet_data():
        pass


class ProjectStd_WM_Selcet_SheetView_GWM:
    def __init__(self, state, parent, relate_widget):
        self.state = state
        self.data_kind = "std-GWM"
        self.treeDataManager = TreeDataManager_treesheet(state, self)
        self.relate_widget = relate_widget
        self.selected_item_relate_widget = relate_widget.selected_item

        self.title_frame = ttk.Frame(parent)
        self.title_frame.pack(anchor="nw")

        self.sheet = Sheet(
            parent,
            show_x_scrollbar=True,
            show_y_scrollbar=True,
            width=2000,
            height=800,
        )
        self.sheet.pack(expand=True, fill="both", padx=5, pady=5)

        # config enable_bindings
        self.sheet.enable_bindings(
            "edit_cell",
            "delete",
            "single_select",  # Allow single cell selection
            "drag_select",
            "row_select",  # Allow row selection
            "column_select",  # Allow column selection
            "drag_select",  # Allow drag selection
            "column_width_resize",
            "row_height_resize",
            "double_click_column_resize",
            "copy",
            "paste",
            "ctrl_click_select",
            "right_click_popup_menu",
            # "rc_insert_row",
            # "rc_delete_row",
            "arrowkeys",
        )

        # Initialize the search manager
        self.search_manager = SheetSearchManager(self.state, self)

        # Add Search Box
        self.add_search_box(self.title_frame)

        # Right Click pop up - 신규 Gauge 항목 관련 메뉴 추가
        self.sheet.popup_menu_add_command(
            label="신규 Gauge 항목 생성",
            func=lambda: self.copyWM_forGauge("GWM"),
        )
        self.sheet.popup_menu_add_command(
            label="선택 Gauge 항목 삭제",
            func=lambda: self.deleteWM_forGauge("GWM"),
        )

        # Bind checkbox clicks
        self.sheet.extra_bindings(
            [
                ("end_edit_cell", lambda e: self.on_checkbox_click(e, mode="GWM")),
                ("delete", lambda e: self.on_checkbox_delete(e)),
            ]
        )

        # 초기 데이터 로드 및 시트 설정
        self.setup_sheet()

        # 상태 변경 감지를 위한 옵저버 설정
        self.state_observer = StateObserver(state, lambda e: self.update(e))

    def setup_sheet(self):
        # 헤더 설정
        headers = ["Use", "Spec", "Unit", "Work Master", "Gauge Code"]
        self.sheet.headers(headers)

        # Create checkboxes in the First column
        self.sheet.checkbox("A", checked=True)

        self.setup_column_style()
        # 초기 데이터 로드
        self.update()

    def setup_column_style(self):
        # self.sheet.set_column_widths([25, 200, 25, 2000])
        self.sheet.set_column_widths([25, 200, 25, 1000, 70])

        self.sheet["E"].align("center")
        self.sheet.set_options(header_font=("Arial Narrow", 8, "normal"))
        self.sheet.set_options(font=("Arial", 10, "normal"))

        # self.sheet.set_options(default_row_height=40)

    def add_search_box(self, parent):
        """Add search box to filter the sheet data."""
        search_frame = ttk.Frame(parent)
        search_frame.pack(padx=5, pady=5, anchor="w")

        # Search Label
        search_label = ttk.Label(search_frame, text="Search:")
        search_label.pack(side="left", padx=5)

        # Search Entry
        self.search_entry = ttk.Entry(search_frame, width=20)
        self.search_entry.pack(side="left", padx=5)
        self.search_entry.bind(
            "<Return>",
            lambda e: self.search_manager.search_sheet_data(self.search_entry.get()),
        )

        # Search Button
        search_button = ttk.Button(
            search_frame,
            text="Search",
            command=lambda: self.search_manager.search_sheet_data(
                self.search_entry.get()
            ),
        )
        search_button.pack(side="left", padx=5)

        # Reset Button
        reset_button = ttk.Button(
            search_frame,
            text="Reset",
            command=lambda: self.search_manager.reset_search(self.search_entry),
        )
        reset_button.pack(side="left", padx=5)

    def on_checkbox_delete(self, event):
        selected_item_str = self.selected_item_relate_widget.get()
        project_GWM = self.state.team_std_info["project-GWM"].get(selected_item_str)
        print(event)

        row, column = list(event["cells"]["table"].keys())[0]
        if column == 0:
            if project_GWM:
                self.state.team_std_info["project-GWM"].pop(selected_item_str)

        self.update()
        self.sheet.redraw()

        # return

    def on_checkbox_click(self, event, mode=None):
        state = self.state
        """Callback for checkbox clicks."""
        self.state.log_widget.write(
            f"{self.__class__.__name__} > on_checkbox_click 메소드 시작"
        )
        selected_item_str = self.selected_item_relate_widget.get()
        pjt_wms = state.team_std_info[f"project-{mode}"]
        project_WM = state.team_std_info[f"project-{mode}"].get(selected_item_str)

        row = event["row"]
        column = event["column"]

        # 선택행이 아닌 다른 행들 일괄 Uncheck
        for r in range(self.sheet.get_total_rows()):
            if r != row:
                self.sheet.set_cell_data(r, 0, False)  # Uncheck other rows

        # Ensure the clicked checkbox remains selected
        self.sheet.set_cell_data(row, 0, True)

        loc = list(event["cells"]["table"].keys())[0]
        row_check_status = self.sheet.get_cell_data(row, 0)

        print(f"이벤트: {event}")
        print(f"위치: {loc}, 체크스테이터스 : {row_check_status}")

        selectedRow_wmCode = go(
            self.sheet.get_cell_data(row, 3),
            lambda x: x.split("|"),
            map(lambda x: x.strip()),
            next,
        )
        if project_WM:
            project_WM_code = project_WM[0]
            project_WM_gauge = project_WM[1]
        else:
            project_WM_code = "na"
            project_WM_gauge = "na"

        if column == 0:
            if (
                project_WM_code != selectedRow_wmCode
                or project_WM_gauge != self.sheet.get_cell_data(row, 4)
            ):  ## 행 옮겨 클릭시
                spec = self.sheet.get_cell_data(row, 1)
                ## 기존항목서 수정된 스펙 받아오기 코드 삽입
                if self.update_spec_fromExist(mode=mode) != "":
                    spec = self.update_spec_fromExist(mode=mode)
                unit = self.sheet.get_cell_data(row, 2)
                gauge = self.sheet.get_cell_data(row, 4)
            else:
                spec = self.sheet.get_cell_data(row, 1)
                unit = self.sheet.get_cell_data(row, 2)
                gauge = self.sheet.get_cell_data(row, 4)
            self.update()
        elif column == 1:
            if (
                project_WM_code != selectedRow_wmCode
                or project_WM_gauge != self.sheet.get_cell_data(row, 4)
            ):  ## 다른행 옮겨 수정시

                target_keys = go(
                    pjt_wms.keys(),
                    filter(lambda k: k != "not_assigned"),
                    filter(lambda k: pjt_wms[k][0] == selectedRow_wmCode),
                    filter(lambda k: pjt_wms[k][1] == self.sheet.get_cell_data(row, 4)),
                    list,
                )
                print(f"target_keys::{target_keys}")
                if target_keys:  # 타겟 있으면 그 타겟 데이터 수정
                    for k in target_keys:
                        pjt_wms[k][3] = self.sheet.get_cell_data(row, 1)
                else:  # 타겟 없으면 임시저장
                    if "not_assigned" not in pjt_wms:
                        pjt_wms.update({"not_assigned": []})

                    modi_target_idx = []
                    for idx, v in enumerate(pjt_wms["not_assigned"]):
                        if v[0] == selectedRow_wmCode and v[
                            1
                        ] == self.sheet.get_cell_data(row, 4):
                            modi_target_idx.append(idx)
                    print(f"modi_target_idx:{modi_target_idx}")
                    if modi_target_idx:
                        pjt_wms["not_assigned"][modi_target_idx[0]] = [
                            selectedRow_wmCode,
                            self.sheet.get_cell_data(row, 4),  # Gauge
                            self.sheet.get_cell_data(row, 2),  # unit
                            self.sheet.get_cell_data(row, 1),  # spec
                        ]
                    else:
                        pjt_wms["not_assigned"].append(
                            [
                                selectedRow_wmCode,
                                self.sheet.get_cell_data(row, 4),  # Gauge
                                self.sheet.get_cell_data(row, 2),  # unit
                                self.sheet.get_cell_data(row, 1),  # spec
                            ]
                        )
                    print(f'not_assigned::{pjt_wms["not_assigned"]}')
            else:
                spec = self.sheet.get_cell_data(row, 1)
                self.edit_spec_sameWMgauge_all(mode="GWM")
                unit = self.sheet.get_cell_data(row, 2)
                gauge = self.sheet.get_cell_data(row, 4)
            self.update()
        elif column == 4:
            messagebox.showinfo(
                "WM Gauge 항목 편집", "Gauge Code는 타이핑으로 편집 할 수 없습니다."
            )
            self.update()

        # if row_check_status:
        self.state.team_std_info[f"project-{mode}"].update(
            {selected_item_str: [selectedRow_wmCode, gauge, unit, spec]}
        )
        print(self.state.team_std_info[f"project-{mode}"][selected_item_str])
        self.update()
        self.highlight_checked_row()
        self.sheet.redraw()

        # 변동사항 어사인 db 에 반영
        WMs = state.team_std_info.get("WMs")
        WMsStr = go(
            WMs,
            map(lambda x: list(map(str, x))),
            map(lambda x: filter(lambda x: x != "0", x)),
            map(lambda x: filter(lambda x: x != "", x)),
            map(lambda x: filter(lambda x: x != " ", x)),
            map(lambda x: filter(lambda x: x != "ㅤ", x)),  #  공백 특수 문자
            map(lambda x: " | ".join(x)),
            list,
        )
        pjt_gwm_data = state.team_std_info.get("project-GWM")
        pjt_swm_data = state.team_std_info.get("project-SWM")
        pjt_wm_data = deepcopy(pjt_gwm_data)
        pjt_wm_data.update(pjt_swm_data)
        pjt_assigntypes = self.state.team_std_info["project-assigntype"]["children"]

        for assigntype in pjt_assigntypes:
            wms = assigntype["children"]
            for wm in wms:
                try:
                    matched_item = find_matched_pjtGWM(pjt_wm_data, wm[2])
                    wm[3] = find_wmStr(
                        pjt_wm_data.get(matched_item, ["", "", "", ""])[0],
                        WMsStr,
                    )
                    wm[4] = pjt_wm_data.get(matched_item, ["", "", "", ""])[1]
                    wm[5] = pjt_wm_data.get(matched_item, ["", "", "", ""])[3]
                    wm[7] = pjt_wm_data.get(matched_item, ["", "", "", ""])[2]
                except:
                    pass

    def highlight_checked_row(self):
        """Update row highlights based on checkbox values."""
        checked_rows = []
        for row in range(self.sheet.get_total_rows()):
            if self.sheet.get_cell_data(row, 0):  # If checkbox is checked
                checked_rows.append(row)

        # Clear existing highlights
        self.sheet.dehighlight_all()
        self.sheet.highlight_rows(
            checked_rows, highlight_index=False, bg="#D3F9D8"
        )  # Light green

    def wrap_text(self, text, width):
        """
        Wrap text to fit within a given width, handling long words properly.
        """
        if not text or not isinstance(text, str):
            return text
        max_chars_per_line = max(1, width // 7)  # Approximate character width in pixels

        words = text.split()  # Split into words
        lines = []
        current_line = ""

        for word in words:
            while len(word) > max_chars_per_line:  # Split long words into chunks
                lines.append(word[:max_chars_per_line])
                word = word[max_chars_per_line:]

            if len(current_line) + len(word) + 1 > max_chars_per_line:
                lines.append(current_line)
                current_line = word
            else:
                current_line = f"{current_line} {word}".strip()

        if current_line:
            lines.append(current_line)

        return "\n".join(lines)

    def apply_wrap(self, tgt_idx, tgt_width=None):
        """
        Apply wrapping to all cells based on their column widths.
        """
        wrapped_data = []
        # for row_index, row in enumerate(self.sheet.get_sheet_data()):
        for row_index, row in enumerate(self.sheet.get_sheet_data()):
            wrapped_row = []
            for col_index, cell in enumerate(row):
                if col_index == tgt_idx:
                    if tgt_width:
                        width = tgt_width
                    else:
                        width = self.sheet.column_width(col_index)
                    wrapped_row.append(self.wrap_text(cell, width))
                else:
                    wrapped_row.append(cell)
            wrapped_data.append(wrapped_row)

        self.sheet.set_sheet_data(wrapped_data)

    def remove_invalid_pjtWM(self, mode):
        state = self.state
        std_WM = state.team_std_info[f"std-{mode}"]["children"]
        pjt_WM = state.team_std_info[f"project-{mode}"]

        check_list = []
        for grand_node in std_WM:
            grand_name = grand_node["name"]
            for parent_node in grand_node["children"]:
                parnet_name = parent_node["name"]
                for child_node in parent_node["children"]:
                    child_name = child_node["name"]

                    check_list.append(" | ".join([grand_name, parnet_name, child_name]))
        remove_target = go(
            pjt_WM,
            deepcopy,
            lambda x: x.keys(),
            filter(lambda x: x not in check_list),
            filter(lambda x: x != "not_assigned"),
            list,
        )
        for rm in remove_target:
            try:
                pjt_WM.pop(rm)
            except:
                pass

    def update_spec_fromExist(self, mode=None):
        state = self.state
        selected_loc = list(self.sheet.get_selected_cells())[0]
        selected_row = list(selected_loc)[0]
        selected_col = list(selected_loc)[1]
        selected_data = self.sheet.get_cell_data(selected_row, 3)

        selected_wm_code = go(
            selected_data,
            lambda x: x.split("|"),
            map(lambda x: x.strip()),
            next,
        )
        selected_wm_gauge = self.sheet.get_cell_data(selected_row, 4)

        pjt_wms = state.team_std_info[f"project-{mode}"]
        print(f"update_spec_fromExist 로직패스체크0.3")
        target_keys = go(
            pjt_wms.keys(),
            filter(lambda k: k != "not_assigned"),
            filter(lambda k: pjt_wms[k][0] == selected_wm_code),
            filter(lambda k: pjt_wms[k][1] == selected_wm_gauge),
            list,
        )
        tgt_specs = []
        print(f"{target_keys}")
        if target_keys:
            for k in pjt_wms:
                v = pjt_wms.get(k)
                if v and v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                    tgt_specs.append(v[3])
            print(f"tgt_spec::{tgt_specs}")
        else:
            if pjt_wms.get("not_assigned"):
                for v in pjt_wms["not_assigned"]:
                    if v and v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                        tgt_specs.append(v[3])

        if tgt_specs:
            tgt_spec = tgt_specs[0]
        else:
            tgt_spec = ""

        return tgt_spec

    def edit_spec_sameWMgauge_all(self, mode=None):
        state = self.state
        selected_loc = list(self.sheet.get_selected_cells())[0]
        selected_row = list(selected_loc)[0]
        selected_col = list(selected_loc)[1]
        selected_data = self.sheet.get_cell_data(selected_row, 3)

        selected_wm_code = go(
            selected_data,
            lambda x: x.split("|"),
            map(lambda x: x.strip()),
            list,
        )[0]
        selected_wm_gauge = self.sheet.get_cell_data(selected_row, 4)

        pjt_wms = state.team_std_info[f"project-{mode}"]
        for k in pjt_wms:
            v = pjt_wms.get(k)
            if v and v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                v[-1] = self.sheet.get_cell_data(selected_row, 1)
            pjt_wms.update({k: v})
        for v in pjt_wms["not_assigned"]:
            if v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                v[-1] = self.sheet.get_cell_data(selected_row, 1)

    def deleteWM_forGauge(self, mode=None):
        state = self.state
        selected_loc = list(self.sheet.get_selected_cells())[0]
        selected_row = list(selected_loc)[0]
        selected_col = list(selected_loc)[1]
        selected_data = self.sheet.get_cell_data(selected_row, 3)

        delete_will = messagebox.askyesno(
            "WM Gauge 항목 삭제",
            "삭제하면 해당 WM Gauge로 할당되었던 항목들의 할당이 해제됩니다.\n계속하시겠습니까?",
        )
        if delete_will:
            selected_wm_code = go(
                selected_data,
                lambda x: x.split("|"),
                map(lambda x: x.strip()),
                list,
            )[0]
            selected_wm_gauge = self.sheet.get_cell_data(selected_row, 4)
            print(f"selected_wm_code ::{selected_wm_code}")

            pjt_wms = state.team_std_info[f"project-{mode}"]

            # 게이지 항목 아닐 경우 경고창 출력
            if "::" not in self.sheet.get_cell_data(selected_row, 3):
                messagebox.showinfo(
                    "WM Gauge 항목 삭제",
                    "Gauge 파생이 되지 않은 항목은 삭제할 수 없습니다.",
                )
                return
            # 게이지 삭제로 인해 할당 여부 검사 및 삭제 키 추리기
            rm_target_keys = []
            for k in pjt_wms:
                v = pjt_wms.get(k)
                if v and v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                    rm_target_keys.append(k)

            print(f"rm_target_keys::{rm_target_keys}")

            # GWM 중 제거된 WM+Gauge와 일치하는 항목들 일괄 삭제
            if rm_target_keys:
                for rm_k in rm_target_keys:
                    deleted_v = pjt_wms.pop(rm_k)

            def delGauge_forNode(node):
                """
                하나의 노드에 대한 게이지WM 삭제 함수
                """
                # std-GWM 데이터 각 item 항목 중
                # 삭제게이지의 원소속 코드가 포함된 모든 항목 추출 및 정렬
                tgt_db_wms = go(
                    node["children"],
                    filter(lambda x: selected_wm_code in x),
                    lambda x: sorted(x),
                    list,
                )
                try:
                    tgt_db_wm_ = go(
                        tgt_db_wms,
                        filter(lambda x: x.split("::")[-1] == selected_wm_gauge),
                        # next,
                    )
                    # GWM/SWM 항목 소속 wm 중 타겟이 있으면 필터목록을 값으로만들고
                    # 없으면 빈문자열
                    if tgt_db_wm_:
                        tgt_db_wm = next(tgt_db_wm_)
                    else:
                        tgt_db_wm = ""
                    tgt_db_wm_idx = node["children"].index(tgt_db_wm)
                    print(f"tgt_db_wm {tgt_db_wm}")

                    if "::" in tgt_db_wm:
                        del node["children"][tgt_db_wm_idx]

                    tgt_db_wms_afterDelete = go(
                        node["children"],
                        filter(lambda x: selected_wm_code in x),
                        lambda x: sorted(x),
                        list,
                    )
                    print(f"tgt_db_wms_afterDelete::{tgt_db_wms_afterDelete}")

                    # 대상 게이지 wm 항목 삭제된 std-GWM item 내 wm들
                    # 순서대로 게이지 붙어있는 지 검사하고
                    # 알파벳 순서대로 게이지 재조정
                    for idx, wm in enumerate(tgt_db_wms_afterDelete):
                        print(f"wm_old::{wm}")
                        if "::" in wm:
                            wmGauge_old = wm.split("::")[-1]
                        else:
                            wmGauge_old = ""

                        print(f"wmGauge_old::{wmGauge_old}")

                        db_index = node["children"].index(wm)

                        if len(tgt_db_wms_afterDelete) == 1:
                            wm_new = wm.split("::")[0]
                        elif chr(idx + 65) != wmGauge_old:
                            wm_new = wm.split("::")[0] + f"::{chr(idx + 65)}"
                            print(f"wm_new_case1!::{wm_new}")
                        else:
                            wm_new = wm
                            print(f"wm_new_case2!::{wm_new}")

                        node["children"][db_index] = wm_new
                        print(
                            f"node['children'][db_index] ::{node['children'][db_index]}"
                        )

                        if "::" in wm_new:
                            wmGauge_new = wm_new.split("::")[-1]
                        else:
                            wmGauge_new = ""

                        print(f"wm_new::{wm_new}")
                        print(f"wmGauge_new::{wmGauge_new}")

                except:
                    pass

            # std-GWM에서 모든 item 에서 해당 게이지 삭제
            data = state.team_std_info[self.data_kind]["children"]
            for grandNode in data:
                for parentNode in grandNode["children"]:
                    for childNode in parentNode["children"]:
                        delGauge_forNode(childNode)

            ############ 수정중 ######################################
            # 게이지 변경으로 값 수정되어야 할 pjt-GWM 추리기
            def a2_previous_a(a):
                if a == "A":
                    pass
                else:
                    res = chr(ord(a) - 1)
                return res

            same_wm_keys = []
            pjt_wms_all_wm = []
            for k in pjt_wms:
                v = pjt_wms.get(k)
                if k != "not_assigned":  # and [v[0], v[1]] not in pjt_wms_all_wm:
                    pjt_wms_all_wm.append([v[0], v[1]])
                if v and v[0] == selected_wm_code:  # and v[1] == selected_wm_gauge:
                    same_wm_keys.append(k)

            for swk in same_wm_keys:
                v = pjt_wms.get(swk)
                print(f"현재 item - {swk}")
                print(f"현재 item v- {v}")
                if v[1] > selected_wm_gauge:
                    print(f"대상 item - {swk}")
                    print(f"대상 item v- {v}")
                    print(f"게이지 차감 {v[1]} to {a2_previous_a(v[1])}")
                    pjt_wms[swk][1] = a2_previous_a(v[1])

            ############ 수정중 ######################################
            # 삭제 대상 게이지 pjt-GWM 에서도 제거 - 이 부분 재설계 필요 :일부 할당 일부 not assigned 일때 모두
            modi_ref_idx = None
            ref_idxs = []
            for idx, v in enumerate(pjt_wms["not_assigned"]):
                if v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                    modi_ref_idx = idx
                    ref_idxs.append(idx)
                    print(f"[v_del] {pjt_wms['not_assigned'][idx]}")
                    del pjt_wms["not_assigned"][idx]
            print(f"[pjt_wms_all_wm] {pjt_wms_all_wm}")

            for idx, v in enumerate(pjt_wms["not_assigned"]):
                if v[0] == selected_wm_code and v[1] > selected_wm_gauge:
                    if [v[0], a2_previous_a(v[1])] not in pjt_wms_all_wm:
                        old = deepcopy(pjt_wms["not_assigned"][idx][1])
                        pjt_wms["not_assigned"][idx][1] = a2_previous_a(old)
                        print(f"[v_new] {pjt_wms['not_assigned'][idx]}")
                    else:
                        del pjt_wms["not_assigned"][idx]

            self.update()
            self.sheet.update()

    def copyWM_forGauge(self, mode=None):
        state = self.state

        # Split the selected item path to find the grandparent, parent, and selected item names
        grand_parent_item_name, parent_item_name, selected_item_name = (
            self.selected_item_relate_widget.get().split(" | ")
        )

        selected_loc = list(self.sheet.get_selected_cells())[0]
        selected_row = list(selected_loc)[0]
        selected_col = list(selected_loc)[1]
        selected_data = self.sheet.get_cell_data(selected_row, 3)

        selected_wm_code = go(
            selected_data,
            lambda x: x.split("|"),
            map(lambda x: x.strip()),
            next,
        )

        data = state.team_std_info[self.data_kind]["children"]

        # Find the grandparent node
        grand_parent_node = next(
            (node for node in data if node["name"] == grand_parent_item_name),
            None,
        )
        if grand_parent_node:
            # Find the parent node
            parent_node = next(
                (
                    node
                    for node in grand_parent_node["children"]
                    if node["name"] == parent_item_name
                ),
                None,
            )
            if parent_node:
                # Find the selected node
                selected_node = next(
                    (
                        node
                        for node in parent_node["children"]
                        if node["name"] == selected_item_name
                    ),
                    None,
                )
        # print(f"selected_row {selected_node}")

        ## 위젯에서 선택한 wm과 동일한 항목을 db의 특정 childnode에서 검색하여
        ## 게이지 코드 부여한 복사본 만들고 원본은 ::A 붙여주는 함수
        def setGauge_forNode(node):
            tgt_db_wms = go(
                node["children"],
                filter(lambda x: selected_wm_code in x),
                lambda x: sorted(x),
                list,
            )
            try:
                tgt_db_wm = tgt_db_wms[-1]  # 동일 wm들 중 마지막 항목
                tgt_db_wm_idx = node["children"].index(tgt_db_wm)
                print(f"tgt_db_wm {tgt_db_wm}")

                tgt_db_wm_last = go(
                    tgt_db_wm,
                    lambda x: x.split("|"),
                    map(lambda x: x.strip()),
                    list,
                    lambda x: x[-1],
                )
                # print(f"tgt_db_wm_last {tgt_db_wm_last}")
                if "::" not in tgt_db_wm_last:
                    new_gauge = "B"
                    copied_wm = f"{tgt_db_wm}::{new_gauge}"
                    node["children"][tgt_db_wm_idx] = f"{tgt_db_wm}::A"
                else:
                    new_gauge = chr(ord(tgt_db_wm_last.split("::")[-1]) + 1)
                    copied_wm = go(
                        tgt_db_wm,
                        lambda x: x.split("::"),
                        lambda x: x[:-1],
                        lambda x: "::".join([*x, new_gauge]),
                    )

                node["children"].insert(tgt_db_wm_idx + 1, copied_wm)
            except:
                pass

        for grandNode in data:
            for parentNode in grandNode["children"]:
                for childNode in parentNode["children"]:
                    setGauge_forNode(childNode)

        pjt_wms = state.team_std_info[f"project-{mode}"]
        for k in pjt_wms:
            # v = pjt_wms[k]
            v = pjt_wms.get(k)
            if v and v[0] == selected_wm_code and v[1] == "":
                v[1] = "A"
            pjt_wms.update({k: v})
        if not pjt_wms.get("not_assigned"):
            pjt_wms["not_assigned"] = []
        if pjt_wms["not_assigned"]:
            for v_ in pjt_wms["not_assigned"]:
                if v_[0] == selected_wm_code and v_[1] == "":
                    v_[1] = "A"

        self.update()
        self.sheet.update()

    def update(self, event=None):
        state = self.state
        mode = self.data_kind.split("-")[-1]
        """Update the TreeView whenever the state changes."""
        self.state.log_widget.write(f"{self.__class__.__name__} > update 메소드 시작")
        self.state.log_widget.write(
            f"선택아이템 출력 : {self.selected_item_relate_widget.get()}"
        )
        self.setup_column_style()

        try:
            self.remove_invalid_pjtWM(mode)
        except:
            pass

        try:
            pjt_wms = state.team_std_info[f"project-{mode}"]

            # Split the selected item path to find the grandparent, parent, and selected item names
            grand_parent_item_name, parent_item_name, selected_item_name = (
                self.selected_item_relate_widget.get().split(" | ")
            )

            # Ensure the data kind exists in the team standard information
            if self.data_kind in state.team_std_info:
                data = state.team_std_info[self.data_kind]["children"]

                # Find the grandparent node
                grand_parent_node = next(
                    (node for node in data if node["name"] == grand_parent_item_name),
                    None,
                )
                if grand_parent_node:
                    # Find the parent node
                    parent_node = next(
                        (
                            node
                            for node in grand_parent_node["children"]
                            if node["name"] == parent_item_name
                        ),
                        None,
                    )
                    if parent_node:
                        # Find the selected node
                        selected_node = next(
                            (
                                node
                                for node in parent_node["children"]
                                if node["name"] == selected_item_name
                            ),
                            None,
                        )
                        if selected_node:
                            # Clear the TreeView and insert the data for the selected node
                            self.sheet.clear()

                            def findSpec_fromStd(wmStr):
                                spec = go(
                                    wmStr.split("|"),
                                    map(lambda x: x.strip()),
                                    filter(
                                        lambda x: ("(   )" in x)
                                        or ("(   )" in x)
                                        or ("(  )" in x)
                                    ),
                                    lambda x: "\n".join(x),
                                )
                                return spec

                            def findSpec_fromPjt(wmStr):
                                wmCode = wmStr.split("|")[0].strip()
                                wmGauge_ = wmStr.split("::")
                                if len(wmGauge_) == 1:
                                    wmGauge = ""
                                else:
                                    wmGauge = wmGauge_[-1]
                                target_keys = go(
                                    pjt_wms.keys(),
                                    filter(lambda k: k != "not_assigned"),
                                    filter(lambda k: pjt_wms[k][0] == wmCode),
                                    filter(lambda k: pjt_wms[k][1] == wmGauge),
                                    list,
                                )
                                spec_ = []
                                if target_keys:
                                    for k in pjt_wms:
                                        v = pjt_wms.get(k)
                                        if v and v[0] == wmCode and v[1] == wmGauge:
                                            spec_.append(v[3])
                                else:
                                    for v in pjt_wms["not_assigned"]:
                                        if v[0] == wmCode and v[1] == wmGauge:
                                            spec_.append(v[3])
                                spec = spec_[0]

                                return spec

                            def findSpec(wmStr):
                                try:
                                    spec = findSpec_fromPjt(wmStr)
                                except:
                                    spec = findSpec_fromStd(wmStr)
                                return spec

                            # Wrap the children of the selected node for insertion
                            wrapped_data = go(
                                selected_node["children"],
                                map(
                                    lambda x: [
                                        "",
                                        findSpec(x),
                                        go(
                                            x,
                                            lambda x: x.split("|"),
                                            map(lambda x: x.strip()),
                                            list,
                                            lambda x: x[-3],
                                        ),
                                        x,
                                        go(
                                            x.split("|"),
                                            map(lambda x: x.strip()),
                                            list,
                                            lambda x: x[-1],
                                            lambda x: (
                                                x.split("::")[-1] if "::" in x else ""
                                            ),
                                        ),
                                    ]
                                ),
                                list,
                            )

                            selected_item_str = self.selected_item_relate_widget.get()
                            decided_WM = state.team_std_info[f"project-{mode}"].get(
                                selected_item_str, None
                            )

                            tgt_rowIdx = 0
                            if decided_WM:
                                for idx, row in enumerate(wrapped_data):
                                    if decided_WM[0] in row[-2] and (
                                        decided_WM[1] == row[4] or decided_WM[1] == ""
                                    ):
                                        row[0] = True
                                        row[1] = decided_WM[-1]
                                        row[2] = decided_WM[-2]
                                        row[4] = decided_WM[1]
                                        tgt_rowIdx = idx

                            # self.treeview.insert_data_with_levels(wrapped_data)
                            self.sheet.set_sheet_data(wrapped_data)

                            ###########test#################
                            self.apply_wrap(tgt_idx=3, tgt_width=1000)
                            self.sheet.set_all_cell_sizes_to_text()
                            self.sheet.set_all_row_heights(
                                height=50,
                                only_set_if_too_small=True,
                            )
                            ###########test#################

                            self.sheet.see(tgt_rowIdx, 0)
                        else:
                            self.state.log_widget.write(
                                f"Selected item '{selected_item_name}' not found."
                            )
                    else:
                        self.state.log_widget.write(
                            f"Parent item '{parent_item_name}' not found."
                        )
                else:
                    self.state.log_widget.write(
                        f"Grandparent item '{grand_parent_item_name}' not found."
                    )

        except Exception as e:
            self.state.log_widget.write(
                f"{self.__class__.__name__} > update 메소드 진입 안됩니다~: {e}"
            )

        self.setup_column_style()
        self.highlight_checked_row()

        self.state.log_widget.write(f"{self.__class__.__name__} > update 메소드 종료")

    def set_edit_mode(self, mode):
        # 편집 모드 설정
        if mode == "edit":
            self.sheet.enable_bindings()
        else:
            self.sheet.disable_bindings()


class ProjectStd_WM_Selcet_SheetView_SWM:
    def __init__(self, state, parent, relate_widget):
        self.state = state
        self.data_kind = "std-SWM"
        self.treeDataManager = TreeDataManager_treesheet(state, self)
        self.relate_widget = relate_widget
        self.selected_item_relate_widget = relate_widget.selected_item

        self.title_frame = ttk.Frame(parent)
        self.title_frame.pack(anchor="nw")

        self.sheet = Sheet(
            parent,
            show_x_scrollbar=True,
            show_y_scrollbar=True,
            width=2000,
            height=800,
        )
        self.sheet.pack(expand=True, fill="both", padx=5, pady=5)

        # config enable_bindings
        self.sheet.enable_bindings(
            "edit_cell",
            "delete",
            "single_select",  # Allow single cell selection
            "drag_select",
            "row_select",  # Allow row selection
            "column_select",  # Allow column selection
            "drag_select",  # Allow drag selection
            "column_width_resize",
            "row_height_resize",
            "double_click_column_resize",
            "copy",
            "paste",
            "ctrl_click_select",
            "right_click_popup_menu",
            "rc_insert_row",
            "rc_delete_row",
            "arrowkeys",
        )

        # Initialize the search manager
        self.search_manager = SheetSearchManager(self.state, self)

        # Add Search Box
        self.add_search_box(self.title_frame)

        # Right Click pop up - 선택 초기화 버튼 추가
        self.sheet.popup_menu_add_command(
            label="신규 Gauge 항목 생성",
            func=lambda: self.copyWM_forGauge("SWM"),
        )
        self.sheet.popup_menu_add_command(
            label="선택 Gauge 항목 삭제",
            func=lambda: self.deleteWM_forGauge("SWM"),
        )

        # Bind checkbox clicks
        self.sheet.extra_bindings(
            [
                ("end_edit_cell", lambda e: self.on_checkbox_click(e, mode="SWM")),
                ("delete", lambda e: self.on_checkbox_delete(e)),
            ]
        )

        # 초기 데이터 로드 및 시트 설정
        self.setup_sheet()

        # 상태 변경 감지를 위한 옵저버 설정
        self.state_observer = StateObserver(state, lambda e: self.update(e))

    def setup_sheet(self):
        # 헤더 설정
        headers = ["Use", "Spec", "Unit", "Work Master", "Gauge Code"]
        self.sheet.headers(headers)

        # Create checkboxes in the First column
        self.sheet.checkbox("A", checked=True)

        self.setup_column_style()
        # 초기 데이터 로드
        self.update()

    def setup_column_style(self):
        # self.sheet.set_column_widths([25, 200, 25, 2000])
        self.sheet.set_column_widths([25, 200, 25, 1000, 70])

        self.sheet["E"].align("center")
        self.sheet.set_options(header_font=("Arial Narrow", 8, "normal"))
        self.sheet.set_options(font=("Arial", 10, "normal"))

        # self.sheet.set_options(default_row_height=30)

    def add_search_box(self, parent):
        """Add search box to filter the sheet data."""
        search_frame = ttk.Frame(parent)
        search_frame.pack(padx=5, pady=5, anchor="w")

        # Search Label
        search_label = ttk.Label(search_frame, text="Search:")
        search_label.pack(side="left", padx=5)

        # Search Entry
        self.search_entry = ttk.Entry(search_frame, width=20)
        self.search_entry.pack(side="left", padx=5)
        self.search_entry.bind(
            "<Return>",
            lambda e: self.search_manager.search_sheet_data(self.search_entry.get()),
        )

        # Search Button
        search_button = ttk.Button(
            search_frame,
            text="Search",
            command=lambda: self.search_manager.search_sheet_data(
                self.search_entry.get()
            ),
        )
        search_button.pack(side="left", padx=5)

        # Reset Button
        reset_button = ttk.Button(
            search_frame,
            text="Reset",
            command=lambda: self.search_manager.reset_search(self.search_entry),
        )
        reset_button.pack(side="left", padx=5)

    def on_checkbox_delete(self, event):
        selected_item_str = self.selected_item_relate_widget.get()
        project_SWM = self.state.team_std_info["project-SWM"].get(selected_item_str)
        print(event)

        row, column = list(event["cells"]["table"].keys())[0]
        if column == 0:
            if project_SWM:
                self.state.team_std_info["project-SWM"].pop(selected_item_str)

        self.update()
        self.sheet.redraw()

        # return

    def on_checkbox_click(self, event, mode=None):
        state = self.state
        """Callback for checkbox clicks."""
        self.state.log_widget.write(
            f"{self.__class__.__name__} > on_checkbox_click 메소드 시작"
        )
        selected_item_str = self.selected_item_relate_widget.get()
        pjt_wms = state.team_std_info[f"project-{mode}"]
        project_WM = self.state.team_std_info[f"project-{mode}"].get(selected_item_str)

        row = event["row"]
        column = event["column"]

        # 선택행이 아닌 다른 행들 일괄 Uncheck
        for r in range(self.sheet.get_total_rows()):
            if r != row:
                self.sheet.set_cell_data(r, 0, False)  # Uncheck other rows

        # Ensure the clicked checkbox remains selected
        self.sheet.set_cell_data(row, 0, True)

        loc = list(event["cells"]["table"].keys())[0]
        row_check_status = self.sheet.get_cell_data(row, 0)

        print(f"이벤트: {event}")
        print(f"위치: {loc}, 체크스테이터스 : {row_check_status}")

        selectedRow_wmCode = go(
            self.sheet.get_cell_data(row, 3),
            lambda x: x.split("|"),
            map(lambda x: x.strip()),
            next,
        )
        if project_WM:
            project_WM_code = project_WM[0]
            project_WM_gauge = project_WM[1]
        else:
            project_WM_code = "na"
            project_WM_gauge = "na"

        if column == 0:
            if (
                project_WM_code != selectedRow_wmCode
                or project_WM_gauge != self.sheet.get_cell_data(row, 4)
            ):  ## 행 옮겨 클릭시
                spec = self.sheet.get_cell_data(row, 1)
                ## 기존항목서 수정된 스펙 받아오기 코드 삽입
                if self.update_spec_fromExist(mode=mode) != "":
                    spec = self.update_spec_fromExist(mode=mode)
                unit = self.sheet.get_cell_data(row, 2)
                gauge = self.sheet.get_cell_data(row, 4)
            else:
                spec = self.sheet.get_cell_data(row, 1)
                unit = self.sheet.get_cell_data(row, 2)
                gauge = self.sheet.get_cell_data(row, 4)
            self.update()
        elif column == 1:
            if (
                project_WM_code != selectedRow_wmCode
                or project_WM_gauge != self.sheet.get_cell_data(row, 4)
            ):  ## 다른행 옮겨 수정시

                target_keys = go(
                    pjt_wms.keys(),
                    filter(lambda k: k != "not_assigned"),
                    filter(lambda k: pjt_wms[k][0] == selectedRow_wmCode),
                    filter(lambda k: pjt_wms[k][1] == self.sheet.get_cell_data(row, 4)),
                    list,
                )
                print(f"target_keys::{target_keys}")
                if target_keys:  # 타겟 있으면 그 타겟 데이터 수정
                    for k in target_keys:
                        pjt_wms[k][3] = self.sheet.get_cell_data(row, 1)
                else:  # 타겟 없으면 임시저장
                    if "not_assigned" not in pjt_wms:
                        pjt_wms.update({"not_assigned": []})

                    modi_target_idx = []
                    for idx, v in enumerate(pjt_wms["not_assigned"]):
                        if v[0] == selectedRow_wmCode and v[
                            1
                        ] == self.sheet.get_cell_data(row, 4):
                            modi_target_idx.append(idx)
                    print(f"modi_target_idx:{modi_target_idx}")
                    if modi_target_idx:
                        pjt_wms["not_assigned"][modi_target_idx[0]] = [
                            selectedRow_wmCode,
                            self.sheet.get_cell_data(row, 4),  # Gauge
                            self.sheet.get_cell_data(row, 2),  # unit
                            self.sheet.get_cell_data(row, 1),  # spec
                        ]
                    else:
                        pjt_wms["not_assigned"].append(
                            [
                                selectedRow_wmCode,
                                self.sheet.get_cell_data(row, 4),  # Gauge
                                self.sheet.get_cell_data(row, 2),  # unit
                                self.sheet.get_cell_data(row, 1),  # spec
                            ]
                        )
                    print(f'not_assigned::{pjt_wms["not_assigned"]}')
            else:
                spec = self.sheet.get_cell_data(row, 1)
                self.edit_spec_sameWMgauge_all(mode="SWM")
                unit = self.sheet.get_cell_data(row, 2)
                gauge = self.sheet.get_cell_data(row, 4)
            self.update()
        elif column == 4:
            messagebox.showinfo(
                "WM Gauge 항목 편집", "Gauge Code는 타이핑으로 편집 할 수 없습니다."
            )
            self.update()

        # if row_check_status:
        self.state.team_std_info[f"project-{mode}"].update(
            {selected_item_str: [selectedRow_wmCode, gauge, unit, spec]}
        )
        print(self.state.team_std_info[f"project-{mode}"][selected_item_str])
        self.update()
        self.highlight_checked_row()
        self.sheet.redraw()

        # 변동사항 어사인 db 에 반영
        WMs = state.team_std_info.get("WMs")
        WMsStr = go(
            WMs,
            map(lambda x: list(map(str, x))),
            map(lambda x: filter(lambda x: x != "0", x)),
            map(lambda x: filter(lambda x: x != "", x)),
            map(lambda x: filter(lambda x: x != " ", x)),
            map(lambda x: filter(lambda x: x != "ㅤ", x)),  #  공백 특수 문자
            map(lambda x: " | ".join(x)),
            list,
        )
        pjt_gwm_data = state.team_std_info.get("project-GWM")
        pjt_swm_data = state.team_std_info.get("project-SWM")
        pjt_wm_data = deepcopy(pjt_gwm_data)
        pjt_wm_data.update(pjt_swm_data)
        pjt_assigntypes = self.state.team_std_info["project-assigntype"]["children"]

        for assigntype in pjt_assigntypes:
            wms = assigntype["children"]
            for wm in wms:
                try:
                    matched_item = find_matched_pjtGWM(pjt_wm_data, wm[2])
                    wm[3] = find_wmStr(
                        pjt_wm_data.get(matched_item, ["", "", "", ""])[0],
                        WMsStr,
                    )
                    wm[4] = pjt_wm_data.get(matched_item, ["", "", "", ""])[1]
                    wm[5] = pjt_wm_data.get(matched_item, ["", "", "", ""])[3]
                    wm[7] = pjt_wm_data.get(matched_item, ["", "", "", ""])[2]
                except:
                    pass

    def highlight_checked_row(self):
        """Update row highlights based on checkbox values."""
        checked_rows = []
        for row in range(self.sheet.get_total_rows()):
            if self.sheet.get_cell_data(row, 0):  # If checkbox is checked
                checked_rows.append(row)

        # Clear existing highlights
        self.sheet.dehighlight_all()
        self.sheet.highlight_rows(
            checked_rows, highlight_index=False, bg="#D3F9D8"
        )  # Light green

    def wrap_text(self, text, width):
        """
        Wrap text to fit within a given width, handling long words properly.
        """
        if not text or not isinstance(text, str):
            return text
        max_chars_per_line = max(1, width // 7)  # Approximate character width in pixels

        words = text.split()  # Split into words
        lines = []
        current_line = ""

        for word in words:
            while len(word) > max_chars_per_line:  # Split long words into chunks
                lines.append(word[:max_chars_per_line])
                word = word[max_chars_per_line:]

            if len(current_line) + len(word) + 1 > max_chars_per_line:
                lines.append(current_line)
                current_line = word
            else:
                current_line = f"{current_line} {word}".strip()

        if current_line:
            lines.append(current_line)

        return "\n".join(lines)

    def apply_wrap(self, tgt_idx, tgt_width=None):
        """
        Apply wrapping to all cells based on their column widths.
        """
        wrapped_data = []
        # for row_index, row in enumerate(self.sheet.get_sheet_data()):
        for row_index, row in enumerate(self.sheet.get_sheet_data()):
            wrapped_row = []
            for col_index, cell in enumerate(row):
                if col_index == tgt_idx:
                    if tgt_width:
                        width = tgt_width
                    else:
                        width = self.sheet.column_width(col_index)
                    wrapped_row.append(self.wrap_text(cell, width))
                else:
                    wrapped_row.append(cell)
            wrapped_data.append(wrapped_row)

        self.sheet.set_sheet_data(wrapped_data)

    def remove_invalid_pjtWM(self, mode):
        state = self.state
        std_WM = state.team_std_info[f"std-{mode}"]["children"]
        pjt_WM = state.team_std_info[f"project-{mode}"]

        check_list = []
        for grand_node in std_WM:
            grand_name = grand_node["name"]
            for parent_node in grand_node["children"]:
                parnet_name = parent_node["name"]
                for child_node in parent_node["children"]:
                    child_name = child_node["name"]

                    check_list.append(" | ".join([grand_name, parnet_name, child_name]))
        remove_target = go(
            pjt_WM,
            deepcopy,
            lambda x: x.keys(),
            filter(lambda x: x not in check_list),
            filter(lambda x: x != "not_assigned"),
            list,
        )
        for rm in remove_target:
            try:
                pjt_WM.pop(rm)
            except:
                pass

    def update_spec_fromExist(self, mode=None):
        state = self.state
        selected_loc = list(self.sheet.get_selected_cells())[0]
        selected_row = list(selected_loc)[0]
        selected_col = list(selected_loc)[1]
        selected_data = self.sheet.get_cell_data(selected_row, 3)

        selected_wm_code = go(
            selected_data,
            lambda x: x.split("|"),
            map(lambda x: x.strip()),
            next,
        )
        selected_wm_gauge = self.sheet.get_cell_data(selected_row, 4)

        pjt_wms = state.team_std_info[f"project-{mode}"]
        print(f"update_spec_fromExist 로직패스체크0.3")
        target_keys = go(
            pjt_wms.keys(),
            filter(lambda k: k != "not_assigned"),
            filter(lambda k: pjt_wms[k][0] == selected_wm_code),
            filter(lambda k: pjt_wms[k][1] == selected_wm_gauge),
            list,
        )
        tgt_specs = []
        print(f"{target_keys}")
        if target_keys:
            for k in pjt_wms:
                v = pjt_wms.get(k)
                if v and v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                    tgt_specs.append(v[3])
            print(f"tgt_spec::{tgt_specs}")
        else:
            if pjt_wms.get("not_assigned"):
                for v in pjt_wms["not_assigned"]:
                    if v and v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                        tgt_specs.append(v[3])

        if tgt_specs:
            tgt_spec = tgt_specs[0]
        else:
            tgt_spec = ""

        return tgt_spec

    def edit_spec_sameWMgauge_all(self, mode=None):
        state = self.state
        selected_loc = list(self.sheet.get_selected_cells())[0]
        selected_row = list(selected_loc)[0]
        selected_col = list(selected_loc)[1]
        selected_data = self.sheet.get_cell_data(selected_row, 3)

        selected_wm_code = go(
            selected_data,
            lambda x: x.split("|"),
            map(lambda x: x.strip()),
            list,
        )[0]
        selected_wm_gauge = self.sheet.get_cell_data(selected_row, 4)

        pjt_wms = state.team_std_info[f"project-{mode}"]
        for k in pjt_wms:
            v = pjt_wms.get(k)
            if v and v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                v[-1] = self.sheet.get_cell_data(selected_row, 1)
            pjt_wms.update({k: v})
        for v in pjt_wms["not_assigned"]:
            if v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                v[-1] = self.sheet.get_cell_data(selected_row, 1)

    def deleteWM_forGauge(self, mode=None):
        state = self.state
        selected_loc = list(self.sheet.get_selected_cells())[0]
        selected_row = list(selected_loc)[0]
        selected_col = list(selected_loc)[1]
        selected_data = self.sheet.get_cell_data(selected_row, 3)

        delete_will = messagebox.askyesno(
            "WM Gauge 항목 삭제",
            "삭제하면 해당 WM Gauge로 할당되었던 항목들의 할당이 해제됩니다.\n계속하시겠습니까?",
        )
        if delete_will:
            selected_wm_code = go(
                selected_data,
                lambda x: x.split("|"),
                map(lambda x: x.strip()),
                list,
            )[0]
            selected_wm_gauge = self.sheet.get_cell_data(selected_row, 4)
            print(f"selected_wm_code ::{selected_wm_code}")

            pjt_wms = state.team_std_info[f"project-{mode}"]

            # 게이지 항목 아닐 경우 경고창 출력
            if "::" not in self.sheet.get_cell_data(selected_row, 3):
                messagebox.showinfo(
                    "WM Gauge 항목 삭제",
                    "Gauge 파생이 되지 않은 항목은 삭제할 수 없습니다.",
                )
                return
            # 게이지 삭제로 인해 할당 여부 검사 및 삭제 키 추리기
            rm_target_keys = []
            for k in pjt_wms:
                v = pjt_wms.get(k)
                if v and v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                    rm_target_keys.append(k)

            print(f"rm_target_keys::{rm_target_keys}")

            # GWM 중 제거된 WM+Gauge와 일치하는 항목들 일괄 삭제
            if rm_target_keys:
                for rm_k in rm_target_keys:
                    deleted_v = pjt_wms.pop(rm_k)

            def delGauge_forNode(node):
                """
                하나의 노드에 대한 게이지WM 삭제 함수
                """
                # std-GWM 데이터 각 item 항목 중
                # 삭제게이지의 원소속 코드가 포함된 모든 항목 추출 및 정렬
                tgt_db_wms = go(
                    node["children"],
                    filter(lambda x: selected_wm_code in x),
                    lambda x: sorted(x),
                    list,
                )
                try:
                    tgt_db_wm_ = go(
                        tgt_db_wms,
                        filter(lambda x: x.split("::")[-1] == selected_wm_gauge),
                        # next,
                    )
                    # GWM/SWM 항목 소속 wm 중 타겟이 있으면 필터목록을 값으로만들고
                    # 없으면 빈문자열
                    if tgt_db_wm_:
                        tgt_db_wm = next(tgt_db_wm_)
                    else:
                        tgt_db_wm = ""
                    tgt_db_wm_idx = node["children"].index(tgt_db_wm)
                    print(f"tgt_db_wm {tgt_db_wm}")

                    if "::" in tgt_db_wm:
                        del node["children"][tgt_db_wm_idx]

                    tgt_db_wms_afterDelete = go(
                        node["children"],
                        filter(lambda x: selected_wm_code in x),
                        lambda x: sorted(x),
                        list,
                    )
                    print(f"tgt_db_wms_afterDelete::{tgt_db_wms_afterDelete}")

                    # 대상 게이지 wm 항목 삭제된 std-GWM item 내 wm들
                    # 순서대로 게이지 붙어있는 지 검사하고
                    # 알파벳 순서대로 게이지 재조정
                    for idx, wm in enumerate(tgt_db_wms_afterDelete):
                        print(f"wm_old::{wm}")
                        if "::" in wm:
                            wmGauge_old = wm.split("::")[-1]
                        else:
                            wmGauge_old = ""

                        print(f"wmGauge_old::{wmGauge_old}")

                        db_index = node["children"].index(wm)

                        if len(tgt_db_wms_afterDelete) == 1:
                            wm_new = wm.split("::")[0]
                        elif chr(idx + 65) != wmGauge_old:
                            wm_new = wm.split("::")[0] + f"::{chr(idx + 65)}"
                            print(f"wm_new_case1!::{wm_new}")
                        else:
                            wm_new = wm
                            print(f"wm_new_case2!::{wm_new}")

                        node["children"][db_index] = wm_new
                        print(
                            f"node['children'][db_index] ::{node['children'][db_index]}"
                        )

                        if "::" in wm_new:
                            wmGauge_new = wm_new.split("::")[-1]
                        else:
                            wmGauge_new = ""

                        print(f"wm_new::{wm_new}")
                        print(f"wmGauge_new::{wmGauge_new}")

                except:
                    pass

            # std-GWM에서 모든 item 에서 해당 게이지 삭제
            data = state.team_std_info[self.data_kind]["children"]
            for grandNode in data:
                for parentNode in grandNode["children"]:
                    for childNode in parentNode["children"]:
                        delGauge_forNode(childNode)

            ############ 수정중 ######################################
            # 게이지 변경으로 값 수정되어야 할 pjt-GWM 추리기
            def a2_previous_a(a):
                if a == "A":
                    pass
                else:
                    res = chr(ord(a) - 1)
                return res

            same_wm_keys = []
            pjt_wms_all_wm = []
            for k in pjt_wms:
                v = pjt_wms.get(k)
                if k != "not_assigned":  # and [v[0], v[1]] not in pjt_wms_all_wm:
                    pjt_wms_all_wm.append([v[0], v[1]])
                if v and v[0] == selected_wm_code:  # and v[1] == selected_wm_gauge:
                    same_wm_keys.append(k)

            for swk in same_wm_keys:
                v = pjt_wms.get(swk)
                print(f"현재 item - {swk}")
                print(f"현재 item v- {v}")
                if v[1] > selected_wm_gauge:
                    print(f"대상 item - {swk}")
                    print(f"대상 item v- {v}")
                    print(f"게이지 차감 {v[1]} to {a2_previous_a(v[1])}")
                    pjt_wms[swk][1] = a2_previous_a(v[1])

            ############ 수정중 ######################################
            # 삭제 대상 게이지 pjt-GWM 에서도 제거 - 이 부분 재설계 필요 :일부 할당 일부 not assigned 일때 모두
            modi_ref_idx = None
            ref_idxs = []
            for idx, v in enumerate(pjt_wms["not_assigned"]):
                if v[0] == selected_wm_code and v[1] == selected_wm_gauge:
                    modi_ref_idx = idx
                    ref_idxs.append(idx)
                    print(f"[v_del] {pjt_wms['not_assigned'][idx]}")
                    del pjt_wms["not_assigned"][idx]
            print(f"[pjt_wms_all_wm] {pjt_wms_all_wm}")

            for idx, v in enumerate(pjt_wms["not_assigned"]):
                if v[0] == selected_wm_code and v[1] > selected_wm_gauge:
                    if [v[0], a2_previous_a(v[1])] not in pjt_wms_all_wm:
                        old = deepcopy(pjt_wms["not_assigned"][idx][1])
                        pjt_wms["not_assigned"][idx][1] = a2_previous_a(old)
                        print(f"[v_new] {pjt_wms['not_assigned'][idx]}")
                    else:
                        del pjt_wms["not_assigned"][idx]

            self.update()
            self.sheet.update()

    def copyWM_forGauge(self, mode=None):
        state = self.state

        # Split the selected item path to find the grandparent, parent, and selected item names
        grand_parent_item_name, parent_item_name, selected_item_name = (
            self.selected_item_relate_widget.get().split(" | ")
        )

        selected_loc = list(self.sheet.get_selected_cells())[0]
        selected_row = list(selected_loc)[0]
        selected_col = list(selected_loc)[1]
        selected_data = self.sheet.get_cell_data(selected_row, 3)

        selected_wm_code = go(
            selected_data,
            lambda x: x.split("|"),
            map(lambda x: x.strip()),
            next,
        )

        data = state.team_std_info[self.data_kind]["children"]

        # Find the grandparent node
        grand_parent_node = next(
            (node for node in data if node["name"] == grand_parent_item_name),
            None,
        )
        if grand_parent_node:
            # Find the parent node
            parent_node = next(
                (
                    node
                    for node in grand_parent_node["children"]
                    if node["name"] == parent_item_name
                ),
                None,
            )
            if parent_node:
                # Find the selected node
                selected_node = next(
                    (
                        node
                        for node in parent_node["children"]
                        if node["name"] == selected_item_name
                    ),
                    None,
                )
        # print(f"selected_row {selected_node}")

        ## 위젯에서 선택한 wm과 동일한 항목을 db의 특정 childnode에서 검색하여
        ## 게이지 코드 부여한 복사본 만들고 원본은 ::A 붙여주는 함수
        def setGauge_forNode(node):
            tgt_db_wms = go(
                node["children"],
                filter(lambda x: selected_wm_code in x),
                lambda x: sorted(x),
                list,
            )
            try:
                tgt_db_wm = tgt_db_wms[-1]  # 동일 wm들 중 마지막 항목
                tgt_db_wm_idx = node["children"].index(tgt_db_wm)
                print(f"tgt_db_wm {tgt_db_wm}")

                tgt_db_wm_last = go(
                    tgt_db_wm,
                    lambda x: x.split("|"),
                    map(lambda x: x.strip()),
                    list,
                    lambda x: x[-1],
                )
                # print(f"tgt_db_wm_last {tgt_db_wm_last}")
                if "::" not in tgt_db_wm_last:
                    new_gauge = "B"
                    copied_wm = f"{tgt_db_wm}::{new_gauge}"
                    node["children"][tgt_db_wm_idx] = f"{tgt_db_wm}::A"
                else:
                    new_gauge = chr(ord(tgt_db_wm_last.split("::")[-1]) + 1)
                    copied_wm = go(
                        tgt_db_wm,
                        lambda x: x.split("::"),
                        lambda x: x[:-1],
                        lambda x: "::".join([*x, new_gauge]),
                    )

                node["children"].insert(tgt_db_wm_idx + 1, copied_wm)
            except:
                pass

        for grandNode in data:
            for parentNode in grandNode["children"]:
                for childNode in parentNode["children"]:
                    setGauge_forNode(childNode)

        pjt_wms = state.team_std_info[f"project-{mode}"]
        for k in pjt_wms:
            # v = pjt_wms[k]
            v = pjt_wms.get(k)
            if v and v[0] == selected_wm_code and v[1] == "":
                v[1] = "A"
            pjt_wms.update({k: v})
        if not pjt_wms.get("not_assigned"):
            pjt_wms["not_assigned"] = []
        if pjt_wms["not_assigned"]:
            for v_ in pjt_wms["not_assigned"]:
                if v_[0] == selected_wm_code and v_[1] == "":
                    v_[1] = "A"

        self.update()
        self.sheet.update()

    def update(self, event=None):
        state = self.state
        mode = self.data_kind.split("-")[-1]
        """Update the TreeView whenever the state changes."""
        self.state.log_widget.write(f"{self.__class__.__name__} > update 메소드 시작")
        self.state.log_widget.write(
            f"선택아이템 출력 : {self.selected_item_relate_widget.get()}"
        )
        self.setup_column_style()

        try:
            self.remove_invalid_pjtWM("SWM")
        except:
            pass

        try:
            pjt_wms = state.team_std_info[f"project-{mode}"]

            # Split the selected item path to find the grandparent, parent, and selected item names
            grand_parent_item_name, parent_item_name, selected_item_name = (
                self.selected_item_relate_widget.get().split(" | ")
            )

            # Ensure the data kind exists in the team standard information
            if self.data_kind in state.team_std_info:
                data = state.team_std_info[self.data_kind]["children"]

                # Find the grandparent node
                grand_parent_node = next(
                    (node for node in data if node["name"] == grand_parent_item_name),
                    None,
                )
                if grand_parent_node:
                    # Find the parent node
                    parent_node = next(
                        (
                            node
                            for node in grand_parent_node["children"]
                            if node["name"] == parent_item_name
                        ),
                        None,
                    )
                    if parent_node:
                        # Find the selected node
                        selected_node = next(
                            (
                                node
                                for node in parent_node["children"]
                                if node["name"] == selected_item_name
                            ),
                            None,
                        )
                        if selected_node:
                            # Clear the TreeView and insert the data for the selected node
                            self.sheet.clear()

                            def findSpec_fromStd(wmStr):
                                spec = go(
                                    wmStr.split("|"),
                                    map(lambda x: x.strip()),
                                    filter(
                                        lambda x: ("(   )" in x)
                                        or ("(   )" in x)
                                        or ("(  )" in x)
                                    ),
                                    lambda x: "\n".join(x),
                                )
                                return spec

                            def findSpec_fromPjt(wmStr):
                                wmCode = wmStr.split("|")[0].strip()
                                wmGauge_ = wmStr.split("::")
                                if len(wmGauge_) == 1:
                                    wmGauge = ""
                                else:
                                    wmGauge = wmGauge_[-1]
                                target_keys = go(
                                    pjt_wms.keys(),
                                    filter(lambda k: k != "not_assigned"),
                                    filter(lambda k: pjt_wms[k][0] == wmCode),
                                    filter(lambda k: pjt_wms[k][1] == wmGauge),
                                    list,
                                )
                                spec_ = []
                                if target_keys:
                                    for k in pjt_wms:
                                        v = pjt_wms.get(k)
                                        if v and v[0] == wmCode and v[1] == wmGauge:
                                            spec_.append(v[3])
                                else:
                                    for v in pjt_wms["not_assigned"]:
                                        if v[0] == wmCode and v[1] == wmGauge:
                                            spec_.append(v[3])
                                spec = spec_[0]

                                return spec

                            def findSpec(wmStr):
                                try:
                                    spec = findSpec_fromPjt(wmStr)
                                except:
                                    spec = findSpec_fromStd(wmStr)
                                return spec

                            # Wrap the children of the selected node for insertion
                            wrapped_data = go(
                                selected_node["children"],
                                map(
                                    lambda x: [
                                        "",
                                        findSpec(x),
                                        go(
                                            x,
                                            lambda x: x.split("|"),
                                            map(lambda x: x.strip()),
                                            list,
                                            lambda x: x[-3],
                                        ),
                                        x,
                                        go(
                                            x.split("|"),
                                            map(lambda x: x.strip()),
                                            list,
                                            lambda x: x[-1],
                                            lambda x: (
                                                x.split("::")[-1] if "::" in x else ""
                                            ),
                                        ),
                                    ]
                                ),
                                list,
                            )

                            selected_item_str = self.selected_item_relate_widget.get()
                            decided_WM = state.team_std_info[f"project-{mode}"].get(
                                selected_item_str, None
                            )

                            tgt_rowIdx = 0
                            if decided_WM:
                                for idx, row in enumerate(wrapped_data):
                                    if decided_WM[0] in row[-2] and (
                                        decided_WM[1] == row[4] or decided_WM[1] == ""
                                    ):
                                        row[0] = True
                                        row[1] = decided_WM[-1]
                                        row[2] = decided_WM[-2]
                                        row[4] = decided_WM[1]
                                        tgt_rowIdx = idx

                            # self.treeview.insert_data_with_levels(wrapped_data)
                            self.sheet.set_sheet_data(wrapped_data)

                            ###########test#################
                            self.apply_wrap(tgt_idx=3, tgt_width=1000)
                            self.sheet.set_all_cell_sizes_to_text()
                            self.sheet.set_all_row_heights(
                                height=50,
                                only_set_if_too_small=True,
                            )
                            ###########test#################

                            self.sheet.see(tgt_rowIdx, 0)
                        else:
                            self.state.log_widget.write(
                                f"Selected item '{selected_item_name}' not found."
                            )
                    else:
                        self.state.log_widget.write(
                            f"Parent item '{parent_item_name}' not found."
                        )
                else:
                    self.state.log_widget.write(
                        f"Grandparent item '{grand_parent_item_name}' not found."
                    )

        except Exception as e:
            self.state.log_widget.write(
                f"{self.__class__.__name__} > update 메소드 진입 안됩니다~: {e}"
            )

        self.setup_column_style()
        self.highlight_checked_row()

        self.state.log_widget.write(f"{self.__class__.__name__} > update 메소드 종료")

    def set_edit_mode(self, mode):
        # 편집 모드 설정
        if mode == "edit":
            self.sheet.enable_bindings()
        else:
            self.sheet.disable_bindings()


class TeamStd_WMsSheetView:
    def __init__(self, state, parent):
        self.state = state
        self.data_kind = "WMs"

        # Compose TreeView, Style Manager, and State Observer
        self.sheetview = BaseSheetView(parent, headers=None)
        self.sheet = self.sheetview.sheet
        self.state_observer = SheetViewStateObserver(
            state, self.sheetview, lambda e: self.update()
        )

        # Set up UI
        self.title_frame = ttk.Frame(parent)
        self.title_frame.pack(fill="x", anchor="nw")
        self.set_title(self.title_frame)

        # Add Search Box
        self.search_frame = ttk.Frame(parent)
        self.search_frame.pack(fill="x", anchor="nw")
        self.add_search_box(self.search_frame)

        self.sheetview.sheet.pack(expand=True, fill="both", anchor="nw")
        self.sheetview.sheet.header_font(("Arial", 8, "normal"))
        self.setup_column_style()
        self.sheetview.sheet.set_options(
            font=("Arial Narrow", 9, "normal"),
            default_row_height=30,
            # Bind selection events
        )  # Font name and size
        self.sheetview.sheet.config(height=2000)
        # Initialize the search manager
        self.search_manager = SheetSearchManager(self.state, self)

        # action binding
        self.sheetview.sheet.extra_bindings(
            [
                (
                    "cell_select",
                    lambda e: self.on_cell_select(e, state, self.sheetview.sheet),
                ),
                (
                    "drag_select_cells",
                    lambda e: self.on_cell_select(e, state, self.sheetview.sheet),
                ),
            ]
        )

        # Add DB update Button
        self.add_updateDB_button(parent)

    def setup_column_style(self):
        wide = 120
        narrow = 30
        self.sheetview.sheet.set_column_widths(
            [
                wide,  # A
                narrow,  # B
                narrow,  # C
                wide,  # D
                narrow,  # E
                wide,  # F
                narrow,  # G
                wide,  # H
                narrow,  # I
                wide,  # J
                narrow,  # K
                wide,  # L
                narrow,  # M
                wide,  # N
                narrow,  # O
                wide,  # P
                narrow,  # Q
                wide,  # R
                narrow,  # S
                wide,  # T
                narrow,  # U
                wide,  # V
                narrow,  # W
                wide,  # X
                wide,  # Y
                wide,  # Z
                wide,  # AA
                wide,  # AB
                wide,  # AC
                wide,  # AD
                wide,  # AE
                wide,  # AF
                wide,  # AG
                narrow,  # AH
                narrow,  # AI
                wide,  # AJ
                wide,  # AK
            ]
        )

        # self.sheet["A"].align("center")
        # self.sheet.set_options(header_font=("Arial Narrow", 7, "normal"))
        # self.sheet.set_options(header_height="")
        # self.sheet.set_options(font=("Arial", 8, "normal"))
        # self.sheet.set_options(default_row_height=18)

    def update(self, event=None, data=None):
        # Updating tksheet in the UI
        state = self.state
        self.sheet.set_sheet_data([])
        if data:
            data_forSheet = data
            # state 변경도 추가
            state.team_std_info[self.data_kind] = data_forSheet
        else:
            data_forSheet = state.team_std_info.get(self.data_kind)

        self.sheetview.sheet.set_sheet_data(data_forSheet)

        self.setup_column_style()

    def add_search_box(self, parent):
        """Add search box to filter the sheet data."""
        search_frame = ttk.Frame(parent)
        search_frame.pack(padx=5, pady=5, anchor="w")

        # Search Label
        search_label = ttk.Label(search_frame, text="Search:")
        search_label.pack(side="left", padx=5)

        # Search Entry
        self.search_entry = ttk.Entry(search_frame, width=20)
        self.search_entry.pack(side="left", padx=5)
        self.search_entry.bind(
            "<Return>",
            lambda e: self.search_manager.search_sheet_data(self.search_entry.get()),
        )

        # Search Button
        search_button = ttk.Button(
            search_frame,
            text="Search",
            command=lambda: self.search_manager.search_sheet_data(
                self.search_entry.get()
            ),
        )
        search_button.pack(side="left", padx=5)

        # Reset Button
        reset_button = ttk.Button(
            search_frame,
            text="Reset",
            command=lambda: self.search_manager.reset_search(self.search_entry),
        )
        reset_button.pack(side="left", padx=5)

    def add_updateDB_button(self, parent):
        widget_frame = ttk.Frame(parent)
        widget_frame.pack(
            expand=True, fill="x", side="left", padx=(5, 5), pady=5, anchor="e"
        )

        updateOldv_button = ttk.Button(
            widget_frame,
            text="구버전 WorkMaster 로드\n(구버전 WM 적용 프로젝트를 위한 한시적 메뉴)",
            command=lambda: self.loadWMs_fromResourceDB(load_mode="old"),
            bootstyle="info-outline",
        )
        updateOldv_button.pack(side="left", padx=5)

        updateNewv_button = ttk.Button(
            widget_frame,
            text="신버전 WorkMaster 로드\n(2024.12.19 업데이트 기준)",
            command=lambda: self.loadWMs_fromResourceDB(load_mode="new"),
            bootstyle="info-outline",
        )
        updateNewv_button.pack(side="left", padx=5)

        # widget Label
        widget_label = ttk.Label(
            widget_frame,
            text="""
엑셀에서 로드:  (설치경로/resource폴더/A_04_Work_Master_AR.xlsx)     ※ wm 업데이트된 경우 좌기의 3파일을 최신으로 교체 요망
                      (설치경로/resource폴더/A_06_Work_Master_SS.xlsx)
                      (설치경로/resource폴더/A_07_Work_Master_FP.xlsx)
""".strip(),
        )
        widget_label.pack(side="left", padx=5)

    def my_a2n(self, a):
        if a != "열삽입":
            res = column_index_from_string(a) - 1
        else:
            res = a
        return res

    def replace_NoneToSpace(self, x):
        if not x:
            return ""
        elif x == "None":
            return ""
        else:
            return x

    def loadWMs_fromResourceDB(self, load_mode):
        state = self.state
        # 1. 로딩 애니 띄우기
        self.show_loading_animation()

        # 2. 백그라운드 쓰레드로 로딩 작업 시작
        threading.Thread(
            target=lambda: self._do_WM_loading(load_mode), daemon=True
        ).start()

    def _do_WM_loading(self, load_mode):
        state = self.state
        # 실제 로딩 작업
        ar_data = self.loadWMs_fromResourceDB_AR("BG", load_mode)
        ss_data = self.loadWMs_fromResourceDB_SS("AH", load_mode)
        fp_data = self.loadWMs_fromResourceDB_FP("W", load_mode)

        res_data = ar_data + ss_data + fp_data
        self.update(event=None, data=res_data)

        state.observer_manager.notify_observers(state)
        # 로딩 애니메이션 제거
        self.hide_loading_animation()

        # 완료 메시지
        messagebox.showinfo("완료", "WM 로딩이 완료되었습니다.")

    # 🔄 로딩 애니메이션 보여주기
    def show_loading_animation(self):
        state = self.state
        state.root.config(cursor="wait")

        self.loading_frame = ttk.Frame(
            state.root,
            width=1000,
            height=150,
            bootstyle="default",
            relief="solid",
            borderwidth=3,
        )
        self.loading_frame.place(relx=0.5, rely=0.5, anchor="center")
        self.loading_frame.pack_propagate(False)
        self.loading_frame.grid_propagate(False)

        self.loading_label1 = ttk.Label(
            self.loading_frame,
            text="로딩 중입니다...",
            font=("맑은 고딕", 12),
            bootstyle="default",
        )
        self.loading_label1.pack(
            fill="x", side="top", anchor="center", padx=20, pady=10
        )

        self.loading_label2 = ttk.Label(
            self.loading_frame,
            text="잠시 기다리시면 로딩 완료 확인창이 뜹니다",
            font=("맑은 고딕", 12),
            bootstyle="default",
        )
        self.loading_label2.pack(
            fill="x", side="top", anchor="center", padx=300, pady=10
        )

        self.progress = ttk.Progressbar(
            self.loading_frame, mode="indeterminate", bootstyle="info-striped"
        )
        self.progress.pack(side="bottom", padx=20, pady=10)
        self.progress.start(10)  # 10ms 간격으로 애니메이션 시작

    # 🔚 로딩 애니메이션 숨기기
    def hide_loading_animation(self):
        state = self.state
        state.root.config(cursor="arrow")
        self.progress.stop()
        self.loading_frame.destroy()

    def loadWMs_fromResourceDB_AR(self, calc_logic_col, load_mode="new"):
        src_path = "resource/A_04_Work_Master_AR.xlsx"
        ref_colIdx_a = [
            "E",  # Work Master / 14
            "F",  # 데이터사양 / (부서)
            "J",  # L01 / Code
            "K",  # L01 / Work Group
            "L",  # L02 / Code
            "M",  # L02 / Work Group
            "N",  # L03 / Code
            "O",  # L03 / Work Group
            "P",  # L04 / Code
            "Q",  # L04 / Attribute
            "R",  # L05 / Code
            "S",  # L05 / Attribute
            "T",  # L06 / Code
            "U",  # L06 / Attribute
            "Z",  # L07 / Code
            "AA",  # L07 / Attribute
            "AB",  # L08 / Code
            "AC",  # L08 / Attribute
            "AD",  # L09 / Code
            "AE",  # L09 / Attribute
            "AF",  # L10 / Code
            "AG",  # L10 / Attribute
            "AL",  # L11 / Code
            "AM",  # L11 / Attribute
            "AV",  # B01 / BOQ_Spec
            "AW",  # B02 / BOQ_Spec
            "AX",  # B03 / BOQ_Spec
            "AY",  # B04 / BOQ_Spec
            "AZ",  # B05 / BOQ_Spec
            "BA",  # B06 / BOQ_Spec
            "BB",  # B07 / BOQ_Spec
            "BC",  # B08 / BOQ_Spec
            "열삽입",  # B09 / BOQ_Spec
            "BD",  # UoM1 / UoM01
            "BE",  # UoM2 / UoM02
            "C",  # Work Group / 8
            "E",  # Work Master / 14
        ]

        ref_colIdx_n = go(
            ref_colIdx_a,
            map(lambda x: self.my_a2n(x)),
            list,
        )
        print(f"ref_colIdx_n : {ref_colIdx_n}")

        header, data = read_excel_data_with_xw(
            file_path=src_path,
            sheet_name="AR",
            header_row_index=8,
        )
        if load_mode == "old":
            filter_rule = "B"
        else:
            filter_rule = "A"

        filtered_data = go(
            data,
            filter(lambda x: not all(x)),
            filter(
                lambda x: x[column_index_from_string(calc_logic_col) - 1]
                != "BOQ_Formula"
            ),
            filter(
                lambda x: x[column_index_from_string(calc_logic_col) - 1] != filter_rule
            ),
            map(lambda x: list(map(self.replace_NoneToSpace, x))),
            list,
        )

        formated_data = []
        for row in filtered_data:
            new_row = []
            for i in ref_colIdx_n:
                if i == "열삽입":
                    new_row.append("")
                else:
                    new_row.append(row[i])
            formated_data.append(new_row)

        print(f"formated_data : {formated_data[:3]}")

        return formated_data

    def loadWMs_fromResourceDB_SS(self, calc_logic_col, load_mode="new"):
        src_path = "resource/A_06_Work_Master_SS.xlsx"
        ref_colIdx_a = [
            "E",  # Work Master / 14
            "F",  # 데이터사양 / (부서)
            "J",  # L01 / Code
            "K",  # L01 / Work Group
            "L",  # L02 / Code
            "M",  # L02 / Work Group
            "N",  # L03 / Code
            "O",  # L03 / Work Group
            "P",  # L04 / Code
            "Q",  # L04 / Attribute
            "R",  # L05 / Code
            "S",  # L05 / Attribute
            "T",  # L06 / Code
            "U",  # L06 / Attribute
            "열삽입",  # L07 / Code
            "열삽입",  # L07 / Attribute
            "열삽입",  # L08 / Code
            "열삽입",  # L08 / Attribute
            "열삽입",  # L09 / Code
            "열삽입",  # L09 / Attribute
            "열삽입",  # L10 / Code
            "열삽입",  # L10 / Attribute
            "열삽입",  # L11 / Code
            "열삽입",  # L11 / Attribute
            "V",  # B01 / BOQ_Spec
            "W",  # B02 / BOQ_Spec
            "X",  # B03 / BOQ_Spec
            "Y",  # B04 / BOQ_Spec
            "Z",  # B05 / BOQ_Spec
            "AA",  # B06 / BOQ_Spec
            "AB",  # B07 / BOQ_Spec
            "AC",  # B08 / BOQ_Spec
            "AD",  # B09 / BOQ_Spec
            "AE",  # UoM1 / UoM01
            "AF",  # UoM2 / UoM02
            "C",  # Work Group / 8
            "E",  # Work Master / 14
        ]

        ref_colIdx_n = go(
            ref_colIdx_a,
            map(lambda x: self.my_a2n(x)),
            list,
        )
        print(f"ref_colIdx_n : {ref_colIdx_n}")

        header, data = read_excel_data_with_xw(
            file_path=src_path,
            sheet_name="SS",
            header_row_index=8,
        )
        if load_mode == "old":
            filter_rule = "B"
        else:
            filter_rule = "A"

        filtered_data = go(
            data,
            filter(lambda x: not all(x)),
            filter(
                lambda x: x[column_index_from_string(calc_logic_col) - 1]
                != "BOQ_Formula"
            ),
            filter(
                lambda x: x[column_index_from_string(calc_logic_col) - 1] != filter_rule
            ),
            map(lambda x: list(map(self.replace_NoneToSpace, x))),
            list,
        )

        formated_data = []
        for row in filtered_data:
            new_row = []
            for i in ref_colIdx_n:
                if i == "열삽입":
                    new_row.append("")
                else:
                    new_row.append(row[i])
            formated_data.append(new_row)

        print(f"formated_data : {formated_data[:3]}")

        return formated_data

    def loadWMs_fromResourceDB_FP(self, calc_logic_col, load_mode="new"):
        src_path = "resource/A_07_Work_Master_FP.xlsx"
        ref_colIdx_a = [
            "E",  # Work Master / 14
            "F",  # 데이터사양 / (부서)
            "J",  # L01 / Code
            "K",  # L01 / Work Group
            "L",  # L02 / Code
            "M",  # L02 / Work Group
            "N",  # L03 / Code
            "O",  # L03 / Work Group
            "P",  # L04 / Code
            "Q",  # L04 / Attribute
            "열삽입",  # L05 / Code
            "열삽입",  # L05 / Attribute
            "열삽입",  # L06 / Code
            "열삽입",  # L06 / Attribute
            "열삽입",  # L07 / Code
            "열삽입",  # L07 / Attribute
            "열삽입",  # L08 / Code
            "열삽입",  # L08 / Attribute
            "열삽입",  # L09 / Code
            "열삽입",  # L09 / Attribute
            "열삽입",  # L10 / Code
            "열삽입",  # L10 / Attribute
            "열삽입",  # L11 / Code
            "열삽입",  # L11 / Attribute
            "R",  # B01 / BOQ_Spec
            "S",  # B02 / BOQ_Spec
            "열삽입",  # B03 / BOQ_Spec
            "열삽입",  # B04 / BOQ_Spec
            "열삽입",  # B05 / BOQ_Spec
            "열삽입",  # B06 / BOQ_Spec
            "열삽입",  # B07 / BOQ_Spec
            "열삽입",  # B08 / BOQ_Spec
            "열삽입",  # B09 / BOQ_Spec
            "T",  # UoM1 / UoM01
            "U",  # UoM2 / UoM02
            "C",  # Work Group / 8
            "E",  # Work Master / 14
        ]

        ref_colIdx_n = go(
            ref_colIdx_a,
            map(lambda x: self.my_a2n(x)),
            list,
        )
        print(f"ref_colIdx_n : {ref_colIdx_n}")

        header, data = read_excel_data_with_xw(
            file_path=src_path,
            sheet_name="FP",
            header_row_index=8,
        )
        if load_mode == "old":
            filter_rule = "B"
        else:
            filter_rule = "A"

        filtered_data = go(
            data,
            filter(lambda x: not all(x)),
            filter(
                lambda x: x[column_index_from_string(calc_logic_col) - 1]
                != "BOQ_Formula"
            ),
            filter(
                lambda x: x[column_index_from_string(calc_logic_col) - 1] != filter_rule
            ),
            map(lambda x: list(map(self.replace_NoneToSpace, x))),
            list,
        )

        formated_data = []
        for row in filtered_data:
            new_row = []
            for i in ref_colIdx_n:
                if i == "열삽입":
                    new_row.append("")
                else:
                    new_row.append(row[i])
            formated_data.append(new_row)

        print(f"formated_data : {formated_data[:3]}")

        return formated_data

    def set_title(self, parent):
        self.widget_name = "WorkMaster DB"
        title_font = tk.font.Font(family="맑은 고딕", size=12)
        title_label = ttk.Label(parent, text=self.widget_name, font=title_font)
        title_label.pack(side="left", padx=5, pady=5, anchor="w")

    def on_cell_select(self, event, state, sheet, color="#fffec0"):
        # 선택된 셀의 위치 가져오기
        selected_cells = list(sheet.get_selected_cells())
        if selected_cells:
            # 기존 스타일 초기화
            sheet.dehighlight_rows("all")

            # 선택된 행 강조 표시 (예: 노란색으로 설정)
            selected_rows = list(map(lambda x: x[0], selected_cells))
            # print(selected_rows)

            selectedWMs = []
            for row_idx in selected_rows:
                stringified_rowData = go(
                    sheet.get_row_data(row_idx),
                    map(lambda x: str(x)),
                    filter(lambda x: x != "0"),
                    filter(lambda x: x != ""),
                    filter(lambda x: x != " "),
                    filter(lambda x: x != "ㅤ"),  #  공백 특수 문자
                    lambda x: " | ".join(x),
                )
                selectedWMs.append(stringified_rowData)
            state.selectedWMs = selectedWMs
            # print(f"on_cell_select_WMsSheet: {selectedWMs}")
            sheet.highlight_rows(
                rows=selected_rows, bg=color, fg="black", highlight_index=True
            )


class ProjectApply_GWMSWM_Selcet_SheetView:
    def __init__(
        self, state, parent, relate_widget_std, related_widget_rvt, wm_mode="[ GWM ]"
    ):
        self.state = state
        self.data_kind = "project-assigntype"
        self.wm_mode = wm_mode
        self.treeDataManager = TreeDataManager_treesheet(state, self)
        self.relate_widget_std = relate_widget_std
        self.selected_item_relate_widget_std = relate_widget_std.selected_item
        self.related_widget_rvt = related_widget_rvt
        self.selected_item_relate_widget_rvt = related_widget_rvt.selected_item
        self.sheet = Sheet(
            parent,
            show_x_scrollbar=False,
            show_y_scrollbar=True,
            # width=470,
            height=350,
            # treeview=True,
        )
        self.sheet.pack(
            expand=True,
            side="left",
            fill="x",
            # fill="both",
            # padx=5,
            # pady=5,
            anchor="center",
        )

        # config enable_bindings
        self.sheet.enable_bindings(
            "edit_cell",
            # "delete",
            "single_select",  # Allow single cell selection
            "drag_select",
            "row_select",  # Allow row selection
            "column_select",  # Allow column selection
            "drag_select",  # Allow drag selection
            "column_width_resize",
            "row_height_resize",
            "double_click_column_resize",
            "copy",
            "paste",
            "ctrl_click_select",
            "right_click_popup_menu",
            # "rc_insert_row",
            # "rc_delete_row",
            "arrowkeys",
        )

        # Right Click pop up - 선택 초기화 버튼 추가
        self.sheet.popup_menu_add_command(
            label="선택상태 초기화",
            func=self.clear_selection,
        )

        # Bind checkbox clicks
        self.sheet.extra_bindings(
            [
                ("end_edit_cell", lambda e: self.on_checkbox_click(e)),
            ]
        )

        # 초기 데이터 로드 및 시트 설정
        self.setup_sheet()

    def clear_selection(self):
        self.update()
        self.sheet.redraw()

    def setup_sheet(self):
        # 헤더 설정
        if self.wm_mode == "[ GWM ]":
            headers = ["Use", "GWM", "분류", "Item", "산출유형", "수식"]
        elif self.wm_mode == "[ SWM ]":
            headers = ["Use", "SWM", "분류", "Item", "산출유형", "수식"]

        self.sheet.headers(
            headers,
        )

        # Create checkboxes in the First column
        # self.sheet.checkbox("A", checked=True)

        self.setup_column_style()
        # 초기 데이터 로드
        # self.update()

    def setup_column_style(self):
        self.sheet.set_column_widths([25, 100, 0, 150, 40, 210])
        # self.sheet.set_column_widths([25, 80, 10, 150, 40, 210])

        self.sheet["A"].align("center")
        self.sheet.set_options(header_font=("Arial Narrow", 7, "normal"))
        self.sheet.set_options(header_height="")
        self.sheet.set_options(font=("Arial", 8, "normal"))
        self.sheet.set_options(default_row_height=18)

    def get_checked(self):
        state = self.state
        res = go(
            self.sheet.get_checkboxes(),
        )
        return res

    def on_checkbox_click(self, event):
        """Callback for checkbox clicks."""
        self.state.log_widget.write(
            f"{self.__class__.__name__} > on_checkbox_click 메소드 시작"
        )
        selected_item_str = self.selected_item_relate_widget_std.get()
        project_GWM = self.state.team_std_info["project-GWM"].get(selected_item_str)

        self.state.log_widget.write(
            self.state.team_std_info["project-GWM"][selected_item_str]
        )

    def highlight_checked_row(self):
        """Update row highlights based on checkbox values."""
        checked_rows = []
        for row in range(self.sheet.get_total_rows()):
            if self.sheet.get_cell_data(row, 0):  # If checkbox is checked
                checked_rows.append(row)

        # Clear existing highlights
        self.sheet.dehighlight_all()
        self.sheet.highlight_rows(
            checked_rows, highlight_index=False, bg="#D3F9D8"
        )  # Light green

        self.sheet.redraw()

    def wrap_text(self, text, width):
        """
        Wrap text to fit within a given width, handling long words properly.
        """
        if not text or not isinstance(text, str):
            return text
        max_chars_per_line = max(1, width // 7)  # Approximate character width in pixels

        words = text.split()  # Split into words
        lines = []
        current_line = ""

        for word in words:
            while len(word) > max_chars_per_line:  # Split long words into chunks
                lines.append(word[:max_chars_per_line])
                word = word[max_chars_per_line:]

            if len(current_line) + len(word) + 1 > max_chars_per_line:
                lines.append(current_line)
                current_line = word
            else:
                current_line = f"{current_line} {word}".strip()

        if current_line:
            lines.append(current_line)

        return "\n".join(lines)

    def apply_wrap(self, tgt_idx, tgt_width=None):
        """
        Apply wrapping to all cells based on their column widths.
        """
        wrapped_data = []
        # for row_index, row in enumerate(self.sheet.get_sheet_data()):
        for row_index, row in enumerate(self.sheet.get_sheet_data()):
            wrapped_row = []
            for col_index, cell in enumerate(row):
                if col_index == tgt_idx:
                    if tgt_width:
                        width = tgt_width
                    else:
                        width = self.sheet.column_width(col_index)
                    wrapped_row.append(self.wrap_text(cell, width))
                else:
                    wrapped_row.append(cell)
            wrapped_data.append(wrapped_row)

        self.sheet.set_sheet_data(wrapped_data)

    def update(self, event=None):
        state = self.state
        """Update the TreeView whenever the state changes."""
        self.state.log_widget.write(f"{self.__class__.__name__} > update 메소드 시작")
        self.state.log_widget.write(
            f"선택아이템 출력 : {self.selected_item_relate_widget_std.get()}"
        )
        self.setup_column_style()

        try:
            # Split the selected item path to find the grandparent, parent, and selected item names
            grand_parent_item_name, parent_item_name, selected_item_name = (
                self.selected_item_relate_widget_std.get().split(" | ")
            )

            # Ensure the data kind exists in the team standard information
            if "std-familylist" in state.team_std_info:
                data = state.team_std_info["std-familylist"]["children"]

                # Find the grandparent node
                grand_parent_node = next(
                    (node for node in data if node["name"] == grand_parent_item_name),
                    None,
                )
                if grand_parent_node:
                    # Find the parent node
                    parent_node = next(
                        (
                            node
                            for node in grand_parent_node["children"]
                            if node["name"] == parent_item_name
                        ),
                        None,
                    )
                    if parent_node:
                        # Find the selected node
                        selected_node = next(
                            (
                                node
                                for node in parent_node["children"]
                                if node["name"] == selected_item_name
                            ),
                            None,
                        )
                        if selected_node:
                            calc_no = selected_node["values"][-1]
                            # Clear the TreeView and insert the data for the selected node
                            for idx, row_span in enumerate(self.sheet):
                                self.sheet.delete_cell_checkbox("all", "all")
                            self.sheet.set_sheet_data([])
                            # Wrap the children of the selected node for insertion
                            # wrapped_data = []
                            pool = go(
                                # deepcopy,
                                selected_node["children"],
                                filter(lambda x: x["values"][5] == self.wm_mode),
                                lambda x: sorted(x, key=lambda x: x["name"]),
                                list,
                            )
                            # print(f"풀::{pool}")
                            wrapped_data_ = go(
                                pool,
                                map(lambda x: ["", x["name"], calc_no]),
                                list,
                            )

                            def find_formula_forWMsMenu(data):
                                try:
                                    if data["values"][6] != "":
                                        res = [data["name"], data["values"][6]]
                                    else:
                                        res = [data["name"], "# 수식 확인 !!"]
                                except:
                                    res = [data["name"], "# 수식 확인 !!"]
                                return res

                            dropdowns = go(
                                pool,
                                map(lambda x: x["children"]),
                                map(
                                    lambda x: list(
                                        map(lambda y: find_formula_forWMsMenu(y), x)
                                    )
                                ),
                                list,
                            )
                            print(f"dropdowns::{dropdowns}")

                            wrapped_data = []
                            # bunch = []
                            for idx, row in enumerate(wrapped_data_):
                                wrapped_data.append(row)
                                sub_rows = dropdowns[idx]
                                # sub_rows = sorted(dropdowns[idx])
                                # for sub_row in sub_rows:
                                for sub_row in sorted(sub_rows):
                                    sub_row.insert(1, row[-1])
                                    wrapped_data.append(["", "", row[1], *sub_row])

                            self.sheet.set_sheet_data(wrapped_data)

                            # wrapped_data_sorted = sorted(wrapped_data)
                            # self.sheet.set_sheet_data(wrapped_data_sorted)

                            for idx, row_span in enumerate(self.sheet):
                                if row_span[1] != "" or None:
                                    if self.wm_mode == "[ GWM ]":
                                        self.sheet.create_checkbox(
                                            r=idx, c=0, checked=True
                                        )
                                else:
                                    if self.wm_mode == "[ SWM ]":
                                        self.sheet.create_checkbox(r=idx, c=0)

                            selected_item_str = (
                                self.selected_item_relate_widget_std.get()
                            )

                        else:
                            self.state.log_widget.write(
                                f"Selected item '{selected_item_name}' not found."
                            )
                    else:
                        self.state.log_widget.write(
                            f"Parent item '{parent_item_name}' not found."
                        )
                else:
                    self.state.log_widget.write(
                        f"Grandparent item '{grand_parent_item_name}' not found."
                    )

        except Exception as e:
            self.state.log_widget.write(
                f"{self.__class__.__name__} > update 메소드 진입 안됩니다~: {e}"
            )

        self.setup_column_style()
        self.highlight_checked_row()

        self.state.log_widget.write(f"{self.__class__.__name__} > update 메소드 종료")

    def set_edit_mode(self, mode):
        # 편집 모드 설정
        if mode == "edit":
            self.sheet.enable_bindings()
        else:
            self.sheet.disable_bindings()


class Project_WM_perRVT_SheetView:
    def __init__(
        self,
        state,
        parent,
        typeAssign_treeview,
        *args,
        **kwargs,
    ):
        self.state = state
        self.kwargs = kwargs
        self.data_kind = "project-assigntype"
        self.treeDataManager = TreeDataManager_treesheet(state, self)
        self.state_observer = StateObserver(state, lambda e: self.update(e))

        self.typeAssign_treeview = typeAssign_treeview
        if kwargs.get("height"):
            self.sheet = Sheet(
                parent,
                show_x_scrollbar=True,
                show_y_scrollbar=True,
                width=1200,
                height=kwargs.get("height"),
            )
        else:
            self.sheet = Sheet(
                parent,
                show_x_scrollbar=True,
                show_y_scrollbar=True,
                # width=1200,
                # height=350,
            )
        self.sheet.pack(
            expand=True,
            side="top",
            # fill="none",
            fill="both",
            # padx=5,
            # pady=5,
            anchor="nw",
        )

        # config enable_bindings
        self.sheet.enable_bindings(
            "undo",
            "edit_cell",
            "delete",
            "select_all",
            "single_select",  # Allow single cell selection
            "drag_select",
            "row_select",  # Allow row selection
            "column_select",  # Allow column selection
            "drag_select",  # Allow drag selection
            "column_width_resize",
            "row_height_resize",
            "double_click_column_resize",
            "copy",
            "paste",
            "ctrl_click_select",
            "right_click_popup_menu",
            "rc_insert_row",
            "rc_delete_row",
            "arrowkeys",
            "row_drag_and_drop",
        )
        # self.sheet.enable_bindings()

        # Bind checkbox clicks
        self.sheet.extra_bindings(
            [
                ("delete", lambda e: self.on_change_sheet(e)),
                ("end_edit_cell", lambda e: self.on_change_sheet(e)),
                ("end_delete_rows", lambda e: self.update_typeAssign(e)),
                ("end_move_rows", lambda e: self.on_change_sheet(e)),
                ("end_ctrl_v", lambda e: self.on_change_sheet(e)),
                ("rc_insert_row", lambda e: self.handle_row_insert(e)),
                ## 신규행 추가시 (std)SWM > MISC > All Items > All WM 항목 추가할수 있는 함수 바인딩 필요
            ]
        )

        # 초기 데이터 로드 및 시트 설정
        self.setup_sheet()
        self.rollback_sheet_height()
        # self.setup_column_style()

    def handle_row_insert(self, event):
        """Handle the End_Insert_row event to add 'etc' in the first column of the new row."""
        print("handle_row_insert 시작")
        print(event)
        newly_added_row = list(event["added"]["rows"]["table"].keys())[
            0
        ]  # Get the index of the newly added row
        # print(event)
        print(newly_added_row)

        pjt_assign_famlist_tree = self.state.pjt_assign_famlist.tree
        # print(f"pjt_assign_famlist_tree: {pjt_assign_famlist_tree}")
        selected_std_id = pjt_assign_famlist_tree.selection()
        # print(f"selected_std_id: {selected_std_id}")
        selected_std_name = pjt_assign_famlist_tree.item(selected_std_id, "values")[3]

        seleceted_std_calctype = pjt_assign_famlist_tree.item(
            selected_std_id, "values"
        )[8]

        print(pjt_assign_famlist_tree.item(selected_std_id, "values"))
        print(f"selected_std_name: {selected_std_name}")

        if newly_added_row is not None:
            self.sheet.set_row_data(
                newly_added_row,
                (
                    "etc",
                    selected_std_name,
                    f"Tmp-Grp | Tmp-Item",
                    "",
                    "",
                    "",
                    "",
                    "",
                    seleceted_std_calctype,
                ),
                redraw=True,
            )
            self.sheet.refresh()  # Refresh the sheet to reflect changes

    def setup_sheet(self):
        # 헤더 설정

        ## Note 칼럼 추가 예정
        headers = [
            "분류",
            "Std",
            "Item",
            "Work Master",
            "Gauge",
            "Spec",
            "수식",
            "단위",
            "산출유형",
            "Note",
        ]

        self.sheet.headers(
            headers,
        )
        self.setup_column_style()

        self.sheet.set_sheet_data([])
        # 초기 데이터 로드
        # self.update()

    def rollback_sheet_height(self):
        self.sheet.config(
            # height=350,
            height=380,
        )
        self.sheet.update_idletasks()
        self.sheet.update()
        print(f"\n 시트크기 복원 \n")

        self.sheet.pack(expand=True, fill="both")
        self.sheet.update()

    def renew_sheet_height(self):
        self.sheet.config(
            # height=750,
            height=785,
        )
        self.sheet.update_idletasks()
        self.sheet.update()
        print(f"\n 시트크기 확장 \n")

        # self.sheet.pack(expand=True, fill="both")
        # self.sheet.update()

    def setup_column_style(self):
        self.sheet.set_column_widths(
            [
                35,
                1,
                125,
                300,
                30,
                250,
                170,
                35,
                35,
                200,
            ]
        )

        # self.sheet["A"].align("center")
        self.sheet.set_options(header_font=("Arial Narrow", 7, "normal"))
        self.sheet.set_options(header_height="")
        self.sheet.set_options(font=("Arial", 8, "normal"))
        # self.sheet.set_options(default_row_height=18)
        self.sheet.set_options(default_row_height=80)
        self.sheet["E"].align("center")

        self.sheet.set_options(table_grid_fg="#b5b5b5")
        self.sheet["A"].highlight(bg="#e6e6e6", fg="black")
        self.sheet["B"].highlight(bg="#e6e6e6", fg="black")
        self.sheet["C"].highlight(bg="#e6e6e6", fg="black")
        self.sheet["D"].highlight(bg="#e6e6e6", fg="black")
        self.sheet["E"].highlight(bg="#e6e6e6", fg="black")
        self.sheet["F"].highlight(bg="#e6e6e6", fg="black")
        self.sheet["H"].highlight(bg="#e6e6e6", fg="black")
        self.sheet["G"].highlight(bg="white", fg="blue")
        self.sheet["I"].highlight(bg="white", fg="blue")
        self.sheet["J"].highlight(bg="white", fg="blue")

    def update(self, event=None):
        state = self.state
        # data = state.team_std_info.get("project-assigntype")
        data = state.team_std_info.get("project-assigntype")
        self.state.log_widget.write(f"{self.__class__.__name__} > update 메소드 시작")

        self.sheet.set_sheet_data([])
        self.setup_column_style()

        pjt_gwm_data = state.team_std_info.get("project-GWM")
        pjt_swm_data = state.team_std_info.get("project-SWM")
        WMs = state.team_std_info.get("WMs")
        WMsStr = go(
            WMs,
            map(lambda x: list(map(str, x))),
            map(lambda x: filter(lambda x: x != "0", x)),
            map(lambda x: filter(lambda x: x != "", x)),
            map(lambda x: filter(lambda x: x != " ", x)),
            map(lambda x: filter(lambda x: x != "ㅤ", x)),  #  공백 특수 문자
            map(lambda x: " | ".join(x)),
            list,
        )

        def find_matched_pjtGWM(name):
            res = go(
                pjt_gwm_data.keys(),
                list,
                # filter(lambda x: name in x),
                filter(lambda x: x.endswith(name)),
                list,
            )
            try:
                return res[0]
            except:
                return ""

        def find_matched_pjtSWM(name):
            res = go(
                pjt_swm_data.keys(),
                list,
                # filter(lambda x: name in x),
                filter(lambda x: x.endswith(name)),
                list,
            )
            try:
                return res[0]
            except:
                return ""

        def find_wmStr(wmcode):
            if wmcode == "":
                return ""
            else:
                wmcode_ = wmcode.split("|")[0].strip()
                res = go(
                    WMsStr,
                    filter(lambda x: wmcode_ in x),
                    list,
                )
            try:
                return res[0]
            except:
                return ""

        current_building = state.current_building
        selected_rvtTypes_ids = self.typeAssign_treeview.treeview.tree.selection()
        selected_rvtTypes_names = go(
            selected_rvtTypes_ids,
            map(lambda x: self.typeAssign_treeview.treeview.tree.item(x, "text")),
            list,
        )
        try:
            selected_rvtTypes_name = selected_rvtTypes_names[0]
        except:
            selected_rvtTypes_name = ""

        selected_rvtTypes_values = go(
            selected_rvtTypes_ids,
            map(lambda x: self.typeAssign_treeview.treeview.tree.item(x, "values")),
            list,
        )

        if data:
            try:
                target_data = go(
                    data["children"],
                    # deepcopy,
                    filter(lambda x: x["values"][1] == current_building.get()),
                    filter(lambda x: x["name"] == selected_rvtTypes_name),
                    next,
                    lambda x: x["children"],
                )

                for wm in target_data:
                    # wm = deepcopy(_wm)
                    if wm[0] == "GWM":
                        matched_item = find_matched_pjtGWM(wm[2])
                        wm[3] = find_wmStr(
                            pjt_gwm_data.get(matched_item, ["", "", "", ""])[0]
                        )
                        wm[4] = pjt_gwm_data.get(matched_item, ["", "", "", ""])[1]
                        wm[5] = pjt_gwm_data.get(matched_item, ["", "", "", ""])[3]
                        wm[7] = pjt_gwm_data.get(matched_item, ["", "", "", ""])[2]
                    elif wm[0] == "SWM":
                        matched_item = find_matched_pjtSWM(wm[2])
                        wm[3] = find_wmStr(
                            pjt_swm_data.get(matched_item, ["", "", "", ""])[0]
                        )
                        wm[4] = pjt_swm_data.get(matched_item, ["", "", "", ""])[1]
                        wm[5] = pjt_swm_data.get(matched_item, ["", "", "", ""])[3]
                        wm[7] = pjt_swm_data.get(matched_item, ["", "", "", ""])[2]
                    elif wm[0] == "etc":
                        matched_item = ""
                        wm[3] = find_wmStr(wm[3])
                        # wm[7] = deepcopy(wm[3]).replace("\n", "").split("|")[-3].strip()
                    # else:
                    #     matched_item = ""
                    print(f"\n matched_item::: {matched_item} \n")

                self.sheet.set_sheet_data(target_data)
                self.setup_column_style()
                self.apply_wrap(
                    tgt_idx=3,
                    # tgt_width=600,
                )
                # self.sheet.set_all_cell_sizes_to_text()
                self.sheet.set_all_row_heights(
                    height=70,
                    only_set_if_too_small=True,
                )
            except:
                state.log_widget.write(f"\n유효한 target_data 없음\n")

        self.setup_column_style()
        self.state.log_widget.write(f"{self.__class__.__name__} > update 메소드 종료")

    def wrap_text(self, text, width):
        """
        Wrap text to fit within a given width, handling long words properly.
        """
        if not text or not isinstance(text, str):
            return text
        max_chars_per_line = max(1, width // 7)  # Approximate character width in pixels

        words = text.split()  # Split into words
        lines = []
        current_line = ""

        for word in words:
            while len(word) > max_chars_per_line:  # Split long words into chunks
                lines.append(word[:max_chars_per_line])
                word = word[max_chars_per_line:]

            if len(current_line) + len(word) + 1 > max_chars_per_line:
                lines.append(current_line)
                current_line = word
            else:
                current_line = f"{current_line} {word}".strip()

        if current_line:
            lines.append(current_line)

        return "\n".join(lines)

    def apply_wrap(self, tgt_idx, tgt_width=None):
        """
        Apply wrapping to all cells based on their column widths.
        """
        wrapped_data = []
        for row_index, row in enumerate(self.sheet.get_sheet_data()):
            wrapped_row = []
            for col_index, cell in enumerate(row):
                if col_index == tgt_idx:
                    if tgt_width:
                        width = tgt_width
                    else:
                        width = self.sheet.column_width(col_index)
                    wrapped_row.append(self.wrap_text(cell, width))
                else:
                    wrapped_row.append(cell)
            wrapped_data.append(wrapped_row)

        self.sheet.set_sheet_data(wrapped_data)

    def update_typeAssign(self, e=None):
        self.on_change_sheet(e)

        self.state.typeAssign_treeview.update()

    def on_change_sheet(self, e=None):
        state = self.state
        print(f"점검!1")
        data = state.team_std_info.get("project-assigntype")
        selected_rvtTypes_ids = self.typeAssign_treeview.treeview.tree.selection()
        selected_rvtTypes_values = go(
            selected_rvtTypes_ids,
            map(lambda x: self.typeAssign_treeview.treeview.tree.item(x, "values")),
            list,
        )
        print(f"점검!2")
        match_assigntype = lambda selected_rvtTypes_value: go(
            data["children"],
            filter(lambda x: x["values"][0] == selected_rvtTypes_value[0]),
            filter(lambda x: x["values"][1] == selected_rvtTypes_value[1]),
            filter(lambda x: x["values"][2] == selected_rvtTypes_value[2]),
            list,
            lambda x: x[0],
        )
        print(f"점검!3{self.sheet.get_sheet_data()}")
        sheet_data = go(
            self.sheet.get_sheet_data(),
            # map(lambda x: [*x[:3], x[3].replace("\n", ""), *x[4:]]),
            map(
                lambda x: [
                    x[0],
                    x[1],
                    x[2],
                    x[3].replace("\n", ""),
                    x[4],
                    x[5],
                    x[6],
                    x[7].strip(),
                    x[8].strip(),
                    x[9] if len(x) == 10 else "",
                ]
            ),
            list,
        )
        print(f"점검!{sheet_data}")

        # Get the full path of the selected item
        for selected_rvtTypes_value in selected_rvtTypes_values:
            matched_assigntype = match_assigntype(selected_rvtTypes_value)
            # print(f"\n matched_assigntype:: {matched_assigntype}\n")

            new_WM_data = sheet_data
            matched_assigntype["children"] = []
            matched_assigntype["children"].extend(new_WM_data)

        ## project_WM_perRVT_SheetView 업데이트
        # state.project_WM_perRVT_SheetView.update()
        self.update()
