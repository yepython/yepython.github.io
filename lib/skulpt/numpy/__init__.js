/**
 * ES6 - Math polyfill, when .dot is implemented, we do not need to rely on mathjs anymore
 * borrowed from: https://github.com/MaxArt2501/es6-math
 */
(function(factory) {
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else factory();
})(function() {
    "use strict";
    // x | 0 is the simplest way to implement ToUint32(x)
    var M = Math,
        N = Number,
        prop, def = Object.defineProperty,
        mathXtra = {
            // Hyperbolic functions
            sinh: function sinh(x) {
                // If -0, must return -0.
                if (x === 0) return x;
                var exp = M.exp(x);
                return exp/2 - .5/exp;
            },
            cosh: function cosh(x) {
                var exp = M.exp(x);
                return exp/2 + .5/exp;
            },
            tanh: function tanh(x) {
                // If -0, must return -0.
                if (x === 0) return x;
                // Mathematically speaking, the formulae are equivalent.
                // But computationally, it's better to make exp tend to 0
                // rather than +Infinity
                if (x < 0) {
                    var exp = M.exp(2 * x);
                    return (exp - 1) / (exp + 1);
                } else {
                    var exp = M.exp(-2 * x);
                    return (1 - exp) / (1 + exp);
                }
            },
            asinh: function asinh(x) {
                return x === -Infinity ? -Infinity : M.log(x + M.sqrt(x * x + 1));
            },
            acosh: function acosh(x) {
                return x >= 1 ? M.log(x + M.sqrt(x * x - 1)) : NaN;
            },
            atanh: function atanh(x) {
                return x >= -1 && x <= 1 ? M.log((1 + x) / (1 - x)) / 2 : NaN;
            },

            // Exponentials and logarithms
            expm1: function expm1(x) {
                // If -0, must return -0. But Math.exp(-0) - 1 yields +0.
                return x === 0 ? x : M.exp(x) - 1;
            },
            log10: function log10(x) {
                return M.log(x) / M.LN10;
            },
            log2: function log2(x) {
                return M.log(x) / M.LN2;
            },
            log1p: function log1p(x) {
                // If -0, must return -0. But Math.log(1 + -0) yields +0.
                return x === 0 ? x : M.log(1 + x);
            },

            // Various
            sign: function sign(x) {
                // If -0, must return -0.
                return isNaN(x) ? NaN : x < 0 ? -1 : x > 0 ? 1 : +x;
            },
            cbrt: function cbrt(x) {
                // If -0, must return -0.
                return x === 0 ? x : x < 0 ? -M.pow(-x, 1/3) : M.pow(x, 1/3);
            },
            hypot: function hypot(value1, value2) { // Must have a length of 2
                for (var i = 0, s = 0, args = arguments; i < args.length; i++)
                    s += args[i] * args[i];
                return M.sqrt(s);
            },

            // Rounding and 32-bit operations
            trunc: function trunc(x) {
                return x === 0 ? x : x < 0 ? M.ceil(x) : M.floor(x);
            },
            fround: typeof Float32Array === "function"
                    ? (function(arr) {
                        return function fround(x) { return arr[0] = x, arr[0]; };
                    })(new Float32Array(1))
                    : function fround(x) { return x; },

            clz32: function clz32(x) {
                if (x === -Infinity) return 32;
                if (x < 0 || (x |= 0) < 0) return 0;
                if (!x) return 32;
                var i = 31;
                while (x >>= 1) i--;
                return i;
            },
            imul: function imul(x, y) {
                return (x | 0) * (y | 0) | 0;
            }
        },
        numXtra = {
            isNaN: function isNaN(x) {
                // NaN is the only Javascript object such that x !== x
                // The control on the type is for eventual host objects
                return typeof x === "number" && x !== x;
            },
            isFinite: function isFinite(x) {
                return typeof x === "number" && x === x && x !== Infinity && x !== -Infinity;
            },
            isInteger: function isInteger(x) {
                return typeof x === "number" && x !== Infinity && x !== -Infinity && M.floor(x) === x;
            },
            isSafeInteger: function isSafeInteger(x) {
                return typeof x === "number" && x > -9007199254740992 && x < 9007199254740992 && M.floor(x) === x;
            },
            parseFloat: parseFloat,
            parseInt: parseInt
        },
        numConsts = {
            EPSILON: 2.2204460492503130808472633361816e-16,
            MAX_SAFE_INTEGER: 9007199254740991,
            MIN_SAFE_INTEGER: -9007199254740991
        };

    for (prop in mathXtra)
        if (typeof M[prop] !== "function")
            M[prop] = mathXtra[prop];

    for (prop in numXtra)
        if (typeof N[prop] !== "function")
            N[prop] = numXtra[prop];

    try {
        prop = {};
        def(prop, 0, {});
        for (prop in numConsts)
            if (!(prop in N))
                def(N, prop, {value: numConsts[prop]});
    } catch (e) {
        for (prop in numConsts)
            if (!(prop in N))
                N[prop] = numConsts[prop];
    }
});
var $builtinmodule = function (name) {
    /**
        Made by Michael Ebert for https://github.com/skulpt/skulpt
        ndarray implementation inspired by https://github.com/geometryzen/davinci-dev (not compatible with skulpt)

        Some methods are based on the original numpy implementation.

        See http://waywaaard.github.io/skulpt/ for more information.
    **/
    /* eslint-disable */

    /******************************************/
    /*               DEFINES                  */
    /******************************************/

    // base class name, used for all checks and other defines
    var CLASS_NDARRAY = "numpy.ndarray";

    // numpy specific defines and constants
    var NPY_MAX_INT = Number.MAX_SAFE_INTEGER;
    var NPY_MAX_INTP = NPY_MAX_INT;
    var NPY_MAXDIMS = 32;
    var NPY_MAXARGS = 32;

    var NPY_FAIL = 0;
    var NPY_SUCCEED = 1;

    var NPY_TYPES = { 
        NPY_BOOL: 0,
        NPY_BYTE: 1, 
        NPY_UBYTE: 2,
        NPY_SHORT: 3, 
        NPY_USHORT: 4,
        NPY_INT: 5, 
        NPY_UINT: 6,
        NPY_LONG: 7, 
        NPY_ULONG: 8,
        NPY_LONGLONG: 9, 
        NPY_ULONGLONG: 10,
        NPY_FLOAT: 11, 
        NPY_DOUBLE: 12, 
        NPY_LONGDOUBLE: 13,
        NPY_CFLOAT: 14, 
        NPY_CDOUBLE: 15, 
        NPY_CLONGDOUBLE: 16,
        NPY_OBJECT: 17,
        NPY_STRING: 18, 
        NPY_UNICODE: 19,
        NPY_VOID: 20,
        /*
         * New 1.6 types appended, may be integrated
         * into the above in 2.0.
         */
        NPY_DATETIME: 21, 
        NPY_TIMEDELTA: 22, 
        NPY_HALF: 23,

        NPY_NTYPES: 24,
        NPY_NOTYPE: 25,
        NPY_CHAR: 26,      /* special flag */
        NPY_USERDEF: 256,  /* leave room for characters */

        /* The number of types not including the new 1.6 types */
        NPY_NTYPES_ABI_COMPATIBLE: 21
    };

    /* basetype array priority */
    var NPY_PRIORITY = 0.0;

    /* default subtype priority */
    var NPY_SUBTYPE_PRIORITY = 1.0;

    /* default scalar priority */
    var NPY_SCALAR_PRIORITY = -1000000.0;
    
    // number of floating point types
    var NPY_NUM_FLOATTYPE = 3;

    // array falgs
    var NPY_ARRAY_C_CONTIGUOUS = 0x0001;
    var NPY_ARRAY_F_CONTIGUOUS = 0x0002;
    var NPY_ARRAY_OWNDATA = 0x0004;
    var NPY_ARRAY_ALIGNED = 0x0100;
    var NPY_ARRAY_NOTSWAPPED = 0x0200;
    var NPY_ARRAY_WRITEABLE  = 0x0400;
    var NPY_ARRAY_BEHAVED = (NPY_ARRAY_ALIGNED | NPY_ARRAY_WRITEABLE);
    var NPY_ARRAY_CARRAY = NPY_ARRAY_C_CONTIGUOUS | NPY_ARRAY_BEHAVED;
    var NPY_ARRAY_DEFAULT = NPY_ARRAY_CARRAY;
    var NPY_ARRAY_UPDATEIFCOPY = 0x1000;

    var numpy = function () {
        this.math = Math; // set math object
    };
    numpy.prototype.arange = function (a, b, c) {
      
      let start = 0;
      let stop = 0;
      let step = 0;  
      if (arguments.length==1) {
                start = 0;
                stop = a;
                step = 1;
             }
      
      if (arguments.length==2) {
                start = a;
                stop = b;
                step = 1;
            }
      if (arguments.length==3) {
                start = a;
                stop = b;
                step = c;
            }
                
/*
      start *= 1.0;
      stop *= 1.0;
      step *= 1.0;
      */ 
      
      var res = [];
      for (var i = start; i < stop; i += step) {
        res.push(i);
      }
     
      return res;
    };

    // check if obj is an ndarray (does not check for subclasses)
    function PyArray_Check(obj) {
        return obj && (Sk.abstr.typeName(obj) === CLASS_NDARRAY);
    }

    // check if an ndarray is usable as a boolean mask
    function _isBooleanMaskArray(obj) {
        if (!PyArray_Check(obj)) return false;
        var data = PyArray_DATA(obj);
        if (!data || data.length === 0) return false;
        for (var i = 0; i < data.length; i++) {
            // Accept both Sk.builtin.bool and plain JS booleans (after comparison)
            if (!(data[i] instanceof Sk.builtin.bool) && 
                typeof data[i] !== 'boolean' && 
                data[i] !== Sk.builtin.bool.true$ && 
                data[i] !== Sk.builtin.bool.false$) {
                return false;
            }
        }
        return true;
    }

    /* get the dataptr from its current coordinates for simple iterator */
    // coordinates is a array, iter is special ndarray create iter object
    function get_ptr_simple(iter, coordinates) {
        var i;
        var ret;

        ret = PyArray_DATA(iter.ao);

        for (i = 0; i < PyArray_NDIM(iter.ao); ++i) {
            ret += coordinates[i] * iter.strides[i];
        }

        return ret;
    }

    // common init code for ndarray iterators
    // it.dataptr is just the index to the current element (as we do not have C pointers in Javascript)
    function array_iter_base_init(it, ao) {
        var nd, i;

        nd = PyArray_NDIM(ao);
        it.ao = ao;
        it.size = PyArray_SIZE(ao);
        it.nd_m1 = nd - 1;
        it.factors = it.factors || [];
        it.dims_m1 = it.dims_m1 || [];
        it.strides = it.strides || [];
        it.backstrides = it.backstrides || [];
        it.bounds = it.bounds || [];
        it.limits = it.limits || [];
        it.limits_sizes = it.limits_sizes || [];
        it.factors[nd -1] = 1;

        for (i = 0; i < nd; i++) {
            it.dims_m1[i] = PyArray_DIMS(ao)[i] - 1;
            it.strides[i] = PyArray_STRIDES(ao)[i];
            it.backstrides[i] = it.strides[i] * it.dims_m1[i];
            if (i > 0) {
                it.factors[nd-i-1] = it.factors[nd-i] * PyArray_DIMS(ao)[nd-i];
            }
            it.bounds[i] = it.bounds[i] || [];
            it.bounds[i][0] = 0;
            it.bounds[i][1] = PyArray_DIMS(ao)[i] - 1;
            it.limits[i] = it.limits[i] || [];
            it.limits[i][0] = 0;
            it.limits[i][1] = PyArray_DIMS(ao)[i] - 1;
            it.limits_sizes[i] = it.limits[i][1] - it.limits[i][0] + 1;
        }

        // assign translate a method
        it.translate = get_ptr_simple;

        PyArray_ITER_RESET(it);

        return it;
    }

    /*NUMPY_API
     * Get Iterator.
     */
    function PyArray_IterNew(obj) {
        var it; // PayArrayIterObject
        var ao; // PyArrayObject

        if (!PyArray_Check(obj)) {
            throw new Error('bad internal call');
        }

        ao = obj;
        it = Sk.abstr.iter(ao); // create new iter

        if (it == null) {
            return null;
        }

        array_iter_base_init(it, ao);

        return it;
    }

    /*NUMPY_API
     * Get Iterator that iterates over all but one axis (don't use this with
     * PyArray_ITER_GOTO1D).  The axis will be over-written if negative
     * with the axis having the smallest stride.
     */
    function PyArray_IterAllButAxis(obj, inaxis) {
        var arr;
        var it;
        var axis;

        if (!PyArray_Check(obj)) {
            throw new Sk.builtin.ValueError('Numpy IterAllButAxis requires an ndarray.');
        }

        arr = obj;
        it = PyArray_IterNew(arr);

        if (PyArray_NDIM(arr) == 0) {
            return it;
        }

        if (inaxis < 0) {
            var i;
            var minaxis = 0;
            var minstride = 0;
            i = 0;
            while (minstride == 0 && i < PyArray_NDIM(arr)) {
                minstride = PyArray_STRIDE(arr ,i);
                i += 1;
            }

            for (i = 1; i < PyArray_NDIM(arr); i++) {
                if (PyArray_STRIDE(arr, i) > 0 && PyArray_STRIDE(arr, i) < minstride) {
                    minaxis = 1;
                    minstride = PyArray_STRIDE(arr, i);
                }
            }
            inaxis = minaxis;
        }

        axis = inaxis;

        it.contiguous = 0;

        if (it.size != 0) {
            it.size /= PyArray_DIM(arr, axis);
        }

        it.dims_m1[axis] = 0;
        it.backstrides[axis] = 0;

        return it;
    }

    // it.dataptr is just the index to the current element (as we do not have C pointers in Javascript)
    function _PyArray_ITER_NEXT1(it) {
        it.dataptr +=  it.strides[0];
        it.coordinates[0] += 1;
    }

    // it.dataptr is just the index to the current element (as we do not have C pointers in Javascript)
    function _PyArray_ITER_NEXT2(it) {
        if (it.coordinates[1] < it.dims_m1[1]) {
            it.coordinates[1] += 1;
            it.dataptr +=  it.strides[1];
        } else {
            it.coordinates[1] = 0;
            it.coordinates[0] += 1;
            it.dataptr +=  it.strides[0] - it.backstrides[1];
        }
    }

    // it.dataptr is just the index to the current element (as we do not have C pointers in Javascript)
    function PyArray_ITER_NEXT(it) {
        it.index += 1;
        if (it.nd_m1 == 0) {
            _PyArray_ITER_NEXT1(it)
        } else if (it.nd_m1 == 1) {
            _PyArray_ITER_NEXT2(it);
        } else {
            var __npy_i;
            for (__npy_i = it.nd_m1; __npy_i >= 0; __npy_i--) {
                if (it.coordinates[__npy_i] < it.dims_m1[__npy_i]) {
                    it.coordinates[__npy_i] += 1;
                    // _PyAIT(it)->dataptr += _PyAIT(it)->strides[__npy_i];
                    it.dataptr += it.strides[__npy_i];
                } else {
                    it.coordinates[__npy_i] = 0;
                    it.dataptr += it.backstrides[__npy_i];
                }
            }
        }
    }

    // https://github.com/numpy/numpy/blob/3d2b8ca9bcbdbc9e835cb3f8d56c2d93a67b00aa/numpy/core/include/numpy/ndarraytypes.h#L1077
    // it.dataptr is just the index to the current element (as we do not have C pointers in Javascript)
    function PyArray_ITER_RESET(it) {
        it.index = 0;
        it.dataptr = 0; // back to the first element
        it.coordinates = [0, it.nd_m1 + 1];
    }

    // easy and functional impl. for our own use cases
    // may not support all cases of the real API
    function PyArray_DESCR(arr) {
        
        return arr.v.dtype;
    }

    function PyArray_MultiIterNew() {
        throw new Sk.builtin.NotImplementedError("MultiIter is not supported");
    }

    /* Does nothing with descr (cannot be NULL) */
    /*NUMPY_API
      Get scalar-equivalent to a region of memory described by a descriptor.
    */
    function PyArray_Scalar(data, descr, base) {
        
        // we do not reproduce the real function, we just want to return
        // the first and only element of the internal buffer (we do not have C like memory)

        // maybe we can add later on a real impl.
        var tmp = data[0];
        var ret = new descr(tmp);
        
        return ret;
    }

    function PyArray_ToScalar(data, arr) {
        return PyArray_Scalar(data, PyArray_DESCR(arr), arr);
    }

    /*
     * This function checks to see if arr is a 0-dimensional array and, if so, returns the appropriate array scalar. It should be used whenever 0-dimensional arrays could be returned to Python.
     */
    function PyArray_Return(mp) {
        if (mp == null) {
            return null;
        }

        if (!PyArray_Check(mp)) {
            return mp;
        }
        
        if (PyArray_NDIM(mp) == 0) {
           
            var ret = PyArray_ToScalar(PyArray_DATA(mp), mp).v;
            
            return ret; // return the only element
        } else {
            
            return mp;
        }
    }

    function PyArray_UNPACK_ITERABLE(itObj) {
        if (Sk.builtin.checkIterable(itObj)) {
            var it = Sk.abstr.iter(itObj);
            var ret = [];
            for (it = Sk.abstr.iter(seq), i = it.tp$iternext(); i !== undefined; i = it.tp$iternext()) {
                ret.push(i);
            }
            // now iterate over all objects and unpack them
        }
    }

    function PyArray_UNPACK_SEQUENCE(seqObj) {
        if (Sk.builtin.checkSequence(seqObj)) {
            var length = Sk.builtin.len(seqObj);
            length = Sk.ffi.remapToJs(length);
            var i;
            var ret = [];
            var item;

            for (i = 0; i < length; i++) {
                item = seqObj.mp$subscript(i);
                ret.push(item);
            }

            return ret;
        } else {
            throw new Error('Internal API-CAll error occured in PyArray_UNPACK_SEQUENCE');
        }
    }

    function PyArray_UNPACK_SHAPE(arr, shape) {
        var js_shape;

        if (Sk.builtin.checkNone(shape)) {
            throw new Sk.builtin.ValueError('total size of new array must be unchanged');
        } else if (Sk.builtin.checkInt(shape)) {
            js_shape = [Sk.ffi.remapToJs(shape)];
        } else if (Sk.builtin.checkSequence(shape) && Sk.builtin.isinstance(shape, Sk.builtin.dict) == Sk.builtin.bool.false$) {
            js_shape = PyArray_UNPACK_SEQUENCE(shape);
        } else {
            throw new Sk.builtin.TypeError('expected sequence object with len >= 0 or a single integer');
        }

        // now check each array item individually
        var i;
        var foundUnknownDimension = 0;
        var unknownDimensionIndex = -1;
        for (i = 0; i < js_shape.length; i++) {
            if (!Sk.builtin.checkInt(js_shape[i])) {
                throw new Sk.builtin.TypeError('an integer is required');
            } else {
                js_shape[i] = Sk.ffi.remapToJs(js_shape[i]);

                if (js_shape[i] === -1) {
                    foundUnknownDimension += 1;
                    unknownDimensionIndex = i;
                }
            }
        }

        // check if there is one unknown dimension
        if (foundUnknownDimension > 1) {
            throw new Sk.builtin.ValueError('can only specify one unknown dimension');
        }

        // shape infering with one unknown dimension
        if (foundUnknownDimension == 1) {
            var knownDim;
            var n_size;
            // easy solution for first index auto shape infering
            if (unknownDimensionIndex === 0) {
                if (js_shape.length === 1) {
                    n_size = 1; // arr_size / 1 is 1 dim with all elements
                } else {
                    n_size = prod(js_shape.slice(1));
                }
            } else {
                // slice array without the -1 dim
                var prod_shape = js_shape.slice();
                prod_shape.splice(unknownDimensionIndex, 1); // remove unknown dim
                n_size = prod(prod_shape);
            }
            knownDim = PyArray_SIZE(arr) / n_size;
            js_shape[unknownDimensionIndex] = knownDim;
        }

        if (prod(js_shape) !== PyArray_SIZE(arr)) {
            throw new Sk.builtin.ValueError('total size of new array must be unchanged');
        }

        return js_shape;
    }

    function PyArray_SIZE(arr) {
        if (PyArray_Check(arr)) {
            return prod(arr.v.shape);
        } else {
            throw new Error('Internal API-Call Error occured in PyArray_DATA.', arr);
        }
    }

    function PyArray_DATA(arr) {
        if (PyArray_Check(arr)) {
            
            return arr.v.buffer;
        } else {
            throw new Error('Internal API-Call Error occured in PyArray_DATA.', arr);
        }
    }

    function PyArray_STRIDES(arr) {
        if (PyArray_Check(arr)) {
            return arr.v.strides;
        } else {
            throw new Error('Internal API-Call Error occured in PyArray_STRIDES.', arr);
        }
    }

    function PyArray_STRIDE(arr, n) {
        if (PyArray_Check(arr)) {
            var strides = arr.v.strides;
            return strides[n];
        } else {
            throw new Error('Internal API-Call Error occured in PyArray_STRIDE.', arr);
        }
    }

    /*
     *  The number of dimensions in the array.
     *  Returns a javascript value
     */
    function PyArray_NDIM(arr) {
        if (PyArray_Check(arr)) {
            return arr.v.shape.length;
        } else {
            throw new Error('Internal API-Call Error occured in PyArray_NDIM.', arr);
        }
    }

    /*
     *  Returns a pointer to the dimensions/shape of the array. The number of elements matches the number of dimensions of the array.
     *  This returns javascript values!
     */
    function PyArray_DIMS(arr) {
        if (PyArray_Check(arr)) {
            return arr.v.shape;
        } else {
            throw new Error('Internal API-Call Error occured in PyArray_DIMS.', arr);
        }
    }

    /*
     *  Return the shape in the nth dimension.
     */
    function PyArray_DIM(arr, n) {
        if (PyArray_Check(arr)) {
            return arr.v.shape[n];
        } else {
            throw new Error('Internal API-Call Error occured in PyArray_DIM.', arr);
        }
    }

    function PyArray_NewShape(arr, shape, order) {
        if (PyArray_Check(arr)) {
            var py_shape = new Sk.builtin.tuple(shape.map(
              function (x) {
                return new Sk.builtin.int_(x);
            }));

             var py_order = Sk.ffi.remapToPy(order);
            return Sk.misceval.callsim(arr.reshape, arr, py_shape, py_order);
        } else {
            throw new Error('Internal API-Call Error occured in PyArray_NewShape.', arr);
        }
    }

    function PyArray_FLAGS(arr) {
        if (PyArray_Check(arr)) {
            return arr.v.flags;
        } else {
            throw new Error('Internal API-Call Error occured in PyArray_NewShape.', arr);
        }
    }

    function PyArray_Transpose(ap, permute) {
        // ap = array object
        // permute = PyArrayDims []
        var axes = [];
        var axis;
        var permutation = [];
        var reverse_permutation = [];
        var ret = null;
        var flags;

        if (permute == null) {
            n = PyArray_NDIM(ap);
            for (i = 0; i < n; i++) {
                permutation[i] = n - 1 - i;
            }
        } else {
            n = permute.length;
            axes = permute;
            if (n != PyArray_NDIM(ap)) {
                throw new Sk.builtin.ValueError("axes don't match array");
            }

            for (i = 0; i < n; i++) {
                reverse_permutation[i] = -1;
            }

            for (i = 0; i < n; i++) {
                axis = axes[i];
                if (axis < 0) {
                    axis = PyArray_NDIM(ap) + axis;
                }

                if (axis < 0 || axis >= PyArray_NDIM(ap)) {
                    throw new Sk.builtin.ValueError('invalid axis for this array');
                }

                if (reverse_permutation[axis] != -1) {
                    throw new Sk.builtin.ValueError('repeated axis in transpose');
                }

                reverse_permutation[axis] = i;
                permutation[i] = axis;
            }
        }

        flags = PyArray_FLAGS(ap);


        // can we speed those things up?
        // we add the data later on, first we create a new array with given dtype and strides, flags etc
        ret = PyArray_NewFromDescr(Sk.builtin.type(ap), PyArray_DESCR(ap), n, PyArray_DIMS(ap), null, null, flags, ap);
        //var newBuffer = Sk.misceval.callsim(ret.tolist, ret);
        //ret.v.buffer = remapToJs_shallow(newBuffer, true);
        // fix the dimensions and strides of the return array
        for (i = 0; i < n; i++) {
            PyArray_DIMS(ret)[i] = PyArray_DIMS(ap)[permutation[i]];
            PyArray_STRIDES(ret)[i] = PyArray_STRIDES(ap)[permutation[i]];
        }

        var list = tolist(PyArray_DATA(ap), PyArray_DIMS(ret), PyArray_STRIDES(ret), 0, PyArray_DESCR(ret));
        //var newBuffer = tobufferrecursive(PyArray_DATA(ap), PyArray_DIMS(ret), PyArray_STRIDES(ret), 0, PyArray_DESCR(ret));
        //ret.v.buffer = newBuffer;
        // can we skip this call and just use the internal tolist?
        var newArray = Sk.misceval.callsim(mod.array, list);
        //     PyArray_UpdateFlags(ret, NPY_ARRAY_C_CONTIGUOUS | NPY_ARRAY_F_CONTIGUOUS |NPY_ARRAY_ALIGNED);
        return newArray;
        //return ret;
    }

    // OBJECT_dot is the method used for python types
    // https://github.com/numpy/numpy/blob/f43d691fd0b9b4f416b50fba34876691af2d0bd4/numpy/core/src/multiarray/arraytypes.c.src#L3497
    function OBJECT_dot(ip1, is1, ip2, is2, op, n, ignore) {
        /*
         * ALIGNMENT NOTE: np.dot, np.inner etc. enforce that the array is
         * BEHAVED before getting to this point, so unaligned pointers aren't
         * handled here.
         */
        var i; // npy_intp
        var tmp1; // PyObject
        var tmp2; // PyObject
        var tmp = null; // PyObject
        var tmp3; // PyObject **

        var ip1_i = 0;
        var ip2_i = 0;

        for (i = 0; i < n; i++, ip1_i += is1, ip2_i += is2) {
            if (ip1[ip1_i] == null || ip2[ip2_i] == null) {
                tmp1 = Sk.builtin.bool.false$;
            }
            else {
                tmp1 = Sk.abstr.numberBinOp(ip1[ip1_i], ip2[ip2_i], 'Mult');
                if (!tmp1) {
                    return;
                }
            }
            if (i == 0) {
                tmp = tmp1;
            }
            else {
                tmp2 = Sk.abstr.numberBinOp(tmp, tmp1, 'Add');
                if (!tmp2) {
                    return;
                }
                tmp = tmp2;
            }
        }

        tmp3 = op;
        tmp2 = tmp3;
        //op[0] = tmp;

        return tmp;
    }


    // vdot function for python basic numeric types
    // https://github.com/numpy/numpy/blob/467d4e16d77a2e7c131aac53c639e82b754578c7/numpy/core/src/multiarray/vdot.c
    /*
     *  ip1: vector 1
     *  ip2: vector 2
     *  is1: stride of vector 1
     *  is2: stride of vector 2
     *  op: new nd_array data buffer for the result
     *  n:  number of elements in ap1 first dim
     *  ignore: not used anymore, however still existing for old api calls
     *
     */
function OBJECT_vdot(ip1, is1, ip2, is2, op, n, ignore) {
    function tryConjugate(pyObj) {
        const conjAttr = pyObj.tp$getattr("conjugate");
        if (conjAttr) {
            return Sk.misceval.callsim(pyObj["conjugate"], pyObj);
        } else {
            return pyObj;
        }
    }

    let tmp = null;

    let ip1_i = 0;
    let ip2_i = 0;

    for (let i = 0; i < n; i++, ip1_i += is1, ip2_i += is2) {
        const a = ip1[ip1_i];
        const b = ip2[ip2_i];

        if (a == null || b == null) {
            console.log(`Element ${i}: a or b is null`);
            continue;
        }

        const a_conj = tryConjugate(a);
        const prod = Sk.abstr.numberBinOp(a_conj, b, 'Mult');
        if (prod == null) {
            console.log(`Element ${i}: product failed`);
            continue;
        }

        if (i === 0) {
            tmp = prod;
        } else {
            const sum = Sk.abstr.numberBinOp(tmp, prod, 'Add');
            if (sum == null) {
                console.log(`Element ${i}: sum failed`);
                return;
            }
            tmp = sum;            
        }
    }

    if (tmp != null) {
        op[0] = tmp;        
    } else {
        console.log("No result to assign.");
    }
}


/*
    function OBJECT_vdot(ip1, is1, ip2, is2, op, n, ignore){
        function tryConjugate(pyObj) {
            var f = pyObj.tp$getattr("conjugate");
            if (f) {
                return Sk.misceval.callsim(pyObj['conjugate'], pyObj);
            } else {
                return pyObj; // conjugate for non complex types is just the real part
            }
        }

        var i; // npy_intp
        var tmp0; // PyObject
        var tmp1; // PyObject
        var tmp2; // PyObject
        var tmp = null; // PyObject
        var tmp3; // PyObject **

        var ip1_i = 0;
        var ip2_i = 0;

        for (i = 0; i < n; i++, ip1_i += is1, ip2_i += is2) {
            if (ip1[ip1_i] == null || ip2[ip2_i] == null) {
                tmp1 = Sk.builtin.bool.false$;
            } else {
                // try to call the conjugate function / each numeric type can call this
                tmp0 = Sk.misceval.callsim(ip1[ip1_i]['conjugate'], ip1[ip1_i]);

                if (tmp0 == null) {
                    return;
                }

                tmp1 = Sk.abstr.numberBinOp(tmp0, ip2[ip2_i], 'Mult');
                if (tmp1 == null) {
                    return;
                }
            }

            if (i === 0) {
                tmp = tmp1;
            } else {
                tmp2 = Sk.abstr.numberBinOp(tmp, tmp1, 'Add');
                //tmp2 = tmp + tmp1; // PyNumber_Add

                if (tmp2 == null) {
                    return;
                }
                tmp = tmp2;
            }
        }

        tmp3 = op;
        tmp2 = tmp3;
        op[0] = tmp;
    }
*/
    /**
     *  Basic dummy impl. The real numpy implementation is about 600 LoC and relies
     *  on the complete data type impl.
     *  We just do a basic checking
     *  obj: any object or nested sequence
     *  maxdims: maximum number of dimensions to check for dtype (recursive call)
     */
    function PyArray_DTypeFromObject(obj, maxdims) {
        // gets first element or null from a nested sequence
        function seqUnpacker(obj, mDims) {
            if (Sk.builtin.checkSequence(obj)) {
                var length = Sk.builtin.len(obj);
                if (Sk.builtin.asnum$(length) > 0) {
                    // ToDo check if element is also of type sequence
                    var element = obj.mp$subscript(0);

                    // if we have a nested sequence, we decrement the maxdims and call recursive
                    if (mDims > 0 && Sk.builtin.checkSequence(element)) {
                        return seqUnpacker(element, mDims -1);
                    } else {
                        return element;
                    }
                }
            } else {
                return obj;
            }
        }

        var dtype = null;
        if (obj === null) {
            throw new Error('Internal API-Call Error occured in PyArray_ObjectType');
        }

        if (maxdims == null) {
            maxdims = NPY_MAXDIMS;
        }

        var element;
        // simple type
        if (Sk.builtin.checkNumber(obj)) {
            element = obj;
        } else if (Sk.builtin.checkSequence(obj)) {
            // sequence
            element = seqUnpacker(obj, maxdims);
            if (PyArray_Check(element)) {
                return PyArray_DESCR(obj);
            }
        } else if (PyArray_Check(obj)) {
            // array
            var descr = PyArray_DESCR(obj);
            if (descr != null) {
                return descr;
            }
            var length = Sk.builtin.len(obj);
            if (Sk.builtin.asnum$(length) > 0) {
                element = PyArray_DATA(obj)[0];
            }
        }

        // ToDo: investigate if this throw may happen
        try {
            dtype = Sk.builtin.type(element);
        } catch (e) {
            // pass
        }

        return dtype;
    }

    var NPY_NOTYPE = null;
    var NPY_DEFAULT_TYPE = 2;

    // our basic internal hierarchy for types
    // we can only promote from lower to higher numbers
    // ToDo: use numpy enum for types
    var Internal_TypeTable = {
        'complex': 3,
        'complex_': 3,
        'complex64': 3,
        'float': 2,
        'float_': 2,
        'float64': 2,
        'int': 1,
        'int_': 1,
        'int64': 1,
        'bool': 0,
        'bool_': 0,
    };

    function Internal_DType_To_Num(dtype) {
        var name = Sk.abstr.typeName(dtype);
        var num = Internal_TypeTable[name];

        if (num == null) {
            return -1;
        }

        return num;
    }

    // ToDo: check if we can change this to match the real impl.
    function PyArray_TYPE(arr) {
        // return ((PyArrayObject_fields *)arr)->descr->type_num;
        var descr = PyArray_DESCR(arr);
        var typenum = Internal_DType_To_Num(descr);
        return typenum;
    }

    /**
     * Not the real impl. as we do not really implement numpys data types and
     * the 1000s LoC for that. We just use the basic python types.
     *
     * This function returns the 'constructor' for the given type number
     */
    function PyArray_DescrFromType(typenum) {
        switch(typenum) {
        case 3:
            return Sk.builtin.complex;
        case 2:
            return Sk.builtin.float_;
        case 1:
            return Sk.builtin.int_;
        case 0:
            return Sk.builtin.bool;
        default:
            return NPY_NOTYPE;
        }
    }

    /*
     *  This function is useful for determining a common type that two or more arrays can be converted to.
     *  It only works for non-flexible array types as no itemsize information is passed. The mintype argument
     *  represents the minimum type acceptable, and op represents the object that will be converted to an array.
     *  The return value is the enumerated typenumber that represents the data-type that op should have.
     */
/*
    function PyArray_ObjectType(op, minimum_type) {
        // http://docs.scipy.org/doc/numpy/reference/c-api.array.html#c.PyArray_ResultType
        // this is only and approximate implementation and is not even close to
        // the real numpy internals, however totally sufficient for our needs

        var dtype;

        dtype = PyArray_DTypeFromObject(op, NPY_MAXDIMS);

        // maybe empty ndarray object?
        if (dtype != null) {
            var num = Internal_DType_To_Num(dtype);
            if (num >= minimum_type) {
                return num;
            } else if(num < minimum_type) {
                // can we convert one type into the other?
                if (num >= 0 && minimum_type <= 3) {
                    return minimum_type;
                } else {
                    return NPY_NOTYPE; // NPY_NOTYPE
                }
            }
        } else {
            return NPY_DEFAULT_TYPE;
        }
    }
*/
function PyArray_ObjectType(op, minimum_type) {
    let typecode = minimum_type;

    function update_typecode(val) {        
        if (val instanceof Sk.builtin.complex) {
            typecode = Math.max(typecode, 3); // complex
        } else if (val instanceof Sk.builtin.float_) {
            typecode = Math.max(typecode, 2); // float64
        } else if (val instanceof Sk.builtin.int_) {
            typecode = Math.max(typecode, 1); // int32
        } else if (val instanceof Sk.builtin.bool) {
            typecode = Math.max(typecode, 0); // bool
        } else if (typeof val === "number") {
            // JavaScript number — double by default
            typecode = Math.max(typecode, 2);
        } else if (typeof val === "boolean") {
            typecode = Math.max(typecode, 0);
        } else {
            // unknown or object
            typecode = Math.max(typecode, 4);
        }

    }
    var control_value = null;
    if (Array.isArray(op)) {
        for (let i = 0; i < op.length; ++i) {            
            update_typecode(op[i]);
        }
    } else {       
            if (op.v.buffer) {
                control_value = op.v.buffer[0];                          
            } else  { 
                control_value = op.v[0];              
            }
            update_typecode(Sk.ffi.remapToJs(control_value));           
        
    }

    return typecode;
}

    /*
     *  A synonym for PyArray_DIMS, named to be consistent with the ‘shape’ usage within Python.
     */
    function PyArrray_Shape(arr) {
        return PyArray_DIMS(arr);
    }

    /*
     *  Cast/Promote object to given dtype with some intelligent type handling
     */
    function PyArray_Cast_Obj(obj, dtype) {
        if (dtype instanceof Sk.builtin.none && Sk.builtin.checkNone(obj)) {
            return obj;
        } else {
            return Sk.misceval.callsim(dtype, obj);
        }
    }

    // ToDo: how can we make a exact check?
    // or do we need to refactor PyArray_Check for subclasses?
    function PyArray_CheckExact(obj) {
        return PyArray_Check(obj);
    }

    function PyArray_CheckAnyScalarExact(obj) {

    }

    function PyArray_GetPriority(obj, default_) {
        var ret;
        var priority = NPY_PRIORITY;

        if (PyArray_CheckExact(obj)) {
            return priority;
        } else if (PyArray_CheckAnyScalarExact(obj)) {
            return NPY_SCALAR_PRIORITY;
        }

        ret = Sk.builtin.getattr(obj, new Sk.builtin.str('__array_priority__'), Sk.builtin.none.none$);
        if (Sk.builtin.checkNone(ret)) {
            return default_;
        }

        ret = Sk.builtin.float(ret);
        priority = Sk.ffi.remapToJs(ret);

        return priority;
    }

    // https://github.com/numpy/numpy/blob/5d6a9f0030e8d1a63e43783c2b5b54cde93bc5d0/numpy/core/src/multiarray/ctors.c#L903
    function PyArray_NewFromDescr_int(subtype, descr, nd, dims, strides, data, flags, obj, zeroed) {
        var fa;
        var i;
        var sd;
        var size;

        if (descr.subarray) {
            throw new Error('subarrays not supported');
        }

        if (nd > NPY_MAXDIMS) {
            throw new Sk.builtin.ValueError('number of dimensions must be within [0, ' + NPY_MAXDIMS + ']');
        }

        /* check dimensions */
        size = 1;
        sd = 1; // we do not have any element sizes: sd = (size_t) descr->elsize;
        if (sd == 0) {
            // ToDo: https://github.com/numpy/numpy/blob/5d6a9f0030e8d1a63e43783c2b5b54cde93bc5d0/numpy/core/src/multiarray/ctors.c#L940
            throw new Sk.builtin.TypeError('Empty data-type');
        }

        for (i = 0; i < nd; i++) {
            var dim = dims[i];

            if (dim == null) {
                continue;
            }

            if (dim < 0) {
                throw new Sk.builtin.ValueError('negative dimensions are not allowed');
            }

            // calculate size of array
            // https://github.com/numpy/numpy/blob/5d6a9f0030e8d1a63e43783c2b5b54cde93bc5d0/numpy/core/src/multiarray/ctors.c#L982
            size = dim * size;
            if (size == Number.MAX_VALUE) {
                throw new Sk.builtin.ValueError('array is too big.');
            }
        }

        fa = {}; //  fa = (PyArrayObject_fields *) subtype->tp_alloc(subtype, 0);

        fa.nd = nd;
        fa.dimensions = null;
        fa.data = null;

        if (data == null) {
            fa.flags = NPY_ARRAY_DEFAULT;
            if (flags) {
                if (flags) {
                    fa.flags |= NPY_ARRAY_F_CONTIGUOUS;
                    if (nd > 1) {
                        fa.flags &= ~NPY_ARRAY_C_CONTIGUOUS;
                    }
                    flags = NPY_ARRAY_F_CONTIGUOUS;
                }
            }
        } else {
            fa.flags = (flags & ~NPY_ARRAY_UPDATEIFCOPY);
        }

        fa.descr = descr;
        fa.base = null;
        fa.weakreflist = null;

        if (nd > 0) {
            fa.dimensions = [];
            fa.strides = [];
            // fill dimensions
            dims.map(function(d) {
                fa.dimensions.push(d);
            });

            if (strides == null) {
                // fill them in
                sd = _array_fill_strides(fa.strides, dims, nd, sd, flags, fa.flags);
            } else {
                strides.map(function(s) {
                    fa.strides.push(s);
                });
                sd *= size;
            }
        } else {
            fa.dimensions = null;
            fa.strides = null;
            fa.flags |= NPY_ARRAY_F_CONTIGUOUS;
        }

        if (data == null) {
            // Allocate something even for zero-space arrays, e.g. shape=(0,)
            if (sd == 0) {
                sd = 1;
            }

            if (zeroed) {
                // ToDo: check if we need todo something here!
                data = [];
            } else {
                data = [];
            }

            fa.flags |= NPY_ARRAY_OWNDATA;
        } else {
            fa.flags &= ~NPY_ARRAY_OWNDATA;
        }

        // map data?
        fa.data = data;

        // ToDo: https://github.com/numpy/numpy/blob/5d6a9f0030e8d1a63e43783c2b5b54cde93bc5d0/numpy/core/src/multiarray/ctors.c#L1090
        // we do not support finalize methods (skulpt does do it either!)
        
        // fa is now just plain JS for representing an ndarray
        // we now use skulpt code to make a real python/skulpt ndarray version out of it
        var pyShape = new Sk.builtin.tuple((fa.dimensions || []).map(function(d) {
            return new Sk.builtin.int_(d);
        }));

        // we need to make a deep copy of each item
        var pyBuffer = new Sk.builtin.list(fa.data);

        var dtype = fa.descr;

        return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype, pyBuffer);
    }

    function _array_fill_strides(strides, dims, nd, itemsize, infalg, objflags) {
        var i;
        var not_cf_contig = 0;
        var nod = 0; // A dim 1= 1 was found

        // Check if new array is both F- and C-contigous
        for (i = 0; i < nd; i++) {
            if (dims[i] != 1) {
                if (nod) {
                    not_cf_contig = 1;
                    break;
                }
                nod = 1;
            }
        }

        // Only make fortran strides if not contigous as well
        // actually we do not really care, do we?
        // ToDo: maybe add this later (see ctors.c)
        for (i = nd - 1; i >= 0; i--) {
            strides[i] = itemsize;
            if (dims[i]) {
                itemsize *= dims[i];
            }
            else {
                not_cf_contig = 0;
            }
            if (dims[i] == 1) {
                /* For testing purpose only */
                strides[i] = NPY_MAX_INTP;
            }
        }

        /*
        if (not_cf_contig) {
            *objflags = ((*objflags)|NPY_ARRAY_C_CONTIGUOUS) &
                                            ~NPY_ARRAY_F_CONTIGUOUS;
        }
        else {
            *objflags |= (NPY_ARRAY_C_CONTIGUOUS|NPY_ARRAY_F_CONTIGUOUS);
        }
        */

        return itemsize;
    }

    function PyArray_NewFromDescr(subtype, descr, nd, dims, strides, data, flags, obj) {
        return PyArray_NewFromDescr_int(subtype, descr, nd, dims, strides, data, flags, obj, 0);
    }

    /*NUMPY_API
     * Generic new array creation routine.
     */
    function PyArray_New(subtype, nd, dims, type_num, strides, data, itemsize, flags, obj) {
        var descr;
        var _new;

        descr = PyArray_DescrFromType(type_num);
        if (descr == null) {
            return null;
        }

        // we do not do any itemsize check as we do not need to allocate memory like in C
        _new = PyArray_NewFromDescr(subtype, descr, nd, dims, strides, data, flags, obj);

        return _new;
    }

    function new_array_for_sum(ap1, ap2, out, nd, dimensions, typenum) {
        var ret;
        var subtype;
        var prior1;
        var prior2;

        // Sk.builtin.type == Py_TYPE macro
        if (Sk.builtin.type(ap2) != Sk.builtin.type(ap1)) {
            prior = PyArray_GetPriority(ap2, 0.0);
            prior = PyArray_GetPriority(ap1, 0.0);
            subtype = (prior2 > prior1 ? Sk.builtin.type(ap2) : Sk.builtin.type(ap1));
        } else {
            prior1 = prior2 = 0.0;
            subtype = Sk.builtin.type(ap1);
        }

        if (out != null) {
            throw new Error('new_array_for_sum does not support "out" parameter');
        }

        ret = PyArray_New(subtype, nd, dimensions, typenum, null, null, 0, 0, (prior2 > prior1 ? ap2 : ap1));

        return ret;
    }

    // PyObject* PyArray_FromAny(PyObject* op, PyArray_Descr* dtype, int min_depth, int max_depth, int requirements, PyObject* context)
    /*
     *  - op: is any value or sequence that will be converted to an array (Python Object)
     *  - dtype: is callable constructor for the type (ie Sk.builtin.int_) (Python Object)
     *  - min_depth: we may enfore a minimum of dimensions (Python Int)
     *  - max_depth: maximum of dimensions (Python Int)
     *  - requirements: same flags to set, we do not support those (int)
     *  - context: ???
     */
    function PyArray_FromAny(op, dtype, min_depth, max_depth, requirements, context) {
        if (op == null) {
            throw new Error('Internal PyArray_FromAny API-Call error. "op" must not be null.');
        }

        if (dtype == null || Sk.builtin.checkNone(dtype)) {
            dtype = PyArray_DTypeFromObject(op, NPY_MAXDIMS);
            if (dtype == null) {
                dtype = PyArray_DescrFromType(NPY_DEFAULT_TYPE);
            }
        }

        var elements = [];
        var state = {};
        state.level = 0;
        state.shape = [];

        if (PyArray_Check(op)) {
            elements = PyArray_DATA(op);
            state = {};
            state.level = 0;
            state.shape = PyArray_DIMS(op);;
        } else {
            // now get items from op and create a new buffer object.
            unpack(op, elements, state);
        }

        // apply dtype castings
        for (i = 0; i < elements.length; i++) {
            elements[i] = PyArray_Cast_Obj(elements[i], dtype);
        }

        // check for min_depth
        var ndmin = Sk.builtin.asnum$(min_depth);
        if (ndmin >= 0 && ndmin > state.shape.length) {
          var _ndmin_array = [];
          for (i = 0; i < ndmin - state.shape.length; i++) {
            _ndmin_array.push(1);
          }
          state.shape = _ndmin_array.concat(state.shape);
        }

        // call array method or create internal ndarray constructor
        var _shape = new Sk.builtin.tuple(state.shape.map(function (x) {
            return new Sk.builtin.int_(x);
        }));
        
        var _buffer = new Sk.builtin.list(elements);
        // create new ndarray instance
        return Sk.misceval.callsim(mod[CLASS_NDARRAY], _shape, dtype,
          _buffer);
    }


    function convert_shape_to_string(n, vals, ending) {
        var i;
        var ret;
        var tmp;

        for (i = 0; i < n && vals[i] < 0; i++);

        if (i === n) {
            return Sk.abstr.numberBinOp(new Sk.builtin.str('()%s'), new Sk.builtin.str(ending), 'Mod');
        } else {
            ret = Sk.abstr.numberBinOp(new Sk.builtin.str('(%i'), vals[i++], 'Mod');
        }

        for (; i < n; ++i) {
            if (vals[i] < 0) {
                tmp = new Sk.builtin.str(",newaxis");
            } else {
                tmp = Sk.abstr.numberBinOp(new Sk.builtin.str(',%i'), vals[i], 'Mod');
            }

            ret = Sk.abstr.numberBinOp(ret, tmp, 'Add');
        }

        if (i == 1) {
            tmp = Sk.abstr.numberBinOp(new Sk.builtin.str(',)%s'), new Sk.builtin.str(ending), 'Mod');
        } else {
            tmp = Sk.abstr.numberBinOp(new Sk.builtin.str(')%s'), new Sk.builtin.str(ending), 'Mod');
        }
        ret = Sk.abstr.numberBinOp(ret, tmp, 'Add');
        return ret;

    }

    function dot_alignment_error(a, i, b, j) {
        var errmsg = null;
        var format = null;
        var fmt_args = null;
        var i_obj = null;
        var j_obj = null;
        var shape1 = null;
        var shape2 = null;
        var shape1_i = null;
        var shape2_j = null;

        format = new Sk.builtin.str("shapes %s and %s not aligned: %d (dim %d) != %d (dim %d)");
        shape1 = convert_shape_to_string(PyArray_NDIM(a), PyArray_DIMS(a), "");
        shape2 = convert_shape_to_string(PyArray_NDIM(b), PyArray_DIMS(b), "");

        i_obj = new Sk.builtin.int_(i);
        j_obj = new Sk.builtin.int_(j);

        shape1_i = new Sk.builtin.int_(PyArray_DIM(a, i));
        shape2_j = new Sk.builtin.int_(PyArray_DIM(b, j));

        if (!format || !shape1 || !shape2 || !i_obj || !j_obj ||
                !shape1_i || !shape2_j) {
            return;
        }

        fmt_args = new Sk.builtin.tuple([shape1, shape2, shape1_i, i_obj, shape2_j, j_obj]);

        errmsg = Sk.abstr.numberBinOp(format, fmt_args, 'Mod');
        if (errmsg != null) {
            throw new Sk.builtin.ValueError(errmsg);
        } else {
            throw new Sk.builtin.ValueError('shapes are not aligned');
        }
    }

    // utility functions to create a real copy of the underlying data
    function PyArray_CopyBuffer(arr) {
        var res = [];
        var buffer = PyArray_DATA(arr);
        var it = PyArray_IterNew(arr);

        while (it.index < it.size) {
            res.push(Sk.misceval.callsim(PyArray_DESCR(arr), buffer[it.dataptr]));
            PyArray_ITER_NEXT(it);
        }

        return res;
    }

    /*NUMPY_API
     * Numeric.matrixproduct(a,v)
     * just like inner product but does the swapaxes stuff on the fly
     */
    // from multiarraymodule.c Line: 940
    function MatrixProdcut(op1, op2) {
        return this.MatrixProduct2(op1, op2, null);
    }

    /*NUMPY_API
     * Numeric.matrixproduct2(a,v,out)
     * just like inner product but does the swapaxes stuff on the fly
     * array_dot: https://github.com/numpy/numpy/blob/d033b6e19fc95a1f1fd6592de8318178368011b1/numpy/core/src/multiarray/methods.c#L2037
     *
     * MatrixProduct2: https://github.com/numpy/numpy/blob/f43d691fd0b9b4f416b50fba34876691af2d0bd4/numpy/core/src/multiarray/multiarraymodule.c#L950
     */
    function MatrixProdcut2(op1, op2, out) {
        var ap1; // PyArrayObject
        var ap2; // PyArrayObject
        var ret = null; // PyArrayObject
        var i; // npy_intp (int pointer)
        var j; // npy_intp (int pointer)
        var l; // npy_intp (int pointer)
        var typenum; // int
        var nd; // int
        var axis; // int
        var matchDim; // int
        var is1; // npy_intp
        var is2; // npy_intp
        var os; // npy_intp
        var op; // char *op
        var dimensions = new Array(); // npy_intp dimensions[NPY_MAXDIMS];
        var dot; // PyArrray_DotFunc *dot
        var typec = null; // PyArray_Descr *typec = NULL;

        // make new pyarray object types from ops
        typenum = PyArray_ObjectType(op1, 0);
        typenum = PyArray_ObjectType(op2, typenum);

        // get type descriptor for the type, for us it is the javascript constructor
        // of the type, that we store as a dtype
        typec = PyArray_DescrFromType(typenum);

        // we currently do not support this specific check for common data type
        if (typec === null) {
            throw new Sk.builtin.ValueError('Cannot find a common data type.');
        }

        ap1 = PyArray_FromAny(op1, typec, 0, 0, 'NPY_ARRAY_ALINGED', null);
        ap2 = PyArray_FromAny(op2, typec, 0, 0, 'NPY_ARRAY_ALINGED', null);

        // check dimensions

        // handle 0 dim cases
        if (PyArray_NDIM(ap1) == 0 || PyArray_NDIM(ap2) == 0) {
            ret = PyArray_NDIM(ap1) == 0 ? ap1 : ap2;
            ret = ret.nb$multiply.call(ap1, ap2);

            return ret;
        }

        l = PyArray_DIMS(ap1)[PyArray_NDIM(ap1) - 1];
        if (PyArray_NDIM(ap2) > 1) {
            matchDim = PyArray_NDIM(ap2) - 2;
        } else {
            matchDim = 0;
        }

        if (PyArray_DIMS(ap2)[matchDim] != l) {
            dot_alignment_error(ap1, PyArray_NDIM(ap1) - 1, ap2, matchDim);
        }

        nd = PyArray_NDIM(ap1) + PyArray_NDIM(ap2) - 2;
        if (nd > NPY_MAXDIMS) {
            throw new Sk.builtin.ValueError('dot: too many dimensions in result');
        }

        j = 0;
        for (i = 0; i < PyArray_NDIM(ap1) - 1; i++) {
            dimensions[j++] = PyArray_DIMS(ap1)[i];
        }
        for (i = 0; i < PyArray_NDIM(ap2) - 2; i++) {
            dimensions[j++] = PyArray_DIMS(ap2)[i];
        }
        if(PyArray_NDIM(ap2) > 1) {
            dimensions[j++] = PyArray_DIMS(ap2)[PyArray_NDIM(ap2)-1];
        }

        is1 = PyArray_STRIDES(ap1)[PyArray_NDIM(ap1)-1];
        is2 = PyArray_STRIDES(ap2)[matchDim];
        /* Choose which subtype to return */
        ret = new_array_for_sum(ap1, ap2, out, nd, dimensions, typenum);

        // Hint: the switch case function replaces the following lines
        //dot = PyArray_DESCR(ret)->f->dotfunc;
        //if (dot == NULL) {
        //    PyErr_SetString(PyExc_ValueError,
        //                    "dot not available for this type");
        //    goto fail;
        //}
        switch (typenum) {
        case 0:
        case 1:
        case 2:
        case 3:
            dot = OBJECT_dot;
            break;
        default:
            throw new Sk.builtin.ValueError('dot not available for this type');
        }

        op = PyArray_DATA(ret);
        // os = PyArray_DESCR(ret).elsize; // we do not have element sizes in JavaScript
        os = 1; // we just deal with normal indicis

        axis = PyArray_NDIM(ap1) - 1;
        it1 = PyArray_IterAllButAxis(ap1, axis);

        if (it1 == null) {
            return null;
        }

        it2 = PyArray_IterAllButAxis(ap2, matchDim);

        if (it2 == null) {
            return null;
        }

        // it.dataptr is just the index to the current element (as we do not have C pointers in Javascript)
        var op_i = 0; // own helper for assinging the result with out passing a pointer to dot method
        var it1DeRefDataPtr; // reference to an array or subarray
        var it2DeRefDataPtr;  // reference to an array or subarray based on it.dataptr derefenced
        while (it1.index < it1.size) {
            it1DeRefDataPtr = PyArray_DATA(it1.ao).slice(it1.dataptr);
            while (it2.index < it2.size) {
                it2DeRefDataPtr = PyArray_DATA(it2.ao).slice(it2.dataptr);
                op[op_i] = dot(it1DeRefDataPtr, is1, it2DeRefDataPtr, is2, null, l, ret);
                op_i += os;
                PyArray_ITER_NEXT(it2);
            }
            PyArray_ITER_NEXT(it1);
            PyArray_ITER_RESET(it2);
        }

        return ret;
    }


    function PyTypeNum_ISFLEXIBLE(type) {
        // ToDo: uncomment this, when we've added all types from ndarraytypes.h
        return false; //(((type) >= NPY_STRING) && ((type) <= NPY_VOID));
    }

    function PyTypeNum_ISEXTENDED(type) {
        return PyTypeNum_ISFLEXIBLE; /* || PyTypeNum_ISUSERDEF(type) */
    } 

    function replaceAt(str, index, character) {
        return str.substr(0, index) + character + str.substr(index+character.length);
    }

    function dump_data(strPtr, nPtr, max_n, data, nd, dimensions, strides, self) {
        var descr = PyArray_DESCR(self);
        var op = null;
        var sp = null;
        var ostring;
        var i;
        var N;
        var ret = 0;
        
        if (nd === 0) {
            op = data[0];
            sp = Sk.builtin.repr(op);
            N = sp.v.length;
            nPtr.n += N;
            strPtr.str += sp.v;
        } else {
            strPtr.str += "[";
            nPtr.n += 1;
            for (i = 0; i < dimensions[0]; i++) {
                var newData = data.slice(strides[0] * i);
                var newDimensions = dimensions.slice(1);
                var newStrides = strides.slice(1);
                dump_data(strPtr, nPtr, max_n, newData, nd - 1, newDimensions, newStrides, self);

                if (i < dimensions[0] - 1) {
                    strPtr.str += ',';
                    strPtr.str += ' '; // replaceAt(str, nPtr.n + 1, ' ');
                    nPtr.n += 2;
                }
            }

            strPtr.str +=  ']'; //replaceAt(str, nPtr.n, ']');
            nPtr.n += 1;
        }

        return ret;
    }

    function array_repr_builtin(self, repr) {
        // self is ndarrray
        // repr is int
        var ret;
        var string;
        var n = 0;
        var max_n = 0; // stupid mem alloc stuff -.-
        var format;
        var fmt_args;
        var nPtr = {n: n};
        var strPtr = {str: ""};
        dump_data(strPtr, nPtr, max_n, PyArray_DATA(self), PyArray_NDIM(self), PyArray_DIMS(self), PyArray_STRIDES(self), self);
        string = new Sk.builtin.str(strPtr.str);
        if (repr) {
            if (PyTypeNum_ISEXTENDED(self)) {
                format = new Sk.builtin.str("array(%s, '%s')"); // required some changes "array(%s, '%c%d')" (we do not have access to elsize)
                fmt_args = new Sk.builtin.tuple([string, PyArray_DESCR(self)]);
                ret = Sk.abstr.numberBinOp(format, fmt_args, 'Mod');
            } else {
                format = new Sk.builtin.str("array(%s, '%s')"); // required some changes "array(%s, '%c%d')" (we do not have access to elsize)
                fmt_args = new Sk.builtin.tuple([string, PyArray_DESCR(self)]);
                ret = Sk.abstr.numberBinOp(format, fmt_args, 'Mod');
            }
        } else {
            return string;
        }

        return ret;
    }

    // --- proper numpy-style str() formatting (aligned columns, no commas, no dtype) ---

    function str_get_max_width(data, nd, dimensions, strides) {
        var max = 0;
        var i, w;
        if (nd === 0) {
            return Sk.builtin.repr(data[0]).v.length;
        }
        for (i = 0; i < dimensions[0]; i++) {
            var newData = data.slice(strides[0] * i);
            w = str_get_max_width(newData, nd - 1, dimensions.slice(1), strides.slice(1));
            if (w > max) {
                max = w;
            }
        }
        return max;
    }

    function str_build_data(data, nd, dimensions, strides, width, total_nd) {
        var i;
        if (nd === 0) {
            var s = Sk.builtin.repr(data[0]).v;
            while (s.length < width) {
                s = " " + s;
            }
            return s;
        }

        var parts = [];
        for (i = 0; i < dimensions[0]; i++) {
            var newData = data.slice(strides[0] * i);
            parts.push(str_build_data(newData, nd - 1, dimensions.slice(1), strides.slice(1), width, total_nd));
        }

        if (nd === 1) {
            return "[" + parts.join(" ") + "]";
        }

        // number of open brackets already consumed at this nesting level
        var indent = total_nd - nd + 1;
        // numpy adds one extra blank line per axis beyond the innermost row
        var sep = "\n".repeat(nd - 1) + " ".repeat(indent);
        return "[" + parts.join(sep) + "]";
    }

    function array_str_builtin(self) {
        var nd = PyArray_NDIM(self);
        var dims = PyArray_DIMS(self);
        var strides = PyArray_STRIDES(self);
        var data = PyArray_DATA(self);

        if (nd === 0) {
            return new Sk.builtin.str(Sk.builtin.repr(data[0]).v);
        }

        var width = str_get_max_width(data, nd, dims, strides);
        var s = str_build_data(data, nd, dims, strides, width, nd);
        return new Sk.builtin.str(s);
    }

    var PyArray_StrFunction = null; // default there is no string function, if not set
    var np = new numpy();

    var mod = {};

    // doc string for numpy module
    mod.__doc__ = new Sk.builtin.str('\nNumPy\n=====\n\nProvides\n  1. An array object of arbitrary homogeneous items\n  2. Fast mathematical operations over arrays\n  3. Linear Algebra, Fourier Transforms, Random Number Generation\n\nHow to use the documentation\n----------------------------\nDocumentation is available in two forms: docstrings provided\nwith the code, and a loose standing reference guide, available from\n`the NumPy homepage <http://www.scipy.org>`_.\n\nWe recommend exploring the docstrings using\n`IPython <http://ipython.scipy.org>`_, an advanced Python shell with\nTAB-completion and introspection capabilities.  See below for further\ninstructions.\n\nThe docstring examples assume that `numpy` has been imported as `np`::\n\n  >>> import numpy as np\n\nCode snippets are indicated by three greater-than signs::\n\n  >>> x = 42\n  >>> x = x + 1\n\nUse the built-in ``help`` function to view a function\'s docstring::\n\n  >>> help(np.sort)\n  ... # doctest: +SKIP\n\nFor some objects, ``np.info(obj)`` may provide additional help.  This is\nparticularly true if you see the line "Help on ufunc object:" at the top\nof the help() page.  Ufuncs are implemented in C, not Python, for speed.\nThe native Python help() does not know how to view their help, but our\nnp.info() function does.\n\nTo search for documents containing a keyword, do::\n\n  >>> np.lookfor(\'keyword\')\n  ... # doctest: +SKIP\n\nGeneral-purpose documents like a glossary and help on the basic concepts\nof numpy are available under the ``doc`` sub-module::\n\n  >>> from numpy import doc\n  >>> help(doc)\n  ... # doctest: +SKIP\n\nAvailable subpackages\n---------------------\ndoc\n    Topical documentation on broadcasting, indexing, etc.\nlib\n    Basic functions used by several sub-packages.\nrandom\n    Core Random Tools\nlinalg\n    Core Linear Algebra Tools\nfft\n    Core FFT routines\npolynomial\n    Polynomial tools\ntesting\n    Numpy testing tools\nf2py\n    Fortran to Python Interface Generator.\ndistutils\n    Enhancements to distutils with support for\n    Fortran compilers support and more.\n\nUtilities\n---------\ntest\n    Run numpy unittests\nshow_config\n    Show numpy build configuration\ndual\n    Overwrite certain functions with high-performance Scipy tools\nmatlib\n    Make everything matrices.\n__version__\n    Numpy version string\n\nViewing documentation using IPython\n-----------------------------------\nStart IPython with the NumPy profile (``ipython -p numpy``), which will\nimport `numpy` under the alias `np`.  Then, use the ``cpaste`` command to\npaste examples into the shell.  To see which functions are available in\n`numpy`, type ``np.<TAB>`` (where ``<TAB>`` refers to the TAB key), or use\n``np.*cos*?<ENTER>`` (where ``<ENTER>`` refers to the ENTER key) to narrow\ndown the list.  To view the docstring for a function, use\n``np.cos?<ENTER>`` (to view the docstring) and ``np.cos??<ENTER>`` (to view\nthe source code).\n\nCopies vs. in-place operation\n-----------------------------\nMost of the functions in `numpy` return a copy of the array argument\n(e.g., `np.sort`).  In-place versions of these functions are often\navailable as array methods, i.e. ``x = np.array([1,2,3]); x.sort()``.\nExceptions to this rule are documented.\n\n');

  /**
        Class for numpy.ndarray
    **/

  function remapToJs_shallow(obj, shallow) {
    var _shallow = shallow || true;
    if (obj instanceof Sk.builtin.list) {
      if (!_shallow) {
        var ret = [];
        for (var i = 0; i < obj.v.length; ++i) {
          ret.push(Sk.ffi.remapToJs(obj.v[i]));
        }
        return ret;
      } else {
        return obj.v;
      }
    } else if (obj instanceof Sk.builtin.float_) {
      return Sk.builtin.asnum$nofloat(obj);
    } else {
      return Sk.ffi.remapToJs(obj);
    }
  }

  /**
        Unpacks in any form fo nested Lists,
        We need to support sequences and ndarrays here!
   **/
 
  function unpack(py_obj, buffer, state) {
    if (PyArray_Check(py_obj)) {
        // unpack array, easiest but slow version is to convert the array to a list
        py_obj = Sk.misceval.callsim(py_obj.tolist, py_obj);
    }

    if (py_obj instanceof Sk.builtin.list || py_obj instanceof Sk.builtin.tuple) {
      var py_items = remapToJs_shallow(py_obj);
      state.level += 1;

      if (state.level > state.shape.length) {
        state.shape.push(py_items.length);
      }
      var i;
      var len = py_items.length;
      for (i = 0; i < len; i++) {
        unpack(py_items[i], buffer, state);
      }
      state.level -= 1;
    } else {
      buffer.push(py_obj);
    }
  }

