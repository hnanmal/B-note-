import tkinter as tk
from tkinter import ttk


def create_radio_btn(root, options=[]):
    res_btns = []
    radio_frame = tk.Frame(root)
    radio_frame.pack(anchor="w")

    if options:
        # 라디오 버튼 선택값을 저장할 변수 생성
        selected_option = tk.StringVar(value=options[0])  # 기본값 설정 ("Option 1")

    for idx, option in enumerate(options):
        btn = tk.Radiobutton(
            radio_frame, text=option, variable=selected_option, value=option
        )
        btn.pack(side="left", anchor="w")
        if idx == 0:
            btn.select()
        res_btns.append(btn)

    return selected_option
