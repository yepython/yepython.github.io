# scipy для Skulpt

Реалізація підмножини SciPy для Skulpt, побудована в тому ж стилі, що й
наданий `numpy/__init__.js`. Модуль **не лізе у приватні структури numpy** —
він спілкується з ним лише через публічний Python-рівень API
(`np.array(...)`, `arr.tolist()`), тому працює і без numpy (тоді масиви
повертаються як звичайні `list`).

## Встановлення

Покладіть файл так само, як лежить `numpy`:

```
твій-проект/
  numpy/__init__.js
  scipy/__init__.js   <-- цей файл
```

і зареєструйте шлях до модулів у Skulpt так само, як для numpy
(`Sk.configure({ ..., builtinFiles: {...}})` або через `Sk.systemPath` —
залежно від того, як у тебе вже налаштований numpy).

## Підмодулі та приклади

```python
import scipy.constants as const
import scipy.special as special
import scipy.linalg as linalg
import scipy.optimize as optimize
import scipy.integrate as integrate
import scipy.stats as stats
import scipy.fft as fft
import scipy.spatial.distance as distance

# constants
print(const.pi, const.c, const.g)
print(const.convert_temperature(100, 'Celsius', 'Fahrenheit'))  # 212.0

# special
print(special.gamma(5))       # 24.0
print(special.erf(1))         # 0.8427...
print(special.comb(5, 2))     # 10

# linalg
A = [[3, 2], [1, 4]]
print(linalg.det(A))          # 10.0
print(linalg.inv(A))
print(linalg.solve(A, [5, 6]))
vals, vecs = linalg.eig([[2, 1], [1, 2]])
print(vals)                   # [3.0, 1.0]

# optimize
root = optimize.brentq(lambda x: x**2 - 2, 0, 2)
print(root)                   # 1.41421356...

res = optimize.minimize(lambda v: (v[0]-1)**2 + (v[1]-2)**2, [0, 0])
print(res.x, res.fun)

params, _ = optimize.curve_fit(lambda x, a, b: a*x + b, [0,1,2,3], [1,3,5,7], p0=[1,1])
print(params)                 # ~[2.0, 1.0]

# integrate
val, err = integrate.quad(lambda x: x**2, 0, 3)
print(val)                    # 9.0

ys = integrate.odeint(lambda y, t: y, [1.0], [0, 0.5, 1.0])
print(ys)                     # y(t) = e^t

# stats
print(stats.norm.pdf(0))
print(stats.norm.cdf(1.96))
print(stats.describe([1, 2, 3, 4, 5]))
print(stats.pearsonr([1,2,3], [2,4,6]))

# fft
print(fft.fft([1, 0, 0, 0]))

# spatial
print(distance.euclidean([0, 0], [3, 4]))     # 5.0
print(distance.cdist([[0,0]], [[3,4],[1,1]]))
```

## Що реалізовано

| Підмодуль | Функції |
|---|---|
| `scipy.constants` | `pi`, `c`, `h`, `hbar`, `G`, `g`, `e`, `k`, `R`, `N_A`, `sigma`, маси частинок, префікси SI, одиниці часу/довжини, `convert_temperature` |
| `scipy.special` | `gamma`, `gammaln`, `erf`, `erfc`, `expit`, `logit`, `factorial`, `comb`, `perm`, `softmax` |
| `scipy.linalg` | `det`, `inv`, `solve`, `lstsq`, `norm`, `eig`/`eigh`, `eigvals`, `cholesky`, `lu`, `qr`, `pinv` |
| `scipy.optimize` | `bisect`, `brentq`, `newton`, `root_scalar`, `minimize_scalar`, `minimize` (Nelder-Mead), `curve_fit` |
| `scipy.integrate` | `quad`, `simpson`/`simps`, `trapezoid`/`trapz`, `odeint`, `solve_ivp` |
| `scipy.stats` | `norm`, `uniform`, `expon` (з `.pdf/.cdf/.ppf/.rvs`), `describe`, `zscore`, `sem`, `pearsonr`, `ttest_1samp`, `mode` |
| `scipy.fft` | `fft`, `ifft`, `fftfreq` |
| `scipy.spatial.distance` | `euclidean`, `cityblock`, `cosine`, `chebyshev`, `cdist`, `pdist` |

## Обмеження

Це легка, чисто-JS реалізація для навчальних/браузерних задач, а не
production-заміна SciPy:

- `eig`/`eigh` реалізовано методом Якобі — коректно лише для **симетричних**
  матриць (як і `eigh` у справжньому SciPy).
- `linalg.lstsq`/`pinv` розв'язують через нормальні рівняння (`AᵀA`) —
  для погано обумовлених матриць менш стійкі, ніж SVD-версія в оригіналі.
- `optimize.minimize` — лише метод Нелдера-Міда (без градієнтних методів).
- `stats` — тільки 3 неперервні розподіли; p-значення в `pearsonr`/`ttest_1samp`
  наближені нормальним розподілом (без точного t-розподілу).
- `fft`/`ifft` — пряме O(n²) ДПФ (без Cooley-Tukey), достатньо для невеликих масивів.
