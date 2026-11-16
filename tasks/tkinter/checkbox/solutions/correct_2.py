import tkinter as tk

root = tk.Tk()
v = tk.IntVar()
tk.Checkbutton(root, text='Погоджуюсь', variable=v).pack()
res = tk.Label(root, text='Ні')
res.pack()

def show():
    res.config(text='Так' if v.get() else 'Ні')

tk.Button(root, text='Перевірити', command=show).pack()
root.mainloop()
