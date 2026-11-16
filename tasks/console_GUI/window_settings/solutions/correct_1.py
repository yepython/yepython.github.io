import tkinter as tk

title = input()
w = input()
h = input()
root = tk.Tk()
root.title(title)
if w != '' and h != '':
    root.geometry(w + 'x' + h)
root.mainloop()
