import tkinter as tk
from tkinter import ttk
from ttkbootstrap import Style

from src.views.lower_tabs.pjt_apply_main_tab import create_pjtApply_Main_tab


# def open_tab_in_new_window(parent_notebook, tab_index):
def open_tab_in_new_window_rvtSummary(state):
    icon_path = "resource/app_logo.ico"
    """Open the contents of a specific tab in a new window."""
    # Create a new window
    new_window = tk.Toplevel()
    new_window.title("Rvt Summary Window")
    new_window.geometry("700x900")

    new_window.iconbitmap(icon_path)
    # Set the new window to always be on top
    new_window.attributes("-topmost", True)

    create_pjtApply_Main_tab(state, new_window, exe_mode="new_window").pack()

    # # Clone the tab's content into the new window
    # selected_tab = parent_notebook.nametowidget(parent_notebook.tabs()[tab_index])
    # new_content_frame = ttk.Frame(new_window)
    # new_content_frame.pack(fill=tk.BOTH, expand=True)

    # for child in selected_tab.winfo_children():
    #     child_clone = clone_widget(child, new_content_frame)
    #     child_clone.pack(fill=tk.BOTH, expand=True)


def close_new_window(self, new_window):
    new_window.destroy()
    self.master.focus_set()  # 기존 창으로 포커스 돌려주기


def open_tab_in_new_window(state, subnotebook, tab_funcs, event=None):
    icon_path = "resource/app_logo.ico"
    # Get the index of the tab that was clicked
    tab_index = subnotebook.index("@{},{}".format(event.x, event.y))
    tab_name = subnotebook.tab(tab_index, "text")

    if tab_funcs[tab_index] != "not_func":

        new_window = tk.Toplevel()
        new_window.title(f"B-note :: @ {tab_name} - New Window")
        new_window.iconbitmap(icon_path)
        new_window.geometry("700x900")
        new_window.attributes("-topmost", True)
        frame = ttk.Frame(new_window)
        frame.pack(expand=True, fill="both")

        widget = tab_funcs[tab_index](state, new_window, exe_mode="new window")
    # widget.pack(expand=True, fill="both")

    # # 창이 닫힐 때 close_new_window 실행
    # new_window.protocol(
    #     "WM_DELETE_WINDOW", lambda: close_new_window(widget, new_window)
    # )


def open_new_window_byFunc(state, tab_func, event=None):
    icon_path = "resource/app_logo.ico"
    window_name = "WM sheet"

    new_window = tk.Toplevel()
    new_window.title(f"B-note :: @ {window_name} - New Window")
    new_window.iconbitmap(icon_path)
    new_window.geometry("700x900")
    new_window.attributes("-topmost", True)
    # frame = ttk.Frame(new_window)
    # frame.pack(expand=True, fill="both")

    tab_func(state, new_window, exe_mode="new window")


def clone_widget(widget, parent):
    """Clone a widget into a new parent."""
    # Clone a Frame (simplifies cloning for this example)
    if isinstance(widget, ttk.Frame):
        new_frame = ttk.Frame(parent)
        for child in widget.winfo_children():
            clone_widget(child, new_frame)
        return new_frame

    # Handle other widgets (e.g., Button, Label)
    widget_class = widget.winfo_class()
    if widget_class == "TButton":
        return ttk.Button(parent, text=widget["text"], command=widget["command"])
    elif widget_class == "TLabel":
        return ttk.Label(parent, text=widget["text"])
    # Extend for other widget types as needed
    return None


# Example App
def main():
    root = tk.Tk()
    root.geometry("600x400")
    style = Style("cosmo")

    # Create a Notebook with tabs
    notebook = ttk.Notebook(root)
    notebook.pack(fill=tk.BOTH, expand=True)

    # Tab 1
    tab1 = ttk.Frame(notebook)
    notebook.add(tab1, text="Tab 1")
    ttk.Label(tab1, text="This is Tab 1").pack(padx=10, pady=10)

    # Tab 2
    tab2 = ttk.Frame(notebook)
    notebook.add(tab2, text="Tab 2")
    ttk.Label(tab2, text="This is Tab 2").pack(padx=10, pady=10)

    # Add a button to open Tab 1 in a new window
    open_button = ttk.Button(
        root,
        text="Open Tab 1 in New Window",
        command=lambda: open_tab_in_new_window_rvtSummary(notebook, 0),
    )
    open_button.pack(pady=10)

    root.mainloop()


if __name__ == "__main__":
    main()
