import tkinter as tk

password = input()
if password == 'python123':
    msg = 'Доступ дозволено'
else:
    msg = 'Доступ заборонено'
root = tk.Tk()
tk.Label(root, text=msg).pack()
root.mainloop()
