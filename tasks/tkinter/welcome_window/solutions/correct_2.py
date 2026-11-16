import tkinter as tk

win = tk.Tk()
win.title('Вітальне вікно')
win.geometry('300x200')
lbl = tk.Label(win, text='Вітаємо!')
lbl.pack()
win.mainloop()
