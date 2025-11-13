import ttkbootstrap as ttk
from ttkbootstrap.constants import *


class TreeViewContextMenu:
    def __init__(self, state, treeview, data_kind, **funcs):
        self.state = state
        self.treeview = treeview
        self.locked_status = None
        self.data_kind = data_kind
        self.funcs = funcs
        # Create the context menu
        self.menu = ttk.Menu(self.treeview.tree, tearoff=0)

        # Bind the right-click to show the menu
        self.treeview.tree.bind("<Button-3>", self.show_context_menu)

    def get_clicked_row_values(self, event):
        """Handle right-click on a Treeview row to get its values."""
        # Identify the item under the mouse pointer
        tree = event.widget
        region = tree.identify("region", event.x, event.y)
        if region != "cell":  # Ensure the click is on a row
            return

        item_id = tree.identify_row(event.y)  # Get the item ID
        if item_id:  # If an item is found
            values = tree.item(item_id, "values")  # Get the values of the clicked row
            print(f"Right-clicked row values: {values}")
            return values

    def find_first_non_empty_index(self, lst):
        for index, element in enumerate(lst):
            if element != "":  # Check if the element is not an empty string
                return index
        return -1  # Return -1 if no non-empty string is found

    def show_context_menu(self, event):
        # Debug statement to check locked status
        row_values = list(self.get_clicked_row_values(event))
        tgt_col = self.find_first_non_empty_index(row_values)
        print(f"target column idx:::{tgt_col}")

        self.menu.delete(0, "end")

        self.menu.add_command(label="Add Top Item", command=self.add_top_item)
        self.menu.add_command(label="Add Item", command=self.add_item)
        self.menu.add_command(label="Delete Item", command=self.delete_item)

        if self.data_kind != "std-familylist" and tgt_col == 0:
            if "copy_Topitem" in self.funcs:
                self.menu.add_command(label="Top항목 복사", command=self.copy_Topitem)
        if self.data_kind != "std-familylist" and tgt_col == 1:
            if "copy_GWM" in self.funcs:
                self.menu.add_command(label="GWM항목 복사", command=self.copy_GWM)
            elif "copy_SWM" in self.funcs:
                self.menu.add_command(label="SWM항목 복사", command=self.copy_SWM)
        elif self.data_kind != "std-familylist" and tgt_col == 2:
            self.menu.add_command(label="하위항목 복사", command=self.copy_item)

        # 선택이 하나일때만 등장하도록
        if self.data_kind == "project-assigntype" and "select_same" in self.funcs:
            self.menu.delete(0, "end")
            if len(self.treeview.tree.selection()) == 1:
                self.menu.add_command(
                    label="동일 WM 타입 선택 (Ctrl + A)", command=self.select_sameType
                )

        if self.data_kind == "std-calcdict" and tgt_col == 0:
            self.menu.delete(0, "end")
            self.menu.add_command(label="Add Item", command=self.add_item)
            # self.menu.add_command(label="Delete Item", command=self.delete_item)
        elif self.data_kind == "std-calcdict" and tgt_col != 0:
            self.menu.delete(0, "end")
            self.menu.add_command(label="Delete Item", command=self.delete_item)

        self.state.log_widget.write(f"Context Menu Locked Status: {self.locked_status}")
        # Only show the context menu if locked_status is False (unlocked)
        if not self.locked_status:
            # Get the item under the right-click
            item = self.treeview.tree.identify_row(event.y)
            if item:
                # Select the item that was right-clicked
                self.treeview.tree.selection_set(item)
                # Show the menu at the mouse position
                self.menu.post(event.x_root, event.y_root)

    def set_locked_status(self, status):
        """Setter to update the locked status."""
        self.locked_status = status
        self.state.log_widget.write(f"Locked Status Updated: {self.locked_status}")

    def copy_Topitem(self):
        func = self.funcs.get("copy_Topitem")
        func()

    def copy_GWM(self):
        func = self.funcs.get("copy_GWM")
        func()

    def copy_SWM(self):
        func = self.funcs.get("copy_SWM")
        func()

    def copy_item(self):
        func = self.funcs.get("copy_item")
        func()

    def add_top_item(self):
        func = self.funcs.get("add_top")
        func()

    def add_item(self):
        func = self.funcs.get("add")
        func()

    # def edit_item(self):
    #     func = lambda: self.funcs.get("edit_item")
    #     func()

    def edit_item(self):
        func = self.funcs.get("edit_item")
        if func:
            print("[EditItem] 함수 호출됨")  # 확인용 로그
            func()

    def delete_item(self):
        func = self.funcs.get("delete")
        func()

    def select_sameType(self):
        func = self.funcs.get("select_same")
        func()


