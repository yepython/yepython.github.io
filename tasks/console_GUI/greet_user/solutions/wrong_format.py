import tkinter as tk

name = input()
root = tk.Tk()
tk.Label(root, text='Hello, ' + name + '!').pack()
root.mainloop()
