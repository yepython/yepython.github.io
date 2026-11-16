import tkinter as tk

try:
    uah = float(input())
    r = float(input())
except Exception:
    uah = 0.0
    r = 1.0
if r == 0:
    r = 1.0
root = tk.Tk()
lbl = tk.Label(root, text=str(uah / r))
lbl.pack()
root.mainloop()
