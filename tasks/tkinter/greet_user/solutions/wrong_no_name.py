import tkinter as tk

root = tk.Tk()
entry = tk.Entry(root)
entry.pack()
result = tk.Label(root, text='')
result.pack()

def greet():
    result.config(text='Привіт!')

tk.Button(root, text='Привітати', command=greet).pack()
root.mainloop()
