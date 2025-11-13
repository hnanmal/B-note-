import tkinter as tk
from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *


from src.core.fp_utils import *


def open_dialog(state, textStr, width=600, height=200):
    # Create a new Toplevel window
    root = state.root
    dialog = tk.Toplevel(root)
    dialog.iconbitmap(state.icon_path)
    dialog.title("Dialog Window")
    # width = 600
    # height = 200
    dialog.geometry(f"{width}x{height}")  # Set the size of the dialog

    # Disable interaction with the main window until the dialog is closed
    dialog.transient(root)  # Set dialog to be a child of the main window
    dialog.grab_set()  # Grab all input focus

    # Add a label to the dialog
    label = ttk.Label(dialog, text=textStr)
    label.pack(pady=10)

    # Add a button to close the dialog
    close_button = ttk.Button(
        dialog,
        text="Close",
        command=dialog.destroy,
        bootstyle="danger",
    )
    close_button.pack(pady=10)

    # 스페이스 키를 'dialog.destroy' 기능에 연결
    dialog.bind(
        "<space>",
        lambda e: dialog.destroy(),
    )

    # Center the dialog relative to the root window
    x = root.winfo_x() + (root.winfo_width() // 2) - (width // 2)
    y = root.winfo_y() + (root.winfo_height() // 2) - (height // 2)
    dialog.geometry(f"{width}x{height}+{x}+{y}")

    dialog.grab_set()  # Grab all input focus
    dialog.focus_force()


def open_filesave_dialog(state, textStr, width=600, height=200):
    from src.core.file_utils import save_to_json_teamStdInfo

    # Create a new Toplevel window
    root = state.root
    dialog = tk.Toplevel(root)
    dialog.iconbitmap(state.icon_path)
    dialog.title("Dialog Window")
    width = 600
    height = 350
    dialog.geometry(f"{width}x{height}")  # Set the size of the dialog

    result = None

    # Disable interaction with the main window until the dialog is closed
    dialog.transient(root)  # Set dialog to be a child of the main window
    dialog.grab_set()  # Grab all input focus

    # Add a label to the dialog
    label = ttk.Label(
        dialog,
        text=textStr,
        font=("Arial", 16, "bold"),
    )
    label.pack(pady=10)

    pathStr = go(
        state.current_filepath,
        lambda x: x.split("/"),
        lambda x: x[-2:],
        lambda x: "/".join(x),
    )
    path_label = ttk.Label(
        dialog,
        text=f"{pathStr}",
        font=("Arial", 9, "normal"),
        bootstyle="info",
    )
    path_label.pack(pady=20)

    def save_func():
        save_to_json_teamStdInfo(
            state,
            _file_path=state.current_filepath,
        )
        state.root.destroy()

    def saveAs_func():
        save_to_json_teamStdInfo(
            state,
        )
        state.root.destroy()

    # Add a button to close the dialog
    save_button = ttk.Button(
        dialog,
        text="저장",
        command=save_func,
        bootstyle="success-outline",
    )
    save_button.pack(padx=10, pady=10)

    # Add a button to close the dialog
    saveAs_button = ttk.Button(
        dialog,
        text="다른이름으로 저장",
        command=saveAs_func,
        bootstyle="success-outline",
    )
    saveAs_button.pack(padx=10, pady=10)

    # Add a button to close the dialog
    quitWithoutSave_button = ttk.Button(
        dialog,
        text="저장하지 않고 종료",
        command=state.root.destroy,
        bootstyle="primary-outline",
    )
    quitWithoutSave_button.pack(padx=10, pady=10)

    # Add a button to close the dialog
    close_button = ttk.Button(
        dialog,
        text="취소",
        command=dialog.destroy,
        bootstyle="danger",
    )
    close_button.pack(padx=10, pady=10)

    # 스페이스 키를 'dialog.destroy' 기능에 연결
    dialog.bind(
        "<space>",
        lambda e: dialog.destroy(),
    )

    # Center the dialog relative to the root window
    x = root.winfo_x() + (root.winfo_width() // 2) - (width // 2)
    y = root.winfo_y() + (root.winfo_height() // 2) - (height // 2)
    dialog.geometry(f"{width}x{height}+{x}+{y}")

    dialog.grab_set()  # Grab all input focus
    dialog.focus_force()

    return result


def open_filesave_dialog_opening(state, textStr, width=600, height=200):
    from src.core.file_utils import save_to_json_teamStdInfo
    from src.core.file_utils import load_from_json

    # Create a new Toplevel window
    root = state.root
    dialog = tk.Toplevel(root)
    dialog.iconbitmap(state.icon_path)
    dialog.title("Dialog Window")
    width = 600
    height = 350
    dialog.geometry(f"{width}x{height}")  # Set the size of the dialog

    result = None

    # Disable interaction with the main window until the dialog is closed
    dialog.transient(root)  # Set dialog to be a child of the main window
    dialog.grab_set()  # Grab all input focus

    # Add a label to the dialog
    label = ttk.Label(
        dialog,
        text=textStr,
        font=("Arial", 16, "bold"),
    )
    label.pack(pady=10)

    pathStr = go(
        state.current_filepath,
        lambda x: x.split("/"),
        lambda x: x[-2:],
        lambda x: "/".join(x),
    )
    path_label = ttk.Label(
        dialog,
        text=f"{pathStr}",
        font=("Arial", 9, "normal"),
        bootstyle="info",
    )
    path_label.pack(pady=20)

    def save_func():
        save_to_json_teamStdInfo(
            state,
            _file_path=state.current_filepath,
        )
        dialog.destroy()

    def saveAs_func():
        save_to_json_teamStdInfo(
            state,
        )
        dialog.destroy()

    def open_other():
        load_from_json(state)
        dialog.destroy()

    # Add a button to close the dialog
    save_button = ttk.Button(
        dialog,
        text="저장",
        command=save_func,
        bootstyle="success-outline",
    )
    save_button.pack(padx=10, pady=10)

    # # Add a button to close the dialog
    # saveAs_button = ttk.Button(
    #     dialog,
    #     text="다른이름으로 저장",
    #     command=saveAs_func,
    #     bootstyle="success-outline",
    # )
    # saveAs_button.pack(padx=10, pady=10)

    # Add a button to close the dialog
    quitWithoutSave_button = ttk.Button(
        dialog,
        text="저장하지 않고 다른 B-note 열기",
        # command=state.root.destroy,
        command=open_other,
        bootstyle="primary-outline",
    )
    quitWithoutSave_button.pack(padx=10, pady=10)

    # Add a button to close the dialog
    close_button = ttk.Button(
        dialog,
        text="취소",
        command=dialog.destroy,
        bootstyle="danger",
    )
    close_button.pack(padx=10, pady=10)

    # 스페이스 키를 'dialog.destroy' 기능에 연결
    dialog.bind(
        "<space>",
        lambda e: dialog.destroy(),
    )

    # Center the dialog relative to the root window
    x = root.winfo_x() + (root.winfo_width() // 2) - (width // 2)
    y = root.winfo_y() + (root.winfo_height() // 2) - (height // 2)
    dialog.geometry(f"{width}x{height}+{x}+{y}")

    dialog.grab_set()  # Grab all input focus
    dialog.focus_force()

    return result


def select_tab(notebook, parent_index, subtab_index=None):
    """Select a parent tab and optionally a subtab."""
    # Disable event handlers if any
    notebook.unbind("<<NotebookTabChanged>>")

    notebook.select(parent_index)  # Select the parent tab
    if subtab_index is not None:  # If a subtab is specified
        parent_tab = notebook.nametowidget(
            notebook.tabs()[parent_index]
        )  # Get the parent tab widget
        sub_notebook = parent_tab.children.get(
            "sub_notebook"
        )  # Find the sub-notebook inside the parent tab
        if sub_notebook:
            sub_notebook.select(subtab_index)  # Select the subtab


# Composition for State Management
class StateObserver:
    def __init__(self, state, updateFunc, tag=None):
        self.state = state
        self.state.observer_manager.add_observer(lambda e: updateFunc(e), tag)


class WidgetSwitcher:
    def __init__(
        self, state, parent_frame, widgets, default_selection=None, default_width=300
    ):
        """
        Initialize the WidgetSwitcher.

        :param parent_frame: The parent frame where the widgets and combo box are placed.
        :param widgets: A dictionary of widget names and corresponding widgets to be switched.
        :param default_selection: The widget to display initially. Defaults to the first widget if not provided.
        """
        self.state = state
        self.parent_frame = parent_frame
        self.widgets = (
            widgets  # A dictionary of widget names and corresponding widget objects
        )
        self.default_width = default_width

        self.state_observer = StateObserver(state, lambda e: self.update(e))

        # Create combo box for widget selection
        self.combo_box = ttk.Combobox(
            self.parent_frame, values=list(self.widgets.keys())
        )
        self.combo_box.pack(pady=10)

        # Set default selection
        if default_selection:
            self.combo_box.set(default_selection)
            state.switch_widget_status.set(default_selection)
        else:
            # Default to the first widget in the list if none is specified
            default_widget = list(self.widgets.keys())[0]
            self.combo_box.set(default_widget)
            state.switch_widget_status.set(default_widget)

        # Hide all widgets initially
        for widget in self.widgets.values():
            widget.tree_frame.pack_forget()

        # Show the default widget
        self.show_widget(self.combo_box.get())

        # Bind the combo box to the switching method
        self.combo_box.bind("<<ComboboxSelected>>", self.on_combo_box_selected)

    def update(self, event=None):
        state = self.state
        state.log_widget.write(f"{self.__class__.__name__} > update 메소드 시작")

        widget_name = state.switch_widget_status.get()
        print(f"\n\n{widget_name}\n\n")

        self.show_widget(widget_name)
        self.combo_box.set(widget_name)

        state.log_widget.write(f"{self.__class__.__name__} > update 메소드 종료")

    def show_widget(self, widget_name):
        """Show the selected widget and hide the others."""
        state = self.state
        # Hide all widgets
        for widget in self.widgets.values():
            widget.tree_frame.pack_forget()

        # Show the selected widget
        selected_widget = self.widgets.get(widget_name)
        self.selected_widget = selected_widget
        if selected_widget:
            selected_widget.tree_frame.pack(fill=tk.BOTH, expand=True)
            selected_widget.tree_frame.config(width=self.default_width)

            # state.switch_widget_status.set(widget_name)
            state.log_widget.write(f"switch status: {widget_name}")

    def on_combo_box_selected(self, event):
        """Handle the combo box selection change event."""
        state = self.state
        selected_widget_name = self.combo_box.get()
        state.switch_widget_status.set(selected_widget_name)
        self.show_widget(selected_widget_name)
        # 상태가 업데이트되었을 때 모든 관찰자에게 알림을 보냄
        state.observer_manager.notify_observers(state)


class TabNavigationButton(tk.Frame):
    def __init__(
        self, parent, notebook, tab_index, button_text="Go to Tab", *args, **kwargs
    ):
        """
        A widget that allows navigation to a specific tab in a Tkinter notebook.

        :param parent: Parent Tkinter widget
        :param notebook: The ttk.Notebook instance to navigate
        :param tab_index: The index of the tab to navigate to
        :param button_text: The text displayed on the navigation button
        """
        super().__init__(parent, *args, **kwargs)

        self.notebook = notebook
        self.tab_index = tab_index

        # Create the navigation button
        self.button = ttk.Button(
            self,
            text=button_text,
            command=self.go_to_tab,
            # bootstyle=SUCCESS,
        )
        self.button.pack(fill="both", padx=5, pady=5)
        self.pack()

    def go_to_tab(self):
        """
        Navigate to the specified tab in the notebook.
        """
        try:
            self.notebook.select(self.tab_index)
        except tk.TclError:
            print(f"Error: Tab index {self.tab_index} is out of range.")


class Builing_select_combobox:
    def __init__(self, state, parent, allMode=False):
        self.state = state
        self.allMode = allMode
        self.data_kind = "project-buildinglist"
        self.state_observer = StateObserver(state, lambda e: self.update(e))

        self.frame = ttk.Frame(parent)
        self.frame.pack(padx=10, side="left", anchor="nw")

        text_label = ttk.Label(self.frame, text="*** 작업대상 건물을 선택해주세요 ***")
        text_label.config(foreground="#ff0080")
        text_label.pack(side="left", anchor="w", padx=5)

        self.combovalues = []

        self.combobox = ttk.Combobox(
            self.frame,
            values=self.combovalues,
            bootstyle="danger",
            state="readonly",
            width=50,
        )
        self.combobox.pack(side="left", anchor="nw", padx=5)

        # Bind the <<ComboboxSelected>> event to the handler
        self.combobox.bind(
            "<<ComboboxSelected>>", lambda event: self.on_combobox_select(event, state)
        )

    # Event handler for combo box selection
    def on_combobox_select(self, event, state):
        selected_value = event.widget.get()  # Get the selected value from the combo box
        self.update_selected_value(selected_value)

        state.observer_manager.notify_observers(state)

    def update_selected_value(self, value):
        state = self.state
        # state.current_building = value
        state.current_building.set(value)
        print(f"State updated: selected_value = {state.current_building.get()}")

    def update(self, event=None):
        state = self.state

        if self.data_kind in state.team_std_info:
            self.combovalues = go(
                state.team_std_info[self.data_kind]["children"],
                map(lambda node: node["name"]),
                list,
            )
            if self.allMode:
                self.combobox.config(values=["All"] + self.combovalues)
            else:
                self.combobox.config(values=self.combovalues)
            try:
                self.combobox.set(state.current_building.get())
            except:
                pass


class Current_building_label:
    def __init__(self, state, parent):
        self.state = state
        self.data_kind = "project-buildinglist"
        # self.state_observer = StateObserver(state, lambda e: self.update(e))

        self.frame = ttk.Frame(parent)
        self.frame.pack(side="top", padx=5, pady=5, anchor="nw")

        text_label = ttk.Label(self.frame, text="Current Building :")
        text_label.config(font=("Arial", 14, "normal"))
        text_label.pack(side="left", anchor="w", padx=5)

        building_label = ttk.Label(self.frame, textvariable=state.current_building)
        building_label.config(font=("Arial", 14, "normal"), foreground="#ff0080")
        building_label.pack(side="left", anchor="w", padx=5)
