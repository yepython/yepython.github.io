import tkinter as tk

t = input()
width = input()
height = input()
win = tk.Tk()
win.title(t)
if width != '' and height != '':
    win.geometry(width + 'x' + height)
win.mainloop()
