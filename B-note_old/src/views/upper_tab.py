import tkinter as tk
from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from PIL import ImageTk, Image
from PIL.Image import Resampling

from src.core.web import open_url_in_browser
from src.core.recent_file_widget import RecentPinnedWidget
from src.core.fp_utils import *
from src.core.file_utils import load_from_json
from src.views.lower_tabs.group_WM_tabs import create_stdGWM_tab, create_stdSWM_tab
from src.views.lower_tabs.common_input_tab import create_common_input_tab
from src.views.lower_tabs.std_family_list_tabs import create_stdFamList_tab
from src.views.lower_tabs.pjt_group_WM_tabs import (
    create_pjtStdGWM_tab,
    create_pjtStdSWM_tab,
)
from src.views.lower_tabs.pjt_std_main_tab import create_pjtStd_Main_tab
from src.views.lower_tabs.pjt_apply_main_tab import create_pjtApply_Main_tab
from src.views.lower_tabs.pjt_family_assign_tab import create_pjt_familylist_tab
from src.views.lower_tabs.pjt_family_list_tabs import create_pjtFamList_tab
from src.views.lower_tabs.std_main_tab import create_std_Main_tab
from src.views.widget.widget import select_tab
from src.views.lower_tabs.pjt_report_member_tab import create_report_member_tab

from src.views.widget.new_window import open_tab_in_new_window
from src.views.lower_tabs.pjt_report_group_tab import create_report_group_tab
from src.views.lower_tabs.pjt_report_TotalBD_tab import create_report_TotalBD_tab
from src.views.widget.easter_egg import EasterEggApp
from src.views.lower_tabs.pjt_int_matrix_tab import create_pjt_intMatrix_tab


def create_tab_with_subtabs(state, notebook, tab_name):
    # Create the main tab
    main_frame = ttk.Frame(notebook)
    notebook.add(main_frame, text=tab_name)

    # Create the notebook for subtabs
    subtab_notebook = ttk.Notebook(
        main_frame,
        # style="Subtab.TNotebook",
        bootstyle=state.tab_bootStyle,
    )
    # subtab_notebook = ttk.Notebook(main_frame, style="lefttab.TNotebook")
    subtab_notebook.pack(expand=True, fill="both")

    return subtab_notebook


def create_recentBnotes_tab(state, notebook):
    # Create a style
    # frame_bgcolor = "#ebf7ee"
    frame_bgcolor = "#e3e3e3"
    style = ttk.Style()
    style.configure("Custom.TFrame", background=frame_bgcolor)

    main_frame = ttk.Frame(notebook)
    notebook.add(
        main_frame,
        # text="Recent Bnotes",
        text="   Home   ",
    )

    working_tab_paned_area = ttk.Frame(
        main_frame,
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
        width=200,
        height=3000,
        style="Custom.TFrame",
    )
    section2 = ttk.Frame(
        working_tab_paned_area,
        width=2000,
        height=3000,
    )

    working_tab_paned_window.add(section1, minsize=200)
    working_tab_paned_window.paneconfigure(section1, height=3000)

    working_tab_paned_window.add(section2, minsize=1500)
    working_tab_paned_window.paneconfigure(section2, height=3000)

    ##############################################################
    ## section 1###########
    logo_area = ttk.Frame(
        section1,
        width=200,
        style="Custom.TFrame",
    )
    logo_area.pack(side=tk.TOP, anchor="center")

    logo_img_ = Image.open("resource/app_logo_maintab.png")
    # logo_img_ = logo_img_.resize((180, 187), resample=Resampling.LANCZOS)
    logo_img_ = logo_img_.resize((270, 200), resample=Resampling.LANCZOS)
    logo_img = ImageTk.PhotoImage(logo_img_)

    tk.Label.image1 = logo_img

    logo_label = tk.Label(logo_area, image=logo_img)
    logo_label.configure(bg=frame_bgcolor)
    logo_label.pack(side=tk.TOP, padx=50, pady=20, anchor="center")

    easter = EasterEggApp(logo_label)

    menu_area = ttk.Frame(
        section1,
        width=200,
        style="Custom.TFrame",
    )
    menu_area.pack(side=tk.TOP, padx=10, anchor="center")

    def open_move_tab_func(path=None):
        if path:
            load_result = load_from_json(state, _file_path=path)
        else:
            load_result = load_from_json(state)
        if load_result:
            # notebook.select(2)
            select_tab(notebook, 2, subtab_index=0)
            pass

    open_bnote_btn = ttk.Button(
        menu_area,
        text="작성된 Bnote 열기",
        width=30,
        command=open_move_tab_func,
        bootstyle="primary-outline",
    )
    open_bnote_btn.pack(side=tk.TOP, padx=20, pady=50, anchor="ne")

    start_withStd_btn = ttk.Button(
        menu_area,
        text="신규 프로젝트 시작\n(by Team Standard)",
        width=30,
        command=lambda: open_move_tab_func(
            path="resource/PlantArch_BIM Standard.bnote"
        ),
        bootstyle="info-outline",
    )
    start_withStd_btn.pack(side=tk.TOP, padx=20, anchor="ne")

    bottom_area = ttk.Frame(
        section1,
        width=200,
        style="Custom.TFrame",
    )
    bottom_area.pack(side="bottom", anchor="w")
    downlink_label = ttk.Label(
        bottom_area,
        text="최신 B-note 설치파일 다운로드 페이지",
        background="#e3e3e3",
        foreground="blue",
        cursor="hand2",
        # style="Custom.TFrame",
    )
    downlink_label.pack(anchor="w", padx=30)
    downlink_label.bind(
        "<Button-1>",
        lambda e: open_url_in_browser(
            "https://henginmc6eaoutlook.sharepoint.com/:f:/s/jhjh/Ele1tr-icRxHtzTvnb3iqcgBlL8RMFu-p0fiL0sXeLJMSg?e=2sdPPM"
        ),
    )

    ##############################################################
    ## section 2###########
    recent_notes_area = ttk.Frame(
        section2,
        width=600,
    )
    recent_notes_area.pack(padx=150, side=tk.TOP, anchor="nw")

    recent_page = RecentPinnedWidget(recent_notes_area, state)
    recent_page.pack(fill="both", expand=True, padx=10, pady=10)
    state.recent_page = recent_page

    return notebook


