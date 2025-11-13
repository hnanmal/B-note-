import tkinter as tk
from tkinter import ttk

from src.views.widget.new_window import open_tab_in_new_window_rvtSummary


class MultiLineInputFrame(tk.Frame):
    def __init__(self, state, parent, label_text="Enter text:", *args, **kwargs):
        super().__init__(parent, *args, **kwargs)

        # Label for the text input
        self.label = ttk.Label(self, text=label_text)
        self.label.pack(side=tk.TOP, anchor="w", pady=(0, 5))

        # # Add a button to open Tab 1 in a new window
        # open_button = ttk.Button(
        #     self,
        #     text="Rvt Summary",
        #     command=lambda: open_tab_in_new_window_rvtSummary(state),
        # )
        # open_button.pack(pady=10, padx=2, side=tk.TOP, anchor="w")

        # Frame for Text widget and Scrollbars
        self.text_frame = tk.Frame(self)
        self.text_frame.pack(fill=tk.BOTH, expand=True)

        # Vertical scrollbar
        self.v_scrollbar = ttk.Scrollbar(self.text_frame, orient=tk.VERTICAL)
        self.v_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # # Horizontal scrollbar
        # self.h_scrollbar = ttk.Scrollbar(self.text_frame, orient=tk.HORIZONTAL)
        # self.h_scrollbar.pack(side=tk.BOTTOM, fill=tk.X)

        # Text widget for multi-line input
        self.text_widget = tk.Text(
            self.text_frame,
            wrap=tk.NONE,  # Use scrollbars for wrapping
            yscrollcommand=self.v_scrollbar.set,
            # xscrollcommand=self.h_scrollbar.set,
        )
        self.text_widget.pack(fill=tk.BOTH, expand=True)

        # Configure scrollbars
        self.v_scrollbar.config(command=self.text_widget.yview)
        # self.h_scrollbar.config(command=self.text_widget.xview)

    def get_text(self):
        """Retrieve the text from the Text widget."""
        return self.text_widget.get("1.0", tk.END).strip()

    def set_text(self, text):
        """Set the text in the Text widget."""
        self.text_widget.delete("1.0", tk.END)
        self.text_widget.insert("1.0", text)

    def clear_text(self):
        """Clear the Text widget."""
        self.text_widget.delete("1.0", tk.END)


# Example usage
if __name__ == "__main__":
    root = tk.Tk()
    root.title("Multi-Line Input Example")
    root.geometry("400x300")

    # Create the multi-line input frame
    multi_line_frame = MultiLineInputFrame(root, label_text="Enter your text below:")
    multi_line_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

    # Add a button to print the text
    def print_text():
        print("Entered Text:")
        print(multi_line_frame.get_text())

    btn = ttk.Button(root, text="Print Text", command=print_text)
    btn.pack(pady=10)

    root.mainloop()
