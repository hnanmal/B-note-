import tkinter as tk
from tkinter import ttk
from tksheet import Sheet
from bs4 import BeautifulSoup


class BrowserWidget(tk.Frame):
    def __init__(self, parent, html_file=None, *args, **kwargs):
        """
        A widget that displays tabular data from an HTML file in a Tksheet with selection via ComboBox.

        :param parent: Parent Tkinter widget
        :param html_file: Path to the HTML file
        """
        super().__init__(parent, *args, **kwargs)

        if not html_file:
            raise ValueError("HTML file path must be provided.")

        # Read the HTML content from the file
        try:
            with open(html_file, "r", encoding="utf-8") as file:
                html_content = file.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"The file '{html_file}' was not found.")

        # Parse the HTML content and extract tables by section
        self.tables = self.parse_html_to_tables(html_content)

        # Create a ComboBox for table selection
        self.combo_frame = tk.Frame(self)
        self.combo_frame.pack(fill="x", pady=5)

        self.combo_label = tk.Label(self.combo_frame, text="Select Table:")
        self.combo_label.pack(side="left", padx=5)

        self.combo_box = ttk.Combobox(self.combo_frame, state="readonly")
        self.combo_box.pack(side="left", fill="x", expand=True)
        self.combo_box["values"] = list(self.tables.keys())
        self.combo_box.bind("<<ComboboxSelected>>", self.on_table_selected)

        # Set the first item as default selection
        if self.combo_box["values"]:
            self.combo_box.current(0)

        # Initialize the Tksheet widget
        self.sheet = Sheet(
            self, show_x_scrollbar=True, show_y_scrollbar=True, headers=True
        )
        self.sheet.enable_bindings(
            "copy",
            "select_all",
            "row_select",
            "column_select",
            "single_select",
            "drag_select",
            "multi_select",
        )  # Enable copy, drag, and multi-selection
        self.sheet.pack(fill="both", expand=True)

        # Display the first table by default if available
        if self.tables:
            self.display_table(list(self.tables.keys())[0])

    @staticmethod
    def parse_html_to_tables(html_content):
        """
        Parse HTML content and extract tables by section as lists of rows.

        :param html_content: HTML content as a string
        :return: Dictionary of tables categorized by their parent div IDs
        """
        soup = BeautifulSoup(html_content, "html.parser")
        sections = {
            "infoPage": [],
            "famTypePage": [],
            "roomInfoPage": [],
            "roomInfoPage_chk": [],
        }

        for div_id in sections.keys():
            div = soup.find("div", id=div_id)
            if div:
                table = div.find("table")
                if table:
                    rows = []
                    for tr in table.find_all("tr"):
                        cells = [
                            td.get_text(strip=True) for td in tr.find_all(["td", "th"])
                        ]
                        rows.append(cells)
                    if div_id == "famTypePage":
                        sections[div_id] = rows  # Keep all rows
                    else:
                        sections[div_id] = rows

        return sections

    def display_table(self, section):
        """
        Display a specific table in the Tksheet widget based on the selected section.

        :param section: The section key corresponding to the desired table
        """
        table_data = self.tables.get(section, [])
        if table_data:
            if section == "famTypePage":
                # Apply static headers A and B for "famTypePage"
                self.sheet.headers(["A", "B"])
                self.sheet.set_sheet_data(table_data)
            else:
                headers = table_data[0]  # Use the first row as headers
                data = table_data[1:]  # Remaining rows as data
                self.sheet.headers(headers)
                self.sheet.set_sheet_data(data)
            self.sheet.set_all_cell_sizes_to_text()
        else:
            self.sheet.set_sheet_data(["No data found in this section"])

    def on_table_selected(self, event):
        """
        Handle ComboBox selection and display the corresponding table.

        :param event: The event triggered by selecting an item in the ComboBox
        """
        selected_section = self.combo_box.get()
        self.display_table(selected_section)


# Example usage
if __name__ == "__main__":
    # Path to the HTML file
    html_file_path = "RVT Summary.html"

    root = tk.Tk()
    root.title("HTML Table Viewer")
    root.geometry("800x600")

    # Create and pack the BrowserWidget
    browser_widget = BrowserWidget(root, html_file=html_file_path)
    browser_widget.pack(fill="both", expand=True)

    root.mainloop()
