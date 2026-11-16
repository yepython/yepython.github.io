import tkinter as tk

count = 0
root = tk.Tk()
lbl = tk.Label(root, text='0')
lbl.pack()

def inc():
    global count
    count += 1
    lbl.config(text=str(count))

tk.Button(root, text='Натисни', command=inc).pack()
root.mainloop()
