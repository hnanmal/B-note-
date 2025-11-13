import tkinter as tk
import tkinter.font
from tkinter import ttk
from PIL import Image, ImageTk

from src.controllers.widget.widgets import (
    EditModeManager,
)

from src.views.widget.treeview_utils import (
    TeamStd_CommonInputTreeView,
    DefaultTreeViewStyleManager,
)


def create_common_input_tab(state, subtab_notebook):
    edit_mode_manager = EditModeManager()

    working_tab = ttk.Frame(subtab_notebook)
    subtab_notebook.add(working_tab, text="Common Input")

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
        width=600,
        height=3000,
    )
    section3 = ttk.Frame(
        working_tab_paned_area,
        width=600,
        height=3000,
    )

    working_tab_paned_window.add(section1, minsize=800)
    # working_tab_paned_window.add(section2, minsize=100)
    working_tab_paned_window.add(section3, minsize=700)

    working_tab_paned_window.paneconfigure(section1, height=3000)
    working_tab_paned_window.paneconfigure(section2, width=600, height=3000)
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

    std_commonInput_treeview = TeamStd_CommonInputTreeView(state, section1)
    DefaultTreeViewStyleManager.apply_style(std_commonInput_treeview.treeview.tree)

    # Create a frame for the custom-styled labels of Column B
    column_b_frame = ttk.Frame(section1)
    column_b_frame.pack(side="right", fill="y", expand=True)

    # ##############################################################
    # ## section 2###########

    # ##############################################################
    # ## section 3###########
    # Alternatively, using PIL for other image formats like JPG
    image = Image.open("resource/common_info_pic1.png")
    image.resize((500, 250), Image.LANCZOS)
    # image = image.resize(
    #     (200, 200),
    # )  # Image.ANTIALIAS)  # Resize the image if needed
    photo = ImageTk.PhotoImage(image)

    label = ttk.Label(section3, image=photo)
    label.image = photo  # Keep a reference to avoid garbage collection
    label.pack()
    # WMs_sheet = TeamStd_WMsSheetView(state, section3)

    # Register widgets with EditModeManager
    edit_mode_manager.register_widgets(
        mode_button=edit_mode_button,
        tree_views=[
            std_commonInput_treeview,
        ],
    )

    # Set the initial state to "Locked Mode"
    edit_mode_manager.set_edit_mode("locked")

    return working_tab
