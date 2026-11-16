import tkinter as tk

def main():
    root = tk.Tk()
    root.title('Counter')
    lbl = tk.Label(root, text='0')
    lbl.pack()
    counter = {'v': 0}
    def inc():
        counter['v'] += 1
        lbl.config(text=str(counter['v']))
    btn = tk.Button(root, text='Уперед', command=inc)
    btn.pack()
    root.mainloop()

main()
