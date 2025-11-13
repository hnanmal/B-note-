import tkinter as tk
import tkinter.font


# from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from src.controllers.widget.widgets import EditModeManager


def create_std_Main_tab(state, subtab_notebook):
    edit_mode_manager = EditModeManager()

    working_tab = ttk.Frame(subtab_notebook)
    subtab_notebook.add(working_tab, text=" Guidelines  ")

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

    # working_tab_paned_window.add(section2, minsize=400)
    # working_tab_paned_window.paneconfigure(section2, height=3000)

    # working_tab_paned_window.add(section3, minsize=400)
    # working_tab_paned_window.paneconfigure(section3, height=3000)

    # common 영역 라벨링
    working_tab_font = tk.font.Font(
        family="맑은 고딕",
        size=12,
        # weight="bold",
    )

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

    notice_text = """
        << Team Standard의 내용을 편집하고자 할때는 BIM W/G에 문의하시는 것을 권장합니다. >>
        
        ➕ GWM/SWM 항목의 내용 추가는 가능합니다.( 추후 변동내역 BIM W/G 에 Report )
        ➕ Common Input 항목의 내용 추가는 가능합니다.( 추후 변동내역 BIM W/G 에 Report )
        ➕ Standard Family List 항목의 내용 추가는 가능합니다.( 추후 변동내역 BIM W/G 에 Report )

        ✏️ GWM/SWM 항목의 내용 수정은 가능합니다.( 추후 변동내역 BIM W/G 에 Report )
        ✏️ Common Input 항목의 내용 수정은 가능합니다.( 추후 변동내역 BIM W/G 에 Report )
        ✏️ Standard Family List 항목의 내용 수정은 가능합니다.( 추후 변동내역 BIM W/G 에 Report )
        
        🚫 GWM/SWM 항목의 삭제는 불가합니다.(팀스탠다드의 항목은 기본 정책이 삭제 불가 )
        🚫 Common Input 항목의 삭제는 불가합니다.(팀스탠다드의 항목은 기본 정책이 삭제 불가 )
        🚫 Standard Family List 항목의 삭제는 불가합니다.(팀스탠다드의 항목은 기본 정책이 삭제 불가 )
        
        
        ✔ 필요한 내용 수정은 Project Standard 탭을 이용하는 것이 원칙입니다.
    """

    notice_label = ttk.Label(
        section1,
        text=notice_text,
        font=("Arial", 25),
    )
    notice_label.pack()
