import tkinter as tk

root = tk.Tk()
e = tk.Entry(root)
e.pack()
lbl = tk.Label(root, text='')
lbl.pack()

def conv():
    c = float(e.get())
    lbl.config(text=str(c * 1.8 + 32))

tk.Button(root, text='Конвертувати', command=conv).pack()
root.mainloop()
