import tkinter as tk

root = tk.Tk()
a = tk.Entry(root); a.pack()
b = tk.Entry(root); b.pack()
lbl = tk.Label(root, text=''); lbl.pack()

def plus():
    lbl.config(text=str(int(a.get()) + int(b.get())))

def minus():
    lbl.config(text=str(int(a.get()) - int(b.get())))

tk.Button(root, text='+', command=plus).pack()
tk.Button(root, text='-', command=minus).pack()
root.mainloop()
