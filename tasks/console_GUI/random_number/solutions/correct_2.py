import tkinter as tk
import random

try:
    lo = int(input())
    hi = int(input())
except Exception:
    lo = 1
    hi = 100
root = tk.Tk()
result = tk.Label(root, text='')
result.pack()

def gen():
    result.config(text=str(random.randint(lo, hi)))

tk.Button(root, text='Згенерувати', command=gen).pack()
root.mainloop()
