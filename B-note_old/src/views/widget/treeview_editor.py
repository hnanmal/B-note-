import tkinter as tk
from tkinter import messagebox

from src.core.fp_utils import *
from src.controllers.tree_data_navigator import TreeDataManager_treeview


class TreeviewEditor:
    def __init__(self, state, impl_treeview):
        self.impl_treeview = impl_treeview
        self.treeview = self.impl_treeview.treeview
        self.tree = self.treeview.tree
        self.state = state
        self.entry_widget = None
        self.text_widget = None
        self.current_item = None
        self.current_column = None
        self.data_manager = TreeDataManager_treeview(state)

        # Bind double-click to initiate edit
        self.tree.bind("<Double-Button-1>", self.on_double_click)

    def enable_edit(self):
        # Bind double-click to initiate edit
        self.tree.bind("<Double-Button-1>", self.on_double_click)

    def disable_edit(self):
        self.tree.unbind("<Double-Button-1>")

    def on_double_click(self, event):
        # Identify the column and item that was double-clicked
        print(f"[더블클릭] x={event.x}, y={event.y}")
        # region = self.tree.identify("region", event.x, event.y)
        region = self.tree.identify_region(event.x, event.y)
        row = self.tree.identify_row(event.y)
        col = self.tree.identify_column(event.x)
        print(f"region={region}, row={row}, col={col}")

        if region != "cell":
            return

        item_id = self.tree.identify_row(event.y)
        column = self.tree.identify_column(event.x)

        if not item_id or not column:
            return

        self.current_item = item_id
        self.current_column = int(column.replace("#", "")) - 1

        # Get the current value of the selected item
        current_values = self.tree.item(item_id, "values")
        if self.current_column >= len(current_values):
            # If the column index exceeds current values length, set current_value to empty
            current_value = ""
        else:
            current_value = current_values[self.current_column]

        # Create an Entry widget for editing
        bbox = self.tree.bbox(item_id, column)
        if not bbox:
            print("Error: Bounding box could not be determined")
            return

        x, y, width, height = bbox
        if width <= 0 or height <= 0:
            print("Error: Bounding box width or height is invalid")
            return

        self.entry_widget = tk.Entry(self.tree, width=width)
        self.entry_widget.place(x=x, y=y, width=width, height=height)
        self.entry_widget.insert(0, current_value)
        # self.entry_widget.grab_set()
        self.entry_widget.focus()

        # Bind events for Entry widget
        self.entry_widget.bind(
            "<Return>", lambda e: self.on_edit_complete(e, current_value)
        )
        self.entry_widget.bind("<Escape>", self.on_edit_cancel)
        self.tree.bind("<MouseWheel>", self.on_edit_cancel)
        self.entry_widget.bind(
            "<FocusOut>", lambda e: self.on_edit_complete(e, current_value)
        )
        # self.entry_widget.bind("<FocusOut>", self.on_edit_cancel)
        # return "break"

    def on_scroll(self, event):
        """Ask the user whether to cancel editing when they scroll."""
        if self.entry_widget:
            response = messagebox.askyesno(
                "Cancel Edit", "Do you want to cancel editing?"
            )
            if response:
                self.on_edit_cancel(None)

    def on_edit_complete(self, event, current_value):
        if self.current_item is None or self.current_column is None:
            return

        # Get the updated value from the Entry widget
        new_value = self.entry_widget.get()

        if current_value == new_value:
            # Destroy the Entry widget
            self.entry_widget.destroy()
            self.entry_widget = None
            return

        # Calc-Dict 자동 업데이트
        if self.current_column == 8 and new_value.startswith("Q"):
            std_calcdict = self.state.team_std_info["std-calcdict"]["children"]
            calcdict_nums = go(
                std_calcdict,
                map(lambda x: x["name"]),
                list,
            )
            if new_value not in calcdict_nums:
                std_calcdict.append(
                    {
                        "name": new_value,
                        "values": [new_value],
                        "children": [],
                    }
                )

        # Update the state with the new value using TreeDataManager
        selected_name = self.tree.item(self.current_item, "text")
        parent_path = self.get_item_path(self.current_item)
        self.data_manager.update_node_value(
            data_kind=self.impl_treeview.data_kind,
            path=parent_path,
            column_index=self.current_column,
            new_value=new_value,
        )

        # If the modified column matches the level depth, update the name as well
        depth = self.get_item_depth(self.current_item)
        if self.current_column == depth:
            self.data_manager.update_node_name(
                data_kind=self.impl_treeview.data_kind,
                path=parent_path,
                new_name=new_value,
            )

        # Notify observers that the state has been updated
        self.state.observer_manager.notify_observers(
            self.state,
            targets=[
                # "GWM",
                # "SWM",
                "calcDict",
                "common-input",
            ],
        )

        # Destroy the Entry widget
        self.entry_widget.destroy()
        self.entry_widget = None

    def on_edit_cancel(self, event):
        # Cancel editing and destroy the Entry widget
        if self.entry_widget:
            self.entry_widget.destroy()
            self.entry_widget = None

        self.tree.unbind("<MouseWheel>")
        # self.state.on_level_selected(None)

    def get_item_depth(self, item_id):
        """Calculate the depth of the given item in the tree."""
        depth = 0
        parent_id = self.tree.parent(item_id)
        while parent_id:
            depth += 1
            parent_id = self.tree.parent(parent_id)
        return depth

    def get_item_path(self, item_id):
        """Get the path of the given item from the root to the item."""
        path = []
        current_id = item_id
        while current_id:
            path.insert(0, self.tree.item(current_id, "text"))
            current_id = self.tree.parent(current_id)
        return path


