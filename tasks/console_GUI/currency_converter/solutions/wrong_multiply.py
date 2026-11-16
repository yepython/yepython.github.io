import tkinter as tk

try:
    amount = float(input())
except Exception:
    amount = 0.0
try:
    rate = float(input())
except Exception:
    rate = 1.0
if rate == 0:
    rate = 1.0
result = amount * rate
root = tk.Tk()
tk.Label(root, text=str(result)).pack()
root.mainloop()
