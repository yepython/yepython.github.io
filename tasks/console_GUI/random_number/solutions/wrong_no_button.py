import tkinter as tk
import random

try:
    a = int(input())
    b = int(input())
except Exception:
    a = 1
    b = 100
root = tk.Tk()
lbl = tk.Label(root, text='')
lbl.pack()
root.mainloop()
