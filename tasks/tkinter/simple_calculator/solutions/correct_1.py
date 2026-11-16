import tkinter as tk

root = tk.Tk()
e1 = tk.Entry(root)
e1.pack()
e2 = tk.Entry(root)
e2.pack()
result = tk.Label(root, text='')
result.pack()

def add():
    a = int(e1.get())
    b = int(e2.get())
    result.config(text=str(a + b))

def sub():
    a = int(e1.get())
    b = int(e2.get())
    result.config(text=str(a - b))

tk.Button(root, text='+', command=add).pack()
tk.Button(root, text='-', command=sub).pack()
root.mainloop()
