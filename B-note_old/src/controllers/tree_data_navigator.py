from copy import deepcopy
from tkinter import messagebox, simpledialog
from src.core.fp_utils import *


class TreeDataManager:
    def __init__(self, state, related_widget=None):
        self.state = state
        self.team_std_info = state.team_std_info
        self.data_kind = related_widget.data_kind if related_widget else None

    def register_related_widget(self, related_widget):
        self.related_widget = related_widget

    def find_node_by_name(self, data, target_name):
        """Find a node by its name in the given children list."""
        return next(
            (
                node
                for node in data
                if isinstance(node, dict) and node["name"] == target_name
            ),
            None,
        )

    def find_node_by_name_recur(self, data, target_name):
        """Find a node by its name in the given tree structure recursively."""
        if isinstance(data, dict):  # 단일 노드가 들어온 경우 처리
            if data.get("name") == target_name:
                return data
            if "children" in data:
                return self.find_node_by_name_recur(data["children"], target_name)

        elif isinstance(data, list):  # 리스트일 경우
            for node in data:
                if isinstance(node, dict):
                    found_node = self.find_node_by_name_recur(node, target_name)
                    if found_node:
                        return found_node
        return None

    def find_parentnodes_by_childname_recur(
        self, data, child_name, parent=None, parents=None
    ):
        """Find all parent nodes of a given child node by its name in a tree structure recursively."""

        if parents is None:
            parents = []  # 부모 노드들을 저장할 리스트

        if isinstance(data, dict):  # 단일 노드일 경우
            if "children" in data:
                # 현재 노드의 자식 중에 child_name을 가진 노드가 있는지 확인
                for child in data["children"]:
                    if isinstance(child, dict) and child.get("name") == child_name:
                        parents.append(data)  # 현재 노드를 부모로 저장

                # 자식 노드들에 대해 재귀 호출
                for child in data["children"]:
                    self.find_parentnodes_by_childname_recur(
                        child, child_name, data, parents
                    )

        elif isinstance(data, list):  # 리스트 형태의 데이터일 경우
            for node in data:
                if isinstance(node, dict):
                    self.find_parentnodes_by_childname_recur(
                        node, child_name, None, parents
                    )

        return parents  # 모든 부모 노드 리스트 반환

    def find_node_by_path(self, data, path):
        """Find a node by traversing the given path in the tree structure."""
        current_node = None
        for name in path:
            if isinstance(data, list):
                current_node = next(
                    (
                        node
                        for node in data
                        if isinstance(node, dict) and node.get("name") == name
                    ),
                    None,
                )
                if current_node is None:
                    return None
                data = current_node.get("children", [])
            else:
                return None
        return current_node

    def get_node_path(
        self, data_kind, grandparent_name, parent_name, child_name, _data=None
    ):
        """Navigate to the specified node based on grandparent, parent, and child names."""
        if data_kind not in self.team_std_info:
            return None, None, None

        # Navigate to the grandparent node
        data = self.team_std_info[data_kind]["children"]
        if _data:
            data = _data

        # if data_kind == "std-familylist" and grandparent_name != "Top":
        #     data = self.find_node_by_name(data, "Top")
        grandparent_node = self.find_node_by_name(data, grandparent_name)
        print(f"grandparent_name::::::::::{grandparent_name}")

        if not grandparent_node:
            return None, None, None

        # Navigate to the parent node
        parent_node = self.find_node_by_name(grandparent_node["children"], parent_name)

        print(f"parent_name::::::::::{parent_name}")
        # print(f"parent_node::::::::::{parent_node}")
        if not parent_node:
            return None, None, None

        # Check if parent_node has children and if they are a list (last level)
        if isinstance(parent_node["children"], list) and all(
            isinstance(child, str) for child in parent_node["children"]
        ):
            return grandparent_node, parent_node, parent_node["children"]

        # Navigate to the selected child node
        child_node = self.find_node_by_name(parent_node["children"], child_name)

        print(f"child_name::::::::::{child_name}")
        # print(f"child_node::::::::::{child_node}")

        return grandparent_node, parent_node, child_node

    def get_node_depth(self, node):
        """Calculate the depth of a given node in the tree data."""
        depth = 0
        while "parent" in node:
            depth += 1
            node = node["parent"]
        return depth

    def update_node_value(self, data_kind, path, column_index, new_value):
        """Update the value of a node in the tree."""
        selected_node = self.find_node_by_path(
            self.team_std_info[data_kind]["children"], path
        )

        if selected_node is not None and "values" in selected_node:
            # Ensure that the values list is long enough
            if len(selected_node["values"]) <= column_index:
                selected_node["values"].extend(
                    [""] * (column_index + 1 - len(selected_node["values"]))
                )

            # Update the corresponding value in "values"
            selected_node["values"][column_index] = new_value
            print(
                f"Updated node value: {selected_node['name']}, column {column_index} to {new_value}"
            )
        else:
            print(f"Could not find node '{path}' or 'values' key is missing.")

    def update_node_name(self, data_kind, path, new_name):
        """Update the name of a node in the tree."""
        selected_node = self.find_node_by_path(
            self.team_std_info[data_kind]["children"], path
        )

        if selected_node is not None:
            selected_node["name"] = new_name
            # Ensure that the name is also updated in the corresponding value at the level column index
            # depth = self.get_node_depth(selected_node)
            # if len(selected_node["values"]) > depth:
            #     selected_node["values"][depth] = new_name
            # print(f"Updated node name: {selected_node['name']} to {new_name}")
        else:
            print(f"Could not find node '{path}' to update name.")

    def add_top_level_node(self, data_kind, new_child):
        """Add a new top-level node to the specified data kind."""
        try:
            # Create the values list with empty strings, setting the name in the first column
            values = [new_child]

            # Append the new child to the top-level "children" list
            self.team_std_info[data_kind]["children"].append(
                {
                    "name": new_child,
                    "values": values,
                    "children": [],
                }
            )
            print(f"Added top-level node: {new_child}")
        except Exception as e:
            print(f"Error adding top-level node: {e}")

    def add_child_node(self, data_kind, selected_name, new_child):
        """Add a new child node to the specified selected node."""
        try:
            # Try to find the selected node at any level
            def find_node_recursive(data, target_name):
                if not isinstance(data, list):
                    return None
                for node in data:
                    if isinstance(node, dict) and node.get("name") == target_name:
                        return node
                    if "children" in node:
                        found_node = find_node_recursive(node["children"], target_name)
                        if found_node:
                            return found_node
                return None

            selected_node = find_node_recursive(
                self.team_std_info[data_kind]["children"], selected_name
            )

            if selected_node is not None and "children" in selected_node:

                # Determine the depth level of the selected node
                depth = selected_node["values"].index(selected_node["name"]) + 1

                # Create the values list with empty strings, setting the name in the appropriate column
                values = [""] * (depth + 1)
                values[depth] = new_child

                selected_node["children"].append(
                    {
                        "name": new_child,
                        "values": values,
                        "children": [],
                    }
                )
                print(f"Added child node: {new_child} to {selected_name}")
            else:
                print(
                    f"Could not find selected node '{selected_name}' or 'children' key is missing."
                )
        except Exception as e:
            print(f"Error adding child node: {e}")

    def add_child_node_forFamilyList(self, data_kind, selected_name, new_child):
        """Add a new child node to the specified selected node."""
        try:
            # Try to find the selected node at any level
            def find_node_recursive(data, target_name):
                if not isinstance(data, list):
                    return None
                for node in data:
                    if isinstance(node, dict) and node.get("name") == target_name:
                        return node
                    if "children" in node:
                        found_node = find_node_recursive(node["children"], target_name)
                        if found_node:
                            return found_node
                return None

            selected_node = find_node_recursive(
                self.team_std_info[data_kind]["children"], selected_name
            )

            if selected_node is not None and "children" in selected_node:

                # Determine the depth level of the selected node
                depth = selected_node["values"].index(selected_node["name"]) + 1

                # Create the values list with empty strings, setting the name in the appropriate column
                values = [""] * (depth + 1)
                values[depth] = new_child
                newCalcNum = f"Q{new_child}"
                values.extend(["", "", "", "", "", newCalcNum])

                selected_node["children"].append(
                    {
                        "name": new_child,
                        "values": values,
                        "children": [],
                    }
                )

                # Calc-Dict 자동 업데이트
                std_calcdict = self.state.team_std_info["std-calcdict"]["children"]
                calcdict_nums = go(
                    std_calcdict,
                    map(lambda x: x["name"]),
                    list,
                )
                if newCalcNum not in calcdict_nums:
                    std_calcdict.append(
                        {
                            "name": newCalcNum,
                            "values": [newCalcNum],
                            "children": [],
                        }
                    )

                print(f"Added child node: {new_child} to {selected_name}")
            else:
                print(
                    f"Could not find selected node '{selected_name}' or 'children' key is missing."
                )
        except Exception as e:
            print(f"Error adding child node: {e}")

    def delete_node(self, data_kind, path):
        """Delete the specified node from the tree based on its path."""
        try:
            # Helper function to find a node by traversing the path
            def find_node_by_path(data, path):
                current_node = None
                for name in path:
                    if isinstance(data, list):
                        current_node = next(
                            (node for node in data if node.get("name") == name), None
                        )
                        if current_node is None:
                            return None  # Stop if the node doesn't exist
                        data = current_node.get("children", [])
                    else:
                        return None  # If data is not a list, stop traversal
                return current_node

            # Validate the path
            if not path or not isinstance(path, list):
                print("Invalid path: Path must be a non-empty list of node names.")
                return

            if data_kind not in self.team_std_info:
                print(f"Invalid data kind: {data_kind}")
                return

            # Handle top-level nodes
            if len(path) == 1:
                # The node is a top-level node; directly search and remove it
                target_name = path[0]
                top_level_nodes = self.team_std_info[data_kind]["children"]
                target_node = next(
                    (
                        node
                        for node in top_level_nodes
                        if node.get("name") == target_name
                    ),
                    None,
                )
                if not target_node:
                    print(f"Could not find top-level node '{target_name}'.")
                    return
                top_level_nodes.remove(target_node)
                print(f"Deleted top-level node: {target_name}")
                return

            # Handle non-top-level nodes
            parent_path = path[:-1]
            target_name = path[-1]

            # Find the parent node
            parent_node = find_node_by_path(
                self.team_std_info[data_kind]["children"], parent_path
            )

            if not parent_node or "children" not in parent_node:
                print(f"Could not find parent node for path: {parent_path}")
                return

            # Find the target node in the parent's children
            target_node = next(
                (
                    node
                    for node in parent_node["children"]
                    if node.get("name") == target_name
                ),
                None,
            )

            if not target_node:
                print(
                    f"Could not find target node '{target_name}' in the specified path."
                )
                return

            # Remove the target node from the parent's children
            parent_node["children"].remove(target_node)
            print(f"Deleted node: {target_name}")

        except Exception as e:
            print(f"Error deleting node: {e}")

    def copy_node(self, data_kind, path, new_name, name_depth):
        """Copy the selected node and its children, placing the copy directly below the original."""
        try:
            # Find the node by traversing the path
            def find_node_by_path(data, path):
                current_node = None
                for name in path:
                    if isinstance(data, list):
                        current_node = next(
                            (node for node in data if node.get("name") == name), None
                        )
                        if current_node is None:
                            return None
                        data = current_node.get("children", [])
                    else:
                        return None
                return current_node

            # Ensure the path includes the parent's path and the target node name
            parent_path = path[:-1]
            target_name = path[-1] if path else None

            # Handle the case where the node is a top-level node
            parent_node = None
            if parent_path:
                # Find the parent node for non-top-level nodes
                parent_node = find_node_by_path(
                    self.team_std_info[data_kind]["children"], parent_path
                )

            if parent_path and (not parent_node or "children" not in parent_node):
                print(f"Could not find the parent node for path: {parent_path}")
                return

            # Get the correct children list (top-level or regular children)
            children_list = (
                parent_node["children"]
                if parent_node
                else self.team_std_info[data_kind]["children"]
            )

            # Find the target node in the children list
            selected_node = next(
                (node for node in children_list if node.get("name") == target_name),
                None,
            )

            if not selected_node:
                print(f"Could not find the node '{target_name}' to copy.")
                return

            # Create a deep copy of the selected node
            def deep_copy_node(node, new_name=None):
                """Deep copy a node, renaming it if a new_name is provided."""
                # Determine the depth level of the selected node
                depth = node["values"].index(node["name"])

                new_values = node["values"][:]
                if depth == name_depth:
                    new_values[depth] = new_name

                copied_node = {
                    "name": new_name if new_name else node["name"],
                    "values": new_values,  # Copy values
                }

                # Check if the node has children
                if "children" in node:
                    if isinstance(node["children"], list):
                        # Check if children are tree nodes or simple items
                        if all(isinstance(child, dict) for child in node["children"]):
                            # Deep copy child tree nodes
                            copied_node["children"] = [
                                deep_copy_node(child) for child in node["children"]
                            ]
                        else:
                            # Directly copy the list of items
                            copied_node["children"] = node["children"][:]
                    else:
                        # If children is not a list, handle it gracefully
                        copied_node["children"] = []

                return copied_node

            # Generate a deep copy with a new name
            copied_node = deep_copy_node(selected_node, new_name)

            # Insert the copied node directly after the selected node in the children list
            index = children_list.index(selected_node)
            children_list.insert(index + 1, copied_node)
            print(f"Copied node '{target_name}' to '{new_name}'.")
            return copied_node

        except Exception as e:
            print(f"Error copying node: {e}")


