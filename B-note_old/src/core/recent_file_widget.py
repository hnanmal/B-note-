import json
import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from tkinter import Menu, messagebox
from datetime import datetime
import os

from src.core.fp_utils import *
from src.core.file_utils import load_from_json
from src.views.widget.widget import select_tab  # For file opening


class FileItem(ttk.Frame):
    def __init__(
        self,
        app_state,
        master,
        parent_widget,
        icon,
        file_info,
        is_pinned=False,
        **kwargs,
    ):
        super().__init__(master, **kwargs)
        self.app_state = app_state
        self.is_pinned = is_pinned
        self.parent_widget = parent_widget  # Reference to RecentPinnedWidget

        # Store default styles
        self.config(borderwidth=1, relief="flat")
        self.default_borderwidth = self.cget("borderwidth")
        self.default_relief = self.cget("relief")
        self.pack(ipadx=10)

        # Extract file name and path from the provided dictionary
        file_path = file_info.get("name", "")
        file_name = os.path.basename(file_path)

        # Get file modification date
        modified_date = self.get_modified_date(file_path)

        # Icon Label
        self.icon_label = ttk.Label(self, text=icon, font=("Arial", 12))
        self.icon_label.pack(side="left", padx=5, pady=5)

        # File Details Frame
        details_frame = ttk.Frame(
            self,
        )
        details_frame.pack(side="left", fill="x", pady=5, expand=True, anchor="w")
        self.details_frame = details_frame

        # File Name Label
        self.name_label = ttk.Label(
            details_frame,
            text=file_name,
            font=("Arial", 10, "bold"),
        )
        self.name_label.pack(anchor="w")

        # File Path Label
        self.path_label = ttk.Label(
            details_frame,
            text=file_path,
            font=("Arial", 8),
            foreground="gray",
        )
        self.path_label.pack(anchor="w")

        # Modified Date Label
        self.date_label = ttk.Label(
            self,
            text=modified_date,
            font=("Arial", 9),
            foreground="gray",
        )
        self.date_label.pack(side="right", padx=5)

        # Bind right-click menu directly to the parent_widget
        self.bind("<Button-3>", self.parent_widget.show_context_menu)
        self.details_frame.bind("<Button-3>", self.parent_widget.show_context_menu)
        self.icon_label.bind("<Button-3>", self.parent_widget.show_context_menu)
        self.name_label.bind("<Button-3>", self.parent_widget.show_context_menu)
        self.date_label.bind("<Button-3>", self.parent_widget.show_context_menu)
        self.path_label.bind("<Button-3>", self.parent_widget.show_context_menu)

        # Bind hover and double-click events
        self.bind("<Enter>", self.on_hover)
        self.bind("<Leave>", self.on_leave)
        self.bind("<Double-1>", self.open_file)

        # Apply hover bindings to sub-elements
        for widget in [
            self.icon_label,
            self.name_label,
            self.date_label,
            self.path_label,
        ]:
            widget.bind("<Enter>", self.on_hover)
            widget.bind("<Leave>", self.on_leave)
            # widget.bind("<Double-1>", self.open_file)
            widget.bind("<Button-1>", self.open_file)

    def get_modified_date(self, file_path):
        try:
            timestamp = os.path.getmtime(file_path)
            return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M")
        except FileNotFoundError:
            return "File not found"

    def on_hover(self, event):
        self.config(borderwidth=1, relief="solid")

    def on_leave(self, event):
        # Restore default styles
        self.config(borderwidth=self.default_borderwidth, relief=self.default_relief)

    def open_file(self, event):
        file_path = self.path_label.cget("text")
        try:
            load_from_json(self.app_state, _file_path=file_path)
            select_tab(self.app_state.notebook, 2, subtab_index=0)
            # os.startfile(file_path)  # Opens the file with the default program
        except Exception as e:
            messagebox.showerror("Error", f"Unable to open {file_path}: {str(e)}")


