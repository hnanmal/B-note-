import tkinter as tk
from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from src.core.file_utils import load_from_json
from src.views.widget.widget import Builing_select_combobox
from src.views.widget.calc_sheet_widget import ReportMember_SheetWidget


def create_report_member_tab(state, subtab_notebook, exe_mode=None):

    working_tab = ttk.Frame(subtab_notebook)
    working_tab.pack(expand=True, fill="both")

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
        subtab_notebook.add(working_tab, text="Q'ty Report by Member")

    section1 = ttk.Frame(
        working_tab_paned_area,
        width=2000,
        height=3000,
    )

    working_tab_paned_window.add(section1)
    working_tab_paned_window.paneconfigure(section1, height=3000)

    ##############################################################
    ## tab_common_area###########

    builing_select_combobox = Builing_select_combobox(state, working_tab_common_area)
    state.builing_select_combobox = builing_select_combobox

    ## refresh 버튼
    refresh_button = ttk.Button(
        working_tab_common_area,
        text="[ ↻ ] Refresh B-note",
        command=lambda: load_from_json(state, _file_path=state.current_filepath),
        bootstyle="info",
    )
    refresh_button.pack(anchor="e")

    ##############################################################
    ## section 1###########

    report_member_calc_sheet = ReportMember_SheetWidget(
        state, section1, data_kind="dynamo-calculation"
    )
    report_member_calc_sheet.pack(fill=tk.BOTH, expand=True)

    ######### notify_targets 등록 ###############################################
    # state.notify_targets.append(report_member_calc_sheet)
    #############################################################################

    return working_tab
