import tkinter as tk
import tkinter.font
from PIL import Image, ImageTk
from PIL.Image import Resampling

# from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from src.controllers.widget.widgets import EditModeManager
from src.views.widget.treeview_utils import BuildingList_TreeView

from src.views.widget.html_viewer import BrowserWidget
from src.views.widget.widget import TabNavigationButton


def create_pjtApply_Main_tab(state, subtab_notebook, exe_mode=None):

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
        subtab_notebook.add(working_tab, text="Project Input Main")

        section1 = ttk.Frame(
            working_tab_paned_area,
            width=1000,
            height=3000,
        )
        section2 = ttk.Frame(
            working_tab_paned_area,
            width=1000,
            height=3000,
        )
        section3 = ttk.Frame(
            working_tab_paned_area,
            width=1000,
            height=3000,
        )

        working_tab_paned_window.add(section1, minsize=400)
        working_tab_paned_window.paneconfigure(section1, height=3000)

        working_tab_paned_window.add(section2, minsize=400)
        working_tab_paned_window.paneconfigure(section2, height=3000)

        working_tab_paned_window.add(section3, minsize=400)
        working_tab_paned_window.paneconfigure(section3, height=3000)

        # common 영역 라벨링
        working_tab_font = tk.font.Font(
            family="맑은 고딕",
            size=12,
            # weight="bold",
        )

        # Place tksheet in Project Main tab
        ##############################################################
        ## tab_common_area###########

        # # Create an "Edit Mode" / "Locked Mode" button
        # edit_mode_button = tk.Button(
        #     working_tab_common_area,
        #     text="Locked Mode",
        #     command=lambda: edit_mode_manager.set_edit_mode(
        #         "edit" if edit_mode_button.cget("text") == "Locked Mode" else "locked"
        #     ),
        # )
        # edit_mode_button.pack(anchor="w", pady=5)

        ##############################################################
        ## section 1###########

        pjt_buildingList_area = ttk.Frame(
            section1,
            width=600,
        )
        pjt_buildingList_area.pack(side=tk.TOP, anchor="nw")

        pjt_building_list = BuildingList_TreeView(state, pjt_buildingList_area)
        state.pjt_building_list = pjt_building_list

        ##############################################################
        ## section 2###########
        pjt_rvtSummary_area = ttk.Frame(
            section2,
            width=600,
        )
        pjt_rvtSummary_area.pack(padx=20, side=tk.TOP, anchor="nw")

        std_main_img_ = Image.open("resource/pjt_input_main.png")
        std_main_img_ = std_main_img_.resize((800, 800), resample=Resampling.LANCZOS)
        std_main_img = ImageTk.PhotoImage(std_main_img_)

        tk.Label.image3 = std_main_img

        mainImg_label = tk.Label(pjt_rvtSummary_area, image=std_main_img)
        # logo_label.configure(bg=frame_bgcolor)
        mainImg_label.pack(side=tk.TOP, padx=50, pady=20, anchor="center")
        # FilePathRegister(pjt_rvtSummary_area)

        ##############################################################
        ## section 3###########
        TabNavigationButton(
            parent=section3,
            notebook=subtab_notebook,
            tab_index=1,
            button_text="→ 빌딩을 추가했으면 \n\n    Project Family Assign 탭으로 이동",
        )
        # browser = BrowserWidget(
        #     section3,
        #     # html_file="recource/RVT Summary.html",
        #     html_file="",
        #     # url="https://www.google.com",
        # )

        # browser.pack(fill="both", expand=True, padx=10, pady=10)
        # browser.start_webview()

        # Save the browser widget in state for later shutdown
        # state.browser_widget = browser

    elif exe_mode == "new_window":
        section3 = ttk.Frame(
            working_tab_paned_area,
            width=2000,
            height=3000,
        )
        working_tab_paned_window.add(section3, minsize=2000)
        working_tab_paned_window.paneconfigure(section3, height=3000)

        browser = BrowserWidget(
            section3,
            html_file="C:/Users/HEC/Pictures/RVT Summary.html",
        )

        browser.pack(fill="both", expand=True, padx=10, pady=10)

    return working_tab