class TreeViewContextMenu_GWMSWM(TreeViewContextMenu):
    def __init__(self, state, treeview, data_kind, **funcs):
        super().__init__(state, treeview, data_kind, **funcs)

    def show_context_menu(self, event):
        # Debug statement to check locked status
        row_values = list(self.get_clicked_row_values(event))
        tgt_col = self.find_first_non_empty_index(row_values)
        print(f"target column idx:::{tgt_col}")

        self.menu.delete(0, "end")

        self.menu.add_command(label="Edit Item Name", command=self.edit_item)
        self.menu.add_command(label="Add Top Item", command=self.add_top_item)
        self.menu.add_command(label="Add Item", command=self.add_item)
        self.menu.add_command(label="Delete Item", command=self.delete_item)

        if self.data_kind != "std-familylist" and tgt_col == 0:
            if "copy_Topitem" in self.funcs:
                self.menu.add_command(label="Top항목 복사", command=self.copy_Topitem)
        if self.data_kind != "std-familylist" and tgt_col == 1:
            if "copy_GWM" in self.funcs:
                self.menu.add_command(label="GWM항목 복사", command=self.copy_GWM)
            elif "copy_SWM" in self.funcs:
                self.menu.add_command(label="SWM항목 복사", command=self.copy_SWM)
        elif self.data_kind != "std-familylist" and tgt_col == 2:
            self.menu.add_command(label="하위항목 복사", command=self.copy_item)

        # 선택이 하나일때만 등장하도록
        if self.data_kind == "project-assigntype" and "select_same" in self.funcs:
            self.menu.delete(0, "end")
            if len(self.treeview.tree.selection()) == 1:
                self.menu.add_command(
                    label="동일 WM 타입 선택 (Ctrl + A)", command=self.select_sameType
                )

        self.state.log_widget.write(f"Context Menu Locked Status: {self.locked_status}")
        # Only show the context menu if locked_status is False (unlocked)
        if not self.locked_status:
            # Get the item under the right-click
            item = self.treeview.tree.identify_row(event.y)
            if item:
                # Select the item that was right-clicked
                self.treeview.tree.selection_set(item)
                # Show the menu at the mouse position
                self.menu.post(event.x_root, event.y_root)


class TreeViewContextMenu_FamilyList(TreeViewContextMenu):
    def __init__(self, state, treeview, data_kind, **funcs):
        super().__init__(state, treeview, data_kind, **funcs)

    def show_context_menu(self, event):
        # Debug statement to check locked status
        row_values = list(self.get_clicked_row_values(event))
        tgt_col = self.find_first_non_empty_index(row_values)
        print(f"target column idx:::{tgt_col}")

        self.menu.delete(0, "end")

        if self.data_kind == "std-familylist" and tgt_col == 1:
            self.menu.delete(0, "end")
            self.menu.add_command(label="Add Item", command=self.add_item)
            self.menu.add_command(label="Delete Item", command=self.delete_item)
        elif self.data_kind == "std-familylist" and tgt_col == 5:
            self.menu.delete(0, "end")
        elif self.data_kind == "std-familylist" and tgt_col != 1:
            self.menu.delete(0, "end")
            self.menu.add_command(label="Delete Item", command=self.delete_item)

        self.state.log_widget.write(f"Context Menu Locked Status: {self.locked_status}")
        # Only show the context menu if locked_status is False (unlocked)
        if not self.locked_status:
            # Get the item under the right-click
            item = self.treeview.tree.identify_row(event.y)
            if item:
                # Select the item that was right-clicked
                self.treeview.tree.selection_set(item)
                # Show the menu at the mouse position
                self.menu.post(event.x_root, event.y_root)
