import tkinter as tk

root = tk.Tk()
var = tk.BooleanVar()
tk.Checkbutton(root, text='Погоджуюсь', variable=var).pack()
lbl = tk.Label(root, text='Так')
lbl.pack()

def check():
    if var.get():
        lbl.config(text='Так')
    else:
        lbl.config(text='Ні')

tk.Button(root, text='Перевірити', command=check).pack()
root.mainloop()
