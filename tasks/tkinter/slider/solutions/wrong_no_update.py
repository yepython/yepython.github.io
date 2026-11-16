import tkinter as tk

root = tk.Tk()
lbl = tk.Label(root, text='0')
lbl.pack()
sc = tk.Scale(root, from_=0, to=100, orient='horizontal')
sc.pack()
root.mainloop()
