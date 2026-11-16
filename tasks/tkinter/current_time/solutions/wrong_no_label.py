import tkinter as tk
import time

root = tk.Tk()
e = tk.Entry(root)
e.pack()

def tick():
    e.delete(0, 'end')
    e.insert(0, time.strftime('%H:%M:%S'))
    root.after(1000, tick)

tick()
root.mainloop()
