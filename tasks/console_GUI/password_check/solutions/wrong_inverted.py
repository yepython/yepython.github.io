import tkinter as tk

password = input()
if password == 'python123':
    msg = 'Доступ заборонено'
else:
    msg = 'Доступ дозволено'
root = tk.Tk()
tk.Label(root, text=msg).pack()
root.mainloop()
