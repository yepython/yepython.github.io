import tkinter as tk

name = input()
print(name.lower())
root = tk.Tk()
root.title(name)
lbl = tk.Label(root, text=name)
lbl.pack()
root.mainloop()