//
  /**
   Computes the strides for columns and rows
  **/
  function computeStrides(shape) {
    var strides = shape.slice(0);
    strides.reverse();
    var prod = 1;
    var temp;
    for (var i = 0, len = strides.length; i < len; i++) {
      temp = strides[i];
      strides[i] = prod;
      prod *= temp;
    }

    return strides.reverse();
  }

  /**
    Computes the offset for the ndarray for given index and strides
    [1, ..., n]
  **/
  function computeOffset(strides, index) {
    var offset = 0;
    for (var k = 0, len = strides.length; k < len; k++) {
      offset += strides[k] * index[k];
    }
    return offset;
  }

  /**
    Calculates the size of the ndarray, dummy
    **/
  function prod(numbers) {
    var size = 1;
    var i;
    for (i = 0; i < numbers.length; i++) {
      size *= numbers[i];
    }
    return size;
  }

  function tobufferrecursive(buffer, shape, strides, startdim, dtype) {
    var i, n, stride;
    var arr, item;

    /* Base case */
    if (startdim >= shape.length) {
        return buffer[0];
    }

    n = shape[startdim];
    stride = strides[startdim];

    arr = [];

    for (i = 0; i < n; i++) {
      item = tobufferrecursive(buffer, shape, strides, startdim + 1, dtype);
      arr = arr.concat(item);

      buffer = buffer.slice(stride);
    }

    return arr
  }

  /*
    http://docs.scipy.org/doc/numpy/reference/generated/numpy.ndarray.tolist.html?highlight=tolist#numpy.ndarray.tolist
  */
  function tolistrecursive(buffer, shape, strides, startdim, dtype) {
    var i, n, stride;
    var arr, item;

    /* Base case */
    if (startdim >= shape.length) {
        return buffer[0];
    }

    n = shape[startdim];
    stride = strides[startdim];

    arr = [];

    for (i = 0; i < n; i++) {
      item = tolistrecursive(buffer, shape, strides, startdim + 1, dtype);
      arr.push(item);

      buffer = buffer.slice(stride);
    }

    return new Sk.builtin.list(arr);
  }

  /**
     internal tolist interface
    **/
  function tolist(buffer, shape, strides, dtype) {
    var buffer_copy = buffer.slice(0);
    return tolistrecursive(buffer_copy, shape, strides, 0, dtype);
  }

  /**
    An array object represents a multidimensional, homogeneous array of fixed-size items.
    An associated data-type object describes the format of each element in the array
    (its byte-order, how many bytes it occupies in memory, whether it is an integer, a
    floating point number, or something else, etc.)

    Arrays should be constructed using array, zeros or empty (refer to the See Also
    section below). The parameters given here refer to a low-level method (ndarray(...)) for
    instantiating an array.

    For more information, refer to the numpy module and examine the the methods and
    attributes of an array.
  **/
  var ndarray_f = function ($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(function (self, shape, dtype, buffer,
      offset, strides, order) {
      var ndarrayJs = {}; // js object holding the actual array
      if (Sk.builtin.checkInt(shape)) {
        ndarrayJs.shape = [Sk.ffi.remapToJs(shape)];
      } else if (Sk.builtin.checkSequence(shape)) {
        var _len = Sk.ffi.remapToJs(Sk.builtin.len(shape));
        ndarrayJs.shape = [];
        for (var _si = 0; _si < _len; _si++) {
          ndarrayJs.shape.push(Sk.ffi.remapToJs(shape.mp$subscript(new Sk.builtin.int_(_si))));
        }
      } else {
        ndarrayJs.shape = Sk.ffi.remapToJs(shape);
      }

      ndarrayJs.strides = computeStrides(ndarrayJs.shape);
      ndarrayJs.dtype = dtype || Sk.builtin.none.none$;
      ndarrayJs.flags = 0x0; // set flags to zero

      // allow any nested data structure
      if (buffer && buffer instanceof Sk.builtin.list) {
        ndarrayJs.buffer = buffer.v; // ToDo: change this to any sequence and iterate over objects?
      }

      self.v = ndarrayJs; // value holding the actual js object and array
      self.tp$name = CLASS_NDARRAY; // set class name
    });

    $loc._internalGenericGetAttr = Sk.builtin.object.prototype.GenericSetAttr;

    $loc.__getattr__ = new Sk.builtin.func(function (self, name) {
        if (name != null && (Sk.builtin.checkString(name) || typeof name === "string")) {
            var _name = name;

            // get javascript string
            if (Sk.builtin.checkString(name)) {
                _name = Sk.ffi.remapToJs(name);
            }

            switch (_name) {
            case 'ndim':
                return new Sk.builtin.int_(PyArray_NDIM(self));
            case 'dtype':
                return self.v.dtype;
            case 'shape':
                return new Sk.builtin.tuple(PyArray_DIMS(self).map(
                  function (x) {
                    return new Sk.builtin.int_(x);
                  }));
            case 'strides':
                return new Sk.builtin.tuple(PyArray_STRIDES(self).map(
                  function (x) {
                    return new Sk.builtin.int_(x);
                  }));
            case 'size':
                return new Sk.builtin.int_(PyArray_SIZE(self));
            case 'data':
                return new Sk.builtin.list(PyArray_DATA(self));
            case 'T':
                if (PyArray_NDIM(self) < 2) {
                    return self
                } else {
                    return Sk.misceval.callsim(self.transpose, self);
                }
            }
        }

        var r, f, ret;
        // if we have not returned yet, try the genericgetattr
        if (self.tp$getattr !== undefined) {
            f = self.tp$getattr("__getattribute__");
        }

        if (f !== undefined) {
            ret = Sk.misceval.callsimOrSuspend(f, new Sk.builtin.str(_name));
        }

        if (r === undefined) {
            throw new Sk.builtin.AttributeError("'" + Sk.abstr.typeName(self) + "' object has no attribute '" + _name + "'");
        }
        return r;
    });

    // ndmin cannot be set, etc...
    $loc.__setattr__ = new Sk.builtin.func(function (self, name, value) {
        if (name != null && (Sk.builtin.checkString(name) || typeof name === "string")) {
            var _name = name;

            // get javascript string
            if (Sk.builtin.checkString(name)) {
                _name = Sk.ffi.remapToJs(name);
            }

            switch (_name) {
                case 'shape':
                    // trigger reshape;
                    var js_shape = PyArray_UNPACK_SHAPE(self, value);
                    self.v.strides = computeStrides(js_shape);
                    self.v.shape = js_shape;
                    return;
            }
        }

        // builtin: --> all is readonly (I am not happy with this)
        throw new Sk.builtin.AttributeError("'ndarray' object attribute '" + name + "' is readonly");
    });

    /*
      Return the array as a (possibly nested) list.

      Return a copy of the array data as a (nested) Python list. Data items are
      converted to the nearest compatible Python type.
    */
    $loc.tolist = new Sk.builtin.func(function (self) {
        var ndarrayJs = Sk.ffi.remapToJs(self);
        var list = tolist(ndarrayJs.buffer, ndarrayJs.shape, ndarrayJs.strides, ndarrayJs.dtype);

        return list;
    });

$loc.reshape = new Sk.builtin.func(function (self) {
    var args = Array.prototype.slice.call(arguments, 1);
    var shape, order = 'C';

    if (args.length === 0) {
        throw new Sk.builtin.TypeError('reshape() takes at least 1 argument (0 given)');
    }

    // 1 & 2. Парсинг shape + order разом, щоб коректно обробити виклики виду
    // reshape((3, 4)) / reshape((3, 4), 'C') / reshape((3, 4), None) —
    // останні два трапляються, коли reshape викликається "зсередини" через
    // PyArray_NewShape(arr, shape, order), де order може бути null або
    // нерозпізнаним рядком (напр. 'NPY_CORDER'). У жодному з цих випадків
    // другий аргумент НЕ повинен потрапляти у сам shape.
    if (args[0] instanceof Sk.builtin.tuple || args[0] instanceof Sk.builtin.list) {
        shape = args[0];
        if (args.length > 1) {
            var maybeOrder = args[1];
            if (maybeOrder instanceof Sk.builtin.str) {
                var o1 = Sk.ffi.remapToJs(maybeOrder).toUpperCase();
                if (['C', 'F', 'A'].indexOf(o1) !== -1) {
                    order = o1;
                }
                // unrecognized order strings (e.g. internal 'NPY_CORDER') fall
                // back to the default order rather than being treated as shape
            }
            // None (or anything else) as a second argument is likewise just
            // "no explicit order" — never part of the shape
        }
    } else {
        // shape given as separate positional ints, e.g. reshape(3, 4),
        // optionally followed by a trailing order string, e.g. reshape(3, 4, 'F')
        if (args.length > 1) {
            var last = args[args.length - 1];
            if (last instanceof Sk.builtin.str) {
                var o2 = Sk.ffi.remapToJs(last).toUpperCase();
                if (['C', 'F', 'A'].indexOf(o2) !== -1) {
                    order = o2;
                    args.pop();
                }
            }
        }
        shape = new Sk.builtin.tuple(args);
    }

    // Конвертуємо shape у JS-масив чисел
    var js_shape = shape.v.map(function(x) { return Sk.ffi.remapToJs(x); });

    // 3. Валідація та розв'язання -1
    var currentSize = PyArray_SIZE(self);
    var targetSize = 1;
    var minusOneIdx = -1;

    for (var i = 0; i < js_shape.length; i++) {
        var d = js_shape[i];
        if (d === -1) {
            if (minusOneIdx !== -1) throw new Sk.builtin.ValueError("can only specify one unknown dimension");
            minusOneIdx = i;
        } else if (d < 0) {
            throw new Sk.builtin.ValueError("negative dimensions are not allowed");
        } else {
            targetSize *= d;
        }
    }

    if (minusOneIdx !== -1) {
        if (currentSize === 0) js_shape[minusOneIdx] = 0;
        else if (currentSize % targetSize !== 0) {
            throw new Sk.builtin.ValueError("total size of new array must be unchanged");
        } else {
            js_shape[minusOneIdx] = Math.floor(currentSize / targetSize);
            targetSize = currentSize;
        }
    }

    if (targetSize !== currentSize) {
        throw new Sk.builtin.ValueError(
          "total size of new array must be unchanged" +
          " [currentSize=" + currentSize +
          " targetSize=" + targetSize +
          " js_shape=" + JSON.stringify(js_shape) +
          " self.v.shape=" + JSON.stringify(self.v.shape) +
          " buffer.length=" + (self.v.buffer ? self.v.buffer.length : 'N/A') + "]"
        );
    }

    // 4. Копіювання даних (numpy завжди зберігає дані у flattened вигляді)
    var flatData = PyArray_DATA(self).slice();

    // 5. Створення нового ndarray
    var newShapePy = new Sk.builtin.tuple(js_shape.map(function(d) { return new Sk.builtin.int_(d); }));
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], newShapePy, PyArray_DESCR(self), new Sk.builtin.list(flatData));
});

    $loc.copy = new Sk.builtin.func(function (self, order) {
      Sk.builtin.pyCheckArgs("copy", arguments, 1, 2);
      var ndarrayJs = Sk.ffi.remapToJs(self);
      var buffer = PyArray_DATA(self).map(function (x) {
        return x;
      });
      var shape = new Sk.builtin.tuple(PyArray_DIMS(self).map(function (x) {
        return new Sk.builtin.int_(x);
      }));
      return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, PyArray_DESCR(self),
        new Sk.builtin.list(buffer));
    });

    /**
      Fill the array with a scalar value.
      Parameters: value: scalar
                    All elements of a will be assigned this value
    **/
    $loc.fill = new Sk.builtin.func(function (self, value) {
      Sk.builtin.pyCheckArgs("fill", arguments, 2, 2);
      var ndarrayJs = Sk.ffi.remapToJs(self);
      var buffer = ndarrayJs.buffer.map(function (x) {
        return x;
      });
      var i;
      for (i = 0; i < ndarrayJs.buffer.length; i++) {
        if (ndarrayJs.dtype) {
          ndarrayJs.buffer[i] = Sk.misceval.callsim(ndarrayJs.dtype,
            value);
        }
      }
    });

    $loc.__getslice__ = new Sk.builtin.func( function (self, start, stop) {
      Sk.builtin.pyCheckArgs( "[]", arguments, 2, 3 );
      var ndarrayJs = Sk.ffi.remapToJs( self );
      var _index; // current index
      var _buffer; // buffer as python type
      var buffer_internal; // buffer als js array
      var _stride; // stride
      var _shape; // shape as js
      var i;
      var _start;
      var _stop;

      if ( !Sk.builtin.checkInt( start ) && !( Sk.builtin.checkInt( stop ) || Sk.builtin.checkNone( stop ) || stop === undefined) ) {
        // support for slices e.g. [1,4] or [0,]

        _start = Sk.ffi.remapToJs(start);
        if(stop === undefined || Sk.builtin.checkNone( stop )) {
          _stop = ndarrayJs.buffer.length;
        } else {
          _stop = Sk.ffi.remapToJs(start);
        }

        if(_start < 0 || _stop < 0) {
          throw new Sk.builtin.IndexError('Use of negative indices is not supported.');
        }

        buffer_internal = [];
        _index = 0;
        for ( i = _start; i < _stop; i += 1 ) {
          buffer_internal[ _index++ ] = ndarrayJs.buffer[ i ];
        }
        _buffer = new Sk.builtin.list( buffer_internal );
        _shape = new Sk.builtin.tuple( [ buffer_internal.length ].map(
          function (x) {
            return new Sk.builtin.int_( x );
          } ) );
        return Sk.misceval.callsim(mod[ CLASS_NDARRAY ], _shape, undefined,
          _buffer );
      } else {
        throw new Sk.builtin.ValueError( 'Index "' + _index +
          '" must be int' );
      }
    } );

    $loc.__setslice__ = new Sk.builtin.func( function (self, start, stop, value) {
      Sk.builtin.pyCheckArgs( "[]", arguments, 3, 2 );
      var ndarrayJs = Sk.ffi.remapToJs( self );
      var _index; // current index
      var _buffer; // buffer as python type
      var buffer_internal; // buffer als js array
      var _stride; // stride
      var _shape; // shape as js
      var i;
      var _start;
      var _stop;

      if ( !Sk.builtin.checkInt( start ) && !( Sk.builtin.checkInt( stop ) || Sk.builtin.checkNone( stop ) || stop === undefined) ) {
        // support for slices e.g. [1,4] or [0,]

        _start = Sk.ffi.remapToJs(start);
        if(stop === undefined || Sk.builtin.checkNone( stop )) {
          _stop = ndarrayJs.buffer.length;
        } else {
          _stop = Sk.ffi.remapToJs(start);
        }

        if(_start < 0 || _stop < 0) {
          throw new Sk.builtin.IndexError('Use of negative indices is not supported.');
        }

        for ( i = _start; i < _stop; i += 1 ) {
          ndarrayJs.buffer[computeOffset(ndarrayJs.strides, i)] = value;
        }
      } else {
        throw new Sk.builtin.ValueError( 'Index "' + index +
          '" must be int' );
      }
    } );

    $loc.__getitem__ = new Sk.builtin.func(function (self, index) {
      Sk.builtin.pyCheckArgs("[]", arguments, 2, 2);
      var ndarrayJs = Sk.ffi.remapToJs(self);
      var _index; // current index
      var _buffer; // buffer as python type
      var buffer_internal; // buffer als js array
      var _stride; // stride
      var _shape; // shape as js
      var i;
      // single index e.g. [3]
      if (Sk.builtin.checkInt(index)) {
        var offset = Sk.ffi.remapToJs(index);

        if (ndarrayJs.shape.length > 1) {
          _stride = ndarrayJs.strides[0];
          buffer_internal = [];
          _index = 0;

          for (i = offset * _stride, ubound = (offset + 1) * _stride; i <
            ubound; i++) {
            buffer_internal[_index++] = ndarrayJs.buffer[i];
          }

          _buffer = new Sk.builtin.list(buffer_internal);
          _shape = new Sk.builtin.tuple(Array.prototype.slice.call(
              ndarrayJs.shape,
              1)
            .map(function (x) {
              return new Sk.builtin.int_(x);
            }));
          return Sk.misceval.callsim(mod[CLASS_NDARRAY], _shape,
            undefined,
            _buffer);
        } else {
          if (offset >= 0 && offset < ndarrayJs.buffer.length) {
            return ndarrayJs.buffer[offset];
          } else {
            throw new Sk.builtin.IndexError("array index out of range");
          }
        }
      } else if (index instanceof Sk.builtin.tuple) {
        // index like [1,3] or [1,:] — supports ints AND slices mixed together,
        // plus partial indexing (fewer indices than dims)
        var _tlen = Sk.ffi.remapToJs(Sk.builtin.len(index));
        var _ndim = PyArray_NDIM(self);
        if (_tlen > _ndim) {
          throw new Sk.builtin.IndexError('too many indices for array');
        }

        // detect whether any element of the tuple is a slice
        var _rawKeys = [];
        var _hasSlice = false;
        for (var _ki = 0; _ki < _tlen; _ki++) {
          var _elt = index.mp$subscript(new Sk.builtin.int_(_ki));
          _rawKeys.push(_elt);
          if (_elt instanceof Sk.builtin.slice) {
            _hasSlice = true;
          }
        }

        if (!_hasSlice) {
          // fast path: every element is a plain integer
          var keyJs = _rawKeys.map(function (k) { return Sk.ffi.remapToJs(k); });
          var _off = 0;
          for (var _oi = 0; _oi < _tlen; _oi++) {
            _off += ndarrayJs.strides[_oi] * keyJs[_oi];
          }
          if (_tlen === _ndim) {
            // Full index → return scalar
            return ndarrayJs.buffer[_off];
          } else {
            // Partial index → return sub-array
            var _subShape = ndarrayJs.shape.slice(_tlen);
            var _subSize = _subShape.reduce(function(a,b){return a*b;}, 1);
            var _subBuf = ndarrayJs.buffer.slice(_off, _off + _subSize);
            var _pyShape = new Sk.builtin.tuple(
              _subShape.map(function(d){ return new Sk.builtin.int_(d); }));
            return Sk.misceval.callsim(mod[CLASS_NDARRAY], _pyShape,
              PyArray_DESCR(self), new Sk.builtin.list(_subBuf));
          }
        } else {
          // slow path: at least one element is a slice, e.g. dist[1, :]
          // resolve each axis independently into a list of concrete positions
          var _axisIndices = [];
          for (var _si = 0; _si < _tlen; _si++) {
            var _dimLen = ndarrayJs.shape[_si];
            var _positions = [];
            if (_rawKeys[_si] instanceof Sk.builtin.slice) {
              _rawKeys[_si].sssiter$(_dimLen, function (i, wrt) {
                if (i >= 0 && i < _dimLen) {
                  _positions.push(i);
                }
              });
            } else {
              var _iv = Sk.ffi.remapToJs(_rawKeys[_si]);
              if (_iv < 0) { _iv += _dimLen; }
              _positions.push(_iv);
            }
            _axisIndices.push(_positions);
          }
          // remaining (unindexed) axes are taken in full
          for (var _ai = _tlen; _ai < _ndim; _ai++) {
            var _full = [];
            for (var _p = 0; _p < ndarrayJs.shape[_ai]; _p++) { _full.push(_p); }
            _axisIndices.push(_full);
          }

          // cartesian product over all axes, in row-major order
          var _resultBuf = [];
          var _combine = function (axis, offsetSoFar) {
            if (axis === _axisIndices.length) {
              _resultBuf.push(ndarrayJs.buffer[offsetSoFar]);
              return;
            }
            for (var _k = 0; _k < _axisIndices[axis].length; _k++) {
              _combine(axis + 1, offsetSoFar + _axisIndices[axis][_k] * ndarrayJs.strides[axis]);
            }
          };
          _combine(0, 0);

          // squeeze out axes that came from a plain integer (non-slice)
          var _finalShape = [];
          for (var _fi = 0; _fi < _tlen; _fi++) {
            if (_rawKeys[_fi] instanceof Sk.builtin.slice) {
              _finalShape.push(_axisIndices[_fi].length);
            }
          }
          for (var _fi2 = _tlen; _fi2 < _ndim; _fi2++) {
            _finalShape.push(_axisIndices[_fi2].length);
          }

          if (_finalShape.length === 0) {
            // fully resolved to a single scalar (shouldn't normally happen here)
            return _resultBuf[0];
          }
          var _pyShape2 = new Sk.builtin.tuple(
            _finalShape.map(function (d) { return new Sk.builtin.int_(d); }));
          return Sk.misceval.callsim(mod[CLASS_NDARRAY], _pyShape2,
            PyArray_DESCR(self), new Sk.builtin.list(_resultBuf));
        }
      } else if (PyArray_Check(index) && _isBooleanMaskArray(index)) {
        // boolean-mask "fancy" indexing, e.g. dist[dist > 6.0]
        var _maskData = PyArray_DATA(index);
        var _srcData = ndarrayJs.buffer;
        if (_maskData.length !== _srcData.length) {
          throw new Sk.builtin.IndexError(
            "boolean index did not match indexed array; mask length " +
            _maskData.length + " does not match array length " + _srcData.length);
        }
        var _maskedBuf = [];
        for (var _mi = 0; _mi < _maskData.length; _mi++) {
          var maskVal = _maskData[_mi];
          // Підтримка різних форм bool
          if (Sk.misceval.isTrue(maskVal) || maskVal === true || maskVal === Sk.builtin.bool.true$) {
            _maskedBuf.push(_srcData[_mi]);
          }
        }
        var _maskShape = new Sk.builtin.tuple([new Sk.builtin.int_(_maskedBuf.length)]);
        return Sk.misceval.callsim(mod[CLASS_NDARRAY], _maskShape,
          PyArray_DESCR(self), new Sk.builtin.list(_maskedBuf));
      } else if (index instanceof Sk.builtin.slice) {
        // support for slices e.g. [1:4:-1]
        var length = Sk.builtin.len(self);
        buffer_internal = [];
        length = Sk.ffi.remapToJs(length);
        index.sssiter$(length, function (i, wrt) {
            if (i >= 0 && i < length) {
                buffer_internal.push(PyArray_DATA(self)[i]);
            }
        });
        _buffer = new Sk.builtin.list(buffer_internal);
        _shape = new Sk.builtin.tuple([buffer_internal.length].map(
          function (
            x) {
            return new Sk.builtin.int_(x);
          }));
        return Sk.misceval.callsim(mod[CLASS_NDARRAY], _shape, undefined,
          _buffer);
      } else {
        throw new Sk.builtin.ValueError('Index "' + index +
          '" must be int, slice or tuple');
      }
    });

    $loc.__setitem__ = new Sk.builtin.func(function (self, index, value) {
      var ndarrayJs = Sk.ffi.remapToJs(self);
      Sk.builtin.pyCheckArgs("[]", arguments, 3, 3);
      if (Sk.builtin.checkInt(index)) {
        var _offset = Sk.ffi.remapToJs(index);
        if (ndarrayJs.shape.length > 1) {
          var _stride = ndarrayJs.strides[0];
          var _base   = _offset * _stride;
          // value can be a list/tuple (e.g. arr[i] = [r,g,b,...])
          if (value instanceof Sk.builtin.list || value instanceof Sk.builtin.tuple) {
            var _vlen = Sk.ffi.remapToJs(Sk.builtin.len(value));
            for (var _vi2 = 0; _vi2 < _vlen; _vi2++) {
              ndarrayJs.buffer[_base + _vi2] = value.mp$subscript(new Sk.builtin.int_(_vi2));
            }
          } else if (PyArray_Check(value)) {
            var _vdata = PyArray_DATA(value);
            for (var _vi3 = 0; _vi3 < _vdata.length; _vi3++) {
              ndarrayJs.buffer[_base + _vi3] = _vdata[_vi3];
            }
          } else {
            // scalar broadcast
            for (var _vi4 = 0; _vi4 < _stride; _vi4++) {
              ndarrayJs.buffer[_base + _vi4] = value;
            }
          }
        } else {
          if (_offset >= 0 && _offset < ndarrayJs.buffer.length) {
            ndarrayJs.buffer[_offset] = value;
          } else {
            throw new Sk.builtin.IndexError("array index out of range");
          }
        }
      } else if (index instanceof Sk.builtin.tuple) {
        // Extract JS numbers from tuple elements
        var _key = [];
        var _tlen = Sk.ffi.remapToJs(Sk.builtin.len(index));
        for (var _ti = 0; _ti < _tlen; _ti++) {
          _key.push(Sk.ffi.remapToJs(index.mp$subscript(new Sk.builtin.int_(_ti))));
        }
        // Partial indexing: arr[i,j] on shape (H,W,3) uses only first 2 strides
        var _flatIdx = 0;
        for (var _ki = 0; _ki < _key.length; _ki++) {
          _flatIdx += ndarrayJs.strides[_ki] * _key[_ki];
        }
        // value may be a list/tuple [r,g,b] or a scalar
        if (value instanceof Sk.builtin.list || value instanceof Sk.builtin.tuple) {
          var _vlen = Sk.ffi.remapToJs(Sk.builtin.len(value));
          for (var _vi = 0; _vi < _vlen; _vi++) {
            ndarrayJs.buffer[_flatIdx + _vi] = value.mp$subscript(new Sk.builtin.int_(_vi));
          }
        } else {
          ndarrayJs.buffer[_flatIdx] = value;
        }
      } else {
        throw new Sk.builtin.TypeError(
          'argument "index" must be int or tuple');
      }
    });


    $loc.tobytes = new Sk.builtin.func(function (self) {
      var data   = PyArray_DATA(self);
      var dtypeStr = _normalize_dtype_str(PyArray_DESCR(self));
      var bpe    = _dtype_itemsize(dtypeStr);
      var n      = data.length;
      var out    = new Uint8Array(n * bpe);
      var view   = new DataView(out.buffer);
      for (var i = 0; i < n; i++) {
        var v = Sk.ffi.remapToJs(data[i]);
        var off = i * bpe;
        switch (dtypeStr) {
          case 'uint8':   out[off] = v & 0xff; break;
          case 'int8':    view.setInt8(off, v); break;
          case 'uint16':  view.setUint16(off, v, true); break;
          case 'int16':   view.setInt16(off, v, true); break;
          case 'uint32':  view.setUint32(off, v, true); break;
          case 'int32':   view.setInt32(off, v, true); break;
          case 'float32': view.setFloat32(off, v, true); break;
          case 'float64': view.setFloat64(off, v, true); break;
          default:        out[off] = v & 0xff;
        }
      }
      // Return as Skulpt bytes
      return new Sk.builtin.bytes(out);
    });

    $loc.__len__ = new Sk.builtin.func(function (self) {
      var ndarrayJs = Sk.ffi.remapToJs(self);
      return new Sk.builtin.int_(ndarrayJs.shape[0]);
    });

    $loc.__iter__ = new Sk.builtin.func(function (self) {
      var ndarrayJs = Sk.ffi.remapToJs(self);
      var ret = {
        tp$iter: function () {
          return ret;
        },
        $obj: ndarrayJs,
        $index: 0,
        tp$iternext: function () {
          // ToDo: should we rise here the IterationStop Exception?
          if (ret.$index >= ret.$obj.buffer.length) return undefined;
          return ret.$obj.buffer[ret.$index++];
        }
      };
      return ret;
    });

    function _formatArray(a, format_function, rank, max_line_len, next_line_prefix, separator, edge_items, summary_insert) {
        // port the functions and output the items in a nice way
        // https://github.com/numpy/numpy/blob/v1.9.1/numpy/core/arrayprint.py#L465
    }

    $loc.__str__ = new Sk.builtin.func(function (self) {
        if (PyArray_StrFunction == null) {
            return array_str_builtin(self);
        } else {
            return PyArray_StrFunction.call(null, self);
        }
    });

    $loc.__repr__ = new Sk.builtin.func(function (self) {
      return array_repr_builtin(self, 1);
    });

    // Without an explicit __format__, Skulpt's fallback path for
    // f-strings / "{}".format() ends up probing the object's truthiness
    // before falling back to str(), which triggers __nonzero__ above and
    // raises "ambiguous truth value" for arrays with >1 element even
    // though nothing here actually needs a boolean. Defining __format__
    // directly (ignoring the format spec, like numpy's own arrays do for
    // plain "{}") avoids that path entirely.
    $loc.__format__ = new Sk.builtin.func(function (self, format_spec) {
        if (PyArray_StrFunction == null) {
            return array_str_builtin(self);
        } else {
            return PyArray_StrFunction.call(null, self);
        }
    });

    /**
      Creates left hand side operations for given binary operator
    **/
    

