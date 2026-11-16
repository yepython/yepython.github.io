import tkinter as tk

try:
    amount = float(input())
except Exception:
    amount = 0.0
try:
    rate = float(input())
except Exception:
    rate = 1.0
root = tk.Tk()
root.mainloop()
