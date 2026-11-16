import tkinter as tk

try:
    a = int(input())
except Exception:
    a = 0
try:
    b = int(input())
except Exception:
    b = 0
root = tk.Tk()
root.mainloop()
