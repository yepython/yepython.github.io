import tkinter as tk

root = tk.Tk()
lb = tk.Listbox(root)
for item in ['Яблуко', 'Банан', 'Апельсин']:
    lb.insert(tk.END, item)
lb.pack()
result = tk.Label(root, text='')
result.pack()
root.mainloop()
