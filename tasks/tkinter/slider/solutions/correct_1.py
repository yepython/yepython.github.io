import tkinter as tk

root = tk.Tk()
lbl = tk.Label(root, text='0')
lbl.pack()

def on_move(val):
    lbl.config(text=str(int(float(val))))

sc = tk.Scale(root, from_=0, to=100, orient='horizontal', command=on_move)
sc.pack()
root.mainloop()
