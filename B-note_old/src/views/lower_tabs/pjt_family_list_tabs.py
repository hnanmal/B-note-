import tkinter as tk
import tkinter.font

# from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from src.controllers.widget.widgets import (
    EditModeManager,
    handle_add_button_press,
)

from src.views.widget.treeview_utils import (
    TeamStd_FamlistTreeView,
    TeamStd_GWMTreeView,
    TeamStd_calcDict_TreeView,
    TeamStd_SWMTreeView,
)
from src.views.widget.widget import WidgetSwitcher


def create_pjtFamList_tab(state, subtab_notebook):
    edit_mode_manager = EditModeManager()

    working_tab = ttk.Frame(subtab_notebook)
    subtab_notebook.add(working_tab, text="   ▶ Project Family List     ")

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

    section2 = ttk.Frame(
        working_tab_paned_area,
        width=1200,
        height=3000,
    )
    section1 = ttk.Frame(
        working_tab_paned_area,
        width=500,
        height=3000,
    )
    section3 = ttk.Frame(
        working_tab_paned_area,
        width=600,
        height=3000,
    )

    working_tab_paned_window.add(section1, minsize=300)
    working_tab_paned_window.add(section2, minsize=400)
    working_tab_paned_window.add(section3, minsize=270)

    working_tab_paned_window.paneconfigure(section1, width=500, height=3000)
    working_tab_paned_window.paneconfigure(section2, width=1100, height=3000)
    working_tab_paned_window.paneconfigure(section3, height=3000)

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

    std_matching_widget_area = ttk.Frame(
        section1,
        width=600,
    )

    std_GWMTreeView = TeamStd_GWMTreeView(
        state, std_matching_widget_area, showmode="project_fl", view_level=2
    )
    state.std_GWMTreeView = std_GWMTreeView
    # std_GWMTreeView.treeview.tree.column(2, width=0, minwidth=0, stretch=False)
    std_GWMTreeView.tree_frame.pack_forget()

    std_SWMTreeView = TeamStd_SWMTreeView(
        state, std_matching_widget_area, showmode="project_fl", view_level=2
    )
    state.std_SWMTreeView = std_SWMTreeView
    # std_SWMTreeView.treeview.tree.column(2, width=0, minwidth=0, stretch=False)
    std_SWMTreeView.tree_frame.pack_forget()

    widgetSwitcher = WidgetSwitcher(
        state,
        std_matching_widget_area,
        {
            "GWM": std_GWMTreeView,
            "SWM": std_SWMTreeView,
            # "GWM": std_GWMTreeView.tree_frame,
            # "SWM": std_SWMTreeView.tree_frame,
        },
        default_selection="GWM",
        default_width=600,
    )
    ######### notify_targets 등록 ###############################################
    # state.notify_targets.append(widgetSwitcher)
    ## 상기 코드 활성화 시 트리뷰 항목 더블클릭 에러 발생
    #############################################################################
    # state.widgetSwitcher_team = widgetSwitcher

    std_matching_btn_area = ttk.Frame(
        section1,
        width=100,
    )
    std_matching_btn_area.pack(side="top", padx=5, pady=5, anchor="ne")
    std_matching_widget_area.pack(fill="both", expand=True, side="top", anchor="w")
    # Create a button and place it in the window
    add_button = tk.Button(
        std_matching_btn_area,
        text="Add 🡆",  # Button text
        command=lambda: handle_add_button_press(
            state,
            # data_kind="std-GWM",
            related_widget=stdFamlist_treeview,
            other_widget=widgetSwitcher,
        ),  # Function to call when clicked
        font=("Arial", 10),  # Custom font for button text
        bg="#fffec0",  # Background color
        fg="black",  # Text color
        width=8,  # Width of the button
        height=1,  # Height of the button
        relief=tk.RAISED,
    )  # Border style: can be FLAT, SUNKEN, RAISED, GROOVE, RIDGE

    add_button.pack(
        side="left", padx=5, pady=5, anchor="nw"
    )  # Add padding around the button

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

    stdFamlist_treeview = TeamStd_FamlistTreeView(
        state,
        section2,
        title="Project Family List",
        showmode="project",
        view_level=3,
    )
    stdFamlist_treeview.treeview.tree.column(0, width=0, minwidth=0, stretch=False)

    # stdFamlist_treeview = TeamStd_FamlistSheetTreeView(state, section2, view_level=3)

    selected_item = ttk.Label(
        selected_item_label_area,
        # textvariable=state.selected_stdGWM_item,
        textvariable=stdFamlist_treeview.selected_item,
        font=working_tab_font,
        foreground="blue",
    )
    selected_item_label.pack(side="left", padx=5, pady=5, anchor="w")
    selected_item.pack(side="left", padx=5, pady=5, anchor="w")

    ##############################################################
    ## section 3###########

    pjt_calcDict_TreeView = TeamStd_calcDict_TreeView(
        state,
        section3,
        relate_widget=stdFamlist_treeview,
        data_kind=stdFamlist_treeview.data_kind,
        view_level=3,
    )
    ######### notify_targets 등록 ###############################################
    state.notify_targets.append(pjt_calcDict_TreeView)
    #############################################################################
    # state.std_calcDict_TreeView = std_calcDict_TreeView

    # Register widgets with EditModeManager
    edit_mode_manager.register_widgets(
        mode_button=edit_mode_button,
        tree_views=[
            # stdFamlist_treeview,
            pjt_calcDict_TreeView,
            std_GWMTreeView,
            std_SWMTreeView,
        ],
        tree_ctrl_btn=[
            add_button,
            # del_button,
        ],
        # sheet=WMs_sheet,
    )

    # Set the initial state to "Locked Mode"
    edit_mode_manager.set_edit_mode("locked")

    return working_tab
