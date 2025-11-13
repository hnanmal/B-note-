import tkinter as tk
from tkinter import messagebox
from tkinter import filedialog

# from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *

# from tkinterdnd2 import TkinterDnD

# from tkinter.ttk import Progressbar
# from pathlib import Path
from PIL import ImageTk, Image

# import time

# from src.controllers.db_update_manager import DBUpdateManager
from src.core.app_update import APP_VERSION
from src.core.file_utils import load_from_json, on_closing, save_to_json_teamStdInfo
from src.views.upper_tab import (
    create_project_apply_tab,
    create_project_report_tab,
    create_project_standard_tab,
    create_recentBnotes_tab,
    create_team_standard_tab,
)
from src.views.app_ui_setup import initialize_app
from src.views.widget.widget import open_filesave_dialog


def main():
    icon_path = "resource/app_logo.ico"
    # root = tk.Tk()
    # root = ttk.Window(themename="journal")
    root = ttk.Window()
    root.geometry("1400x900+100+100")
    # root = TkinterDnD.Tk()
    # root.wm_iconbitmap(icon_path)
    root.iconbitmap(icon_path)
    root.iconify()
    # Apply ttkbootstrap theme
    style = ttk.Style()
    style.theme_use("cosmo")  # Use your preferred ttkbootstrap theme
    ################

    notebook, state = initialize_app(root)

    state.root = root
    state.notebook = notebook

    state.icon_path = icon_path

    splash = show_splash_screen()

    splash.wait_window()  # Wait for the splash screen to close

    # Create parent tabs within the notebook
    create_recentBnotes_tab(state, notebook)

    create_team_standard_tab(state, notebook)

    create_project_standard_tab(state, notebook)

    create_project_apply_tab(state, notebook)

    create_project_report_tab(state, notebook)

    root.deiconify()

    root.state("zoomed")

    ## 어플리케이션 시작시 메시지
    state.log_widget.write("어서오세요!\n")

    notebook.select(0)

    # Handle window close event
    root.protocol("WM_DELETE_WINDOW", lambda: on_closing(root, state))

    root.attributes("-topmost", False)

    root.mainloop()


def show_splash_screen():
    """Create and display a splash screen."""
    splash_width = 700
    splash_height = 350

    splash = tk.Toplevel()
    splash.configure(bg="#ebebeb", highlightthickness=5)
    splash.title("B-Note")
    splash.geometry(f"{splash_width}x{splash_height}")
    splash.overrideredirect(True)  # Remove window decorations (close, minimize, etc.)
    # Set the new window to always be on top
    splash.attributes("-topmost", True)
    splash.wm_attributes("-alpha", 0.9)  # Set transparency

    # Add branding or loading information
    logo_img_ = Image.open("resource/app_logo_maintab.png")
    logo_img_ = logo_img_.resize((400, 300), Image.LANCZOS)
    logo_img = ImageTk.PhotoImage(logo_img_)

    tk.Label.image = logo_img

    logo_area = tk.Frame(splash)
    logo_area.configure(bg="#ebebeb")
    logo_area.pack(side="left")

    text_area = tk.Frame(splash)
    text_area.configure(bg="#ebebeb")
    text_area.pack(padx=20, side="left")

    logo_label = tk.Label(logo_area, image=logo_img)
    logo_label.configure(bg="#ebebeb")
    logo_label.pack(padx=20)
    logo_label.pack()

    text_label2 = tk.Label(
        text_area,
        # text="HEC BIM Note, now Loading...",
        text=f"B-note 시작하는중...\n\nversion : v{APP_VERSION}",
        font=("Arial", 12),
    )
    text_label2.configure(bg="#ebebeb")
    text_label2.pack(padx=20, pady=10, anchor="ne")

    # Center the splash screen
    splash.update_idletasks()
    screen_width = splash.winfo_screenwidth()
    screen_height = splash.winfo_screenheight()

    x = (screen_width // 2) - (splash_width // 2)
    y = (screen_height // 2) - (splash_height // 2)
    splash.geometry(f"{splash_width}x{splash_height}+{x}+{y}")

    # Close splash screen after 3 seconds
    splash.after(5000, splash.destroy)

    return splash


if __name__ == "__main__":
    main()
