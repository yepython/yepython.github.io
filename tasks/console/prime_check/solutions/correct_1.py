n = int(input())
if n < 2:
    print("не просте")
else:
    is_prime = True
    d = 2
    while d * d <= n:
        if n % d == 0:
            is_prime = False
            break
        d += 1
    print("просте" if is_prime else "не просте")
