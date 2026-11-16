import tkinter as tk

name = input()
print(name.upper())
root = tk.Tk()
root.title(name)
lbl = tk.Label(root, text=name.lower())
lbl.pack()
root.mainloop()
