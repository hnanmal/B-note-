# src/models/observer_manager.py


class ObserverManager:
    def __init__(self):
        self._observers = []

    def add_observer(self, observer, tag=None):
        if callable(observer) and observer not in self._observers:
            observer.tag = tag
            self._observers.append(observer)
            print(f"Observer added: {observer}")
        else:
            print("Error: Observer is not callable")

    def notify_observers(self, state, targets=None):
        if not self._observers:
            print("Warning: No observers registered")
        for observer in self._observers:
            if targets:
                if observer.tag in targets:
                    try:
                        print(f"Notifying observer {observer}")
                        observer(state)
                    except Exception as e:
                        print(f"Error notifying observer {observer}: {e}")
            else:
                try:
                    print(f"Notifying observer {observer}")
                    observer(state)
                except Exception as e:
                    print(f"Error notifying observer {observer}: {e}")
