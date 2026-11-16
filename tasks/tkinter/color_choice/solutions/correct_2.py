import tkinter as tk

root = tk.Tk()
label = tk.Label(root, text='Текст', fg='black')
label.pack()

tk.Radiobutton(root, text='Червоний', command=lambda: label.config(fg='red')).pack()
tk.Radiobutton(root, text='Зелений', command=lambda: label.config(fg='green')).pack()
tk.Radiobutton(root, text='Синій', command=lambda: label.config(fg='blue')).pack()
root.mainloop()
