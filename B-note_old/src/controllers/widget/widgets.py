# src/controllers/widget

import tkinter as tk
from tkinter import messagebox
from src.core.fp_utils import *
from src.views.widget.treeview_utils import DefaultTreeViewStyleManager


class EditModeManager:
    def __init__(self):
        # self.state = state
        self.widgets = {}

    def register_widgets(self, **widgets):
        """
        Register widgets to be controlled by EditModeManager.
        """
        self.widgets.update(widgets)
        print(f"register_widgets : {self.widgets}")

    def set_edit_mode(self, mode):
        """
        Set the edit mode of all registered widgets.
        """
        if mode == "edit":
            self.enable_editing()
        elif mode == "locked":
            self.disable_editing()

    def enable_editing(self):
        # Update button label if available
        if "mode_button" in self.widgets:
            self.widgets["mode_button"].config(text="Edit Mode")

        # Enable TreeView editing
        for tree_widget in self.widgets.get("tree_views", []):
            DefaultTreeViewStyleManager.apply_style(tree_widget.treeview.tree)
            tree_widget.treeviewEditor.enable_edit()
            if hasattr(tree_widget, "context_menu"):
                print(f"{tree_widget}:::락스테이터스 있음")
                tree_widget.context_menu.set_locked_status(False)
            else:
                print("락스테이터스 없음")

        # Enable Btn
        for btn_widget in self.widgets.get("tree_ctrl_btn", []):
            btn_widget.config(state="normal")

        # Enable Sheet editing
        sheet_widget = self.widgets.get("sheet")
        if sheet_widget:
            sheet_widget.sheetview.sheet.enable_bindings(
                "edit_cell", "delete", "insert_row", "delete_row", "copy", "paste"
            )

    def disable_editing(self):
        # Update button label if available
        if "mode_button" in self.widgets:
            self.widgets["mode_button"].config(text="Locked Mode")

        # Disable TreeViewContextMenu

        # Disable TreeView editing
        for tree_widget in self.widgets.get("tree_views", []):
            DefaultTreeViewStyleManager.apply_locked_style(tree_widget.treeview.tree)
            tree_widget.treeviewEditor.disable_edit()
            if hasattr(tree_widget, "context_menu"):
                print(f"{tree_widget}:::락스테이터스 있음")
                tree_widget.context_menu.set_locked_status(True)
            else:
                print("락스테이터스 없음")

        # Disable Btn
        for btn_widget in self.widgets.get("tree_ctrl_btn", []):
            btn_widget.config(state="disabled")

        # Disable Sheet editing
        sheet_widget = self.widgets.get("sheet")
        if sheet_widget:
            sheet_widget.sheetview.sheet.disable_bindings(
                "edit_cell", "delete", "insert_row", "delete_row", "paste"
            )

    def start_treeview_edit(self, tree, event):
        """
        Example function to start editing a TreeView item.
        """
        item_id = tree.focus()
        if item_id:
            # Implement your editing logic here (e.g., open an entry widget for editing)
            print(f"Editing item: {tree.item(item_id, 'values')}")


def handle_add_button_press(state, related_widget=None, other_widget=None):
    print("handle_add_button_press_시작")

    data_kind = related_widget.data_kind

    # Pass the data to the model to be added to the state
    if "WM" in data_kind:
        state.match_wms_to_stdType(related_widget)
        state.observer_manager.notify_observers(state)
    elif "std-familylist":
        selected_item_id = other_widget.selected_widget.treeview.tree.focus()
        current_column = go(
            other_widget.selected_widget.treeview.tree.item(selected_item_id, "values"),
            lambda x: next((i for i, s in enumerate(x) if s), None),
        )
        if current_column == 1:
            state.match_GWM_to_stdFam(related_widget)
            state.observer_manager.notify_observers(state)
        elif current_column == 2:
            messagebox.showinfo(
                "알림",
                "Item 선택 불가  - 좌측 화면에서 상위항목인 GWM/SWM 을 선택해서 추가해주세요.",
            )
        else:
            messagebox.showinfo("알림", "좌측 화면에서 GWM/SWM 레벨에서만 추가 가능")
    print("handle_add_button_press_종료")


def handle_del_button_press(state, related_widget=None):
    print("handle_add_button_press_시작")

    data_kind = related_widget.data_kind
    # Pass the data to the model to be added to the state
    if "WM" in data_kind:
        state.dematch_matchedWMs_to_stdType(related_widget)
        state.observer_manager.notify_observers(state)

    print("handle_add_button_press_종료")


def toggle_stdGWM_widget_mode(state, sheet, edit_mode_var):  ##sheet를 탭으로 바꿔서?
    """시트의 편집 가능 여부를 전환하는 함수"""
    mode = edit_mode_var.get()
    if mode == "edit":
        sheet.enable_bindings()  # 모든 기본 바인딩 활성화
        state.std_matching_add_btn.config(state=tk.NORMAL)
        state.std_matching_del_btn.config(state=tk.NORMAL)
        state.std_matching_listbox.config(bg="white", fg="black")

        state.log_widget.write("Sheet is now in Edit Mode")
    elif mode == "locked":
        # 편집 관련 바인딩을 비활성화하여 편집을 잠금
        sheet.disable_bindings(
            "edit_cell",
            "delete",
            "insert_row",
            "delete_row",
            "paste",
        )

        state.std_matching_add_btn.config(state=tk.DISABLED)
        state.std_matching_del_btn.config(state=tk.DISABLED)
        state.std_matching_listbox.config(bg="lightgray", fg="black")

        state.log_widget.write("Sheet is now in Locked Mode")
