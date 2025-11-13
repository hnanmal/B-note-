# from tkinterdnd2 import TkinterDnD, DND_FILES
# import ttkbootstrap as ttk
# from ttkbootstrap.constants import *


# class FilePathRegister(ttk.Frame):
#     def __init__(self, parent, *args, **kwargs):
#         super().__init__(parent, *args, **kwargs)
#         self.pack(fill="both", expand=True)

#         # Title Label
#         ttk.Label(
#             self,
#             text="RVT Summary File Path Registration",
#             font=("Arial", 16),
#             # bootstyle=PRIMARY,
#         ).pack(pady=10)

#         # Entry Field for the Path
#         self.entry = ttk.Entry(self, font=("Arial", 12), bootstyle=INFO)
#         self.entry.pack(pady=10, fill="x", padx=10)

#         # Instruction Label
#         ttk.Label(
#             self,
#             text="→ 레빗 모델링이 있다면: \n\n    서머리파일을 드래그해주세요:",
#             font=("Arial", 10),
#         ).pack(pady=5)

#         # Drop Area using Canvas
#         self.drop_area = ttk.Canvas(
#             self, width=300, height=150, bg="white", highlightthickness=0
#         )
#         self.drop_area.pack(pady=10, padx=10)

#         # Draw a dotted outline rectangle
#         self.drop_area.create_rectangle(
#             5,
#             5,
#             295,
#             145,  # Coordinates of the rectangle
#             outline="black",
#             dash=(5, 5),  # Dotted line pattern
#             width=2,
#         )
#         self.drop_area.create_text(
#             150, 75, text="Drop file here", font=("Arial", 14), fill="gray"
#         )

#         # Enable drag-and-drop events
#         self.drop_area.drop_target_register(DND_FILES)
#         self.drop_area.dnd_bind("<<Drop>>", self.drop_file)

#         # Status Label
#         self.status_label = ttk.Label(self, text="", font=("Arial", 10))
#         self.status_label.pack(pady=5)

#     def drop_file(self, event):
#         """Handle the drop event and register the file path."""
#         file_path = event.data.strip().replace("{", "").replace("}", "")  # Clean path
#         self.entry.delete(0, "end")
#         self.entry.insert(0, file_path)
#         self.status_label.config(
#             text=f"File Registered: {file_path}", bootstyle=SUCCESS
#         )


# # Main application
# if __name__ == "__main__":
#     root = TkinterDnD.Tk()
#     style = ttk.Style()
#     style.theme_use("journal")
#     root.title("ttkbootstrap with Drag-and-Drop")
#     root.geometry("400x400")

#     # Create the FilePathRegister widget
#     file_path_widget = FilePathRegister(root)

#     root.mainloop()
