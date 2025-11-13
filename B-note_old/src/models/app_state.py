# src/models/app_state.py
import hashlib
import json
import re
import multiprocessing as mp

# import threading
# from tkinter import messagebox, simpledialog
import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from src.controllers.tree_data_navigator import TreeDataManager_treeview
from src.core.fp_utils import *
from src.models.observer_manager import ObserverManager


import tkinter as tk

from src.views.widget.treeview_utils import DefaultTreeViewStyleManager
from src.views.widget.widget import open_dialog


class AppState:
    def __init__(self, log_widget):
        # self._state = {}  ## 필요 없으면 나중에 삭제
        self.current_filepath = None
        self.global_font = "resource/RIDIBatang.otf"
        self.observer_manager = ObserverManager()
        self.notify_targets = []
        self.DefaultTreeViewStyleManager = DefaultTreeViewStyleManager
        self._rowheight = tk.IntVar()
        self._rowheight.set(30)
        # self.treeDataManager = TreeDataManager(self, related_widget)

        self.current_tab = None
        self.previous_tab = None  # Track the previous tab
        self.config = None

        self.selectedWMs = []
        self.selectedGWMitems = []
        self.selected_matchedWMs = []
        self.current_building = tk.StringVar()
        self.current_building.set("건물을 선택하세요")
        self.selected_GWMSWM = None
        self.selected_rvtTypes = tk.StringVar()
        self.selected_rvtTypes_forLabel = tk.StringVar()

        self.switch_widget_status = tk.StringVar()
        self.suggest_area_open_status = True
        self.rvt_wm_isShort = True

        self.wm_group_data = {}
        self.lock_status = {}
        self.log_widget = log_widget
        self.clipboard_data = None  # 추가: 클립보드 데이터를 저장하는 필드

        self.team_std_info = {}
        # self.project_std_info = {}
        # self.project_apply_info = {}
        self.undo_stack = []

        self.init_db_hash = "not loaded yet"
        self.quit_response = None

    def _notify_selected_change(self, *args, targets=None):
        pass
        for noti_tgt in self.notify_targets:
            try:
                noti_tgt.update(self)
            except:
                pass

    def get_db_hash(self):
        db_data = self.team_std_info  # DB 데이터를 딕셔너리로 가져옴
        json_str = json.dumps(db_data, sort_keys=True)  # JSON 변환 (정렬)
        return hashlib.md5(json_str.encode()).hexdigest()  # 해시값 반환

    ################### 옵저버 관련 #################################

    # 통합 상태 업데이트 함수
    ## 시트별 상태 업데이트 함수 - SGWM 시트의 내용을 state의 team_std_info에 업데이트

    def updateDB_total_data(self, data_kind, new_data):
        self.log_widget.write(f"update_{data_kind}_start\n")

        self.team_std_info.update({data_kind: new_data})

        self.log_widget.write(f"update_{data_kind}_data_end\n")

    def update_team_standard_info(self, new_data, data_kind=None):

        new_target_data = new_data.get(data_kind)
        self.updateDB_total_data(data_kind, new_target_data)

        # 상태가 업데이트되었을 때 모든 관찰자에게 알림을 보냄
        self.observer_manager.notify_observers(self)

    # state 데이터 업데이트 함수들
    def match_wms_to_stdType(self, related_widget):
        print("match_wms_to_stdType_시작")
        data_kind = related_widget.data_kind
        selected_wms = go(
            self.selectedWMs,
            sorted,
            list,
        )
        print(f"selected_wms:::!!!{selected_wms}")
        related_widget.selected_item.get().split(" | ")
        grand_parent_item_name, parent_item_name, selected_item_name = (
            related_widget.selected_item.get().split(" | ")
        )

        # Use TreeDataNavigator to remove matched WMs
        treeDataManager = TreeDataManager_treeview(self, related_widget)
        treeDataManager.match_wms_to_stdType(
            data_kind,
            grand_parent_item_name,
            parent_item_name,
            selected_item_name,
            selected_wms,
        )

        print("match_wms_to_stdType_종료")

    def dematch_matchedWMs_to_stdType(self, related_widget):
        print("dematch_matchedWMs_to_stdType_시작")

        data_kind = related_widget.data_kind
        selected_matchedWMs = self.selected_matchedWMs

        # Split the selected item to get grandparent, parent, and selected item names
        grand_parent_item_name, parent_item_name, selected_item_name = (
            related_widget.selected_item.get().split(" | ")
        )

        # Use TreeDataNavigator to remove matched WMs
        navigator = TreeDataManager_treeview(self, related_widget)
        navigator.remove_matched_wms(
            data_kind,
            grand_parent_item_name,
            parent_item_name,
            selected_item_name,
            selected_matchedWMs,
        )

        print("dematch_matchedWMs_to_stdType_종료")

    def add_GWM_to_stdFam(self, item):
        pass

    def match_GWM_to_stdFam(self, related_widget):
        print("match_wms_to_stdType_시작")
        data_kind = related_widget.data_kind
        print(f"data_kind:::::{data_kind}")
        selectedGWMitems = go(
            self.selectedGWMitems,
            sorted,
            list,
        )
        print(f"{self.selected_GWMSWM}")

        def find_idxNotSpace(strlist):
            idx = 0
            for idx_, str_ in enumerate(strlist):
                if str_ != "":
                    idx = idx_

            return idx

        GWMSWM_lvIdx = find_idxNotSpace(self.selected_GWMSWM)

        # print(f"!!!match_GWM_to_stdFam: {selectedGWMitems}")
        print(f"!!!GWMSWM_lvIdx: {GWMSWM_lvIdx}")

        grandparent_item_name, parent_item_name, selected_item_name = (
            related_widget.selected_item.get().split(" | ")
        )
        print(f'related_widget:: {related_widget.selected_item.get().split(" | ")}')

        # Use TreeDataNavigator to remove matched WMs
        treeDataManager = TreeDataManager_treeview(self, related_widget)
        pattern = r"^\d+\.\d+$"
        if GWMSWM_lvIdx == 0:
            open_dialog(
                self,
                "< 유효하지 않은 레벨 선택 >\n\n좌측 영역에서 G-WM/S-WM 이나\nItem 항목을 선택해 주세요.",
            )
        elif GWMSWM_lvIdx == 1:
            if grandparent_item_name == "Top":
                treeDataManager.match_GWMitems_to_stdFam(
                    data_kind,
                    grandparent_item_name,
                    parent_item_name,
                    selected_item_name,
                    selectedGWMitems,
                )
            else:
                open_dialog(
                    self,
                    "< 유효하지 않은 레벨 선택 >\n\n중앙 영역에서 Family Name 항목을 선택해 주세요.",
                )
        elif GWMSWM_lvIdx == 2:
            if re.match(pattern, parent_item_name):
                treeDataManager.match_GWMitems_to_stdFam(
                    data_kind,
                    grandparent_item_name,
                    parent_item_name,
                    selected_item_name,
                    selectedGWMitems,
                )
            else:
                open_dialog(
                    self,
                    "< 유효하지 않은 레벨 선택 >\n\n중앙 영역에서 GWM/SWM 항목을 선택해 주세요.",
                )

        print("match_wms_to_stdType_종료")
