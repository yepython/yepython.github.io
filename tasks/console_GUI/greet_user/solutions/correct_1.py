import tkinter as tk

name = input()
root = tk.Tk()
tk.Label(root, text='Привіт, ' + name + '!').pack()
root.mainloop()
