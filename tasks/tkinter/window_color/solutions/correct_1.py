import tkinter as tk

root = tk.Tk()

def set_red():
    root.config(bg='red')

def set_green():
    root.config(bg='green')

def set_blue():
    root.config(bg='blue')

tk.Button(root, text='Червоний', command=set_red).pack()
tk.Button(root, text='Зелений', command=set_green).pack()
tk.Button(root, text='Синій', command=set_blue).pack()
root.mainloop()
