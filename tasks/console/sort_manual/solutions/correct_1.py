nums = [int(x) for x in input().split()]
n = len(nums)
for i in range(n):
    for j in range(n - 1 - i):
        if nums[j] > nums[j + 1]:
            nums[j], nums[j + 1] = nums[j + 1], nums[j]
print(" ".join(str(x) for x in nums))
