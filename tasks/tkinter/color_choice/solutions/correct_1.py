import tkinter as tk

root = tk.Tk()
lbl = tk.Label(root, text='Текст', fg='black')
lbl.pack()

def set_red():
    lbl.config(fg='red')

def set_green():
    lbl.config(fg='green')

def set_blue():
    lbl.config(fg='blue')

tk.Radiobutton(root, text='Червоний', command=set_red).pack()
tk.Radiobutton(root, text='Зелений', command=set_green).pack()
tk.Radiobutton(root, text='Синій', command=set_blue).pack()
root.mainloop()
