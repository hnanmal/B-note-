import re
import tkinter as tk
from ttkbootstrap import ttk
from tksheet import Sheet

from src.core.fp_utils import *
from src.views.widget.widget import StateObserver
from src.controllers.tree_data_navigator import TreeDataManager_treeview


class ProjectStdDashboard:
    def __init__(self, state, parent, *args, **kwargs):
        self.state = state  # Reference to the application state
        self.frame = ttk.Frame(parent)
        # self.data_kind = "project-stdDash"
        self.init_ui()

    def init_ui(self):
        """Initialize the user interface for project std dashboard."""
        self.frame.config(width=600)
        self.frame.pack(side=tk.TOP, anchor="nw")

        ttk.Label(
            self.frame,
            text="Project GWM status:",
            font=("Arial", 16),
        ).pack(pady=10)

        gwm_stat = Sheet(
            self.frame,
            show_x_scrollbar=True,
            show_y_scrollbar=True,
            # headers=True,
        )
        gwm_stat.set_sheet_data(
            [
                ["지정완료 항목", 1],
                ["지정미완료 항목", 16],
                ["미사용 항목", 5],
            ]
        )
        gwm_stat.pack()

        ttk.Label(
            self.frame,
            text="Project SWM status:",
            font=("Arial", 16),
        ).pack(pady=10)

        swm_stat = Sheet(
            self.frame,
            show_x_scrollbar=True,
            show_y_scrollbar=True,
            # headers=True,
        )
        swm_stat.set_sheet_data(
            [
                ["지정완료 항목", 4],
                ["지정미완료 항목", 16],
                ["미사용 항목", 7],
            ]
        )
        swm_stat.pack()


