import tkinter as tk
from tkinter import ttk
import ttkbootstrap as ttk
from ttkbootstrap.constants import *


from src.views.widget.treeview_utils import TeamStd_FamlistTreeView


class StdFamilyListWidget(tk.Frame):
    def __init__(self, state, parent, *args, **kwargs):
        self.state = state
        # self.init_ui()
        frame = ttk.Frame(parent)
        frame.pack(fill="both", padx=3)

        familylist = self.set_familylist(frame)
        self.familylist = familylist
        self.treeview = familylist.treeview
        self.tree = familylist.treeview.tree

        self.selected_item = familylist.selected_item
        self.data_kind = familylist.data_kind

    def set_familylist(self, parent):
        teamStd_FamlistTreeView = TeamStd_FamlistTreeView(
            self.state,
            parent,
            title="대상 건물에 존재하는 부재종류를 선택해 주세요",
            showmode="project_assign",
        )

        teamStd_FamlistTreeView.treeview.tree.column(
            0, width=0, minwidth=0, stretch=False
        )
        teamStd_FamlistTreeView.treeview.tree.column(
            "No", width=25, minwidth=25, stretch=True
        )
        teamStd_FamlistTreeView.treeview.tree.column(
            "Family Name", width=170, minwidth=170, stretch=True
        )
        teamStd_FamlistTreeView.treeview.tree.column(
            "Item", width=0, minwidth=0, stretch=False
        )
        teamStd_FamlistTreeView.treeview.tree.column(
            "표준산출 수식", width=0, minwidth=0, stretch=False
        )
        teamStd_FamlistTreeView.treeview.tree.column(
            "Description", width=0, minwidth=0, stretch=False
        )
        teamStd_FamlistTreeView.treeview.tree.column(
            "GWM/SWM", width=40, minwidth=40, stretch=True
        )
        teamStd_FamlistTreeView.treeview.tree.column(
            "표준산출유형 번호", width=40, minwidth=40, stretch=True
        )

        return teamStd_FamlistTreeView
