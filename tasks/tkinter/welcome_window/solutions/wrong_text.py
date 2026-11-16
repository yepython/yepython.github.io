import tkinter as tk

root = tk.Tk()
root.title('Вітальне вікно')
root.geometry('300x200')
tk.Label(root, text='Привіт!').pack()
root.mainloop()
