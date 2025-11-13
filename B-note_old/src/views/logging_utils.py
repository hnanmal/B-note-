import tkinter as tk
from tkinter import ttk
import sys


# class RedirectText:
#     def __init__(self, text_widget):
#         self.output = text_widget
#         self.original_stdout = sys.stdout  # Save the original stdout

#     def write(self, string):
#         self.output.delete(1.0, tk.END)  # Clear existing content
#         self.output.insert(tk.END, string)
#         self.output.see(tk.END)  # Auto-scroll to the end
#         self.original_stdout.write(string)  # Also write to the original stdout

#     def flush(self):
#         pass  # Needed for compatibility with some output methods


# def setup_logging_frame(root):
#     """Set up the logging frame at the bottom of the main window."""
#     # Create a frame for logging at the bottom of the window
#     logging_frame = ttk.Frame(root)
#     logging_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=5)

#     # Create a Text widget for logging output
#     # log_text = tk.Text(logging_frame, height=8, wrap="word", state="normal")
#     log_text = tk.Text(logging_frame, height=3, wrap="word", state="normal")
#     log_text.pack(fill=tk.BOTH, expand=True)

#     # Redirect print statements to the logging area
#     redirect = RedirectText(log_text)
#     sys.stdout = redirect
#     sys.stderr = redirect

#     return redirect  # Return the RedirectText instance


# class RedirectText:
#     def __init__(self, text_widget):
#         """
#         RedirectText redirects stdout and stderr to a Tkinter Text widget.

#         Parameters:
#         text_widget (tk.Text): The Tkinter Text widget to display output.
#         """
#         self.output = text_widget
#         self.original_stdout = sys.stdout  # Save the original stdout
#         self.original_stderr = sys.stderr  # Save the original stderr

#     def write(self, string):
#         """
#         Write the given string to the Text widget and the original stdout.

#         Parameters:
#         string (str): The string to write.
#         """
#         if self.output:
#             try:
#                 self.output.configure(state="normal")  # Ensure the widget is editable
#                 self.output.delete(1.0, tk.END)  # Clear existing content
#                 self.output.insert(tk.END, string)  # Insert the new string
#                 self.output.see(tk.END)  # Auto-scroll to the end
#                 self.output.configure(state="disabled")  # Make the widget read-only
#             except Exception as e:
#                 self.original_stdout.write(f"Error writing to Text widget: {e}\n")
#         self.original_stdout.write(string)  # Also write to the original stdout

#     def flush(self):
#         """Flush the output stream (needed for compatibility)."""
#         pass

#     def restore(self):
#         """
#         Restore stdout and stderr to their original values.
#         """
#         sys.stdout = self.original_stdout
#         sys.stderr = self.original_stderr


class RedirectText:
    def __init__(self, text_widget):
        """
        RedirectText redirects stdout and stderr to a Tkinter Text widget.

        Parameters:
        text_widget (tk.Text): The Tkinter Text widget to display output.
        """
        pass

    def write(self, string):
        pass

    def flush(self):
        pass

    def restore(self):
        pass


def setup_logging_frame(root):
    """
    Set up a logging frame at the bottom of the main window and redirect print statements.

    Parameters:
    root (tk.Tk or ttk.Frame): The root window or frame to attach the logging frame.

    Returns:
    RedirectText: The RedirectText instance used for redirection.
    """
    # Create a frame for logging at the bottom of the window
    logging_frame = ttk.Frame(root)
    logging_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=5)

    # Create a Text widget for logging output
    log_text = tk.Text(logging_frame, height=1, wrap="word", state="normal")
    log_text.pack(fill=tk.BOTH, expand=True)

    # Redirect print statements to the logging area
    redirect = RedirectText(log_text)
    # sys.stdout = redirect
    # sys.stderr = redirect

    return redirect  # Return the RedirectText instance
