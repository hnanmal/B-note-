from src.core.fp_utils import *
import tkinter as tk
import tkinter.font

# from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from src.controllers.widget.widgets import (
    EditModeManager,
)

from src.views.widget.widget import Builing_select_combobox, Current_building_label
from src.views.widget.pjt_int_matrix import pjt_interior_matrix_widget


def create_pjt_intMatrix_tab(state, subtab_notebook, exe_mode=None):
    edit_mode_manager = EditModeManager()

    working_tab = ttk.Frame(subtab_notebook)

    working_tab_common_area = ttk.Frame(
        working_tab,
        # width=2000,
        height=10,
    )
    working_tab_common_area.pack(expand=True, fill="x")

    working_tab_paned_area = ttk.Frame(
        working_tab,
        # width=600,
        height=3000,
    )
    working_tab_paned_area.pack(expand=True, fill="both")

    working_tab_paned_window = tk.PanedWindow(
        working_tab_paned_area,
        orient=tk.HORIZONTAL,
        sashwidth=7,
        bg="#e3e3e3",
    )
    working_tab_paned_window.pack(expand=True, fill="both")

    if not exe_mode:
        subtab_notebook.add(working_tab, text="Project Interior Matrix")
    elif exe_mode == "new window":
        working_tab.pack(expand=True, fill="both")

    section1 = ttk.Frame(
        working_tab_paned_area,
        width=1500,
        height=3000,
    )
    # section2 = ttk.Frame(
    #     working_tab_paned_area,
    #     width=400,
    #     height=3000,
    # )

    # section3 = ttk.Frame(
    #     working_tab_paned_area,
    #     width=2000,
    #     height=3000,
    # )

    working_tab_paned_window.add(section1)
    # working_tab_paned_window.add(section2)
    # working_tab_paned_window.add(section3)

    working_tab_paned_window.paneconfigure(
        section1,
        minsize=1100,
        # maxsize=1000,
        height=3000,
    )
    # working_tab_paned_window.paneconfigure(
    #     section2,
    #     minsize=400,
    #     width=400,
    #     height=3000,
    # )
    # working_tab_paned_window.paneconfigure(
    #     section3,
    #     minsize=1100,
    #     height=3000,
    # )

    # common 영역 라벨링
    working_tab_font = tk.font.Font(
        family="맑은 고딕",
        size=12,
        # weight="bold",
    )

    ##############################################################
    ## tab_common_area###########

    # Create an "Edit Mode" / "Locked Mode" button
    edit_mode_button = tk.Button(
        working_tab_common_area,
        text="Locked Mode",
        command=lambda: edit_mode_manager.set_edit_mode(
            "edit" if edit_mode_button.cget("text") == "Locked Mode" else "locked"
        ),
    )
    edit_mode_button.pack(side="left", anchor="nw", pady=5)

    builing_select_combobox = Builing_select_combobox(state, working_tab_common_area)
    state.builing_select_combobox = builing_select_combobox

    ##############################################################
    ## section 1###########
    pjt_interior_matrix = pjt_interior_matrix_widget(state, section1)
    ######## notify_targets 등록 ###############################################
    # state.notify_targets.append(pjt_interior_matrix)
    ############################################################################

    return working_tab
