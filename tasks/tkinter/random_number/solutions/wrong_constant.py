import tkinter as tk
import random

root = tk.Tk()
lbl = tk.Label(root, text='')
lbl.pack()

def generate():
    lbl.config(text='42')

tk.Button(root, text='Згенерувати', command=generate).pack()
root.mainloop()
