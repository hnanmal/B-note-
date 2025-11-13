# src/views/widget/listbox_utils.py

import tkinter as tk
import tkinter.font
from tkinter import ttk


class BaseListBox:
    def __init__(self, state, parent):
        self.state = state
        self.listbox = tk.Listbox(parent, selectmode=tk.EXTENDED)
        self.listbox.pack(expand=True, fill="both")
        self.state.observer_manager.add_observer(self.update_listbox)
        self.listbox.bind("<<ListboxSelect>>", self.on_listbox_edit)

    def update_listbox(self, state):
        """Updates the listbox whenever the state changes."""
        selected_tree_item = state.selected_tree_item
        if selected_tree_item:
            self.listbox.delete(0, tk.END)  # Clear existing items
            for item in state.get_matching(selected_tree_item):
                self.listbox.insert(tk.END, item)

    def on_listbox_edit(self, event):
        """Update state based on listbox edits."""
        selected_tree_item = self.state.selected_tree_item
        if selected_tree_item:
            current_items = [
                self.listbox.get(idx) for idx in range(self.listbox.size())
            ]
            self.state.update_matching(selected_tree_item, current_items)


def create_listbox(state, frame):
    # Create a frame to hold the Listbox and scrollbar
    listbox_frame = ttk.Frame(frame)
    listbox_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    # Create Listbox
    listbox = tk.Listbox(
        listbox_frame,
        selectmode=tk.EXTENDED,  # Allow multiple selections
        bg="white",  # Background color
        fg="black",  # Text color
        font=("Arial", 11),  # Font customization
        activestyle="none",
        selectbackground="green",  # Highlight background color
        selectforeground="white",  # Highlight text color
        # highlightthickness=0,
        width=60,
        height=50,
    )  # Width and height of Listbox

    # Add Scrollbar
    scrollbar = tk.Scrollbar(listbox_frame, orient=tk.VERTICAL)
    scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    # Connect Scrollbar to Listbox
    listbox.config(yscrollcommand=scrollbar.set)
    scrollbar.config(command=listbox.yview)

    listbox.pack(side=tk.TOP, fill=tk.BOTH)

    for i in range(1, 200):
        listbox.insert(tk.END, i)

    return listbox
