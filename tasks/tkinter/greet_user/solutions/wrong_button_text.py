import tkinter as tk

root = tk.Tk()
entry = tk.Entry(root)
entry.pack()
result = tk.Label(root, text='')
result.pack()

def greet():
    name = entry.get()
    result.config(text='Привіт, ' + name + '!')

tk.Button(root, text='ОК', command=greet).pack()
root.mainloop()
