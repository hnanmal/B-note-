import tkinter as tk
import tkinter.font

# from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from src.controllers.widget.widgets import (
    EditModeManager,
)
from src.views.widget.sheet_utils import (
    # add_edit_mode_radio_buttons,
    ProjectStd_WM_Selcet_SheetView_SWM,
    ProjectStd_WM_Selcet_SheetView_GWM,
)
from src.views.widget.treeview_utils import (
    TeamStd_GWMTreeView,
    DefaultTreeViewStyleManager,
    TeamStd_SWMTreeView,
)


def create_pjtStdGWM_tab(state, subtab_notebook, exe_mode=None):
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
        subtab_notebook.add(working_tab, text=" Project Group Work Master  ")

    section1 = ttk.Frame(
        working_tab_paned_area,
        width=950,
        height=3000,
    )
    # state.GWMsection = section1
    section2 = ttk.Frame(
        working_tab_paned_area,
        width=1450,
        height=3000,
    )

    working_tab_paned_window.add(section1, minsize=400)
    working_tab_paned_window.add(section2, minsize=400)

    working_tab_paned_window.paneconfigure(section1, width=500, height=3000)
    working_tab_paned_window.paneconfigure(section2, width=2000, height=3000)

    # common 영역 라벨링
    working_tab_font = tk.font.Font(
        family="맑은 고딕",
        size=12,
        # weight="bold",
    )

    # Place tksheet in G-WM tab
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
    edit_mode_button.pack(anchor="w", pady=5)

    ##############################################################
    ## section 1###########
    pjtStdGWM_treeview = TeamStd_GWMTreeView(
        state,
        section1,
        showmode="project",
    )
    # pjtStdGWM_treeview = PjtStd_GWMTreeView(state, section1)
    DefaultTreeViewStyleManager.apply_style(pjtStdGWM_treeview.treeview.tree)
    state.pjtStdGWM_treeview = pjtStdGWM_treeview

    ##############################################################
    ## section 2###########
    selected_item_label_area = ttk.Frame(
        section2,
        width=600,
    )
    selected_item_label_area.pack(side=tk.TOP, anchor="w")

    selected_item_label = ttk.Label(
        selected_item_label_area,
        text="Selected Item: ",
        font=working_tab_font,
    )
    selected_item = ttk.Label(
        selected_item_label_area,
        # textvariable=state.selected_stdGWM_item,
        textvariable=pjtStdGWM_treeview.selected_item,
        font=working_tab_font,
        foreground="blue",
    )
    selected_item_label.pack(side="left", padx=5, pady=5, anchor="w")
    selected_item.pack(side="left", padx=5, pady=5, anchor="w")

    std_matching_widget_area = ttk.Frame(
        section2,
        width=600,
    )
    std_matching_widget_area.pack(side="top", anchor="w")

    pjtStd_WMselect_sheetview_GWM = ProjectStd_WM_Selcet_SheetView_GWM(
        state, std_matching_widget_area, pjtStdGWM_treeview
    )
    ## 체크표시만 pjt-GWM에 GMW-WM 항목별로 저장하고, 시트불러올때는 std-GWM불러온뒤 체크표시만 pjt-GWM으로 업데이트 하면 어떤가?
    ######### notify_targets 등록 ###############################################
    state.notify_targets.append(pjtStd_WMselect_sheetview_GWM)
    #############################################################################

    # Register widgets with EditModeManager
    edit_mode_manager.register_widgets(
        mode_button=edit_mode_button,
        tree_views=[
            pjtStdGWM_treeview,
            # pjtStd_matching_treeview,
        ],
        # tree_ctrl_btn=[
        #     add_button,
        #     del_button,
        # ],
        # sheet=WMs_sheet,
    )

    # Set the initial state to "Locked Mode"
    edit_mode_manager.set_edit_mode("locked")

    return working_tab


def create_pjtStdSWM_tab(state, subtab_notebook):
    edit_mode_manager = EditModeManager()

    working_tab = ttk.Frame(subtab_notebook)
    subtab_notebook.add(working_tab, text=" Project Single Work Master  ")

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

    section1 = ttk.Frame(
        working_tab_paned_area,
        width=950,
        height=3000,
    )
    section2 = ttk.Frame(
        working_tab_paned_area,
        width=1450,
        height=3000,
    )

    working_tab_paned_window.add(section1, minsize=400)
    working_tab_paned_window.add(section2, minsize=400)

    working_tab_paned_window.paneconfigure(section1, width=500, height=3000)
    working_tab_paned_window.paneconfigure(section2, width=2000, height=3000)

    # common 영역 라벨링
    working_tab_font = tk.font.Font(
        family="맑은 고딕",
        size=12,
        # weight="bold",
    )

    # Place tksheet in G-WM tab
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
    edit_mode_button.pack(anchor="w", pady=5)

    ##############################################################
    ## section 1###########
    pjtStdSWM_treeview = TeamStd_SWMTreeView(
        state,
        section1,
        showmode="project",
    )
    # pjtStdGWM_treeview = PjtStd_GWMTreeView(state, section1)
    DefaultTreeViewStyleManager.apply_style(pjtStdSWM_treeview.treeview.tree)

    state.pjtStdSWM_treeview = pjtStdSWM_treeview

    ##############################################################
    ## section 2###########
    selected_item_label_area = ttk.Frame(
        section2,
        width=600,
    )
    selected_item_label_area.pack(side=tk.TOP, anchor="w")

    selected_item_label = ttk.Label(
        selected_item_label_area,
        text="Selected Item: ",
        font=working_tab_font,
    )
    selected_item = ttk.Label(
        selected_item_label_area,
        # textvariable=state.selected_stdGWM_item,
        textvariable=pjtStdSWM_treeview.selected_item,
        font=working_tab_font,
        foreground="blue",
    )
    selected_item_label.pack(side="left", padx=5, pady=5, anchor="w")
    selected_item.pack(side="left", padx=5, pady=5, anchor="w")

    std_matching_widget_area = ttk.Frame(
        section2,
        width=600,
    )
    std_matching_widget_area.pack(side="top", anchor="w")

    pjtStd_WMselect_sheetview_SWM = ProjectStd_WM_Selcet_SheetView_SWM(
        state, std_matching_widget_area, pjtStdSWM_treeview
    )
    ## 체크표시만 pjt-GWM에 GMW-WM 항목별로 저장하고, 시트불러올때는 std-GWM불러온뒤 체크표시만 pjt-GWM으로 업데이트 하면 어떤가?
    ######### notify_targets 등록 ###############################################
    state.notify_targets.append(pjtStd_WMselect_sheetview_SWM)
    #############################################################################
    # state.pjtStd_WMselect_sheetview_SWM = pjtStd_WMselect_sheetview_SWM

    # Register widgets with EditModeManager
    edit_mode_manager.register_widgets(
        mode_button=edit_mode_button,
        tree_views=[
            pjtStdSWM_treeview,
            # pjtStd_matching_treeview,
        ],
        # tree_ctrl_btn=[
        #     add_button,
        #     del_button,
        # ],
        # sheet=WMs_sheet,
    )

    # Set the initial state to "Locked Mode"
    edit_mode_manager.set_edit_mode("locked")

    return working_tab_paned_window
