n = int(input())
count = 0
for d in range(1, n + 1):
    if n % d == 0:
        count += 1
print("просте" if count == 2 else "не просте")
