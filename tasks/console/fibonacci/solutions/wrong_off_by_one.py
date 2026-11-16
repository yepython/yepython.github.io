n = int(input())
a, b = 0, 1
result = []
for i in range(n - 1):
    result.append(str(a))
    a, b = b, a + b
print(" ".join(result))
