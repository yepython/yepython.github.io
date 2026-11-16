n = int(input())
a, b = 1, 1
result = []
for i in range(n):
    result.append(str(a))
    a, b = b, a + b
print(" ".join(result))