class TreeDataManager_treeview(TreeDataManager):
    def __init__(self, state, related_widget=None):
        super().__init__(state, related_widget=related_widget)
        self.state = state

    def match_wms_to_stdType(
        self, data_kind, grandparent_name, parent_name, child_name, selected_wms
    ):
        """Add specified matched WMs to the children of the selected node."""
        _, parent_node, selected_node = self.get_node_path(
            data_kind, grandparent_name, parent_name, child_name
        )

        if isinstance(selected_node, list) and selected_wms:
            # Handle adding to list of strings (last level)
            self.state.log_widget.write(f"\nAdding matched WMs: {selected_wms}\n")
            parent_node["children"].extend(selected_wms)
        elif selected_node and "children" in selected_node and selected_wms:
            # Handle adding matched WMs to regular children
            self.state.log_widget.write(f"\nAdding matched WMs: {selected_wms}\n")
            selected_node["children"].extend(selected_wms)

    def remove_matched_wms(
        self, data_kind, grandparent_name, parent_name, child_name, matched_wms
    ):
        """Remove specified matched WMs from the children of the selected node."""
        _, parent_node, selected_node = self.get_node_path(
            data_kind, grandparent_name, parent_name, child_name
        )
        gauge_yesno = go(
            matched_wms,
            map(lambda x: "::" in x),
            any,
        )
        if gauge_yesno:
            # print("메세지 소환")
            messagebox.showwarning(
                "WM 할당 해제",
                """
게이지 부여 항목은 Standard GWM/SWM Tab에서 삭제할 수 없습니다.
삭제를 원하면 Project GWM/SWM Tab에서 Gauge 항목을 모두 삭제해 주세요.
                """,
            )
        else:
            if isinstance(selected_node, list):
                # Handle removal from list of strings (last level)
                self.state.log_widget.write(f"\nRemoving matched WMs: {matched_wms}\n")
                parent_node["children"] = [
                    child for child in selected_node if child not in matched_wms
                ]
            elif selected_node and "children" in selected_node:
                # Handle removal from regular children
                self.state.log_widget.write(f"\nRemoving matched WMs: {matched_wms}\n")
                selected_node["children"] = [
                    child
                    for child in selected_node["children"]
                    if child not in matched_wms
                ]

    def match_GWMitems_to_stdFam(
        self, data_kind, grandparent_name, parent_name, child_name, selected_GWMitems
    ):
        """Add specified matched WMs to the children of the selected node, recognizing derived items by inclusion."""
        state = self.state

        _, parent_node, selected_node = self.get_node_path(
            data_kind, grandparent_name, parent_name, child_name
        )
        print(f"grandparent name:::::{grandparent_name}")
        print(f"parent_name:::::{parent_name}")
        print(f"selected_name:::::{child_name}")

        # print(f"grandparent 노드:::::{_}")
        # print(f"parent_node:::::{parent_node}")
        # print(f"selected_node:::::{selected_node}")
        selected_GWMitems_copy = deepcopy(selected_GWMitems)

        if grandparent_name == "Top":

            # Get existing child names for recognition of derivatives
            existing_names = {
                child["name"] for child in selected_node.get("children", [])
            }
            print(f"\n0. existing_names: {existing_names}\n")
            self.state.log_widget.write(f"\n0. existing_names: {existing_names}\n")

            for selected_GWMitem in selected_GWMitems_copy:
                # Check if the item is a derivative by inclusion
                base_name = selected_GWMitem["name"]
                derived_from = next(
                    (name for name in existing_names if base_name.startswith(name)),
                    None,
                )
                self.state.log_widget.write(f"\n1. derived_from: {derived_from}\n")
                if derived_from:
                    # Recognized as a derived item, update its name to include base name
                    selected_GWMitem["name"] = (
                        base_name  # The name already represents the derived item
                    )
                self.state.log_widget.write(
                    f"\n2. selected_GWMitem_name: {selected_GWMitem['name']}\n"
                )

                # Update the values for the item
                new_values = list(selected_GWMitem["values"])
                if len(new_values) < 3:
                    dummy = (3 - len(new_values)) * [""]
                    new_values.extend(dummy)
                    new_values[2] = f"[ {state.switch_widget_status.get()} ]"
                else:
                    new_values[2] = f"[ {state.switch_widget_status.get()} ]"
                new_values.insert(0, "")
                new_values.insert(0, "")
                new_values.insert(0, "")
                selected_GWMitem.update({"values": new_values})
                self.state.log_widget.write(f"\n3. new_values: {new_values}\n")

                # Copy formulas for the children if they match a reference item
                children = list(selected_GWMitem.get("children", []))
                reference_item_ = go(
                    (
                        selected_node.get("children", [])
                        if isinstance(selected_node, dict)
                        else []
                    ),
                    filter(lambda x: x["name"] == derived_from),
                    list,
                )
                if len(reference_item_) > 0:
                    reference_item = reference_item_[0]
                else:
                    reference_item = {
                        "name": "",
                        "values": [],
                        "children": [],
                    }

                self.state.log_widget.write(f"\n4. reference_item: {reference_item}\n")
                for child in children:
                    # Find a matching reference child by name
                    matching_reference = next(
                        (
                            ref
                            for ref in reference_item["children"]
                            if ref["name"] == child["name"]
                        ),
                        None,
                    )
                    self.state.log_widget.write(
                        f"\n5. matching_reference: {matching_reference}\n"
                    )

                    # Copy formula from the matching reference if available
                    new_child_value = list(child["values"])  # The new child's values
                    # Add placeholders for columns
                    new_child_value.insert(0, "")
                    new_child_value.insert(0, "")
                    new_child_value.insert(0, "")

                    if matching_reference:
                        print("매칭 레퍼런스까지는 작동")
                        # formula_index = (
                        #     len(matching_reference["values"]) - 1
                        # )  # Assuming formula is the last value
                        formula_index = 6
                        desc_index = 7
                        try:
                            new_child_value[formula_index] = matching_reference[
                                "values"
                            ][formula_index]
                        except:
                            new_child_value.append(
                                matching_reference["values"][formula_index]
                            )

                        if len(matching_reference["values"]) == desc_index + 1:
                            try:
                                new_child_value[desc_index] = matching_reference[
                                    "values"
                                ][desc_index]
                            except:
                                new_child_value.append(
                                    matching_reference["values"][desc_index]
                                )

                    child.update({"values": new_child_value})

                # Update the children of the derived item
                selected_GWMitem.update({"children": children})

            # Add the new GWM items to the appropriate location
            if isinstance(selected_node, list) and selected_GWMitems_copy:
                # Handle adding to list of strings (last level)
                parent_node["children"].extend(selected_GWMitems_copy)
            elif (
                selected_node and "children" in selected_node and selected_GWMitems_copy
            ):
                # Handle adding matched WMs to regular children
                selected_node["children"].extend(selected_GWMitems_copy)

        else:
            data = self.team_std_info[data_kind]["children"][0]["children"]
            _, parent_node, selected_node = self.get_node_path(
                data_kind,
                grandparent_name,
                parent_name,
                child_name,
                _data=data,
            )

            # selected_GWMitem = {
            #     "name": state.selected_GWMSWM[2],
            #     "values": ["", "", "", "", "", state.selected_GWMSWM[2], ""],
            #     "children": [],
            # }
            selected_GWMitem = selected_GWMitems_copy[0]

            # Update the values for the item
            new_values = list(selected_GWMitem["values"])
            new_values.insert(0, "")
            new_values.insert(0, "")
            new_values.insert(0, "")
            selected_GWMitem.update({"values": new_values})

            existing_names = {
                child["name"] for child in selected_node.get("children", [])
            }
            print(f"\n0. existing_names: {existing_names}\n")

            base_name = selected_GWMitem["name"]
            derived_from = next(
                (name for name in existing_names if base_name.startswith(name)),
                None,
            )
            print(f"\n1. derived_from: {derived_from}\n")
            if derived_from:
                # Recognized as a derived item, update its name to include base name
                selected_GWMitem["name"] = (
                    base_name  # The name already represents the derived item
                )
            print(f"\n2. selected_GWMitem_name: {selected_GWMitem['name']}\n")

            reference_item_ = go(
                (
                    selected_node.get("children", [])
                    if isinstance(selected_node, dict)
                    else []
                ),
                filter(lambda x: x["name"] == derived_from),
                list,
            )

            print(f"selected_GWMSWM::: {state.selected_GWMSWM}")

            print(f"selected_GWMitem :: {selected_GWMitem}")

            if len(reference_item_) > 0:
                reference_item = reference_item_[0]
            else:
                reference_item = {
                    "name": "",
                    "values": [],
                    "children": [],
                }

            print(f"\n4. reference_item: {reference_item}\n")

            matching_reference = reference_item
            print(f"\n5. matching_reference: {matching_reference}\n")

            # Copy formula from the matching reference if available
            new_child_value = list(selected_GWMitem["values"])  # The new child's values
            print(f"6. new_child_value_before: {new_child_value}")

            if matching_reference:
                print("매칭 레퍼런스까지는 작동")
                # formula_index = (
                #     len(matching_reference["values"]) - 1
                # )  # Assuming formula is the last value
                formula_index = 6
                desc_index = 7
                try:
                    new_child_value[formula_index] = matching_reference["values"][
                        formula_index
                    ]
                except:
                    new_child_value.append(matching_reference["values"][formula_index])

                if len(matching_reference["values"]) == desc_index + 1:
                    try:
                        new_child_value[desc_index] = matching_reference["values"][
                            desc_index
                        ]
                    except:
                        new_child_value.append(matching_reference["values"][desc_index])

            print(f"6. new_child_value_after: {new_child_value}")

            # # Update the children of the derived item
            selected_GWMitem.update({"values": new_child_value})
            # selected_GWMitem.update({"children": children})

            # Add the new GWM items to the appropriate location
            if isinstance(selected_node, list) and selected_GWMitem:
                # Handle adding to list of strings (last level)
                parent_node["children"].append(selected_GWMitem)
                print(f'parent_node["children"]:::{parent_node["children"]}')
            elif selected_node and "children" in selected_node and selected_GWMitem:
                # Handle adding matched WMs to regular children
                selected_node["children"].append(selected_GWMitem)
                print(f'selected_node["children"]:::{selected_node["children"]}')


class TreeDataManager_treesheet(TreeDataManager):
    def __init__(self, state, related_widget=None):
        super().__init__(state, related_widget=related_widget)
