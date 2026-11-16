import tkinter as tk

root = tk.Tk()
value_lbl = tk.Label(root, text='0')
value_lbl.pack()

def changed(v):
    value_lbl.config(text=str(int(float(v))))

s = tk.Scale(root, from_=0, to=100, orient='horizontal', command=changed)
s.pack()
root.mainloop()
