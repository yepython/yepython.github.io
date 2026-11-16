import tkinter as tk

root = tk.Tk()
tk.Button(root, text='Червоний', command=lambda: root.config(bg='red')).pack()
tk.Button(root, text='Зелений', command=lambda: root.config(bg='green')).pack()
tk.Button(root, text='Синій', command=lambda: root.config(bg='blue')).pack()
root.mainloop()
