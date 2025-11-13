from src.core.fp_utils import *
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
    Project_WM_perRVT_SheetView,
    ProjectApply_GWMSWM_Selcet_SheetView,
)
from src.views.widget.treeview_utils import (
    TeamStd_calcDict_TreeView,
)
from src.views.widget.pjt_familylist_widget import StdFamilyListWidget
from src.views.widget.widget import Builing_select_combobox, Current_building_label
from src.views.widget.assign_widget import (
    ModelType_entry,
    TypeAssign_treeview,
    WMapply_button,
)
from src.views.widget.collapsing_frame import CollapsingFrame
from src.views.widget.new_window import open_new_window_byFunc
from src.views.lower_tabs.group_WM_tabs import create_wmSheet_window


def create_pjt_familylist_tab(state, subtab_notebook, exe_mode=None):
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
        subtab_notebook.add(working_tab, text="Project Family Assign")
    elif exe_mode == "new window":
        working_tab.pack(expand=True, fill="both")

    section1 = ttk.Frame(
        working_tab_paned_area,
        width=1000,
        height=3000,
    )
    section2 = ttk.Frame(
        working_tab_paned_area,
        width=400,
        height=3000,
    )

    section3 = ttk.Frame(
        working_tab_paned_area,
        width=2000,
        height=3000,
    )

    working_tab_paned_window.add(section1)
    working_tab_paned_window.add(section2)
    working_tab_paned_window.add(section3)

    working_tab_paned_window.paneconfigure(
        section1,
        minsize=100,
        # maxsize=1000,
        height=3000,
    )
    working_tab_paned_window.paneconfigure(
        section2,
        minsize=400,
        width=400,
        height=3000,
    )
    working_tab_paned_window.paneconfigure(
        section3,
        minsize=1100,
        height=3000,
    )

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

    ### button for new WM sheet
    wm_newWindow_button = ttk.Button(
        working_tab_common_area,
        text="참조용 WM sheet 새창에서 열기",
        command=lambda: open_new_window_byFunc(
            state,
            tab_func=create_wmSheet_window,
        ),
    )
    wm_newWindow_button.pack(anchor="e")

    ##############################################################
    ## section 1###########
    pjt_assign_famlist = StdFamilyListWidget(state, section1)
    state.pjt_assign_famlist = pjt_assign_famlist

    ##############################################################
    ## section 2###########
    curBuilding_widget = Current_building_label(state, section2)

    modelType_entry = ModelType_entry(state, section2, relate_widget=pjt_assign_famlist)

    typeAssign_treeview = TypeAssign_treeview(
        state, section2, relate_widget=modelType_entry
    )
    typeAssign_treeview.treeview.tree.config(height=10)
    state.typeAssign_treeview = typeAssign_treeview
    ######### notify_targets 등록 ###############################################
    state.notify_targets.append(typeAssign_treeview)
    #############################################################################
    # state.typeAssign_treeview = typeAssign_treeview

    # calc_dict Area
    calc_dict_area = ttk.Frame(section2)
    calc_dict_area.pack(fill="both", side="top", anchor="s", padx=20)
    pjtAssign_calcDict_TreeView = TeamStd_calcDict_TreeView(
        state,
        calc_dict_area,
        relate_widget=pjt_assign_famlist,
        view_level=3,
    )
    pjtAssign_calcDict_TreeView.treeview.tree.config(height=12)
    ######### notify_targets 등록 ###############################################
    state.notify_targets.append(pjtAssign_calcDict_TreeView)
    #############################################################################
    # state.pjtAssign_calcDict_TreeView = pjtAssign_calcDict_TreeView

    ##############################################################
    ## section 3###########
    cf = CollapsingFrame(state, section3)
    cf.pack(fill=BOTH)

    main_area = ttk.Frame(
        cf,
        # padding=10,
    )

    suggestWM_area = ttk.Frame(
        main_area,
        # relief="ridge",
        # borderwidth=3,
    )
    suggestWM_area.pack(expand=True, fill="x", pady=3, anchor="center")

    GWMarea = ttk.Frame(
        suggestWM_area,
        # relief="sunken",
        # borderwidth=3,
    )
    GWMarea.pack(expand=True, fill="x", side="left", anchor="center")

    separator = ttk.Separator(
        suggestWM_area,
        orient="vertical",
        bootstyle="default",
    )
    separator.pack(side="left", fill="y", padx=5)

    SWMarea = ttk.Frame(
        suggestWM_area,
        # relief="sunken",
        # borderwidth=3,
    )
    SWMarea.pack(expand=True, fill="x", side="left", anchor="center")

    projectApply_GWM_Selcet_SheetView = ProjectApply_GWMSWM_Selcet_SheetView(
        state,
        GWMarea,
        pjt_assign_famlist,
        typeAssign_treeview,
    )
    ######### notify_targets 등록 ###############################################
    state.notify_targets.append(projectApply_GWM_Selcet_SheetView)
    #############################################################################

    projectApply_SWM_Selcet_SheetView = ProjectApply_GWMSWM_Selcet_SheetView(
        state,
        SWMarea,
        pjt_assign_famlist,
        typeAssign_treeview,
        wm_mode="[ SWM ]",
    )
    ######### notify_targets 등록 ###############################################
    state.notify_targets.append(projectApply_SWM_Selcet_SheetView)
    #############################################################################

    wm_apply_button = WMapply_button(
        state,
        main_area,
        ref_widgets=[
            pjt_assign_famlist,
            projectApply_GWM_Selcet_SheetView,
            projectApply_SWM_Selcet_SheetView,
            typeAssign_treeview,
        ],
        tgt_widget=None,
    )

    cf.add(
        child=main_area,
        # title="Suggested Standard Work Master items\n좌측 : 세트 메뉴   |   우측 : 사이드 단품",
        title="Work Master 메뉴판\n좌측 : 세트 메뉴   |   우측 : 사이드 단품",
        # bootstyle="info",
        fontsize=11,
        bootstyle="primary",
        suggest_area=True,
    )

    # option group 2
    customWM_area = ttk.Frame(
        cf,
        # padding=10,
    )
    state.customWM_area = customWM_area

    def toggle_height(state):
        if state.rvt_wm_isShort == True:
            state.project_WM_perRVT_SheetView.renew_sheet_height()
            state.rvt_wm_isShort = False
        else:
            state.project_WM_perRVT_SheetView.rollback_sheet_height()
            state.rvt_wm_isShort = True

    state.toggle_height = toggle_height

    project_WM_perRVT_SheetView = Project_WM_perRVT_SheetView(
        state,
        customWM_area,
        typeAssign_treeview,
        height=375,
        # height=100,
    )
    ######### notify_targets 등록 ###############################################
    state.notify_targets.append(project_WM_perRVT_SheetView)
    #############################################################################
    state.project_WM_perRVT_SheetView = project_WM_perRVT_SheetView

    cf.add(
        child=customWM_area,
        # title="Final WM Registration per Rvt Type",
        # collapsed=True,
        collapsed=False,
        textvariable=state.selected_rvtTypes_forLabel,
        # fontsize=10,
        bootstyle="info",
    )

    # Register widgets with EditModeManager
    edit_mode_manager.register_widgets(
        mode_button=edit_mode_button,
        tree_views=[
            pjt_assign_famlist.familylist,
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
