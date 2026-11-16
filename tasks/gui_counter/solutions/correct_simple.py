import tkinter as tk

root = tk.Tk()
root.title('Counter')
lbl = tk.Label(root, text='0')
lbl.pack()

def inc():
    lbl.config(text=str(int(lbl.cget('text')) + 1))

btn = tk.Button(root, text='Уперед', command=inc)
btn.pack()
root.mainloop()
