s = input()
left = 0
right = len(s) - 1
is_pal = True
while left < right:
    if s[left] != s[right]:
        is_pal = False
        break
    left += 1
    right -= 1
print("паліндром" if is_pal else "не паліндром")
