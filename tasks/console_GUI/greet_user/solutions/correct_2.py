import tkinter as tk

name = input()
root = tk.Tk()
lbl = tk.Label(root, text=f'Привіт, {name}!')
lbl.pack()
root.mainloop()