const opmap = {
    "Add": (a, b) => a.nb$add(b),
    "Sub": (a, b) => a.nb$subtract(b),
    "Mult": (a, b) => a.nb$multiply(b),
    "Div":  (a, b) => {
    // якщо об'єкти Skulpt, спробуємо nb$true_divide, інакше просто JS-ділення
    if (a.nb$true_divide) {
        return a.nb$true_divide(b);
    } else {
        // Повертаємо Python-об'єкт float_ від результату ділення чисел
        let va = (typeof a === 'number') ? a : a.v;  // a.v — внутрішнє число в Skulpt
        let vb = (typeof b === 'number') ? b : b.v;
        return new Sk.builtin.float_(va / vb);
    }
},
    "FloorDiv": (a, b) => a.nb$floor_divide(b),
    "Mod": (a, b) => a.nb$remainder(b),
    "Pow": (a, b) => a.nb$power(b),  
    "BitXor": (a, b) => a.nb$xor(b),
    "BitAnd": (a, b) => a.nb$and(b),
    "BitOr": (a, b) => a.nb$or(b),
    "LShift": (a, b) => a.nb$lshift(b),
    "RShift": (a, b) => a.nb$rshift(b)
};

function wrapPrimitiveToSkObj(x) {
    if (typeof x === 'number') {
        // Конвертація в float_ (можна змінити на int_, якщо потрібно)
        return new Sk.builtin.float_(x);
    }
    // Якщо вже Python-об’єкт, повертаємо як є
    return x;
}