def create_team_standard_tab(state, notebook):
    subtab_notebook = create_tab_with_subtabs(state, notebook, "   Team Standard   ")

    # Add each subtab
    main_tab = create_std_Main_tab(state, subtab_notebook)
    g_wm_tab = create_stdGWM_tab(state, subtab_notebook)
    s_wm_tab = create_stdSWM_tab(state, subtab_notebook)

    ### common_input_tab / std_Famlist_tab 일단 제거 - 추후 팀 스탠다드 용 위젯으로 재편 후 추가 ###
    # common_input_tab = create_common_input_tab(state, subtab_notebook)
    # std_Famlist_tab = create_stdFamList_tab(state, subtab_notebook)


def create_project_standard_tab(state, notebook):
    subtab_notebook = create_tab_with_subtabs(state, notebook, "   Project Standard   ")
    state.pjtStd_tab = subtab_notebook

    # Add each subtab
    main_tab = create_pjtStd_Main_tab(state, subtab_notebook)
    g_wm_tab = create_pjtStdGWM_tab(state, subtab_notebook)
    s_wm_tab = create_pjtStdSWM_tab(state, subtab_notebook)
    state.s_wm_tab = s_wm_tab
    common_input_tab = create_common_input_tab(state, subtab_notebook)
    pjt_Famlist_tab = create_pjtFamList_tab(state, subtab_notebook)

    tab_funcs = [
        create_pjtStd_Main_tab,
        create_pjtStdGWM_tab,
        create_pjtStdSWM_tab,
        create_common_input_tab,
        create_pjtFamList_tab,
    ]

    # # Bind double-click event to the tabs
    # subtab_notebook.bind(
    #     "<Double-1>",
    #     lambda e: open_tab_in_new_window(state, subtab_notebook, tab_funcs, e),
    # )


def create_project_apply_tab(state, notebook):
    subtab_notebook = create_tab_with_subtabs(state, notebook, "   Project Input   ")

    # Add each subtab
    main_tab = create_pjtApply_Main_tab(state, subtab_notebook)
    famlist_tab = create_pjt_familylist_tab(state, subtab_notebook)
    intMatrix_tab = create_pjt_intMatrix_tab(state, subtab_notebook)

    tab_funcs = [
        # create_pjtApply_Main_tab,
        # create_pjt_familylist_tab,
        "not_func",
        "not_func",
        create_pjt_intMatrix_tab,
    ]

    # Bind double-click event to the tabs
    subtab_notebook.bind(
        "<Double-1>",
        lambda e: open_tab_in_new_window(state, subtab_notebook, tab_funcs, event=e),
    )

    state.pjt_apply_notebook = subtab_notebook


def create_project_report_tab(state, notebook):
    subtab_notebook = create_tab_with_subtabs(state, notebook, "   Project Report   ")

    # Add each subtab
    member_report_tab = create_report_member_tab(state, subtab_notebook)
    type_report_tab = create_report_group_tab(state, subtab_notebook)
    totalBD_report_tab = create_report_TotalBD_tab(state, subtab_notebook)
    # wm_report_tab = create_report_wm_tab(state, subtab_notebook)

    tab_funcs = [
        create_report_member_tab,
        create_report_group_tab,
        create_report_TotalBD_tab,
    ]

    # Bind double-click event to the tabs
    subtab_notebook.bind(
        "<Double-1>",
        lambda e: open_tab_in_new_window(state, subtab_notebook, tab_funcs, event=e),
    )

    state.pjt_report_notebook = subtab_notebook
