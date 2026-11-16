import tkinter as tk
import time

root = tk.Tk()
lbl = tk.Label(root, text=time.strftime('%H:%M:%S'))
lbl.pack()
root.mainloop()
