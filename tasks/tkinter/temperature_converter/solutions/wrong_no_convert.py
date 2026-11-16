import tkinter as tk

root = tk.Tk()
entry = tk.Entry(root)
entry.pack()
result = tk.Label(root, text='')
result.pack()

def convert():
    result.config(text=entry.get())

tk.Button(root, text='Конвертувати', command=convert).pack()
root.mainloop()
