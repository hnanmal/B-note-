import tkinter as tk
from tkinter import messagebox
import requests
import os
import shutil
import sys

# import subprocess
from datetime import datetime

from src.core.web import open_url_in_browser

APP_VERSION = "1.3.9"  # Your app's current version
UPDATE_URL = "https://raw.githubusercontent.com/hnanmal/mQ/refs/heads/master/H_BimNote/resource/version.json"  # Replace with your real URL


def check_for_update():
    try:
        response = requests.get(UPDATE_URL)
        latest_version_data = response.json()
        latest_version = latest_version_data["version"]
        download_url = latest_version_data["download_url"]

        if latest_version > APP_VERSION:
            answer = messagebox.askyesno(
                "Update Available",
                # f"새 버전({latest_version}) 을 이용할 수 있습니다. 업데이트 하시겠습니까?",
                f"새 버전({latest_version}) 을 이용할 수 있습니다. 설치파일 다운로드 페이지로 이동하시겠습니까까?",
            )
            if answer:
                # download_update(download_url) # 업데이트 방식 변경으로 삭제 예정
                open_url_in_browser(
                    "https://henginmc6eaoutlook.sharepoint.com/:f:/s/jhjh/Ele1tr-icRxHtzTvnb3iqcgBlL8RMFu-p0fiL0sXeLJMSg?e=2sdPPM"
                )
        else:
            messagebox.showinfo("No Update", "현재 최신버전입니다.")

    except Exception as e:
        messagebox.showerror("Error", f"Failed to check for updates: {e}")


def download_update(download_url):
    """Download and replace the old executable."""
    try:
        update_filename = "app_update.exe"  # Temporary filename
        response = requests.get(download_url, stream=True)
        with open(update_filename, "wb") as file:
            for chunk in response.iter_content(1024):
                file.write(chunk)

        messagebox.showinfo(
            "Update Downloaded",
            "새 버전이 다운로드 되었습니다. 프로그램이 종료되니 재시작 해주세요.",
        )

        # Restart the app with the new update
        apply_update(update_filename)

    except Exception as e:
        messagebox.showerror("Update Failed", f"Failed to download update: {e}")


def restart_application():
    current_exe = sys.executable
    os.execv(current_exe, [current_exe])


def apply_update(update_filename):
    """Replace the old exe with the new one and restart."""
    current_exe = sys.executable  # Get current executable path

    # Rename the old exe (backup)
    # backup_exe = current_exe + ".old"

    now = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_exe = current_exe + now + ".old"
    # os.rename(current_exe, backup_exe)
    shutil.move(current_exe, backup_exe)

    # Move the new update to replace the old executable
    # os.rename(update_filename, current_exe)
    shutil.move(update_filename, current_exe)

    # Restart the application
    # subprocess.Popen([current_exe])
    # restart_application()
    sys.exit()
