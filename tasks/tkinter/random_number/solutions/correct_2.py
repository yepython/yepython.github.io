import tkinter as tk
from random import randint

root = tk.Tk()
result = tk.Label(root, text='')
result.pack()

def gen():
    result.config(text=str(randint(1, 100)))

tk.Button(root, text='Згенерувати', command=gen).pack()
root.mainloop()
