import tkinter as tk

root = tk.Tk()
e = tk.Entry(root)
e.pack()
lbl = tk.Label(root, text='')
lbl.pack()

def show():
    lbl.config(text=f'Привіт, {e.get()}!')

tk.Button(root, text='Привітати', command=show).pack()
root.mainloop()
