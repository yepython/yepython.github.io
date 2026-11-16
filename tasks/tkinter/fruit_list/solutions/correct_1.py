import tkinter as tk

root = tk.Tk()
lb = tk.Listbox(root)
for item in ['Яблуко', 'Банан', 'Апельсин']:
    lb.insert(tk.END, item)
lb.pack()
result = tk.Label(root, text='')
result.pack()

def on_select(event):
    sel = lb.curselection()
    if sel:
        result.config(text=lb.get(sel[0]))

lb.bind('<<ListboxSelect>>', on_select)
root.mainloop()