function _shapeStr(dims) {
    if (dims.length === 1) {
        return "(" + dims[0] + ",)";
    }
    return "(" + dims.join(", ") + ")";
}

const makeNumericBinaryOpLhs = (opname) => {
    const opfunc = opmap[opname];
    return function (self, other) {
        const lhs = PyArray_DATA(self);
        const _buffer = [];

        if (PyArray_Check(other)) {
            const rhs = PyArray_DATA(other);
            // broadcasting лише для сумісних форм: однакова довжина або один з операндів — скаляр (розмір 1)
            if (lhs.length !== rhs.length && lhs.length !== 1 && rhs.length !== 1) {
                throw new Sk.builtin.ValueError(
                    "operands could not be broadcast together with shapes " +
                    _shapeStr(PyArray_DIMS(self)) + " " + _shapeStr(PyArray_DIMS(other))
                );
            }
            for (let i = 0; i < lhs.length; i++) {
                const a = wrapPrimitiveToSkObj(lhs[i]);
                const b = wrapPrimitiveToSkObj(rhs[i]);
                _buffer[i] = opfunc(a, b);
            }
        } else {
            const b = wrapPrimitiveToSkObj(other);
            for (let i = 0; i < lhs.length; i++) {
                const a = wrapPrimitiveToSkObj(lhs[i]);
                _buffer[i] = opfunc(a, b);
            }
        }

        // Оформлюємо результат
        const shape = new Sk.builtin.tuple(PyArray_DIMS(self).map(x => new Sk.builtin.int_(x)));
        const buffer = new Sk.builtin.list(_buffer);

        // Визначаємо тип
        let resultType = PyArray_DESCR(self);
        for (let item of _buffer) {
            if (item instanceof Sk.builtin.float_) {
                resultType = Sk.builtin.float_;
                break;
            }
        }

        return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, resultType, buffer);
    };
};
    
    function makeNumericBinaryOpInplace(operation) {
        return function (self, other) {
            var lhs;
            var rhs;
            var i;

            if (PyArray_Check(other)) {
              lhs = PyArray_DATA(self);
              rhs = PyArray_DATA(other);
              for (i = 0, len = lhs.length; i < len; i++) {
                lhs[i] = Sk.abstr.numberBinOp(lhs[i], rhs[i], operation);
              }
            } else {
              lhs = PyArray_DATA(self);
              for (i = 0, len = lhs.length; i < len; i++) {
                lhs[i] = Sk.abstr.numberBinOp(lhs[i], other, operation);
              }
            }

            return self;
        };
    }


    function makeNumericBinaryOpRhs(operation) {
      return function (self, other) {
        var rhsBuffer = PyArray_DATA(self);
        var _buffer = [];
        for (var i = 0, len = rhsBuffer.length; i < len; i++) {
          _buffer[i] = Sk.abstr.numberBinOp(other, rhsBuffer[i], operation);
        }
        var shape = new Sk.builtin.tuple(PyArray_DIMS(self).map(function (x) {
          return new Sk.builtin.int_(x);
        }));
        buffer = new Sk.builtin.list(_buffer);
        return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, PyArray_DESCR(self), buffer);
      };
    }

    /*
      Applies given operation on each element of the ndarray.
    */
    function makeUnaryOp(operation) {
      return function (self) {
        var _buffer =PyArray_DATA(self).map(function (value) {
          return Sk.abstr.numberUnaryOp(value, operation);
        });
        var shape = new Sk.builtin.tuple(PyArray_DIMS(self).map(function (x) {
          return new Sk.builtin.int_(x);
        }));
        buffer = new Sk.builtin.list(_buffer);
        return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, PyArray_DESCR(self), buffer);
      };
    }

    $loc.__add__ = new Sk.builtin.func(makeNumericBinaryOpLhs("Add"));
    $loc.__radd__ = new Sk.builtin.func(makeNumericBinaryOpRhs("Add"));
    $loc.__iadd__ = new Sk.builtin.func(makeNumericBinaryOpInplace("Add"));

    $loc.__sub__ = new Sk.builtin.func(makeNumericBinaryOpLhs("Sub"));
    $loc.__rsub__ = new Sk.builtin.func(makeNumericBinaryOpRhs("Sub"));
    $loc.__isub__ = new Sk.builtin.func(makeNumericBinaryOpInplace("Sub"));

    $loc.__mul__ = new Sk.builtin.func(makeNumericBinaryOpLhs("Mult"));
    $loc.__rmul__ = new Sk.builtin.func(makeNumericBinaryOpRhs("Mult"));
    $loc.__imul__ = new Sk.builtin.func(makeNumericBinaryOpInplace("Mult"));
    $loc.__truediv__ = new Sk.builtin.func(makeNumericBinaryOpLhs("Div"));

    //$loc.__div__ = new Sk.builtin.func(makeNumericBinaryOpLhs("Div"));
    $loc.__rdiv__ = new Sk.builtin.func(makeNumericBinaryOpRhs("Div"));
    $loc.__idiv__ = new Sk.builtin.func(makeNumericBinaryOpInplace("Div"));

    $loc.__floordiv__ = new Sk.builtin.func(makeNumericBinaryOpLhs("FloorDiv"));
    $loc.__rfloordiv__ = new Sk.builtin.func(makeNumericBinaryOpRhs("FloorDiv"));
    $loc.__ifloordiv__ = new Sk.builtin.func(makeNumericBinaryOpInplace("FloorDiv"));

    $loc.__mod__ = new Sk.builtin.func(makeNumericBinaryOpLhs("Mod"));
    $loc.__rmod__ = new Sk.builtin.func(makeNumericBinaryOpRhs("Mod"));
    $loc.__imod__ = new Sk.builtin.func(makeNumericBinaryOpInplace("Mod"));

    $loc.__xor__ = new Sk.builtin.func(makeNumericBinaryOpLhs("BitXor"));
    $loc.__rxor__ = new Sk.builtin.func(makeNumericBinaryOpRhs("BitXor"));
    $loc.__ixor__ = new Sk.builtin.func(makeNumericBinaryOpInplace("BitXor"));

    $loc.__lshift__ = new Sk.builtin.func(makeNumericBinaryOpLhs("LShift"));
    $loc.__rlshift__ = new Sk.builtin.func(makeNumericBinaryOpRhs("LShift"));
    $loc.__ilshift__ = new Sk.builtin.func(makeNumericBinaryOpInplace("LShift"));

    $loc.__rshift__ = new Sk.builtin.func(makeNumericBinaryOpLhs("RShift"));
    $loc.__rrshift__ = new Sk.builtin.func(makeNumericBinaryOpRhs("RShift"));
    $loc.__irshift__ = new Sk.builtin.func(makeNumericBinaryOpInplace("RShift"));

    $loc.__pos__ = new Sk.builtin.func(makeUnaryOp("UAdd"));
    $loc.__neg__ = new Sk.builtin.func(makeUnaryOp("USub"));

    // logical compare functions
    /*
    $loc.__eq__ = new Sk.builtin.func(function (self, other) {        
        return Sk.misceval.callsim(mod.equal, self, other);
    });
*/
function allTrueFromNdarray(ndarr) {
    var data = PyArray_DATA(ndarr);
    for (var i = 0; i < data.length; i++) {
        if (!Sk.misceval.isTrue(data[i])) {
            return false;
        }
    }
    return true;
}

// Rich comparisons must behave like real numpy: element-wise, returning a
// boolean ndarray (not a single collapsed Python bool). This is required for
// boolean-mask indexing such as dist[dist > 6.0]. Truthiness of the result in
// an `if` statement is handled separately by __nonzero__/__bool__ below.
$loc.__eq__ = new Sk.builtin.func(function (self, other) {
    return Sk.misceval.callsim(mod.equal, self, other);
});

$loc.__ne__ = new Sk.builtin.func(function (self, other) {
    return Sk.misceval.callsim(mod.not_equal, self, other);
});

$loc.__lt__ = new Sk.builtin.func(function (self, other) {
    return Sk.misceval.callsim(mod.less, self, other);
});

$loc.__le__ = new Sk.builtin.func(function (self, other) {
    return Sk.misceval.callsim(mod.less_equal, self, other);
});

$loc.__gt__ = new Sk.builtin.func(function (self, other) {
    return Sk.misceval.callsim(mod.greater, self, other);
});

$loc.__ge__ = new Sk.builtin.func(function (self, other) {
    return Sk.misceval.callsim(mod.greater_equal, self, other);
});

