nums = [int(x) for x in input().split()]
n = len(nums)
for i in range(n):
    k = i
    for j in range(i + 1, n):
        if nums[j] < nums[k]:
            k = j
    nums[i], nums[k] = nums[k], nums[i]
print(" ".join(str(x) for x in nums))
