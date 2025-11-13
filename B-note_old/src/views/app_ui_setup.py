import tkinter as tk
from tkinter import (
    # ttk,
    Menu,
)
import ttkbootstrap as ttk
from ttkbootstrap.constants import *
import json

from src.views.widget.update_log import open_update_log_newWindow
from src.core.web import open_url_in_browser
from src.core.app_update import APP_VERSION, check_for_update
from src.core.file_utils import (
    load_from_json,
    on_closing,
    on_opening,
    save_to_json_teamStdInfo,
)
from src.models.app_state import AppState
from src.views.logging_utils import setup_logging_frame


def define_styles():
    style = ttk.Style()
    # Define a custom style for the main Notebook
    style.configure(
        "Main.TNotebook",
        tabposition="nw",  # north, tabs at the top
        # tabmargins=[5, 5, 5, 5],
    )  # space around tabs

    style.configure(
        "Main.TNotebook.Tab",
        background="white",
        foreground="black",
        padding=[70, 0],
        # font=("Helvetica", 12, "bold"),
        # font=("Arial", 12, "normal"),
        font=("resource/RIDIBatang.otf", 12, "normal"),
    )

    # Define a custom style for the subtabs
    style.configure(
        "Subtab.TNotebook",
        tabposition="nw",
        # tabmargins=[5, 5, 5, 5],
    )

    style.configure(
        "Subtab.TNotebook.Tab",
        background="lightblue",
        foreground="darkblue",
        # padding=[50, 0],
        # font=("Arial", 11, "normal"),
        font=("resource/RIDIBatang.otf", 11, "normal"),
    )
    # style.configure("lefttab.TNotebook", tabposition="wn")


def initialize_app(root, _state=None):

    log_widget = setup_logging_frame(root)
    state = AppState(log_widget)
    if _state:
        state = _state
        return state
    state.root = root

    state.defaultextension = ".bnote"
    state.filetypes = [("B-note files", "*.bnote")]

    root.title(
        f"B-note  {APP_VERSION} :: Hyundai Engineering Plant Architecture Bim Note"
    )
    root.geometry("1400x900+100+100")

    with open("resource/recent_files.json", "r", encoding="utf-8") as file:
        loaded_data = json.load(file)
    state.recent_files = loaded_data

    state.tab_bootStyle = "secondary"

    menubar = Menu(root)
    root.config(
        menu=menubar,
    )
    # menubar.config(
    #     activebackground="blue",
    # )

    # 파일 메뉴 추가
    file_menu = Menu(menubar, tearoff=0)
    menubar.add_cascade(label="   File   ", menu=file_menu)
    file_menu.add_command(
        label="현재 B-note 저장              (Ctrl+S)",
        command=lambda: save_to_json_teamStdInfo(
            state, _file_path=state.current_filepath
        ),
    )  # save_to_json)
    file_menu.add_command(
        label="다른이름으로 저장     (Ctrl+Shift+S)",
        command=lambda: save_to_json_teamStdInfo(state),
    )
    file_menu.add_command(
        label="B-note 열기                     (Ctrl+O)",
        # command=lambda: load_from_json(state),
        command=lambda: on_opening(state),
    )
    file_menu.add_separator()
    file_menu.add_command(
        label="Exit",
        # command=root.quit,
        command=lambda: on_closing(root, state),
    )

    help_menu = Menu(menubar, tearoff=0)
    menubar.add_cascade(label="   Help   ", menu=help_menu)

    help_menu.add_command(
        label="B-note 업데이트 체크",
        command=check_for_update,
    )
    help_menu.add_command(
        label=f"[H_PAB.RT.Q2]_Revit 물량 산출.dyn 다운로드 페이지로 이동",
        command=lambda: open_url_in_browser(
            "https://henginmc6eaoutlook.sharepoint.com/:f:/s/jhjh/EhMNiYh8PkBDsCKr7gg8UeoBvhpHni-Bm2umKis-lf_-qg?e=Ab6njo"
        ),
    )
    help_menu.add_command(
        label=f"B-note 업데이트 로그 ( 현재 B-note 버전 : {APP_VERSION} )",
        command=open_update_log_newWindow,
    )

    paned_window = tk.PanedWindow(
        root,
        orient=tk.HORIZONTAL,
    )
    paned_window.pack(expand=True, fill="both")

    notebook = ttk.Notebook(
        paned_window,
        # style="Main.TNotebook",
        bootstyle=state.tab_bootStyle,
    )
    state.main_notebook = notebook
    paned_window.add(notebook)

    # Ctrl+S 단축키를 'Save Team Standard' 기능에 연결
    root.bind(
        "<Control-s>",
        lambda e: save_to_json_teamStdInfo(state, _file_path=state.current_filepath),
    )
    root.bind("<Control-Shift-KeyPress-S>", lambda e: save_to_json_teamStdInfo(state))
    root.bind("<Control-o>", lambda e: on_opening(state))

    # print("starting log widget\n")
    try:
        state.log_widget.write("starting log widget\n")
    except:
        pass

    return notebook, state