// numpy raises "truth value of an array with more than one element is
// ambiguous" for arrays with >1 element, and returns the plain value for a
// single-element array. This keeps `if arr:` / `while arr:` working sanely
// for scalars/1-element results while matching real numpy semantics for
// larger arrays (use .any()/.all() instead).
$loc.__nonzero__ = new Sk.builtin.func(function (self) {	
    var data = PyArray_DATA(self);
    if (data.length === 0) {
        return Sk.builtin.bool.false$;
    }
    if (data.length === 1) {
        return new Sk.builtin.bool(Sk.misceval.isTrue(data[0]));
    }

    throw new Sk.builtin.ValueError(
        "The truth value of an array with more than one element is ambiguous. " +
        "Use a.any() or a.all()");
});
$loc.__bool__ = $loc.__nonzero__;

    /**
     Simple pow implementation that faciliates the pow builtin
    **/
    $loc.__pow__ = new Sk.builtin.func(function (self, other) {
      Sk.builtin.pyCheckArgs("__pow__", arguments, 2, 2);
      var _buffer = PyArray_DATA(self).map(function (value) {
        return Sk.builtin.pow(value, other);
      });
      var shape = new Sk.builtin.tuple(PyArray_DIMS(self).map(function (x) {
        return new Sk.builtin.int_(x);
      }));
      buffer = new Sk.builtin.list(_buffer);
      return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, PyArray_DESCR(self), buffer);
    });

    $loc.dot = new Sk.builtin.func(function (self, other) {
        var ret;
        ret = Sk.misceval.callsim(mod.dot, self, other);

        return ret;
    });

    $loc.__abs__ = new Sk.builtin.func(function (self) {
    Sk.builtin.pyCheckArgs("__abs__", arguments, 1, 1);

    // 🔁 Якщо передано список, перетвори на ndarray
    if (Sk.builtin.list === self.constructor) {
        self = Sk.misceval.callsim(mod.array, self);  // np.array([...])
    }

    // 🔒 Перевір, що self тепер дійсно ndarray
    if (!Sk.ffi.isInstance(self, mod[CLASS_NDARRAY])) {
        throw new Sk.builtin.TypeError("bad operand type for abs(): '" + Sk.abstr.typeName(self) + "'");
    }

    // ➗ Обчисли модуль кожного елемента
    var _buffer = PyArray_DATA(self).map(function (value) {
        return Sk.builtin.abs(value);
    });

    var shape = new Sk.builtin.tuple(PyArray_DIMS(self).map(function (x) {
        return new Sk.builtin.int_(x);
    }));

    var buffer = new Sk.builtin.list(_buffer);

    return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, PyArray_DESCR(self), buffer);
});


    // reference: https://github.com/numpy/numpy/blob/41afcc3681d250f231aea9d9f428a9e197a47f6e/numpy/core/src/multiarray/shape.c#L692
    $loc.transpose = new Sk.builtin.func(function (self, args) {
        // http://docs.scipy.org/doc/numpy/reference/generated/numpy.ndarray.transpose.html
        // https://github.com/numpy/numpy/blob/d033b6e19fc95a1f1fd6592de8318178368011b1/numpy/core/src/multiarray/methods.c#L1896
        var shape = Sk.builtin.none.none$;
        var n = arguments.length - 1;
        var permute = [];
        var ret;

        // get args
        args = Array.prototype.slice.call(arguments, 1); 

        if (n > 1) {
            shape = args;
        } else if (n === 1) {
            shape = args[0];
        }

        if (Sk.builtin.checkNone(shape)) {
            ret = PyArray_Transpose(self, null);
        } else {
            permute = Sk.ffi.remapToJs(shape);
            ret = PyArray_Transpose(self, permute);
        }

        return ret;
    });

    $loc.any = new Sk.builtin.func(function (self, axis, out) {
        return Sk.misceval.callsim(mod.any, self, axis, out);
    });

    $loc.all = new Sk.builtin.func(function (self, axis, out) {
        return Sk.misceval.callsim(mod.all, self, axis, out);
    });

    $loc.mean = new Sk.builtin.func(function (self, axis, dtype, out, keepdims) {
        return Sk.misceval.callsim(mod.mean, self, axis, dtype, out, keepdims);
    });

    $loc.var = new Sk.builtin.func(function (self, axis, dtype, out, ddof, keepdims) {
        return Sk.misceval.callsim(mod.var, self, axis, dtype, out, ddof, keepdims);
    });

    $loc.std = new Sk.builtin.func(function (self, axis, dtype, out, ddof, keepdims) {
        return Sk.misceval.callsim(mod.std, self, axis, dtype, out, ddof, keepdims);
    });

    $loc.sum = new Sk.builtin.func(function (self, axis, dtype, out, keepdims) {
        return Sk.misceval.callsim(mod.sum, self, axis, dtype, out, keepdims);
    });

    $loc.prod = new Sk.builtin.func(function (self, axis, dtype, out, keepdims) {
        return Sk.misceval.callsim(mod.prod, self, axis, dtype, out, keepdims);
    });

    // end of ndarray_f
  };

  mod[CLASS_NDARRAY] = Sk.misceval.buildClass(mod, ndarray_f,
    CLASS_NDARRAY, []);

  /**
   Trigonometric functions, all element wise
  **/
  mod.pi = new Sk.builtin.float_(np.math ? np.math.PI : Math.PI);
  mod.e = new Sk.builtin.float_(np.math ? np.math.E : Math.E);

  /**
   * np.nan / np.NAN / np.NaN — "не число" (Not a Number).
   * np.inf / np.Inf / np.Infinity / np.PINF — додатна нескінченність.
   * np.NINF — від'ємна нескінченність.
   * np.NZERO / np.PZERO — від'ємний і додатний нулі (як у справжньому numpy).
   **/
  mod.nan = new Sk.builtin.float_(NaN);
  mod.NAN = mod.nan;
  mod.NaN = mod.nan;

  mod.inf = new Sk.builtin.float_(Infinity);
  mod.Inf = mod.inf;
  mod.Infinity = mod.inf;
  mod.PINF = mod.inf;
  mod.NINF = new Sk.builtin.float_(-Infinity);

  mod.NZERO = new Sk.builtin.float_(-0.0);
  mod.PZERO = new Sk.builtin.float_(0.0);

  /**
  Trigonometric sine, element-wise.
  **/

  function callTrigonometricFunc(x, op) {
    var res;
    var num;

    // ToDo: check if we can use ArrayFromAny here!
    if (x instanceof Sk.builtin.list || x instanceof Sk.builtin.tuple) {
      x = Sk.misceval.callsim(mod.array, x);
    }

    if (PyArray_Check(x)) {
      var _buffer = PyArray_DATA(x).map(function (value) {
        num = Sk.builtin.asnum$(value);
        res = op.call(null, num);
        return new Sk.builtin.float_(res);
      });

      var shape = new Sk.builtin.tuple(PyArray_DIMS(x).map(function (d) {
        return new Sk.builtin.int_(d);
      }));

      buffer = new Sk.builtin.list(_buffer);
      return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, PyArray_DESCR(x), buffer);
    } else if (Sk.builtin.checkNumber(x)) {
      num = Sk.builtin.asnum$(x);
      res = op.call(null, num);
      return new Sk.builtin.float_(res);
    }

    throw new Sk.builtin.TypeError('Unsupported argument type for "x"');
  }

  // Sine, element-wise.
  var sin_f = function (x, out) {
    Sk.builtin.pyCheckArgs("sin", arguments, 1, 2);
    return callTrigonometricFunc(x, np.math ? np.math.sin : Math.sin);
  };
  sin_f.co_varnames = ['x', 'out'];
  sin_f.$defaults = [0, new Sk.builtin.list([])];
  mod.sin = new Sk.builtin.func(sin_f);

  // Hyperbolic sine, element-wise.
  var sinh_f = function (x, out) {
    Sk.builtin.pyCheckArgs("sinh", arguments, 1, 2);
    if (!np.math) throw new Sk.builtin.OperationError("sinh requires math polyfill");
    return callTrigonometricFunc(x, np.math.sinh);
  };
  sinh_f.co_varnames = ['x', 'out'];
  sinh_f.$defaults = [0, new Sk.builtin.list([])];
  mod.sinh = new Sk.builtin.func(sinh_f);

  // Inverse sine, element-wise.
  var arcsin_f = function (x, out) {
    Sk.builtin.pyCheckArgs("arcsin", arguments, 1, 2);
    return callTrigonometricFunc(x, np.math ? np.math.asin : Math.asin);
  };
  arcsin_f.co_varnames = ['x', 'out'];
  arcsin_f.$defaults = [0, new Sk.builtin.list([])];
  mod.arcsin = new Sk.builtin.func(arcsin_f);

  // Cosine, element-wise.
  var cos_f = function (x, out) {
    Sk.builtin.pyCheckArgs("cos", arguments, 1, 2);
    return callTrigonometricFunc(x, np.math ? np.math.cos : Math.cos);
  };
  cos_f.co_varnames = ['x', 'out'];
  cos_f.$defaults = [0, new Sk.builtin.list([])];
  mod.cos = new Sk.builtin.func(cos_f);

  // Hyperbolic cosine, element-wise.
  var cosh_f = function (x, out) {
    Sk.builtin.pyCheckArgs("cosh", arguments, 1, 2);
    if (!np.math) throw new Sk.builtin.OperationError("cosh requires math polyfill");
    return callTrigonometricFunc(x, np.math.cosh);
  };
  cosh_f.co_varnames = ['x', 'out'];
  cosh_f.$defaults = [0, new Sk.builtin.list([])];
  mod.cosh = new Sk.builtin.func(cosh_f);

  // Inverse cosine, element-wise.
  var arccos_f = function (x, out) {
    Sk.builtin.pyCheckArgs("arccos", arguments, 1, 2);
    return callTrigonometricFunc(x, np.math ? np.math.acos : Math.acos);
  };
  arccos_f.co_varnames = ['x', 'out'];
  arccos_f.$defaults = [0, new Sk.builtin.list([])];
  mod.arccos = new Sk.builtin.func(arccos_f);

  // Inverse tangens, element-wise.
  var arctan_f = function (x, out) {
    Sk.builtin.pyCheckArgs("arctan", arguments, 1, 2);
    return callTrigonometricFunc(x, np.math ? np.math.atan : Math.atan);
  };
  arctan_f.co_varnames = ['x', 'out'];
  arctan_f.$defaults = [0, new Sk.builtin.list([])];
  mod.arctan = new Sk.builtin.func(arctan_f);

  // Tangens, element-wise.
  var tan_f = function (x, out) {
    Sk.builtin.pyCheckArgs("tan", arguments, 1, 2);
    return callTrigonometricFunc(x, np.math ? np.math.tan : Math.tan);
  };
  tan_f.co_varnames = ['x', 'out'];
  tan_f.$defaults = [0, new Sk.builtin.list([])];
  mod.tan = new Sk.builtin.func(tan_f);

  // Hyperbolic cosine, element-wise.
  var tanh_f = function (x, out) {
    Sk.builtin.pyCheckArgs("tanh", arguments, 1, 2);
    if (!np.math) throw new Sk.builtin.OperationError("tanh requires math polyfill");
    return callTrigonometricFunc(x, np.math.tanh);
  };
  tanh_f.co_varnames = ['x', 'out'];
  tanh_f.$defaults = [0, new Sk.builtin.list([])];
  mod.tanh = new Sk.builtin.func(tanh_f);


  // Exponential
  var exp_f = function (x, out) {
    Sk.builtin.pyCheckArgs("exp", arguments, 1, 2);

    /* for complex type support we should use here a different approach*/
    //Sk.builtin.assk$(Math.E, Sk.builtin.nmber.float$);
    return callTrigonometricFunc(x, np.math ? np.math.exp : Math.exp);
  };
  exp_f.co_varnames = ['x', 'out'];
  exp_f.$defaults = [0, new Sk.builtin.list([])];
  mod.exp = new Sk.builtin.func(exp_f);

  // Square Root
  var sqrt_f = function (x, out) {
    Sk.builtin.pyCheckArgs("sqrt", arguments, 1, 2);
   return callTrigonometricFunc(x, np.math ? np.math.sqrt : Math.sqrt);
  };
  sqrt_f.co_varnames = ['x', 'out'];
  sqrt_f.$defaults = [0, new Sk.builtin.list([])];
  mod.sqrt = new Sk.builtin.func(sqrt_f);

  // Natural logarithm, element-wise.
  var log_f = function (x, out) {
    Sk.builtin.pyCheckArgs("log", arguments, 1, 2);
    return callTrigonometricFunc(x, Math.log);
  };
  log_f.co_varnames = ['x', 'out'];
  log_f.$defaults = [0, new Sk.builtin.list([])];
  mod.log = new Sk.builtin.func(log_f);

  // Base-2 logarithm, element-wise.
  var log2_f = function (x, out) {
    Sk.builtin.pyCheckArgs("log2", arguments, 1, 2);
    return callTrigonometricFunc(x, np.math ? np.math.log2 : function (v) { return Math.log(v) / Math.LN2; });
  };
  log2_f.co_varnames = ['x', 'out'];
  log2_f.$defaults = [0, new Sk.builtin.list([])];
  mod.log2 = new Sk.builtin.func(log2_f);

  // Base-10 logarithm, element-wise.
  var log10_f = function (x, out) {
    Sk.builtin.pyCheckArgs("log10", arguments, 1, 2);
    return callTrigonometricFunc(x, np.math ? np.math.log10 : function (v) { return Math.log(v) / Math.LN10; });
  };
  log10_f.co_varnames = ['x', 'out'];
  log10_f.$defaults = [0, new Sk.builtin.list([])];
  mod.log10 = new Sk.builtin.func(log10_f);

  // log(1 + x), element-wise (more accurate than log(1+x) for x near 0).
  var log1p_f = function (x, out) {
    Sk.builtin.pyCheckArgs("log1p", arguments, 1, 2);
    return callTrigonometricFunc(x, np.math ? np.math.log1p : function (v) { return Math.log(1 + v); });
  };
  log1p_f.co_varnames = ['x', 'out'];
  log1p_f.$defaults = [0, new Sk.builtin.list([])];
  mod.log1p = new Sk.builtin.func(log1p_f);


  /* Simple reimplementation of the linspace function
   * http://docs.scipy.org/doc/numpy/reference/generated/numpy.linspace.html
   */
  var linspace_f = function (start, stop, num, endpoint, retstep) {
    Sk.builtin.pyCheckArgs("linspace", arguments, 3, 5);
    Sk.builtin.pyCheckType("start", "number", Sk.builtin.checkNumber(
      start));
    Sk.builtin.pyCheckType("stop", "number", Sk.builtin.checkNumber(
      stop));
    if (num === undefined) {
      num = 50;
    }
    var num_num = Sk.builtin.asnum$(num);
    var endpoint_bool;

    if (endpoint === undefined) {
      endpoint_bool = true;
    } else if (endpoint.constructor === Sk.builtin.bool) {
      endpoint_bool = endpoint.v;
    }

    var retstep_bool;
    if (retstep === undefined) {
      retstep_bool = false;
    } else if (retstep.constructor === Sk.builtin.bool) {
      retstep_bool = retstep.v;
    }

    var samples;
    var step;

    start_num = Sk.builtin.asnum$(start) * 1.0;
    stop_num = Sk.builtin.asnum$(stop) * 1.0;



    if (num_num <= 0) {
      samples = [];
    } else {

      var samples_array;
      if (endpoint_bool) {
        if (num_num == 1) {
          samples = [start_num];
        } else {
          step = (stop_num - start_num) / (num_num-1 );
         
          samples_array = np.arange(0, num_num);
          samples = samples_array.map(function (v) {
            return v * step + start_num;
          });
          samples[samples.length - 1] = stop_num;
        }
      } else {
        step = (stop_num - start_num) / (num_num-1);
       
        samples_array = np.arange(0, num_num);
        samples = samples_array.map(function (v) {
          return v * step + start_num;
        });
      }
    }

    //return as ndarray! dtype:float
    var dtype = Sk.builtin.float_;
    
   /*
    for (i = 0; i < samples.length; i++) {
      samples[i] = Sk.misceval.callsim(dtype, samples[i]);
    }
    */
for (var i = 0; i < samples.length; i++) {
    let val = samples[i];

    // Якщо val — це Sk.builtin.int_ або Sk.builtin.float_, витягни .v
    if (val instanceof Sk.builtin.int_ || val instanceof Sk.builtin.float_) {
        val = val.v;
    }

    // Потім створюй float_ із чистого числа
    samples[i] = Sk.misceval.callsim(dtype, new Sk.builtin.float_(val));
}


//
    var buffer = new Sk.builtin.list(samples);
    var shape = new Sk.builtin.tuple([samples.length]);
    var ndarray = Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, dtype,
      buffer);

    if (retstep_bool === true)
      return new Sk.builtin.tuple([ndarray, step]);
    else
      return ndarray;
  };

  // this should allow for named parameters
  linspace_f.co_varnames = ['start', 'stop', 'num', 'endpoint',
    'retstep'
  ];
  linspace_f.$defaults = [0, 0, 50, true, false];
  mod.linspace = new Sk.builtin.func(linspace_f);
//
	function unpackKWA(kwa) {
		result = {};

		for (var i = 0; i < kwa.length; i += 2) {
			var key = Sk.ffi.remapToJs(kwa[i]);
			var val = kwa[i + 1];
			result[key] = val;
		}
		return result;
	}
    function parseArgs(args) {
        var pos_args = [];
        var kwargs = new Sk.builtin.dict();
        for (var i = 0; i < args.length; i++) {
            if (Array.isArray(args[i])) {                
                kwargs = args[i];
            } else {
                pos_args.push(args[i]);
            }
        }
      
        var props = unpackKWA(kwargs);
        return [pos_args,props];
    
    }
//

  /* Simple reimplementation of the arange function
   * http://docs.scipy.org/doc/numpy/reference/generated/numpy.arange.html#numpy.arange
   */
  var arange_f = function () { // start, stop, step, dtype
    var args = Array.prototype.slice.call(arguments);
    let p_args = parseArgs(args);
    var pos_args = p_args[0]; 
    var props = p_args[1]; 
    var start = 0;
    var stop  = 0;
    var step  = 1; 
   
    if (pos_args.length==1) {
          start = 0; 
          stop = Sk.ffi.remapToJs(pos_args[0]);          
        }
    if (pos_args.length==2) {
          start = Sk.ffi.remapToJs(pos_args[0]);
          stop  = Sk.ffi.remapToJs(pos_args[1]);
        }
    if (pos_args.length==3) {
          start = Sk.ffi.remapToJs(pos_args[0]);
          stop  = Sk.ffi.remapToJs(pos_args[1]);
          step  = Sk.ffi.remapToJs(pos_args[2]);
        }    
    Sk.builtin.pyCheckType("start", "number", Sk.builtin.checkNumber(
      start));
    var start_num;
    var stop_num;
    var step_num;
    var dtype = Sk.builtin.int_;
    if (stop === undefined && step === undefined) {
      start_num = Sk.builtin.asnum$(0);
      stop_num = Sk.builtin.asnum$(start);
      step_num = Sk.builtin.asnum$(1);
    } else if (step === undefined) {
      start_num = Sk.builtin.asnum$(start);
      stop_num = Sk.builtin.asnum$(stop);
      step_num = Sk.builtin.asnum$(1);
    } else {
      start_num = Sk.builtin.asnum$(start);
      stop_num = Sk.builtin.asnum$(stop);
      step_num = Sk.builtin.asnum$(step);
    }
    if (props.dtype){
        dtype = props.dtype;
    }
    // set to float
    if (!dtype || dtype == Sk.builtin.none.none$) {
      if (Sk.builtin.checkInt(start))
        dtype = Sk.builtin.int_;
      else
        dtype = Sk.builtin.float_;
    }

    // припускаємо, що np.arange — це просто функція, яка повертає JS-масив чисел
    var js_array = np.arange(start_num, stop_num, step_num);

    // Перетворити кожен елемент у об'єкт Skulpt
    var arange_buffer = js_array.map(function(x) {
        if (dtype === Sk.builtin.int_) {
            return new Sk.builtin.int_(x);
        } else {
            return new Sk.builtin.float_(x);
        }
    });

    // Створюємо список
    var buffer = new Sk.builtin.list(arange_buffer);
    var shape = new Sk.builtin.tuple([new Sk.builtin.int_(arange_buffer.length)]);

    // Повертаємо ndarray
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, dtype, buffer);   
    };

  arange_f.co_kwargs = true;
  arange_f.$defaults = [0, 1, 1, Sk.builtin.none.none$];
  mod.arange = new Sk.builtin.func(arange_f);

  /* implementation for numpy.array
    ------------------------------------------------------------------------------------------------
        http://docs.scipy.org/doc/numpy/reference/generated/numpy.array.html#numpy.array

        object : array_like
        An array, any object exposing the array interface, an object whose __array__ method returns an array, or any (nested) sequence.

        dtype : data-type, optional
        The desired data-type for the array. If not given, then the type will be determined as the minimum type required to hold the objects in the sequence. This argument can only be used to ‘upcast’ the array. For downcasting, use the .astype(t) method.

        copy : bool, optional
        If true (default), then the object is copied. Otherwise, a copy will only be made if __array__ returns a copy, if obj is a nested sequence, or if a copy is needed to satisfy any of the other requirements (dtype, order, etc.).

        order : {‘C’, ‘F’, ‘A’}, optional
        Specify the order of the array. If order is ‘C’ (default), then the array will be in C-contiguous order (last-index varies the fastest). If order is ‘F’, then the returned array will be in Fortran-contiguous order (first-index varies the fastest). If order is ‘A’, then the returned array may be in any order (either C-, Fortran-contiguous, or even discontiguous).

        subok : bool, optional
        If True, then sub-classes will be passed-through, otherwise the returned array will be forced to be a base-class array (default).

        ndmin : int, optional
        Specifies the minimum number of dimensions that the resulting array should have. Ones will be pre-pended to the shape as needed to meet this requirement.

        Returns :
        out : ndarray
        An array object satisfying the specified requirements
    */
  // https://github.com/geometryzen/davinci-dev/blob/master/src/stdlib/numpy.js
  // https://github.com/geometryzen/davinci-dev/blob/master/src/ffh.js
  // http://docs.scipy.org/doc/numpy/reference/arrays.html
  var array_f = function (object, dtype, copy, order, subok, ndmin) {
    Sk.builtin.pyCheckArgs("array", arguments, 1, 6);

    // ToDo: use PyArray_FromAny here and then do some checkings for the type
    // and maybe casting and support ndmin param
    // see http://docs.scipy.org/doc/numpy/reference/generated/numpy.array.html#numpy.array

    if (object === undefined)
      throw new Sk.builtin.TypeError("'" + Sk.abstr.typeName(object) +
        "' object is undefined");

    // check for ndmin param
    if (ndmin != null && Sk.builtin.checkInt(ndmin) === false) {
      throw new Sk.builtin.TypeError('Parameter "ndmin" must be of type "int"');
    }    
    var py_ndarray = PyArray_FromAny(object, dtype, ndmin);
  
    return py_ndarray;
  };

  array_f.co_varnames = ['object', 'dtype', 'copy', 'order',
    'subok', 'ndmin'
  ];
  array_f.$defaults = [null, Sk.builtin.none.none$, true, new Sk.builtin.str(
    'C'), false, new Sk.builtin.int_(0)];
  mod.array = new Sk.builtin.func(array_f);

    var asanyarray_f = function (a, dtype, order) {
        //array(a, dtype, copy=False, order=order, subok=True)
        return Sk.misceval.callsim(mod.array, dtype, Sk.builtin.bool.false$, order);
    };

    mod.asanyarray = new Sk.builtin.func(asanyarray_f);
    asanyarray_f.co_varnames = ['a', 'dtype', 'order'];
    asanyarray_f.$defaults = [null, Sk.builtin.none.none$, Sk.builtin.none.none$];

  /**
    Defensively coerce a "shape" argument that arrives as a plain JS array
    (e.g. [3, 3] passed in directly from internal JS callers such as
    numpy.random helpers) into a proper Sk.builtin.tuple of Sk ints, so it
    behaves like any normal Python sequence for checkSequence/mp$subscript.
    Anything that isn't a raw JS array (already a Sk object, an int, etc.)
    is passed through untouched.
  **/
  function _coerceShapeArg(shape) {
    if (Array.isArray(shape)) {
      return new Sk.builtin.tuple(shape.map(function (d) {
        if (d instanceof Sk.builtin.int_ || d instanceof Sk.builtin.float_ ||
            d instanceof Sk.builtin.lng) {
          return d;
        }
        return new Sk.builtin.int_(d);
      }));
    }
    return shape;
  }

  /**
    Return a new array of given shape and type, filled with zeros.
  **/
  var zeros_f = function (shape, dtype, order) {
    Sk.builtin.pyCheckArgs("zeros", arguments, 1, 3);
    shape = _coerceShapeArg(shape);
    if(!Sk.builtin.checkSequence(shape) && !Sk.builtin.checkInt(shape)) {
      throw new Sk.builtin.TypeError('argument "shape" must int or sequence of ints');
    }

    if (dtype instanceof Sk.builtin.list) {
      throw new Sk.builtin.TypeError("'" + Sk.abstr.typeName(dtype) +
        "' is not supported for dtype.");
    }

    var _zero = new Sk.builtin.float_(0.0);

    return Sk.misceval.callsim(mod.full, shape, _zero, dtype, order);
  };
  zeros_f.co_varnames = ['shape', 'dtype', 'order'];
  zeros_f.$defaults = [
    new Sk.builtin.tuple([]), Sk.builtin.none.none$, new Sk.builtin.str('C')
  ];
  mod.zeros = new Sk.builtin.func(zeros_f);

  /**
    Return a new array of given shape and type, filled with `fill_value`.
  **/
  var full_f = function (shape, fill_value, dtype, order) {
    Sk.builtin.pyCheckArgs("full", arguments, 2, 4);
    shape = _coerceShapeArg(shape);

    if(!Sk.builtin.checkSequence(shape) && !Sk.builtin.checkInt(shape)) {
      throw new Sk.builtin.TypeError('argument "shape" must int or sequence of ints');
    }

    if (dtype instanceof Sk.builtin.list) {
      throw new Sk.builtin.TypeError("'" + Sk.abstr.typeName(dtype) +
        "' is currently not supported for dtype.");
    }

    var _shape;
    if (Sk.builtin.checkInt(shape)) {
      _shape = [Sk.ffi.remapToJs(shape)];
    } else if (Sk.builtin.checkSequence(shape)) {
      _shape = [];
      var _slen = Sk.ffi.remapToJs(Sk.builtin.len(shape));
      for (var _si = 0; _si < _slen; _si++) {
        _shape.push(Sk.ffi.remapToJs(shape.mp$subscript(new Sk.builtin.int_(_si))));
      }
    } else {
      _shape = [Sk.ffi.remapToJs(shape)];
    }
    // generate an array of the dimensions for the generic array method

    var _size = prod(_shape);
    var _buffer = [];
    var _fill_value = fill_value;
    var i;

    for (i = 0; i < _size; i++) {
      _buffer[i] = _fill_value;
    }

    // if no dtype given and type of fill_value is numeric, assume float
    if (!dtype && Sk.builtin.checkNumber(fill_value)) {
      dtype = Sk.builtin.float_;
    }

    // apply dtype casting function, if it has been provided
    if (Sk.builtin.checkClass(dtype)) {
      for (i = 0; i < _buffer.length; i++) {
        if (_buffer[i] !== Sk.builtin.none.none$) {
          _buffer[i] = Sk.misceval.callsim(dtype, _buffer[i]);
        }
      }
    }
    var _pyShape = new Sk.builtin.tuple(_shape.map(function(d){ return new Sk.builtin.int_(d); }));
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], _pyShape, dtype, new Sk.builtin.list(_buffer));
  };
  full_f.co_varnames = ['shape', 'fill_value', 'dtype', 'order'];
  full_f.$defaults = [
    new Sk.builtin.tuple([]), Sk.builtin.none.none$, Sk.builtin.none.none$, new Sk
    .builtin
    .str('C')
  ];
  mod.full = new Sk.builtin.func(full_f);

  var abs_f = function (x) {
    Sk.builtin.pyCheckArgs("abs", arguments, 1, 1);
    var ret;
    if (PyArray_Check(x) == true) {
        // call abs on each element of the array and return new array
        // we need to call __abs__ on the ndarray
        ret = Sk.misceval.callsim(x.__abs__, x);
    } else {
        // return abs for element by calling abs
        ret = Sk.builtin.abs(x);
    }

    return ret;
  };
