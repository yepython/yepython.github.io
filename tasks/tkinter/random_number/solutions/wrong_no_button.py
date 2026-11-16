import tkinter as tk
import random

root = tk.Tk()
lbl = tk.Label(root, text=str(random.randint(1, 100)))
lbl.pack()
root.mainloop()
