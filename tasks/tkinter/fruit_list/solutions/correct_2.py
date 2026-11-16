import tkinter as tk

root = tk.Tk()
fruits = ['Яблуко', 'Банан', 'Апельсин']
lb = tk.Listbox(root)
for f in fruits:
    lb.insert('end', f)
lb.pack()
lbl = tk.Label(root, text='')
lbl.pack()

def show(event):
    s = lb.curselection()
    if s:
        lbl.config(text=lb.get(s[0]))

lb.bind('<<ListboxSelect>>', show)
root.mainloop()