class RecentPinnedWidget(ttk.Frame):
    def __init__(self, master, app_state, **kwargs):
        super().__init__(master, **kwargs)
        self.app_state = app_state  # .recent_files

        # Right-click context menu
        self.menu = Menu(self, tearoff=0)
        self.menu.add_command(label="Open", command=self.open_item)
        self.pin_command = self.menu.add_command(label="Pin", command=self.pin_item)
        self.unpin_command = self.menu.add_command(
            label="Unpin", command=self.unpin_item
        )
        self.menu.add_command(label="Remove", command=self.remove_item)

        # Header
        ttk.Label(
            self, text="📄 Recent Items", font=("Arial", 18, "bold"), anchor="w"
        ).pack(fill="x", padx=10, pady=(20, 0))
        self.recent_frame = ttk.Frame(self)
        self.recent_frame.pack(fill="both", expand=True, padx=10, pady=5)

        ttk.Label(
            self, text="📌 Pinned Items", font=("Arial", 18, "bold"), anchor="w"
        ).pack(fill="x", padx=10, pady=(50, 0))
        self.pinned_frame = ttk.Frame(self)
        self.pinned_frame.pack(fill="both", expand=True, padx=10, pady=5)

        # Load initial items
        self.load_items()

    def load_items(self):
        for frame in [self.recent_frame, self.pinned_frame]:
            for widget in frame.winfo_children():
                widget.destroy()

        for item in self.app_state.recent_files.get("recent_items", [])[:6]:
            file_item = FileItem(
                self.app_state, self.recent_frame, self, "🗂️", item, is_pinned=False
            )
            file_item.pack(fill="x", pady=5, padx=5)

        for item in self.app_state.recent_files.get("pinned_items", [])[:6]:
            file_item = FileItem(
                self.app_state, self.pinned_frame, self, "📌     ", item, is_pinned=True
            )
            file_item.pack(fill="x", pady=5, padx=5)

    def get_parent_file_item(self, widget):
        while widget:
            if isinstance(widget, FileItem):
                return widget
            widget = widget.master
        return None

    def show_context_menu(self, event):
        self.selected_item = self.get_parent_file_item(event.widget)

        if self.selected_item:
            # Toggle Pin/Unpin visibility based on the item
            if self.selected_item.is_pinned:
                self.menu.entryconfig("Pin", state="disabled")
                self.menu.entryconfig("Unpin", state="normal")
            else:
                self.menu.entryconfig("Pin", state="normal")
                self.menu.entryconfig("Unpin", state="disabled")

            self.menu.post(event.x_root, event.y_root)

    def open_item(self):
        file_path = self.selected_item.path_label.cget("text")
        print(file_path)
        try:
            load_from_json(self.app_state, _file_path=file_path)
            select_tab(self.app_state.notebook, 2, subtab_index=0)
            # os.startfile(file_path)
        except Exception as e:
            messagebox.showerror("Error", f"Unable to open {file_path}: {str(e)}")

    def pin_item(self):
        file_path = self.selected_item.path_label.cget("text")
        item = next(
            (
                i
                for i in self.app_state.recent_files["recent_items"]
                if i["name"] == file_path
            ),
            None,
        )

        exist_pinned_files = go(
            self.app_state.recent_files["pinned_items"],
            map(lambda x: x["name"]),
            list,
        )

        if item and (item["name"] not in exist_pinned_files):
            self.app_state.recent_files["recent_items"].remove(item)
            self.app_state.recent_files["pinned_items"].append(item)

            with open("resource/recent_files.json", "w", encoding="utf-8") as file:
                json.dump(
                    self.app_state.recent_files, file, indent=4, ensure_ascii=False
                )

            self.load_items()

    def unpin_item(self):
        file_path = self.selected_item.path_label.cget("text")
        item = next(
            (
                i
                for i in self.app_state.recent_files["pinned_items"]
                if i["name"] == file_path
            ),
            None,
        )

        exist_recent_files = go(
            self.app_state.recent_files["recent_items"],
            map(lambda x: x["name"]),
            list,
        )

        if item:
            self.app_state.recent_files["pinned_items"].remove(item)
            if item["name"] not in exist_recent_files:
                self.app_state.recent_files["recent_items"].append(item)

            with open("resource/recent_files.json", "w", encoding="utf-8") as file:
                json.dump(
                    self.app_state.recent_files, file, indent=4, ensure_ascii=False
                )

            self.load_items()

    def remove_item(self):
        file_path = self.selected_item.path_label.cget("text")
        self.app_state.recent_files["recent_items"] = [
            item
            for item in self.app_state.recent_files["recent_items"]
            if item["name"] != file_path
        ]
        self.app_state.recent_files["pinned_items"] = [
            item
            for item in self.app_state.recent_files["pinned_items"]
            if item["name"] != file_path
        ]

        with open("resource/recent_files.json", "w", encoding="utf-8") as file:
            json.dump(self.app_state.recent_files, file, indent=4, ensure_ascii=False)

        self.load_items()
