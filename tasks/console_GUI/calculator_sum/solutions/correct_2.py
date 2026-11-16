import tkinter as tk

try:
    x = int(input())
    y = int(input())
except Exception:
    x = 0
    y = 0
root = tk.Tk()
lbl = tk.Label(root, text=str(x + y))
lbl.pack()
root.mainloop()