class ProjectInfoWidget:
    # class ProjectInfoWidget(ttk.Frame):
    def __init__(self, state, parent, *args, **kwargs):
        # super().__init__(parent, *args, **kwargs)

        self.state = state  # Reference to the application state
        self.frame = ttk.Frame(parent)
        self.data_kind = "project-info"
        self.init_ui()
        self.state_observer = StateObserver(state, lambda e: self.update(e))
        self.data_manager = TreeDataManager_treeview(state)
        self.update()  # Load data from state during initialization

    def init_ui(self):
        """Initialize the user interface for project info input."""
        self.frame.config(width=600)
        self.frame.pack(side=tk.TOP, anchor="center")

        # Project Name
        ttk.Label(self.frame, text="Project Name:", font=("Arial", 16)).pack(pady=10)
        self.pjtName_entry = ttk.Entry(self.frame, font=("Arial", 16), bootstyle="info")
        self.pjtName_entry.pack(pady=10, padx=20, fill=tk.X)

        # Project Abbreviation
        ttk.Label(self.frame, text="Project Abbreviation:", font=("Arial", 16)).pack(
            pady=10
        )
        self.pjtAbrbr_entry = ttk.Entry(
            self.frame, font=("Arial", 16), bootstyle="info"
        )
        self.pjtAbrbr_entry.pack(pady=10, padx=20, fill=tk.X)

        # Project Type
        ttk.Label(self.frame, text="Project Type:", font=("Arial", 16)).pack(pady=10)
        self.pjtType_combobox = ttk.Combobox(
            self.frame,
            bootstyle="info",
            values=["입찰", "실행"],
            font=("Arial", 16),
        )
        self.pjtType_combobox.pack(pady=10, padx=20, fill=tk.X)

        # Update button to store changes in state
        self.update_button = ttk.Button(
            self.frame,
            text="BNOTE에 프로젝트 이름 등록",
            bootstyle="success",
            command=self.modify_state,
        )
        self.update_button.pack(pady=20)

    def modify_state(self):
        """Update state with the current input values."""
        old_abbr = self.state.team_std_info["project-info"]["abbr"]
        new_name = self.pjtName_entry.get()
        new_abbr = self.pjtAbrbr_entry.get()
        new_type = self.pjtType_combobox.get()

        self.state.team_std_info[self.data_kind] = {
            "name": new_name,
            "abbr": new_abbr,
            "type": new_type,
        }

        std_GWMs = self.state.team_std_info.get("std-GWM")["children"]
        std_SWMs = self.state.team_std_info.get("std-SWM")["children"]
        pjt_GWMs = self.state.team_std_info.get("project-GWM")
        pjt_SWMs = self.state.team_std_info.get("project-SWM")
        std_famlist = self.state.team_std_info.get("std-familylist")["children"]
        pjt_assign = self.state.team_std_info.get("project-assigntype")["children"]

        self.update_bracketed_value_in_tree(std_GWMs, old_abbr, new_value=new_abbr)
        self.update_bracketed_value_in_tree(std_SWMs, old_abbr, new_value=new_abbr)
        self.update_bracketed_value_in_tree(pjt_GWMs, old_abbr, new_value=new_abbr)
        self.update_bracketed_value_in_tree(pjt_SWMs, old_abbr, new_value=new_abbr)
        self.update_bracketed_value_in_tree(std_famlist, old_abbr, new_value=new_abbr)
        self.update_bracketed_value_in_pjt_assign(
            pjt_assign, old_abbr, new_value=new_abbr
        )

        self.state.observer_manager.notify_observers(self.state)

    def replace_bracketed_value(self, text, old_value, new_value):
        """
        ::[old_value]와 정확히 일치하는 부분만 ::[new_value]로 변경
        """
        pattern = re.escape(f"::[{old_value}]")
        return re.sub(pattern, f"::[{new_value}]", text)

    def update_bracketed_value_in_pjt_assign(self, data, old_value, new_value):
        # 먼저 항목에 ::[old_value]가 포함된 항목을 찾아냄
        for item in data:
            if item.get("children"):
                for asgn_item in item["children"]:
                    if old_value in asgn_item[2]:
                        try:
                            asgn_item[2] = self.replace_bracketed_value(
                                asgn_item[2], old_value, new_value
                            )
                        except:
                            pass

    def update_bracketed_value_in_tree(self, data, old_value, new_value):
        """
        트리 구조 전체를 순회하며 ::[old_value] 형식의 값을 가진 name, values, dict의 key를 찾아
        ::[new_value]로 대체한다.
        """
        if isinstance(data, dict):
            keys_to_update = []

            # 먼저 키에 ::[old_value]가 포함된 항목을 찾아냄
            for key in list(data.keys()):
                value = data[key]

                # 키가 문자열이고 패턴이 포함된 경우
                if isinstance(key, str) and f"::[{old_value}]" in key:
                    new_key = self.replace_bracketed_value(key, old_value, new_value)
                    keys_to_update.append((key, new_key, value))
                else:
                    # 값이 또 트리면 재귀 호출
                    self.update_bracketed_value_in_tree(value, old_value, new_value)

            # 키 업데이트 (기존 키 제거 후 새 키 추가)
            for old_key, new_key, value in keys_to_update:
                del data[old_key]
                data[new_key] = value
                self.update_bracketed_value_in_tree(data[new_key], old_value, new_value)

            # 추가로 기존 구조대로 name, values, children 처리
            if "name" in data and isinstance(data["name"], str):
                data["name"] = self.replace_bracketed_value(
                    data["name"], old_value, new_value
                )

            if "values" in data and isinstance(data["values"], list):
                data["values"] = [
                    (
                        self.replace_bracketed_value(v, old_value, new_value)
                        if isinstance(v, str)
                        else v
                    )
                    for v in data["values"]
                ]

            if "children" in data:
                self.update_bracketed_value_in_tree(
                    data["children"], old_value, new_value
                )

        elif isinstance(data, list):
            for node in data:
                self.update_bracketed_value_in_tree(node, old_value, new_value)

    def update(self, event=None):
        """Load data from the state into the input fields."""
        project_info = self.state.team_std_info.get(self.data_kind, {})
        self.state.log_widget.write(str(project_info))

        self.pjtName_entry.delete(0, tk.END)
        self.pjtName_entry.insert(0, project_info.get("name", ""))

        self.pjtAbrbr_entry.delete(0, tk.END)
        self.pjtAbrbr_entry.insert(0, project_info.get("abbr", ""))

        self.pjtType_combobox.set(project_info.get("type", ""))