//
mod.abs = new Sk.builtin.func(function (x) {
    Sk.builtin.pyCheckArgs("abs", arguments, 1, 1);

    // 🔁 Якщо передано список — перетвори на ndarray
    if (x.constructor === Sk.builtin.list) {
        x = Sk.misceval.callsim(mod.array, x);  // np.array([...])
    }

    // 🔒 Перевір, що x — це ndarray
    if (!x || x.tp$name !== CLASS_NDARRAY) {
        throw new Sk.builtin.TypeError("bad operand type for np.abs(): '" + Sk.abstr.typeName(x) + "'");
    }

    // ➗ Обчисли abs для кожного значення
    var _buffer = PyArray_DATA(x).map(function (value) {
        return Sk.builtin.abs(value);
    });

    var shape = new Sk.builtin.tuple(PyArray_DIMS(x).map(function (dim) {
        return new Sk.builtin.int_(dim);
    }));

    var buffer = new Sk.builtin.list(_buffer);

    return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, PyArray_DESCR(x), buffer);
});


  //mod.abs = new Sk.builtin.func(abs_f);
  mod.absolute = mod.abs;

  // Evenly round to the given number of decimals (numpy.round / numpy.around).
  var round_f = function (x, decimals, out) {
    Sk.builtin.pyCheckArgs("round", arguments, 1, 3);

    var dec = (decimals === undefined || decimals === null || Sk.builtin.checkNone(decimals))
        ? 0 : Sk.builtin.asnum$(decimals);
    var factor = Math.pow(10, dec);

    function roundNum(n) {
        return Math.round(n * factor) / factor;
    }

    // 🔁 Якщо передано список — перетвори на ndarray
    if (x instanceof Sk.builtin.list || x instanceof Sk.builtin.tuple) {
        x = Sk.misceval.callsim(mod.array, x);
    }

    if (PyArray_Check(x)) {
        var _buffer = PyArray_DATA(x).map(function (value) {
            var num = Sk.builtin.asnum$(value);
            return new Sk.builtin.float_(roundNum(num));
        });

        var shape = new Sk.builtin.tuple(PyArray_DIMS(x).map(function (dim) {
            return new Sk.builtin.int_(dim);
        }));

        var buffer = new Sk.builtin.list(_buffer);

        return Sk.misceval.callsim(mod[CLASS_NDARRAY], shape, PyArray_DESCR(x), buffer);
    } else if (Sk.builtin.checkNumber(x)) {
        var num = Sk.builtin.asnum$(x);
        return new Sk.builtin.float_(roundNum(num));
    }

    throw new Sk.builtin.TypeError("bad operand type for np.round(): '" + Sk.abstr.typeName(x) + "'");
  };
  round_f.co_varnames = ['x', 'decimals', 'out'];
  round_f.$defaults = [new Sk.builtin.int_(0), Sk.builtin.none.none$];
  mod.round = new Sk.builtin.func(round_f);
  mod.around = mod.round;
  mod.round_ = mod.round;

  // rint: round to nearest integer, element-wise (decimals fixed at 0).
  mod.rint = new Sk.builtin.func(function (x, out) {
    Sk.builtin.pyCheckArgs("rint", arguments, 1, 2);
    return Sk.misceval.callsim(mod.round, x, new Sk.builtin.int_(0));
  });

 /**
  * Coerces array-like input (Python list, tuple, or anything numpy.array()
  * accepts) into a real numpy.ndarray so that reduction functions such as
  * mean/sum/var/std/median work on plain Python lists (e.g. [2, 4, 6, 8, 10]),
  * not only on values that already pass PyArray_Check.
  *
  * Returns:
  *   - the ndarray itself, if x already is one (PyArray_Check(x) === true)
  *   - null, if x is a genuine scalar number (caller should treat it as such)
  *   - a freshly built ndarray, if x is a list/tuple/other array-like
  */
 function _coerceArrayLike(x) {
    if (PyArray_Check(x)) {
        return x;
    }
    if (Sk.builtin.checkNumber(x)) {
        return null;
    }
    // Python list, tuple, or other array-like object: build a real
    // ndarray out of it via numpy.array(), same coercion numpy itself
    // performs internally (PyArray_FromAny) before reducing.
    return Sk.misceval.callsim(mod.array, x);
 }

 var mean_f = function (x, axis, dtype, out, keepdims) {
    Sk.builtin.pyCheckArgs("mean", arguments, 1, 5);
    var ret;
    var sum = new Sk.builtin.float_(0.0); // initialised sum var
    var mean;
    var i = 0;
    var _buffer;
    var length;
    var arr;

    if (axis != null && !Sk.builtin.checkNone(axis)) {
        throw new Sk.builtin.NotImplementedError("the 'axis' parameter is currently not supported");
    }

    if (out != null && !Sk.builtin.checkNone(out)) {
        throw new Sk.builtin.NotImplementedError("the 'out' parameter is currently not supported");
    }

    if (keepdims != null && keepdims != Sk.builtin.bool.false$) {
        throw new Sk.builtin.NotImplementedError("the 'keepdims' parameter is currently not supported");
    }

    // Accept ndarrays as well as plain Python lists/tuples (array-like).
    arr = _coerceArrayLike(x);

    if (arr != null) {
        _buffer = PyArray_DATA(arr);
        length = new Sk.builtin.int_(PyArray_SIZE(arr));

        for (i = 0; i < length.v; i++) {
            sum = Sk.abstr.numberBinOp(sum, _buffer[i], 'Add');
        }

        mean = Sk.abstr.numberBinOp(sum, length, 'Div');
    } else {
        // genuine scalar: mean of a single number is itself
        mean = x
    }

    // apply dtype casting
    if (dtype != null && !Sk.builtin.checkNone(dtype)) {
        mean = Sk.misceval.callsim(dtype, mean);
    }

    // call PyArray_Return
    return mean;
  };
  mean_f.co_varnames = ['a', 'axis', 'dtype', 'out', 'keepdims'];
  mean_f.$defaults = [null, Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.bool.false$];
  mod.mean = new Sk.builtin.func(mean_f);

  function _checkReduceParams(name, axis, out, keepdims) {
    if (axis != null && !Sk.builtin.checkNone(axis)) {
      throw new Sk.builtin.NotImplementedError("the 'axis' parameter is currently not supported for '" + name + "'");
    }
    if (out != null && !Sk.builtin.checkNone(out)) {
      throw new Sk.builtin.NotImplementedError("the 'out' parameter is currently not supported for '" + name + "'");
    }
    if (keepdims != null && keepdims != Sk.builtin.bool.false$) {
      throw new Sk.builtin.NotImplementedError("the 'keepdims' parameter is currently not supported for '" + name + "'");
    }
  }

  /**
   * Raw JS-number variance computation shared by var()/std().
   * divisor = N - ddof; matches numpy's behaviour of returning NaN
   * (with a RuntimeWarning in real numpy, silently here) when divisor <= 0.
   */
  function _varianceCompute(x, ddof) {
    var data, n, mean, sumSq, i, d, divisor, arr;

    arr = _coerceArrayLike(x);

    if (arr != null) {
      data = _toJsNumberArray(PyArray_DATA(arr));
      n = data.length;
      mean = 0;
      for (i = 0; i < n; i++) {
        mean += data[i];
      }
      mean = mean / n;
      sumSq = 0;
      for (i = 0; i < n; i++) {
        d = data[i] - mean;
        sumSq += d * d;
      }
      divisor = n - ddof;
    } else {
      if (!Sk.builtin.checkNumber(x)) {
        throw new Sk.builtin.TypeError("cannot perform reduce with flexible type");
      }
      // a lone scalar has zero deviation from its own mean
      sumSq = 0;
      divisor = 1 - ddof;
    }

    return divisor > 0 ? sumSq / divisor : NaN;
  }

  function _toJsNumberArray(buffer) {
    var out = [];
    var i;
    for (i = 0; i < buffer.length; i++) {
      if (!Sk.builtin.checkNumber(buffer[i])) {
        throw new Sk.builtin.TypeError("cannot perform reduce with flexible type");
      }
      out.push(Sk.builtin.asnum$(buffer[i]));
    }
    return out;
  }

  var var_f = function (x, axis, dtype, out, ddof, keepdims) {
    Sk.builtin.pyCheckArgs("var", arguments, 1, 6);
    _checkReduceParams("var", axis, out, keepdims);

    var _ddof = (ddof == null || Sk.builtin.checkNone(ddof)) ? 0 : Sk.builtin.asnum$(ddof);
    var result = _varianceCompute(x, _ddof);

    if (dtype != null && !Sk.builtin.checkNone(dtype)) {
      return Sk.misceval.callsim(dtype, new Sk.builtin.float_(result));
    }
    return new Sk.builtin.float_(result);
  };
  var_f.co_varnames = ['a', 'axis', 'dtype', 'out', 'ddof', 'keepdims'];
  var_f.$defaults = [Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.none.none$, new Sk.builtin.int_(0), Sk.builtin.bool.false$];
  mod.var = new Sk.builtin.func(var_f);

  var std_f = function (x, axis, dtype, out, ddof, keepdims) {
    Sk.builtin.pyCheckArgs("std", arguments, 1, 6);
    _checkReduceParams("std", axis, out, keepdims);

    var _ddof = (ddof == null || Sk.builtin.checkNone(ddof)) ? 0 : Sk.builtin.asnum$(ddof);
    var variance = _varianceCompute(x, _ddof);
    var result = Math.sqrt(variance);

    if (dtype != null && !Sk.builtin.checkNone(dtype)) {
      return Sk.misceval.callsim(dtype, new Sk.builtin.float_(result));
    }
    return new Sk.builtin.float_(result);
  };
  std_f.co_varnames = ['a', 'axis', 'dtype', 'out', 'ddof', 'keepdims'];
  std_f.$defaults = [Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.none.none$, new Sk.builtin.int_(0), Sk.builtin.bool.false$];
  mod.std = new Sk.builtin.func(std_f);

  /**
   * numpy.median(a, axis=None, out=None, overwrite_input=False, keepdims=False)
   * Works on ndarrays as well as plain Python lists/tuples (array-like),
   * via the shared _coerceArrayLike() helper.
   */
  var median_f = function (x, axis, out, overwrite_input, keepdims) {
    Sk.builtin.pyCheckArgs("median", arguments, 1, 5);
    _checkReduceParams("median", axis, out, keepdims);

    var arr = _coerceArrayLike(x);
    var data, n, sorted, mid, result;

    if (arr != null) {
      data = _toJsNumberArray(PyArray_DATA(arr));
    } else {
      if (!Sk.builtin.checkNumber(x)) {
        throw new Sk.builtin.TypeError("cannot perform reduce with flexible type");
      }
      data = [Sk.builtin.asnum$(x)];
    }

    n = data.length;
    if (n === 0) {
      return new Sk.builtin.float_(NaN);
    }

    sorted = data.slice().sort(function (a, b) { return a - b; });
    mid = Math.floor(n / 2);

    if (n % 2 === 1) {
      result = sorted[mid];
    } else {
      // even count: average the two middle elements (numpy's default
      // linear interpolation behaviour for this case)
      result = (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return new Sk.builtin.float_(result);
  };
  median_f.co_varnames = ['a', 'axis', 'out', 'overwrite_input', 'keepdims'];
  median_f.$defaults = [Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.bool.false$, Sk.builtin.bool.false$];
  mod.median = new Sk.builtin.func(median_f);

 var sum_f = function (x, axis, dtype, out, keepdims) {
    Sk.builtin.pyCheckArgs("sum", arguments, 1, 5);
    var ret;
    var sum = new Sk.builtin.float_(0.0); // initialised sum var
    var i = 0;
    var _buffer;
    var length;
    var arr;

    if (axis != null && !Sk.builtin.checkNone(axis)) {
        throw new Sk.builtin.NotImplementedError("the 'axis' parameter is currently not supported");
    }

    if (out != null && !Sk.builtin.checkNone(out)) {
        throw new Sk.builtin.NotImplementedError("the 'out' parameter is currently not supported");
    }

    if (keepdims != null && keepdims != Sk.builtin.bool.false$) {
        throw new Sk.builtin.NotImplementedError("the 'keepdims' parameter is currently not supported");
    }

    // Accept ndarrays as well as plain Python lists/tuples (array-like).
    arr = _coerceArrayLike(x);

    if (arr != null) {
        _buffer = PyArray_DATA(arr);
        length = new Sk.builtin.int_(PyArray_SIZE(arr));

        for (i = 0; i < length.v; i++) {
            sum = Sk.abstr.numberBinOp(sum, _buffer[i], 'Add');
        }
    } else {
        // genuine scalar: sum of a single number is itself
        sum = x
    }

    // apply dtype casting
    if (dtype != null && !Sk.builtin.checkNone(dtype)) {
        sum = Sk.misceval.callsim(dtype, sum);
    }

    // call PyArray_Return
    return sum;
  };
  sum_f.co_varnames = ['a', 'axis', 'dtype', 'out', 'keepdims'];
  sum_f.$defaults = [null, Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.bool.false$];
  mod.sum = new Sk.builtin.func(sum_f);

 var prod_f = function (x, axis, dtype, out, keepdims) {
    Sk.builtin.pyCheckArgs("prod", arguments, 1, 5);
    var ret;
    var prod = new Sk.builtin.float_(1.0); // initialised sum var
    var i = 0;
    var _buffer;
    var length;

    if (axis != null && !Sk.builtin.checkNone(axis)) {
        throw new Sk.builtin.NotImplementedError("the 'axis' parameter is currently not supported");
    }

    if (out != null && !Sk.builtin.checkNone(out)) {
        throw new Sk.builtin.NotImplementedError("the 'out' parameter is currently not supported");
    }

    if (keepdims != null && keepdims != Sk.builtin.bool.false$) {
        throw new Sk.builtin.NotImplementedError("the 'keepdims' parameter is currently not supported");
    }

    // ToDo: check here for array like
    // call PyArrayFromAny

    if (PyArray_Check(x) == true) {
        _buffer = PyArray_DATA(x);
        length = new Sk.builtin.int_(PyArray_SIZE(x));

        for (i = 0; i < length.v; i++) {
            prod = Sk.abstr.numberBinOp(prod, _buffer[i], 'Mult');
        }
    } else {
        // return abs for element by calling abs
        prod = x
    }

    // apply dtype casting
    if (dtype != null && !Sk.builtin.checkNone(dtype)) {
        prod = Sk.misceval.callsim(dtype, prod);
    }

    // call PyArray_Return
    return prod;
  };
  prod_f.co_varnames = ['a', 'axis', 'dtype', 'out', 'keepdims'];
  prod_f.$defaults = [null, Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.bool.false$];
  mod.prod = new Sk.builtin.func(prod_f);


  /**
    Return a new array of given shape and type, filled with ones.
  **/
  var ones_f = function (shape, dtype, order) {
    Sk.builtin.pyCheckArgs("ones", arguments, 1, 3);
    shape = _coerceShapeArg(shape);

    if(!Sk.builtin.checkSequence(shape) && !Sk.builtin.checkInt(shape)) {
      throw new Sk.builtin.TypeError('argument "shape" must int or sequence of ints');
    }

    if (dtype instanceof Sk.builtin.list) {
      throw new Sk.builtin.TypeError("'" + Sk.abstr.typeName(dtype) +
        "' is not supported for dtype.");
    }

    var _one = new Sk.builtin.float_(1.0);
    return Sk.misceval.callsim(mod.full, shape, _one, dtype, order);
  };
  ones_f.co_varnames = ['shape', 'dtype', 'order'];
  ones_f.$defaults = [
    new Sk.builtin.tuple([]), Sk.builtin.none.none$, new Sk.builtin.str('C')
  ];
  mod.ones = new Sk.builtin.func(ones_f);

  /**
    Return a new array of given shape and type, filled with None.
  **/
  var empty_f = function (shape, dtype, order) {
    Sk.builtin.pyCheckArgs("empty", arguments, 1, 3);
    shape = _coerceShapeArg(shape);

    if (!Sk.builtin.checkSequence(shape) && !Sk.builtin.checkInt(shape)) {
      throw new Sk.builtin.TypeError('argument "shape" must int or sequence of ints');
    }

    if (dtype instanceof Sk.builtin.list) {
      throw new Sk.builtin.TypeError("'" + Sk.abstr.typeName(dtype) +
        "' is not supported for dtype.");
    }

    var _empty = Sk.builtin.none.none$;
    return Sk.misceval.callsim(mod.full, shape, _empty, dtype, order);
  };
  empty_f.co_varnames = ['shape', 'dtype', 'order'];
  empty_f.$defaults = [
    new Sk.builtin.tuple([]), Sk.builtin.none.none$, new Sk.builtin.str('C')
  ];
  mod.empty = new Sk.builtin.func(empty_f);

  /**
    Dot product
  **/
  var dot_f = function (a, b, o) {
    Sk.builtin.pyCheckArgs("dot", arguments, 2, 3);
    var o;
    var ret;

    if (Sk.builtin.checkNone(o)) {
        o = null;
    }

    if (o != null && !PyArray_Check(o)) {
        throw new Sk.builtin.TypeError("'out' must be an array");
    }

    ret = MatrixProdcut2(a, b, o);

    // ret is already the full result ndarray (or, for the 0-dim scalar
    // case, a plain scalar). PyArray_Return only needs to unwrap true
    // 0-dim arrays into a Python scalar; for everything else it must
    // return the whole array, not a single flattened element of it.
    return PyArray_Return(ret);
  };
  dot_f.co_varnames = ['a', 'b', 'out'];
  dot_f.$defaults = [Sk.builtin.none.none$,
    Sk.builtin.none.none$, Sk.builtin.none.none$
  ];
  mod.dot = new Sk.builtin.func(dot_f);

  // https://github.com/numpy/numpy/blob/master/numpy/core/src/multiarray/multiarraymodule.c#L2252
  var vdot_f = function(a, b) {
        // a and b must be array like
        // if a or b have more than 1 dim => flatten them
        var typenum; // int
        var ip1;
        var ip2;
        var op;
        var op1 = a;
        var op2 = b;
        var newdimptr = -1;
        var newdims = [-1, 1];
        var ap1 = null;
        var ap2 = null;
        var ret = null;
        var type;
        var vdot;

        typenum = PyArray_ObjectType(op1, 0);

        typenum = PyArray_ObjectType(op2, typenum);


        type = PyArray_DescrFromType(typenum);

        ap1 = PyArray_FromAny(op1, type, 0, 0, 0, null);
        if (ap1 == null) {
            return null;
        }

        // flatten the array
        op1 = PyArray_NewShape(ap1, newdims, 'NPY_CORDER');
        if (op1 == null) {
            return;
        }
        ap1 = op1;

        ap2 = PyArray_FromAny(op2, type, 0, 0, 0, null);
        if (ap2 == null) {
            return null;
        }

        // flatten the array
        op2 = PyArray_NewShape(ap2, newdims, 'NPY_CORDER');
        if (op2 == null) {
            return;
        }
        ap2 = op2;

        if (PyArray_DIM(ap2, 0) != PyArray_DIM(ap1, 0)) {
            throw new Sk.builtin.ValueError('vectors have different lengths');
        }

        var shape = new Sk.builtin.tuple([0].map(
          function (x) {
            return new Sk.builtin.int_(x);
        }));
        // create new empty array for given dimensions
        ret = Sk.misceval.callsim(mod.zeros, shape, type);

        n = PyArray_DIM(ap1, 0);
        stride1 = PyArray_STRIDE(ap1, 0);
        stride2 = PyArray_STRIDE(ap2, 0);
        ip1 = PyArray_DATA(ap1);
        ip2 = PyArray_DATA(ap2);
        op = PyArray_DATA(ret);

        switch(typenum) {
        case 0:
        case 1:
        case 2:
        case 3:
            vdot = OBJECT_vdot;
            break;
        default:
            throw new Sk.builtin.ValueError('function not available for this data type');
        }

        // call vdot function with vectors
        vdot.call(null, ip1, stride1, ip2, stride2, op, n, null);
      
        // return resulting ndarray
        return PyArray_Return(ret.v.buffer[0].v);
  }
  mod.vdot = new Sk.builtin.func(vdot_f);

  var any_f = function(a, axis, out, keepdims) {
    Sk.builtin.pyCheckArgs("any", arguments, 1, 4, false);
    var arr = PyArray_FromAny(a);
    var data = PyArray_DATA(arr);
    var i;
    var b;

    if (axis != undefined && !Sk.builtin.checkNone(axis)) {
        throw new ValueError('"axis" parameter not supported');
    }

    if (out != undefined  && !Sk.builtin.checkNone(out)) {
        throw new ValueError('"out" parameter not supported');
    }

    // iterate over all items and compare
    for (i = 0; i < data.length; i++) {
        b = new Sk.builtin.bool(data[i]);
        if (b == Sk.builtin.bool.true$) {
            return Sk.builtin.bool.true$;
        }
    }

    return Sk.builtin.bool.false$;;
  };
  any_f.co_varnames = ['a', 'axis', 'out', 'keepdims'];
  any_f.$defaults = [Sk.builtin.none.none$,
    Sk.builtin.none.none$, Sk.builtin.bool.false$
  ];
  mod.any = new Sk.builtin.func(any_f);

  var all_f = function(a, axis, out, keepdims) {
    Sk.builtin.pyCheckArgs("all", arguments, 1, 4, false);
    var arr = PyArray_FromAny(a);
    var data = PyArray_DATA(arr);
    var i;
    var b;

    if (axis != undefined && !Sk.builtin.checkNone(axis)) {
        throw new ValueError('"axis" parameter not supported');
    }

    if (out != undefined  && !Sk.builtin.checkNone(out)) {
        throw new ValueError('"out" parameter not supported');
    }

    // iterate over all items and compare
    for (i = 0; i < data.length; i++) {
        b = new Sk.builtin.bool(data[i]);
        if (b == Sk.builtin.bool.false$) {
            return Sk.builtin.bool.false$;
        }
    }

    return Sk.builtin.bool.true$;;
  };
  all_f.co_varnames = ['a', 'axis', 'out', 'keepdims'];
  all_f.$defaults = [Sk.builtin.none.none$,
    Sk.builtin.none.none$, Sk.builtin.bool.false$
  ];
  mod.all = new Sk.builtin.func(all_f);
//

 function compareLogical(binOp, x1, x2, out) {
    var a1 = PyArray_FromAny(x1);
    var a2 = PyArray_FromAny(x2);
    var data1 = PyArray_DATA(a1);
    var data2 = PyArray_DATA(a2);
    var buf = [];
    var ret;
    var shape;

    // Якщо обидва аргументи не є масивами, повертаємо скалярний bool
    if (!PyArray_Check(x1) && !Sk.builtin.checkSequence(x1) && 
        !PyArray_Check(x2) && !Sk.builtin.checkSequence(x2)) {
        return new Sk.builtin.bool(Sk.misceval.richCompareBool(x1, x2, binOp));
    }

    // Перевіряємо, чи можна виконати broadcasting
    if (PyArray_SIZE(a1) !== PyArray_SIZE(a2)) {
        if (PyArray_SIZE(a1) === 1) {
            // Розширюємо a1 до розміру a2
            var val = data1[0];
            data1 = new Array(PyArray_SIZE(a2)).fill(val);
            shape = PyArray_DIMS(a2);
        } else if (PyArray_SIZE(a2) === 1) {
            // Розширюємо a2 до розміру a1
            var val = data2[0];
            data2 = new Array(PyArray_SIZE(a1)).fill(val);
            shape = PyArray_DIMS(a1);
        } else {
            throw new Sk.builtin.ValueError("operands could not be broadcast together with shapes");
        }
    } else {
        shape = PyArray_DIMS(a1);
    }
//
if (out != undefined && !Sk.builtin.checkNone(out)) {
  // Для тесту просто ігнорувати
  // throw new ValueError('"out" parameter not supported');
  out = null;
}

/*
    if (out !== undefined && !Sk.builtin.checkNone(out)) {
        throw new Sk.builtin.ValueError('"out" parameter not supported');
    }
*/


    // Порівнюємо елементи
    for (var i = 0; i < data1.length; i++) {
		
        buf.push(new Sk.builtin.bool(Sk.misceval.richCompareBool(data1[i], data2[i], binOp)));
        
    }

    // Створюємо масив з результатами
    ret = PyArray_FromAny(new Sk.builtin.list(buf));
    ret = PyArray_NewShape(ret, shape, null);
    return PyArray_Return(ret);
    
}

  /**
   * Basic impl. of the comparison function due to the lack of real shape broadcasting
   */
  var less_f = function(x1, x2, out) {
    Sk.builtin.pyCheckArgs("less", arguments, 2, 3, false);
    return compareLogical('Lt', x1, x2, out);
  };
  less_f.co_varnames = ['x1', 'x2', 'out'];
  less_f.$defaults = [Sk.builtin.none.none$];
  mod.less = new Sk.builtin.func(less_f);

  var less_equal_f = function(x1, x2, out) {
    Sk.builtin.pyCheckArgs("less_equal", arguments, 2, 3, false);
    return compareLogical('LtE', x1, x2, out);
  };
  less_equal_f.co_varnames = ['x1', 'x2', 'out'];
  less_equal_f.$defaults = [Sk.builtin.none.none$];
  mod.less_equal = new Sk.builtin.func(less_equal_f);

  var greater_f = function(x1, x2, out) {
    Sk.builtin.pyCheckArgs("greater", arguments, 2, 3, false);
    return compareLogical('Gt', x1, x2, out);
  };
  greater_f.co_varnames = ['x1', 'x2', 'out'];
  greater_f.$defaults = [Sk.builtin.none.none$];
  mod.greater = new Sk.builtin.func(greater_f);

  var greater_equal_f = function(x1, x2, out) {
    Sk.builtin.pyCheckArgs("greater_equal", arguments, 2, 3, false);
    return compareLogical('GtE', x1, x2, out);
  };
  greater_equal_f.co_varnames = ['x1', 'x2', 'out'];
  greater_equal_f.$defaults = [Sk.builtin.none.none$];
  mod.greater_equal = new Sk.builtin.func(greater_equal_f);

  var equal_f = function(x1, x2, out) {
    
    Sk.builtin.pyCheckArgs("equal", arguments, 2, 3, false);
  
    return compareLogical('Eq', x1, x2, out);
  };
  equal_f.co_varnames = ['x1', 'x2', 'out'];
  equal_f.$defaults = [Sk.builtin.none.none$];
  mod.equal = new Sk.builtin.func(equal_f);

  var not_equal_f = function(x1, x2, out) {
    Sk.builtin.pyCheckArgs("not_equal", arguments, 2, 3, false);
    return compareLogical('NotEq', x1, x2, out);
  };
  not_equal_f.co_varnames = ['x1', 'x2', 'out'];
  not_equal_f.$defaults = [Sk.builtin.none.none$];
  mod.not_equal = new Sk.builtin.func(not_equal_f);

  /**
   * Shared elementwise-broadcast helper for the logical_and/or/xor and isclose family.
   * fn(aVal, bVal) receives the raw Sk objects for one pair of (already
   * broadcast) elements and must return a JS true/false.
   * Returns a raw ndarray (0-dim not yet collapsed) - caller decides whether
   * to PyArray_Return() it.
   */
  function elementwiseBroadcast(x1, x2, fn) {
    var a1 = PyArray_FromAny(x1);
    var a2 = PyArray_FromAny(x2);
    var data1 = PyArray_DATA(a1);
    var data2 = PyArray_DATA(a2);
    var shape;

    if (PyArray_SIZE(a1) !== PyArray_SIZE(a2)) {
      if (PyArray_SIZE(a1) === 1) {
        var val1 = data1[0];
        data1 = new Array(PyArray_SIZE(a2)).fill(val1);
        shape = PyArray_DIMS(a2);
      } else if (PyArray_SIZE(a2) === 1) {
        var val2 = data2[0];
        data2 = new Array(PyArray_SIZE(a1)).fill(val2);
        shape = PyArray_DIMS(a1);
      } else {
        throw new Sk.builtin.ValueError(
          "operands could not be broadcast together with shapes " +
          _shapeStr(PyArray_DIMS(a1)) + " " + _shapeStr(PyArray_DIMS(a2)));
      }
    } else {
      shape = PyArray_DIMS(a1);
    }

    var buf = [];
    for (var i = 0; i < data1.length; i++) {
      buf.push(new Sk.builtin.bool(fn(data1[i], data2[i])));
    }

    var ret = PyArray_FromAny(new Sk.builtin.list(buf));
    ret = PyArray_NewShape(ret, shape, null);
    return ret;
  }

  /**
   * Elementwise unary predicate helper for isnan/isinf/isfinite.
   */
  function elementwiseUnaryPredicate(name, x1, predicate) {
    var arr = PyArray_FromAny(x1);
    var data = PyArray_DATA(arr);
    var buf = [];
    var i;
    var val;

    for (i = 0; i < data.length; i++) {
      if (!Sk.builtin.checkNumber(data[i])) {
        throw new Sk.builtin.TypeError(
          "ufunc '" + name + "' not supported for the input types");
      }
      val = Sk.builtin.asnum$(data[i]);
      buf.push(new Sk.builtin.bool(predicate(val)));
    }

    var ret = PyArray_FromAny(new Sk.builtin.list(buf));
    ret = PyArray_NewShape(ret, PyArray_DIMS(arr), null);
    return PyArray_Return(ret);
  }

  var logical_and_f = function (x1, x2, out) {
    Sk.builtin.pyCheckArgs("logical_and", arguments, 2, 3, false);
    var ret = elementwiseBroadcast(x1, x2, function (a, b) {
      return Sk.misceval.isTrue(a) && Sk.misceval.isTrue(b);
    });
    return PyArray_Return(ret);
  };
  logical_and_f.co_varnames = ['x1', 'x2', 'out'];
  logical_and_f.$defaults = [Sk.builtin.none.none$];
  mod.logical_and = new Sk.builtin.func(logical_and_f);

  var logical_or_f = function (x1, x2, out) {
    Sk.builtin.pyCheckArgs("logical_or", arguments, 2, 3, false);
    var ret = elementwiseBroadcast(x1, x2, function (a, b) {
      return Sk.misceval.isTrue(a) || Sk.misceval.isTrue(b);
    });
    return PyArray_Return(ret);
  };
  logical_or_f.co_varnames = ['x1', 'x2', 'out'];
  logical_or_f.$defaults = [Sk.builtin.none.none$];
  mod.logical_or = new Sk.builtin.func(logical_or_f);

  var logical_xor_f = function (x1, x2, out) {
    Sk.builtin.pyCheckArgs("logical_xor", arguments, 2, 3, false);
    var ret = elementwiseBroadcast(x1, x2, function (a, b) {
      return Sk.misceval.isTrue(a) !== Sk.misceval.isTrue(b);
    });
    return PyArray_Return(ret);
  };
  logical_xor_f.co_varnames = ['x1', 'x2', 'out'];
  logical_xor_f.$defaults = [Sk.builtin.none.none$];
  mod.logical_xor = new Sk.builtin.func(logical_xor_f);

  var logical_not_f = function (x1, out) {
    Sk.builtin.pyCheckArgs("logical_not", arguments, 1, 2, false);
    var arr = PyArray_FromAny(x1);
    var data = PyArray_DATA(arr);
    var buf = [];
    var i;

    for (i = 0; i < data.length; i++) {
      buf.push(new Sk.builtin.bool(!Sk.misceval.isTrue(data[i])));
    }

    var ret = PyArray_FromAny(new Sk.builtin.list(buf));
    ret = PyArray_NewShape(ret, PyArray_DIMS(arr), null);
    return PyArray_Return(ret);
  };
  logical_not_f.co_varnames = ['x1', 'out'];
  logical_not_f.$defaults = [Sk.builtin.none.none$];
  mod.logical_not = new Sk.builtin.func(logical_not_f);

  var isnan_f = function (x1, out) {
    Sk.builtin.pyCheckArgs("isnan", arguments, 1, 2, false);
    return elementwiseUnaryPredicate("isnan", x1, function (v) {
      return Number.isNaN(v);
    });
  };
  isnan_f.co_varnames = ['x1', 'out'];
  isnan_f.$defaults = [Sk.builtin.none.none$];
  mod.isnan = new Sk.builtin.func(isnan_f);

  var isinf_f = function (x1, out) {
    Sk.builtin.pyCheckArgs("isinf", arguments, 1, 2, false);
    return elementwiseUnaryPredicate("isinf", x1, function (v) {
      return v === Infinity || v === -Infinity;
    });
  };
  isinf_f.co_varnames = ['x1', 'out'];
  isinf_f.$defaults = [Sk.builtin.none.none$];
  mod.isinf = new Sk.builtin.func(isinf_f);

  var isfinite_f = function (x1, out) {
    Sk.builtin.pyCheckArgs("isfinite", arguments, 1, 2, false);
    return elementwiseUnaryPredicate("isfinite", x1, function (v) {
      return Number.isFinite(v);
    });
  };
  isfinite_f.co_varnames = ['x1', 'out'];
  isfinite_f.$defaults = [Sk.builtin.none.none$];
  mod.isfinite = new Sk.builtin.func(isfinite_f);

  /**
   * Single-value closeness test, numpy semantics:
   * |a - b| <= atol + rtol * |b|
   * NaNs compare unequal unless equal_nan is true; +-Infinity only matches
   * the same signed infinity.
   */
  function isCloseValue(a, b, rtol, atol, equal_nan) {
    if (Number.isNaN(a) || Number.isNaN(b)) {
      return !!equal_nan && Number.isNaN(a) && Number.isNaN(b);
    }
    if (a === b) {
      return true; // handles equal +-Infinity too
    }
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return false;
    }
    return Math.abs(a - b) <= (atol + rtol * Math.abs(b));
  }

  var isclose_f = function (x1, x2, rtol, atol, equal_nan) {
    Sk.builtin.pyCheckArgs("isclose", arguments, 2, 5, false);
    var _rtol = (rtol == null || Sk.builtin.checkNone(rtol)) ? 1e-05 : Sk.builtin.asnum$(rtol);
    var _atol = (atol == null || Sk.builtin.checkNone(atol)) ? 1e-08 : Sk.builtin.asnum$(atol);
    var _equal_nan = (equal_nan == null || Sk.builtin.checkNone(equal_nan)) ? false : Sk.misceval.isTrue(equal_nan);

    var ret = elementwiseBroadcast(x1, x2, function (a, b) {
      if (!Sk.builtin.checkNumber(a) || !Sk.builtin.checkNumber(b)) {
        throw new Sk.builtin.TypeError("ufunc 'isclose' not supported for the input types");
      }
      return isCloseValue(Sk.builtin.asnum$(a), Sk.builtin.asnum$(b), _rtol, _atol, _equal_nan);
    });
    return PyArray_Return(ret);
  };
  isclose_f.co_varnames = ['x1', 'x2', 'rtol', 'atol', 'equal_nan'];
  isclose_f.$defaults = [new Sk.builtin.float_(1e-05), new Sk.builtin.float_(1e-08), Sk.builtin.bool.false$];
  mod.isclose = new Sk.builtin.func(isclose_f);

  var allclose_f = function (x1, x2, rtol, atol, equal_nan) {
    Sk.builtin.pyCheckArgs("allclose", arguments, 2, 5, false);
    var closeArr = Sk.misceval.callsim(mod.isclose, x1, x2, rtol, atol, equal_nan);
    return Sk.misceval.callsim(mod.all, closeArr);
  };
  allclose_f.co_varnames = ['x1', 'x2', 'rtol', 'atol', 'equal_nan'];
  allclose_f.$defaults = [new Sk.builtin.float_(1e-05), new Sk.builtin.float_(1e-08), Sk.builtin.bool.false$];
  mod.allclose = new Sk.builtin.func(allclose_f);

  var array_equal_f = function (x1, x2, equal_nan) {
    Sk.builtin.pyCheckArgs("array_equal", arguments, 2, 3, false);
    var _equal_nan = (equal_nan == null || Sk.builtin.checkNone(equal_nan)) ? false : Sk.misceval.isTrue(equal_nan);

    var a1 = PyArray_FromAny(x1);
    var a2 = PyArray_FromAny(x2);
    var dims1 = PyArray_DIMS(a1);
    var dims2 = PyArray_DIMS(a2);
    var i;

    if (dims1.length !== dims2.length) {
      return Sk.builtin.bool.false$;
    }
    for (i = 0; i < dims1.length; i++) {
      if (dims1[i] !== dims2[i]) {
        return Sk.builtin.bool.false$;
      }
    }

    var data1 = PyArray_DATA(a1);
    var data2 = PyArray_DATA(a2);
    var v1, v2, n1, n2;

    for (i = 0; i < data1.length; i++) {
      v1 = data1[i];
      v2 = data2[i];
      if (Sk.builtin.checkNumber(v1) && Sk.builtin.checkNumber(v2)) {
        n1 = Sk.builtin.asnum$(v1);
        n2 = Sk.builtin.asnum$(v2);
        if (Number.isNaN(n1) && Number.isNaN(n2)) {
          if (!_equal_nan) {
            return Sk.builtin.bool.false$;
          }
          continue;
        }
        if (n1 !== n2) {
          return Sk.builtin.bool.false$;
        }
      } else if (!Sk.misceval.richCompareBool(v1, v2, "Eq")) {
        return Sk.builtin.bool.false$;
      }
    }
    return Sk.builtin.bool.true$;
  };
  array_equal_f.co_varnames = ['x1', 'x2', 'equal_nan'];
  array_equal_f.$defaults = [Sk.builtin.bool.false$];
  mod.array_equal = new Sk.builtin.func(array_equal_f);

  mod.identity = new Sk.builtin.func(function (n, dtype) {
    Sk.builtin.pyCheckArgs("identity", arguments, 1, 2, false);
    //if (dtype == null) {
    //   dtype = Sk.builtin.none.none$;
    //}

    n = new Sk.builtin.int_(n); // convert to int or truncate

    var a;
    var b;
    // [1]+n*[0]
    //var al = Sk.abstr.numberBinOp(new Sk.builtin.list([1]), Sk.abstr.numberBinOp(n, new Sk.builtin.list([0]), 'Mult'), 'Add');
    
    // we cannot use flat iter, just generate n*n array and fill with zeros,
    //a = Sk.misceval.callsim(mod.array, al, dtype);
    b = Sk.misceval.callsim(mod.zeros, new Sk.builtin.tuple([n, n]), dtype);
    // b.flat = a;
    // just iterate over n*n array and increment i and j, usefo
    var i;
    var j;
    var length = Sk.ffi.remapToJs(n);
    
    var dtype = b.dtype;
    if (dtype === Sk.builtin.none.none$ || dtype === undefined) {
        dtype = Sk.builtin.float_;
    }
    //var value = PyArray_DESCR(b)(1);
    var value = Sk.misceval.callsim(dtype, new Sk.builtin.float_(1.0));
    for (i = 0, j = 0; i < length; i++, j++) {
        PyArray_DATA(b)[computeOffset(PyArray_STRIDES(b), [i, j])] = value;
    }

    return b;
  });

  var eye_f = function (N, M, k, dtype) {
    Sk.builtin.pyCheckArgs("eye", arguments, 1, 4, false);

    var Njs = Sk.ffi.remapToJs(new Sk.builtin.int_(N));
    var Mjs = (M == null || Sk.builtin.checkNone(M)) ? Njs : Sk.ffi.remapToJs(new Sk.builtin.int_(M));
    var kjs = (k == null || Sk.builtin.checkNone(k)) ? 0 : Sk.ffi.remapToJs(new Sk.builtin.int_(k));

    var b = Sk.misceval.callsim(mod.zeros,
      new Sk.builtin.tuple([new Sk.builtin.int_(Njs), new Sk.builtin.int_(Mjs)]), dtype);

    var bdtype = b.dtype;
    if (bdtype === Sk.builtin.none.none$ || bdtype === undefined) {
      bdtype = Sk.builtin.float_;
    }
    var value = Sk.misceval.callsim(bdtype, new Sk.builtin.float_(1.0));

    var i, j;
    for (i = 0; i < Njs; i++) {
      j = i + kjs;
      if (j >= 0 && j < Mjs) {
        PyArray_DATA(b)[computeOffset(PyArray_STRIDES(b), [i, j])] = value;
      }
    }

    return b;
  };
  eye_f.co_varnames = ['N', 'M', 'k', 'dtype'];
  eye_f.$defaults = [Sk.builtin.none.none$, new Sk.builtin.int_(0), Sk.builtin.none.none$];
  mod.eye = new Sk.builtin.func(eye_f);

  /* not implemented methods */
  mod.ones_like = new Sk.builtin.func(function () {
    throw new Sk.builtin.NotImplementedError(
      "ones_like is not yet implemented");
  });
  mod.empty_like = new Sk.builtin.func(function () {
    throw new Sk.builtin.NotImplementedError(
      "empty_like is not yet implemented");
  });
  mod.ones_like = new Sk.builtin.func(function () {
    throw new Sk.builtin.NotImplementedError(
      "ones_like is not yet implemented");
  });
  mod.arctan2 = new Sk.builtin.func(function () {
    throw new Sk.builtin.NotImplementedError(
      "arctan2 is not yet implemented");
  });
  mod.asarray = new Sk.builtin.func(array_f);
  
  
  // numpy.random уже реалізовано окремим підмодулем (numpy/random/__init__.js
  // у тому ж пакеті). Раніше цей рядок був закоментований — через це
  // `np.random` не існував як атрибут узагалі. Обгортаємо у try/catch:
  // якщо з якоїсь причини підмодуль не знайдеться (інша збірка,
  // відсутній файл тощо), решта numpy однаково має завантажитися.
  try {
    mod.random = Sk.importModule("numpy.random", false).$d;
  } catch (e) {
    // numpy.random недоступний у цій збірці — np.random просто не буде
    // визначено, решта numpy працює як звичайно.
  }

  // ─── Допоміжна: розпізнати dtype-рядок / тип і повернути Skulpt-конструктор ──
  function _resolve_dtype(dtype) {
    if (dtype === undefined || dtype === null || Sk.builtin.checkNone(dtype))
      return Sk.builtin.float_;
    if (Sk.builtin.checkClass(dtype)) return dtype;
    var s = Sk.ffi.remapToJs(dtype);
    if (typeof s !== 'string') return Sk.builtin.float_;
    switch (s.toLowerCase()) {
      case 'uint8': case 'u1': case 'b':    return Sk.builtin.int_;
      case 'int8':  case 'i1':              return Sk.builtin.int_;
      case 'uint16':case 'u2':              return Sk.builtin.int_;
      case 'int16': case 'i2':              return Sk.builtin.int_;
      case 'uint32':case 'u4':              return Sk.builtin.int_;
      case 'int32': case 'i4': case 'i':    return Sk.builtin.int_;
      case 'int64': case 'i8': case 'l':    return Sk.builtin.int_;
      case 'uint64':case 'u8':              return Sk.builtin.int_;
      case 'float16':case 'f2':             return Sk.builtin.float_;
      case 'float32':case 'f4': case 'f':   return Sk.builtin.float_;
      case 'float64':case 'f8': case 'd':   return Sk.builtin.float_;
      case 'bool':  case '?':               return Sk.builtin.bool;
      default:                              return Sk.builtin.float_;
    }
  }

  function _normalize_dtype_str(dtype) {
    if (dtype === undefined || dtype === null || Sk.builtin.checkNone(dtype))
      return 'float64';
    // Check named dtype aliases on the module first (e.g. np.uint8, np.float32)
    var _dtypeAliases = {
      'uint8':'uint8','int8':'int8','uint16':'uint16','int16':'int16',
      'uint32':'uint32','int32':'int32','uint64':'uint32','int64':'int32',
      'float16':'float32','float32':'float32','float64':'float64',
      'bool_':'uint8','bool8':'uint8'
    };
    for (var _ak in _dtypeAliases) {
      if (mod[_ak] !== undefined && dtype === mod[_ak]) return _dtypeAliases[_ak];
    }
    if (Sk.builtin.checkClass(dtype)) {
      if (dtype === Sk.builtin.int_)   return 'int32';
      if (dtype === Sk.builtin.float_) return 'float64';
      return 'float64';
    }
    var s = Sk.ffi.remapToJs(dtype);
    if (typeof s !== 'string') return 'float64';
    var m = {
      'uint8':'uint8','u1':'uint8','b':'uint8',
      'int8':'int8','i1':'int8',
      'uint16':'uint16','u2':'uint16',
      'int16':'int16','i2':'int16',
      'uint32':'uint32','u4':'uint32',
      'int32':'int32','i4':'int32','i':'int32',
      'int64':'int32','i8':'int32','l':'int32',
      'uint64':'uint32','u8':'uint32',
      'float16':'float32','f2':'float32',
      'float32':'float32','f4':'float32','f':'float32',
      'float64':'float64','f8':'float64','d':'float64',
      'bool':'uint8','?':'uint8',
    };
    return m[s.toLowerCase()] || 'float64';
  }

  // ─── Допоміжна: bytes-подібний Skulpt-об'єкт → JS Uint8Array ────────────────
  function _skulpt_to_uint8(data) {
    var v = data.v;
    if (v instanceof Uint8Array || v instanceof Uint8ClampedArray)
      return new Uint8Array(v);
    if (Array.isArray(v)) {
      var a = new Uint8Array(v.length);
      for (var i = 0; i < v.length; i++)
        a[i] = (typeof v[i] === 'number') ? (v[i] & 0xff)
              : (Sk.ffi.remapToJs(v[i]) & 0xff);
      return a;
    }
    if (typeof v === 'string') {
      var a2 = new Uint8Array(v.length);
      for (var i = 0; i < v.length; i++) a2[i] = v.charCodeAt(i) & 0xff;
      return a2;
    }
    throw new Sk.builtin.TypeError(
      'Expected bytes or bytearray, got ' + Sk.abstr.typeName(data));
  }

  // ─── Допоміжна: читання числа з Uint8Array за dtype та зміщенням ─────────────
  function _read_typed(raw, byteOffset, dtypeStr) {
    var tmp = raw.buffer
      ? new DataView(raw.buffer, raw.byteOffset || 0)
      : new DataView(new Uint8Array(raw).buffer);
    var off = byteOffset;
    switch (dtypeStr) {
      case 'uint8':   return raw[off];
      case 'int8':    return tmp.getInt8(off);
      case 'uint16':  return tmp.getUint16(off, true);
      case 'int16':   return tmp.getInt16(off, true);
      case 'uint32':  return tmp.getUint32(off, true);
      case 'int32':   return tmp.getInt32(off, true);
      case 'float32': return tmp.getFloat32(off, true);
      case 'float64': return tmp.getFloat64(off, true);
      default:        return raw[off];
    }
  }

  function _dtype_itemsize(dtypeStr) {
    switch (dtypeStr) {
      case 'uint8':  case 'int8':               return 1;
      case 'uint16': case 'int16':              return 2;
      case 'uint32': case 'int32':
      case 'float32':                           return 4;
      case 'float64': case 'int64':
      case 'uint64':                            return 8;
      default: return 1;
    }
  }


// ─── np.frombuffer(buffer, dtype='float64', count=-1, offset=0) ──────────────
var _frombuffer_f = function(buffer, dtype, count, offset) {
    // ВИПРАВЛЕНО: прибрано підкреслення у назвах функцій
    var dtypeStr  = _normalize_dtype_str(dtype);
    var dtypeCtor = _resolve_dtype(dtype);
    
    var byteOff   = (offset !== undefined && !Sk.builtin.checkNone(offset)) 
                    ? Sk.ffi.remapToJs(offset) : 0;
    var countJs   = (count !== undefined && !Sk.builtin.checkNone(count)) 
                    ? Sk.ffi.remapToJs(count) : -1;
                    
    var raw = _skulpt_to_uint8(buffer);
    var bpe = _dtype_itemsize(dtypeStr);
    var available = Math.floor((raw.length - byteOff) / bpe);
    var n = (countJs < 0) ? available : countJs;

    if (n > available) {
        throw new Sk.builtin.ValueError('buffer is smaller than requested size');
    }

    var pyList = [];
    for (var i = 0; i < n; i++) {
        var val = _read_typed(raw, byteOff + i * bpe, dtypeStr);
        pyList.push(Sk.misceval.callsim(dtypeCtor, Sk.ffi.remapToPy(val)));
    }
    
    var pyShape  = new Sk.builtin.tuple([new Sk.builtin.int_(n)]);
    var pyBuffer = new Sk.builtin.list(pyList);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtypeCtor, pyBuffer);
};
_frombuffer_f.co_varnames = ['buffer', 'dtype', 'count', 'offset'];
_frombuffer_f.$defaults = [Sk.builtin.none.none$, new Sk.builtin.str('float64'), new Sk.builtin.int_(-1), new Sk.builtin.int_(0)];
mod.frombuffer = new Sk.builtin.func(_frombuffer_f);