class TreeviewEditor_stdGWMSWM(TreeviewEditor):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.tree.bind("<Double-1>", self.on_double_click)  # 더블클릭 바인딩

    # def extract_locked_prefix(self, value):
    #     match = re.match(r"^.*::\[[^\]]+\]", value)
    #     return match.group(0) if match else ""

    def extract_locked_prefix(self, value):
        match = re.search(r"^.*?::\[[^\]]+\]", value)
        return match.group(0) if match else ""

    def on_double_click(self, event):
        self.append_suffix_via_popup()
        return "break"

    def center_popup_on_parent(self, popup, parent, width=300, height=120):
        parent.update_idletasks()
        x = parent.winfo_rootx() + (parent.winfo_width() // 2) - (width // 2)
        y = parent.winfo_rooty() + (parent.winfo_height() // 2) - (height // 2)
        popup.geometry(f"{width}x{height}+{x}+{y}")

    def append_suffix_via_popup(self):
        item_id = self.tree.focus()
        if not item_id:
            print("선택된 아이템이 없습니다.")
            return

        current_values = self.tree.item(item_id, "values")
        if not current_values:
            print("값이 없습니다.")
            return

        for idx, value in enumerate(current_values):
            if value.strip():
                self.current_column = idx
                break
        else:
            print("유효한 값이 없습니다.")
            return

        self.current_item = item_id
        current_value = current_values[self.current_column]
        locked_prefix = self.extract_locked_prefix(current_value)

        editable_part = (
            current_value[len(locked_prefix) :] if locked_prefix else current_value
        ).strip()

        popup = tk.Toplevel(self.tree)
        popup.title("내용 수정")
        popup_width = 350
        popup_height = 170
        popup.geometry(f"{popup_width}x{popup_height}")
        popup.transient(self.tree)
        # popup.grab_set()

        self.center_popup_on_parent(
            popup, self.tree, width=popup_width, height=popup_height
        )

        # 이벤트 바인딩
        # popup.bind("<MouseWheel>", lambda e: popup.destroy())  # 스크롤 시 닫기
        # popup.bind("<Button-4>", lambda e: popup.destroy())  # Linux scroll up
        # popup.bind("<Button-5>", lambda e: popup.destroy())  # Linux scroll down
        popup.bind("<FocusOut>", lambda e: popup.destroy())  # 포커스 아웃 시 닫기

        label_text = (
            f"<<변경 불가 문자열>>:\n\n '{locked_prefix}' 뒤에 덧붙임 말 입력 및 수정만 가능"
            if locked_prefix
            else "<<전체 수정 가능>>\n\n프로젝트 파생 항목이 아닌 \n팀표준 항목의 이름을 변경하는 것을 권장하지 않습니다.\n변경이 꼭 필요한 경우 BIM W/G에 문의하고 진행하세요."
        )
        label = tk.Label(popup, text=label_text, anchor="w")
        label.pack(pady=(10, 5), padx=10, fill="x")

        entry = tk.Entry(popup)
        entry.insert(0, editable_part)
        entry.pack(pady=5, padx=10, fill="x")
        entry.focus()

        def on_confirm():
            suffix = entry.get()
            new_value = locked_prefix + " " + suffix if locked_prefix else suffix
            self.on_edit_complete(None, new_value)
            popup.destroy()

        entry.bind("<Return>", lambda e: on_confirm())
        entry.bind("<Escape>", lambda e: popup.destroy())  # ESC 키로 닫기
        confirm_btn = tk.Button(popup, text="확인", command=on_confirm)
        confirm_btn.pack(pady=(5, 10))

    def on_edit_complete(self, event, new_value):
        if self.current_item is None or self.current_column is None:
            return

        original_value = self.tree.item(self.current_item, "values")[
            self.current_column
        ]
        if original_value == new_value:
            return

        # Update the state with the new value using TreeDataManager
        parent_path = self.get_item_path(self.current_item)
        self.data_manager.update_node_value(
            data_kind=self.impl_treeview.data_kind,
            path=parent_path,
            column_index=self.current_column,
            new_value=new_value,
        )

        # If the modified column matches the level depth, update the name as well
        depth = self.get_item_depth(self.current_item)
        if self.current_column == depth:
            self.data_manager.update_node_name(
                data_kind=self.impl_treeview.data_kind,
                path=parent_path,
                new_name=new_value,
            )

        if self.impl_treeview.data_kind in ["std-GWM", "std-SWM"]:
            if self.current_column == 2:
                self.impl_treeview.update_editing_stdType_wmItem_in(new_value)
            elif self.current_column == 1:
                self.impl_treeview.update_editing_stdType_GWMSWM_in(new_value)

        self.state.observer_manager.notify_observers(
            self.state, targets=["GWM", "SWM", "famlist"]
        )


# class TreeviewEditor_stdGWMSWM(TreeviewEditor):
#     def edit_current_selectedRowAndCol(self):
#         print("[수동 편집 진입]")
#         item_id = self.tree.focus()
#         if not item_id:
#             print("선택된 아이템이 없습니다.")
#             return

#         current_values = self.tree.item(item_id, "values")
#         for idx, value in enumerate(current_values):
#             if value.strip():
#                 self.current_column = idx
#                 break
#         else:
#             print("해당 행에 유효한 값이 없습니다.")
#             return

#         column_id = f"#{self.current_column + 1}"
#         current_value = current_values[self.current_column]

#         # row가 보이도록 먼저 보장
#         self.tree.see(item_id)

#         bbox = self.tree.bbox(item_id, column_id)
#         print(f"item_id = {item_id}")
#         print(f"column_id = {column_id}")
#         print(f"current_value = {current_value}")
#         print(f"bbox = {bbox}")

#         if not bbox:
#             print("Error: Bounding box could not be determined")
#             return

#         x, y, width, height = bbox
#         if width <= 0 or height <= 0:
#             print("Error: Bounding box width or height is invalid")
#             return

#         self.entry_widget = tk.Entry(self.tree, width=width)
#         self.entry_widget.place(x=x, y=y, width=width, height=height)
#         self.entry_widget.insert(0, current_value)
#         self.entry_widget.focus()

#         self.entry_widget.bind(
#             "<Return>", lambda e: self.on_edit_complete(e, current_value)
#         )
#         self.entry_widget.bind("<Escape>", self.on_edit_cancel)
#         self.tree.bind("<MouseWheel>", self.on_edit_cancel)
#         self.entry_widget.bind(
#             "<FocusOut>", lambda e: self.on_edit_complete(e, current_value)
#         )

#         self.current_item = item_id

# def on_edit_complete(self, event, current_value):
#     if self.current_item is None or self.current_column is None:
#         return

#     print(f"트리뷰수정이벤트::{event}")
#     # Get the updated value from the Entry widget
#     new_value = self.entry_widget.get()

#     if current_value == new_value:
#         # Destroy the Entry widget
#         self.entry_widget.destroy()
#         self.entry_widget = None
#         return

#     # Update the state with the new value using TreeDataManager
#     selected_name = self.tree.item(self.current_item, "text")
#     parent_path = self.get_item_path(self.current_item)
#     self.data_manager.update_node_value(
#         data_kind=self.impl_treeview.data_kind,
#         path=parent_path,
#         column_index=self.current_column,
#         new_value=new_value,
#     )

#     # If the modified column matches the level depth, update the name as well
#     depth = self.get_item_depth(self.current_item)
#     if self.current_column == depth:
#         self.data_manager.update_node_name(
#             data_kind=self.impl_treeview.data_kind,
#             path=parent_path,
#             new_name=new_value,
#         )

#     # Update the GWM/SWM item name in std-familylist
#     print(f"손잭스 - column : {self.current_column}")
#     # self.impl_treeview.update_editing_stdType_wmItem_in(new_value)
#     if (
#         self.impl_treeview.data_kind == "std-GWM"
#         or self.impl_treeview.data_kind == "std-SWM"
#     ):
#         if self.current_column == 2:
#             self.impl_treeview.update_editing_stdType_wmItem_in(new_value)
#         elif self.current_column == 1:
#             self.impl_treeview.update_editing_stdType_GWMSWM_in(new_value)

#     # Notify observers that the state has been updated
#     self.state.observer_manager.notify_observers(
#         self.state, targets=["GWM", "SWM", "famlist"]
#     )

#     # Destroy the Entry widget
#     self.entry_widget.destroy()
#     self.entry_widget = None


class TreeviewEditor_forAssignTreeview(TreeviewEditor):

    def on_edit_complete(self, event, current_value):
        if self.current_item is None or self.current_column is None:
            return

        # Get the updated value from the Entry widget
        new_value = self.entry_widget.get()

        if current_value == new_value:
            # Destroy the Entry widget
            self.entry_widget.destroy()
            self.entry_widget = None
            return

        # Update the state with the new value using TreeDataManager
        selected_name = self.tree.item(self.current_item, "text")
        parent_path = self.get_item_path(self.current_item)
        self.data_manager.update_node_value(
            data_kind=self.impl_treeview.data_kind,
            path=parent_path,
            column_index=self.current_column,
            new_value=new_value,
        )

        # If the modified column matches the level depth, update the name as well
        depth = self.get_item_depth(self.current_item)
        if self.current_column == depth:
            self.data_manager.update_node_name(
                data_kind=self.impl_treeview.data_kind,
                path=parent_path,
                new_name=new_value,
            )

        # Notify observers that the state has been updated
        self.state.observer_manager.notify_observers(self.state)

        # Destroy the Entry widget
        self.entry_widget.destroy()
        self.entry_widget = None

        # self.state.on_level_selected(None)
        try:
            self.impl_treeview.place_selected_item_at_top()
        except:
            pass


class TreeviewEditor_forBuildingList(TreeviewEditor):

    def on_edit_complete(self, event, current_value):
        if self.current_item is None or self.current_column is None:
            return

        # Get the updated value from the Entry widget
        new_value = self.entry_widget.get()

        if current_value == new_value:
            # Destroy the Entry widget
            self.entry_widget.destroy()
            self.entry_widget = None
            return

        # Update the state with the new value using TreeDataManager
        selected_name = self.tree.item(self.current_item, "text")
        parent_path = self.get_item_path(self.current_item)
        self.data_manager.update_node_value(
            data_kind=self.impl_treeview.data_kind,
            path=parent_path,
            column_index=self.current_column,
            new_value=new_value,
        )

        # If the modified column matches the level depth, update the name as well
        depth = self.get_item_depth(self.current_item)
        if self.current_column == depth:
            self.data_manager.update_node_name(
                data_kind=self.impl_treeview.data_kind,
                path=parent_path,
                new_name=new_value,
            )

        # state의 project-assigntype의 데이터 변경 반영
        data = self.state.team_std_info["project-assigntype"]["children"]
        for dic in data:
            if dic["values"][1] == selected_name:
                dic["values"][1] = new_value

        # Notify observers that the state has been updated
        self.state.observer_manager.notify_observers(self.state)

        # Destroy the Entry widget
        self.entry_widget.destroy()
        self.entry_widget = None

        # self.state.on_level_selected(None)
        try:
            self.impl_treeview.place_selected_item_at_top()
        except:
            pass


class TreeviewEditor_forFamilyList(TreeviewEditor):
    def on_edit_complete(self, event, current_value):
        if self.current_item is None or self.current_column is None:
            return

        print(f"트리뷰수정이벤트::{event}")
        # Get the updated value from the Entry widget
        new_value = self.entry_widget.get()

        if current_value == new_value:
            # Destroy the Entry widget
            self.entry_widget.destroy()
            self.entry_widget = None
            return
        elif self.current_column == 4 or self.current_column == 5:
            self.entry_widget.destroy()
            self.entry_widget = None
            messagebox.showinfo("알림", "패밀리 리스트에서 변경 불가!")
            return

        # Calc-Dict 자동 업데이트
        if self.current_column == 8 and new_value.startswith("Q"):
            std_calcdict = self.state.team_std_info["std-calcdict"]["children"]
            calcdict_nums = go(
                std_calcdict,
                map(lambda x: x["name"]),
                list,
            )
            if new_value not in calcdict_nums:
                std_calcdict.append(
                    {
                        "name": new_value,
                        "values": [new_value],
                        "children": [],
                    }
                )

        # Update the state with the new value using TreeDataManager
        selected_name = self.tree.item(self.current_item, "text")
        parent_path = self.get_item_path(self.current_item)
        self.data_manager.update_node_value(
            data_kind=self.impl_treeview.data_kind,
            path=parent_path,
            column_index=self.current_column,
            new_value=new_value,
        )

        # If the modified column matches the level depth, update the name as well
        depth = self.get_item_depth(self.current_item)
        if self.current_column == depth:
            self.data_manager.update_node_name(
                data_kind=self.impl_treeview.data_kind,
                path=parent_path,
                new_name=new_value,
            )

        # Update the GWM/SWM item name in std-familylist
        print(f"손잭스 - column : {self.current_column}")
        # self.impl_treeview.update_editing_stdType_wmItem_in(new_value)
        if (
            self.impl_treeview.data_kind == "std-GWM"
            or self.impl_treeview.data_kind == "std-SWM"
        ):
            if self.current_column == 2:
                self.impl_treeview.update_editing_stdType_wmItem_in(new_value)
            elif self.current_column == 1:
                self.impl_treeview.update_editing_stdType_GWMSWM_in(new_value)

        # Notify observers that the state has been updated
        self.state.observer_manager.notify_observers(self.state, targets=["famlist"])

        # Destroy the Entry widget
        self.entry_widget.destroy()
        self.entry_widget = None
