import tkinter as tk

root = tk.Tk()
root.title('Вітальне вікно')
root.geometry('400x300')
tk.Label(root, text='Вітаємо!').pack()
root.mainloop()
