import tkinter as tk

pwd = input()
root = tk.Tk()
if pwd == 'python123':
    tk.Label(root, text='Доступ дозволено').pack()
else:
    tk.Label(root, text='Доступ заборонено').pack()
root.mainloop()
