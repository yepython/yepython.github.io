import tkinter as tk

root = tk.Tk()
lbl = tk.Label(root, text='0')
lbl.pack()

def inc():
    lbl.config(text=str(int(lbl.cget('text')) + 2))

tk.Button(root, text='Натисни', command=inc).pack()
root.mainloop()
