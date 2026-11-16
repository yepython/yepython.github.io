import tkinter as tk

root = tk.Tk()
var = tk.BooleanVar()
tk.Checkbutton(root, text='Погоджуюсь', variable=var).pack()
lbl = tk.Label(root, text='Ні')
lbl.pack()

def check():
    if var.get():
        lbl.config(text='Ні')
    else:
        lbl.config(text='Так')

tk.Button(root, text='Перевірити', command=check).pack()
root.mainloop()