// ─── np.fromstring(string, dtype='float64', count=-1, sep='') ────────────────
var _fromstring_f = function(string, dtype, count, sep) {
    var hasSep  = (sep !== undefined && !Sk.builtin.checkNone(sep));
    var sepStr  = hasSep ? Sk.ffi.remapToJs(sep) : '';
    
    // ВИПРАВЛЕНО: прибрано підкреслення
    var dtypeCtor = _resolve_dtype(dtype); 
    
    var countJs   = (count !== undefined && !Sk.builtin.checkNone(count)) 
                    ? Sk.ffi.remapToJs(count) : -1;
                    
    if (!hasSep || sepStr === '') {
        // binary mode
        return Sk.misceval.callsim(mod.frombuffer, string, dtype,
            count !== undefined ? count : new Sk.builtin.int_(-1),
            new Sk.builtin.int_(0));
    }

    // text mode
    var s     = Sk.ffi.remapToJs(string);
    var parts = s.split(sepStr).filter(function(x){ return x.trim() !== ''; });
    var n     = (countJs < 0) ? parts.length : Math.min(countJs, parts.length);
    
    var pyList = [];
    for (var i = 0; i < n; i++) {
        var num = parseFloat(parts[i]);
        pyList.push(Sk.misceval.callsim(dtypeCtor, Sk.ffi.remapToPy(num)));
    }
    
    var pyShape  = new Sk.builtin.tuple([new Sk.builtin.int_(pyList.length)]);
    var pyBuffer = new Sk.builtin.list(pyList);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtypeCtor, pyBuffer);
};
_fromstring_f.co_varnames = ['string', 'dtype', 'count', 'sep'];
_fromstring_f.$defaults = [Sk.builtin.none.none$, new Sk.builtin.str('float64'), new Sk.builtin.int_(-1), new Sk.builtin.str('')];
mod.fromstring = new Sk.builtin.func(_fromstring_f);


  // ─── np.concatenate((a1, a2, ...), axis=0) ───────────────────────────────────
  var _concatenate_f = function(arrays, axis) {
    var axisJs = (axis !== undefined && !Sk.builtin.checkNone(axis))
                 ? Sk.ffi.remapToJs(axis) : 0;
    var arrs = Sk.ffi.remapToJs(arrays);
    if (!arrs.length)
      throw new Sk.builtin.ValueError('need at least one array to concatenate');

    var first  = arrs[0];
    var dtype  = PyArray_DESCR(first);
    var shape0 = PyArray_DIMS(first).slice();
    var combined = [];
    for (var i = 0; i < arrs.length; i++) {
      var data = PyArray_DATA(arrs[i]);
      for (var j = 0; j < data.length; j++) combined.push(data[j]);
    }
    var newShape = shape0.slice();
    newShape[axisJs] = 0;
    for (var i = 0; i < arrs.length; i++)
      newShape[axisJs] += PyArray_DIMS(arrs[i])[axisJs];

    var pyShape = new Sk.builtin.tuple(
      newShape.map(function(x){ return new Sk.builtin.int_(x); }));
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(combined));
  };

  _concatenate_f.co_varnames = ['arrays', 'axis'];
  _concatenate_f.$defaults = [Sk.builtin.none.none$, new Sk.builtin.int_(0)];
  mod.concatenate = new Sk.builtin.func(_concatenate_f);


  // ─── np.stack(arrays, axis=0) ────────────────────────────────────────────────
  var _stack_f = function(arrays, axis) {
    var axisJs = (axis !== undefined && !Sk.builtin.checkNone(axis))
                 ? Sk.ffi.remapToJs(axis) : 0;
    var arrs  = Sk.ffi.remapToJs(arrays);
    if (!arrs.length)
      throw new Sk.builtin.ValueError('need at least one array to stack');
    var first = arrs[0];
    var dtype = PyArray_DESCR(first);
    var shape0 = PyArray_DIMS(first).slice();
    var combined = [];
    for (var i = 0; i < arrs.length; i++) {
      var data = PyArray_DATA(arrs[i]);
      for (var j = 0; j < data.length; j++) combined.push(data[j]);
    }
    var newShape = shape0.slice();
    newShape.splice(axisJs, 0, arrs.length);
    var pyShape = new Sk.builtin.tuple(
      newShape.map(function(x){ return new Sk.builtin.int_(x); }));
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(combined));
  };

  _stack_f.co_varnames = ['arrays', 'axis'];
  _stack_f.$defaults = [Sk.builtin.none.none$, new Sk.builtin.int_(0)];
  mod.stack = new Sk.builtin.func(_stack_f);


  // ─── np.hstack / np.vstack ───────────────────────────────────────────────────
  mod.hstack = new Sk.builtin.func(function(arrays) {
    return Sk.misceval.callsim(mod.concatenate, arrays, new Sk.builtin.int_(1));
  });
  mod.vstack = new Sk.builtin.func(function(arrays) {
    return Sk.misceval.callsim(mod.concatenate, arrays, new Sk.builtin.int_(0));
  });

  // ─── np.clip(a, a_min, a_max) ────────────────────────────────────────────────
  // ─── np.clip(a, a_min, a_max) ────────────────────────────────────────────────
  var _clip_f = function(a, a_min, a_max) {
    var mn    = Sk.ffi.remapToJs(a_min);
    var mx    = Sk.ffi.remapToJs(a_max);
    var arr   = PyArray_Check(a) ? a : Sk.misceval.callsim(mod.array, a);
    var dtype = PyArray_DESCR(arr);
    var src   = PyArray_DATA(arr);
    var newBuf = [], i, n;
    for (i = 0; i < src.length; i++) {
      n = Sk.ffi.remapToJs(src[i]);
      newBuf.push(Sk.misceval.callsim(dtype,
        Sk.ffi.remapToPy(n < mn ? mn : n > mx ? mx : n)));
    }
    var dims = PyArray_DIMS(arr);
    var pyShape = new Sk.builtin.tuple([new Sk.builtin.int_(dims[0])]);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(newBuf));
  };
  _clip_f.co_varnames = ['a', 'a_min', 'a_max'];
  _clip_f.$defaults = [Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.none.none$];
  mod.clip = new Sk.builtin.func(_clip_f);

  // ─── np.where(condition[, x, y]) ─────────────────────────────────────────────
  var _where_f = function(condition, x, y) {
    var cond     = PyArray_Check(condition)
                   ? condition : Sk.misceval.callsim(mod.array, condition);
    var condData = PyArray_DATA(cond);
    var hasVals  = (x !== undefined && !Sk.builtin.checkNone(x) &&
                    y !== undefined && !Sk.builtin.checkNone(y));
    var i, dims = PyArray_DIMS(cond);
    if (!hasVals) {
      var idxs = [];
      for (i = 0; i < condData.length; i++)
        if (Sk.ffi.remapToJs(condData[i])) idxs.push(new Sk.builtin.int_(i));
      var idxShape = new Sk.builtin.tuple([new Sk.builtin.int_(idxs.length)]);
      return new Sk.builtin.tuple([
        Sk.misceval.callsim(mod[CLASS_NDARRAY], idxShape,
          Sk.builtin.int_, new Sk.builtin.list(idxs))
      ]);
    }
    var xData = PyArray_Check(x) ? PyArray_DATA(x) : null;
    var yData = PyArray_Check(y) ? PyArray_DATA(y) : null;
    var dtype  = PyArray_DESCR(cond);
    var buf = [];
    for (i = 0; i < condData.length; i++) {
      buf.push(Sk.ffi.remapToJs(condData[i])
        ? (xData ? xData[i] : x)
        : (yData ? yData[i] : y));
    }
    var pyShape = new Sk.builtin.tuple([new Sk.builtin.int_(dims[0])]);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(buf));
  };
  _where_f.co_varnames = ['condition', 'x', 'y'];
  _where_f.$defaults = [Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.none.none$];
  mod.where = new Sk.builtin.func(_where_f);

  // ─── np.unique(a) ────────────────────────────────────────────────────────────
  var _unique_f = function(a) {
    var arr   = PyArray_Check(a) ? a : Sk.misceval.callsim(mod.array, a);
    var data  = PyArray_DATA(arr);
    var dtype = PyArray_DESCR(arr);
    var seen  = {}, uniqs = [], i, j, key;
    for (i = 0; i < data.length; i++) {
      var k = Sk.ffi.remapToJs(data[i]) + '';
      if (!seen[k]) { seen[k] = true; uniqs.push(data[i]); }
    }
    for (i = 1; i < uniqs.length; i++) {
      key = uniqs[i]; j = i - 1;
      while (j >= 0 && Sk.ffi.remapToJs(uniqs[j]) > Sk.ffi.remapToJs(key)) {
        uniqs[j + 1] = uniqs[j]; j--;
      }
      uniqs[j + 1] = key;
    }
    var pyShape = new Sk.builtin.tuple([new Sk.builtin.int_(uniqs.length)]);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(uniqs));
  };
  _unique_f.co_varnames = ['a'];
  _unique_f.$defaults = [Sk.builtin.none.none$];
  mod.unique = new Sk.builtin.func(_unique_f);

  // ─── np.sort(a) ──────────────────────────────────────────────────────────────
  var _sort_f = function(a) {
    var arr   = PyArray_Check(a) ? a : Sk.misceval.callsim(mod.array, a);
    var dtype = PyArray_DESCR(arr);
    var data  = PyArray_DATA(arr).slice(), i, j, tmp;
    for (i = 1; i < data.length; i++) {
      tmp = data[i]; j = i - 1;
      while (j >= 0 && Sk.ffi.remapToJs(data[j]) > Sk.ffi.remapToJs(tmp)) {
        data[j + 1] = data[j]; j--;
      }
      data[j + 1] = tmp;
    }
    var dims = PyArray_DIMS(arr);
    var pyShape = new Sk.builtin.tuple([new Sk.builtin.int_(dims[0])]);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(data));
  };
  _sort_f.co_varnames = ['a'];
  _sort_f.$defaults = [Sk.builtin.none.none$];
  mod.sort = new Sk.builtin.func(_sort_f);

  // ─── np.argsort(a) ───────────────────────────────────────────────────────────
  var _argsort_f = function(a) {
    var arr  = PyArray_Check(a) ? a : Sk.misceval.callsim(mod.array, a);
    var data = PyArray_DATA(arr);
    var idxs = [], pyIdxs = [], i, j, tmp;
    for (i = 0; i < data.length; i++) idxs.push(i);
    for (i = 1; i < idxs.length; i++) {
      tmp = idxs[i]; j = i - 1;
      while (j >= 0 && Sk.ffi.remapToJs(data[idxs[j]]) > Sk.ffi.remapToJs(data[tmp])) {
        idxs[j + 1] = idxs[j]; j--;
      }
      idxs[j + 1] = tmp;
    }
    for (i = 0; i < idxs.length; i++) pyIdxs.push(new Sk.builtin.int_(idxs[i]));
    var pyShape = new Sk.builtin.tuple([new Sk.builtin.int_(pyIdxs.length)]);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape,
      Sk.builtin.int_, new Sk.builtin.list(pyIdxs));
  };
  _argsort_f.co_varnames = ['a'];
  _argsort_f.$defaults = [Sk.builtin.none.none$];
  mod.argsort = new Sk.builtin.func(_argsort_f);


  // ─── np.max / np.min / np.argmax / np.argmin ─────────────────────────────────
  function _flat_reduce(a, cmp) {
    var arr  = PyArray_Check(a) ? a : Sk.misceval.callsim(mod.array, a);
    var data = PyArray_DATA(arr);
    if (!data.length) throw new Sk.builtin.ValueError('zero-size array');
    var best = Sk.ffi.remapToJs(data[0]), bestI = 0;
    for (var i = 1; i < data.length; i++) {
      var v = Sk.ffi.remapToJs(data[i]);
      if (cmp(v, best)) { best = v; bestI = i; }
    }
    return { val: best, idx: bestI, dtype: PyArray_DESCR(arr) };
  }
  mod.max = new Sk.builtin.func(function(a) {
    var r = _flat_reduce(a, function(v, b){ return v > b; });
    return Sk.misceval.callsim(r.dtype, Sk.ffi.remapToPy(r.val));
  });
  mod.min = new Sk.builtin.func(function(a) {
    var r = _flat_reduce(a, function(v, b){ return v < b; });
    return Sk.misceval.callsim(r.dtype, Sk.ffi.remapToPy(r.val));
  });
  mod.amax   = mod.max;
  mod.amin   = mod.min;
  mod.argmax = new Sk.builtin.func(function(a) {
    return new Sk.builtin.int_(
      _flat_reduce(a, function(v, b){ return v > b; }).idx);
  });
  mod.argmin = new Sk.builtin.func(function(a) {
    return new Sk.builtin.int_(
      _flat_reduce(a, function(v, b){ return v < b; }).idx);
  });

  // ─── np.cumsum(a) ────────────────────────────────────────────────────────────
  // ─── np.cumsum(a) ──────────────────────────────────────────────────────────────────────────────
  var _cumsum_f = function(a) {
    var arr   = PyArray_Check(a) ? a : Sk.misceval.callsim(mod.array, a);
    var dtype = PyArray_DESCR(arr);
    var data  = PyArray_DATA(arr);
    var acc   = 0, buf = [], i;
    for (i = 0; i < data.length; i++) {
      acc += Sk.ffi.remapToJs(data[i]);
      buf.push(Sk.misceval.callsim(dtype, Sk.ffi.remapToPy(acc)));
    }
    var pyShape = new Sk.builtin.tuple([new Sk.builtin.int_(buf.length)]);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(buf));
  };
  _cumsum_f.co_varnames = ['a'];
  _cumsum_f.$defaults = [Sk.builtin.none.none$];
  mod.cumsum = new Sk.builtin.func(_cumsum_f);


  // ─── np.diff(a, n=1) ─────────────────────────────────────────────────────────
  var _diff_f = function(a, n) {
    var arr   = PyArray_Check(a) ? a : Sk.misceval.callsim(mod.array, a);
    var dtype = PyArray_DESCR(arr);
    var data  = PyArray_DATA(arr).slice();
    var times = (n !== undefined && !Sk.builtin.checkNone(n))
                ? Sk.ffi.remapToJs(n) : 1;
    for (var t = 0; t < times; t++) {
      var next = [];
      for (var i = 1; i < data.length; i++) {
        var d = Sk.ffi.remapToJs(data[i]) - Sk.ffi.remapToJs(data[i - 1]);
        next.push(Sk.misceval.callsim(dtype, Sk.ffi.remapToPy(d)));
      }
      data = next;
    }
    var pyShape = new Sk.builtin.tuple([new Sk.builtin.int_(data.length)]);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(data));
  };

  _diff_f.co_varnames = ['a', 'n'];
  _diff_f.$defaults = [Sk.builtin.none.none$, new Sk.builtin.int_(1)];
  mod.diff = new Sk.builtin.func(_diff_f);


  // ─── np.tile(A, reps) ────────────────────────────────────────────────────────
  var _tile_f = function(A, reps) {
    var arr   = PyArray_Check(A) ? A : Sk.misceval.callsim(mod.array, A);
    var data  = PyArray_DATA(arr);
    var dtype = PyArray_DESCR(arr);
    var r     = Sk.builtin.checkInt(reps)
                ? Sk.ffi.remapToJs(reps)
                : Sk.ffi.remapToJs(reps)[0];
    var buf = [];
    for (var i = 0; i < r; i++)
      for (var j = 0; j < data.length; j++) buf.push(data[j]);
    var pyShape = new Sk.builtin.tuple([new Sk.builtin.int_(buf.length)]);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(buf));
  };

  _tile_f.co_varnames = ['A', 'reps'];
  _tile_f.$defaults = [Sk.builtin.none.none$, Sk.builtin.none.none$];
  mod.tile = new Sk.builtin.func(_tile_f);


  // ─── np.repeat(a, repeats) ───────────────────────────────────────────────────
  var _repeat_f = function(a, repeats) {
    var arr   = PyArray_Check(a) ? a : Sk.misceval.callsim(mod.array, a);
    var data  = PyArray_DATA(arr);
    var dtype = PyArray_DESCR(arr);
    var r     = Sk.ffi.remapToJs(repeats);
    var buf   = [];
    for (var i = 0; i < data.length; i++) {
      var cnt = Array.isArray(r) ? r[i] : r;
      for (var j = 0; j < cnt; j++) buf.push(data[i]);
    }
    var pyShape = new Sk.builtin.tuple([new Sk.builtin.int_(buf.length)]);
    return Sk.misceval.callsim(mod[CLASS_NDARRAY], pyShape, dtype,
      new Sk.builtin.list(buf));
  };

  _repeat_f.co_varnames = ['a', 'repeats'];
  _repeat_f.$defaults = [Sk.builtin.none.none$, Sk.builtin.none.none$];
  mod.repeat = new Sk.builtin.func(_repeat_f);


  // ─── np.uint8 / np.int32 / np.float32 тощо — dtype-конструктори ──────────────
  mod.uint8   = Sk.builtin.int_;
  mod.int8    = Sk.builtin.int_;
  mod.int16   = Sk.builtin.int_;
  mod.uint16  = Sk.builtin.int_;
  mod.int32   = Sk.builtin.int_;
  mod.uint32  = Sk.builtin.int_;
  mod.int64   = Sk.builtin.int_;
  mod.uint64  = Sk.builtin.int_;
  mod.float16 = Sk.builtin.float_;
  mod.float32 = Sk.builtin.float_;
  mod.float64 = Sk.builtin.float_;
  mod.bool_   = Sk.builtin.bool;
  mod.bool8   = Sk.builtin.bool;

  // ─── Файлові операції: np.save / np.load / np.savetxt / np.loadtxt ───────────
  // Реалізовано через Sk.__jsfs (window.FileSystem), оскільки в браузері немає
  // реального диска. Формат .npy тут не бінарний, а JSON-обгортка з тими самими
  // полями (shape/dtype/data) — головне, щоб save+load давали той самий масив.

  function _ensureJsfs() {
    if (!Sk.__jsfs) {
      console.log("Ініціалізація файлової системи");
      Sk.__jsfs = new window.FileSystem("epythonfs");
    }
    return Sk.__jsfs;
  }

  function _ioError(msg) {
    if (Sk.builtin.IOError) {
      return new Sk.builtin.IOError(msg);
    }
    return new Sk.builtin.Exception(msg);
  }

  function _nestFromFlat(flat, shape, dtypeClass, idxRef) {
    if (shape.length === 0) {
      var v = flat[idxRef.i++];
      if (dtypeClass === Sk.builtin.int_) {
        return new Sk.builtin.int_(Math.trunc(v));
      } else if (dtypeClass === Sk.builtin.bool) {
        return new Sk.builtin.bool(!!v);
      } else {
        return new Sk.builtin.float_(v);
      }
    }
    var n = shape[0];
    var rest = shape.slice(1);
    var arr = [];
    var i;
    for (i = 0; i < n; i++) {
      arr.push(_nestFromFlat(flat, rest, dtypeClass, idxRef));
    }
    return new Sk.builtin.list(arr);
  }

  function _npyFilename(name) {
    if (name.slice(-4) !== '.npy') {
      return name + '.npy';
    }
    return name;
  }

  /* numpy.save(file, arr) */
  var save_f = function (file, arr) {
    Sk.builtin.pyCheckArgs("save", arguments, 2, 2);
    var fs = _ensureJsfs();
    var fname = _npyFilename(Sk.ffi.remapToJs(file));

    var pyArr = PyArray_Check(arr) ? arr : Sk.misceval.callsim(mod.array, arr);
    var flatData = PyArray_DATA(pyArr).map(function (x) {
      return Sk.ffi.remapToJs(x);
    });

    var payload = {
      shape: PyArray_DIMS(pyArr),
      dtype: _normalize_dtype_str(PyArray_DESCR(pyArr)),
      data: flatData
    };

    try {
      fs.write(fname, JSON.stringify(payload));
    } catch (e) {
      throw _ioError("Cannot save array to '" + fname + "': " + e.message);
    }

    return Sk.builtin.none.none$;
  };
  save_f.co_varnames = ['file', 'arr'];
  mod.save = new Sk.builtin.func(save_f);

  /* numpy.load(file) */
  var load_f = function (file) {
    Sk.builtin.pyCheckArgs("load", arguments, 1, 1);
    var fs = _ensureJsfs();
    var rawName = Sk.ffi.remapToJs(file);

    var content;
    try {
      content = fs.read(rawName);
    } catch (e1) {
      try {
        content = fs.read(_npyFilename(rawName));
      } catch (e2) {
        throw _ioError("No such file: '" + rawName + "'");
      }
    }

    var payload;
    try {
      payload = (typeof content === 'string') ? JSON.parse(content) : content;
    } catch (e) {
      throw _ioError("Cannot parse '" + rawName + "' as a saved array");
    }

    var dtypeClass = _resolve_dtype(payload.dtype);
    var nested = _nestFromFlat(payload.data, payload.shape, dtypeClass, {i: 0});

    return Sk.misceval.callsim(mod.array, nested, dtypeClass);
  };
  load_f.co_varnames = ['file'];
  mod.load = new Sk.builtin.func(load_f);

  /* light-weight printf-style number formatting for savetxt (%d, %f, %e, %g) */
  function _formatNumberLikeC(value, fmt) {
    var m = fmt.match(/%[-+0 #]*\d*(?:\.(\d+))?([diouxXeEfFgGsc])/);
    if (!m) {
      return String(value);
    }
    var precision = m[1] !== undefined ? parseInt(m[1], 10) : undefined;
    var conv = m[2];

    switch (conv) {
      case 'd': case 'i': case 'u':
        return String(Math.trunc(value));
      case 'f': case 'F':
        return value.toFixed(precision !== undefined ? precision : 6);
      case 'e': case 'E': {
        var p = precision !== undefined ? precision : 6;
        var s = value.toExponential(p);
        var em = s.match(/^(-?\d(?:\.\d+)?)e([+-])(\d+)$/);
        if (em) {
          var expDigits = em[3];
          if (expDigits.length < 2) {
            expDigits = "0" + expDigits;
          }
          s = em[1] + (conv === 'E' ? 'E' : 'e') + em[2] + expDigits;
        }
        return s;
      }
      case 'g': case 'G':
        return String(parseFloat(value.toPrecision(precision !== undefined ? precision : 6)));
      default:
        return String(value);
    }
  }

  /* numpy.savetxt(fname, X, fmt='%.18e', delimiter=' ', newline='\n', header='', footer='', comments='# ') */
  var savetxt_f = function () {
    var args = Array.prototype.slice.call(arguments);
    var p_args = parseArgs(args);
    var pos_args = p_args[0];
    var props = p_args[1] || {};
    Sk.builtin.pyCheckArgs("savetxt", pos_args, 2, 2);
    var fname = pos_args[0];
    var X = pos_args[1];
    var fmt = props.fmt !== undefined ? Sk.ffi.remapToJs(props.fmt) : '%.18e';
    var delimiter = props.delimiter !== undefined ? Sk.ffi.remapToJs(props.delimiter) : ' ';
    var newline = props.newline !== undefined ? Sk.ffi.remapToJs(props.newline) : '\n';
    var header = props.header !== undefined ? Sk.ffi.remapToJs(props.header) : '';
    var footer = props.footer !== undefined ? Sk.ffi.remapToJs(props.footer) : '';
    var comments = props.comments !== undefined ? Sk.ffi.remapToJs(props.comments) : '# ';

    var fs = _ensureJsfs();
    var pyArr = PyArray_Check(X) ? X : Sk.misceval.callsim(mod.array, X);
    var nd = PyArray_NDIM(pyArr);
    var dims = PyArray_DIMS(pyArr);
    var data = PyArray_DATA(pyArr);

    var rows = [];
    var i, j;
    if (nd === 1) {
      var line = [];
      for (i = 0; i < dims[0]; i++) {
        line.push(_formatNumberLikeC(Sk.ffi.remapToJs(data[i]), fmt));
      }
      rows.push(line.join(delimiter));
    } else if (nd === 2) {
      var strides = PyArray_STRIDES(pyArr);
      for (i = 0; i < dims[0]; i++) {
        var rowVals = [];
        for (j = 0; j < dims[1]; j++) {
          var idx = i * strides[0] + j * strides[1];
          rowVals.push(_formatNumberLikeC(Sk.ffi.remapToJs(data[idx]), fmt));
        }
        rows.push(rowVals.join(delimiter));
      }
    } else {
      throw new Sk.builtin.ValueError("Expected 1D or 2D array, got " + nd + "D array instead");
    }

    var text = '';
    if (header) {
      text += comments + header + newline;
    }
    text += rows.join(newline) + newline;
    if (footer) {
      text += comments + footer + newline;
    }

    try {
      fs.write(Sk.ffi.remapToJs(fname), text);
    } catch (e) {
      throw _ioError("Cannot write to '" + Sk.ffi.remapToJs(fname) + "': " + e.message);
    }

    return Sk.builtin.none.none$;
  };
  savetxt_f.co_kwargs = true;
  savetxt_f.co_varnames = ['fname', 'X'];
  mod.savetxt = new Sk.builtin.func(savetxt_f);

  /* numpy.loadtxt(fname, dtype=float, delimiter=None, comments='#', skiprows=0) */
  var loadtxt_f = function () {
    var args = Array.prototype.slice.call(arguments);
    var p_args = parseArgs(args);
    var pos_args = p_args[0];
    var props = p_args[1] || {};
    Sk.builtin.pyCheckArgs("loadtxt", pos_args, 1, 1);
    var fname = pos_args[0];
    var dtypeClass = _resolve_dtype(props.dtype);
    var delimiter = props.delimiter !== undefined && !Sk.builtin.checkNone(props.delimiter) ?
      Sk.ffi.remapToJs(props.delimiter) : null;
    var comments = props.comments !== undefined ? Sk.ffi.remapToJs(props.comments) : '#';
    var skiprows = props.skiprows !== undefined ? Sk.ffi.remapToJs(props.skiprows) : 0;

    var fs = _ensureJsfs();
    var rawName = Sk.ffi.remapToJs(fname);
    var content;
    try {
      content = fs.read(rawName);
    } catch (e) {
      throw _ioError("No such file: '" + rawName + "'");
    }
    if (typeof content !== 'string') {
      content = String(content);
    }

    var lines = content.split('\n');
    var rows = [];
    var i;
    for (i = skiprows; i < lines.length; i++) {
      var line = lines[i];
      var commentIdx = comments ? line.indexOf(comments) : -1;
      if (commentIdx !== -1) {
        line = line.slice(0, commentIdx);
      }
      line = line.trim();
      if (line.length === 0) {
        continue;
      }
      var parts = delimiter ? line.split(delimiter) : line.split(/\s+/);
      var rowVals = parts
        .map(function (p) { return p.trim(); })
        .filter(function (p) { return p.length > 0; })
        .map(function (p) { return parseFloat(p); });
      rows.push(rowVals);
    }

    if (rows.length === 0) {
      return Sk.misceval.callsim(mod.array, new Sk.builtin.list([]), dtypeClass);
    }

    var flat, shape;
    if (rows.length === 1) {
      flat = rows[0];
      shape = [flat.length];
    } else if (rows.every(function (r) { return r.length === 1; })) {
      flat = rows.map(function (r) { return r[0]; });
      shape = [flat.length];
    } else {
      flat = [];
      rows.forEach(function (r) { flat = flat.concat(r); });
      shape = [rows.length, rows[0].length];
    }

    var nested = _nestFromFlat(flat, shape, dtypeClass, {i: 0});
    return Sk.misceval.callsim(mod.array, nested, dtypeClass);
  };
  loadtxt_f.co_kwargs = true;
  loadtxt_f.co_varnames = ['fname'];
  mod.loadtxt = new Sk.builtin.func(loadtxt_f);

  return mod;
};
