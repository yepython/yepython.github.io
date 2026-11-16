import tkinter as tk
import time

root = tk.Tk()
label = tk.Label(root, text=time.strftime('%H:%M:%S'))
label.pack()

def update():
    label.config(text=time.strftime('%H:%M:%S'))
    root.after(1000, update)

root.after(1000, update)
root.mainloop()
