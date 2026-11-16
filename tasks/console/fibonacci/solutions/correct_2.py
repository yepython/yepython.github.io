n = int(input())
a, b = 0, 1
parts = []
i = 0
while i < n:
    parts.append(str(a))
    a, b = b, a + b
    i += 1
print(" ".join(parts))
