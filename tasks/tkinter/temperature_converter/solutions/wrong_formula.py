import tkinter as tk

root = tk.Tk()
entry = tk.Entry(root)
entry.pack()
result = tk.Label(root, text='')
result.pack()

def convert():
    c = float(entry.get())
    f = c + 32
    result.config(text=str(f))

tk.Button(root, text='Конвертувати', command=convert).pack()
root.mainloop()
