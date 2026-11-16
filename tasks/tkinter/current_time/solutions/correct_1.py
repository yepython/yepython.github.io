import tkinter as tk
import time

root = tk.Tk()
lbl = tk.Label(root, text='')
lbl.pack()

def tick():
    lbl.config(text=time.strftime('%H:%M:%S'))
    root.after(1000, tick)

tick()
root.mainloop()
