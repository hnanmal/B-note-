import tkinter as tk
import tkinter.font
from PIL import ImageTk, Image
from PIL.Image import Resampling

# from tkhtmlview import HTMLLabel
# from cefpython3 import cefpython as cef

# from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

from src.controllers.widget.widgets import EditModeManager
from src.views.widget.pjt_main_widget import ProjectInfoWidget


def create_pjtStd_Main_tab(state, subtab_notebook, exe_mode=None):

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
        subtab_notebook.add(working_tab, text="Project Main")

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

    ProjectInfoWidget(state, section1)

    ##############################################################
    ## section 2###########
    pjt_stdDashboard_area = ttk.Frame(
        section2,
        width=900,
    )
    pjt_stdDashboard_area.pack()

    # ProjectStdDashboard(state, pjt_stdDashboard_area)

    std_main_img_ = Image.open("resource/pjt_std_main.png")
    std_main_img_ = std_main_img_.resize((800, 800), resample=Resampling.LANCZOS)
    std_main_img = ImageTk.PhotoImage(std_main_img_)

    tk.Label.image2 = std_main_img

    mainImg_label = tk.Label(pjt_stdDashboard_area, image=std_main_img)
    # logo_label.configure(bg=frame_bgcolor)
    mainImg_label.pack(side=tk.TOP, padx=50, pady=20, anchor="center")

    ##############################################################
    ## section 3###########
    notice_text = """
                <<< !! 한번 읽어보고 가세요 !! >>>
        
        
        
        
        
        1.  [신규 프로젝트 시작] 을 누르셨다면, 
        
            가장 먼저 프로젝트 이름을 입력하고
            
            [BNOTE에 프로젝트 이름 등록] 버튼을 눌러주세요.
            
            그 다음 현재 파일을 다른이름으로 저장해주시면 되요.
            ( Ctrl + S 혹은 File > Save 버튼 )
            
            
            
        2.  [작성된 Bnote 열기] 를 누르셨거나 프로젝트 저장을 했다면, 
        
            Pjt G-WM / Pjt S-WM 탭으로 이동해서
            
            해당 프로젝트의 주요 스펙들을 지정하시면 됩니다.
        
        
        
        
        3.  Project Family List 탭에서는 부재 표준 타입 마다,
        
            GWM 항목과 SWM 항목을 등록해 둘수 있어요.
            
            GWM / SWM 등록을 잘 해두면,
            
            Project Apply 에서 Work Master 할당이
            
            꽤 빨라지니 참고하세요. (자세한 내용은 팀내 교육 참고)
    """

    notice_label = ttk.Label(
        section3,
        text=notice_text,
        font=("Arial", 12),
    )
    notice_label.pack()
    return working_tab_paned_window
