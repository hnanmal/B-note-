# src/core/fp_utils.py
import re

################Module For Functional Programing#########################
from functools import reduce
from itertools import chain
from itertools import groupby
from copy import deepcopy

curry = lambda f: lambda a, *args: (
    f(a, *args) if (len(args)) else lambda *args: f(a, *args)
)

filter, map, reduce = curry(filter), curry(map), curry(reduce)

go = lambda *args: reduce(lambda a, f: f(a), args)  ## 함수도 축약 가능 ##


def tap(fn, x):
    return lambda x: (fn(x), x)[1]


def trace(label):
    return tap(lambda x: print(f"[{label}]:", x))


def dictUpdate(dic1, dic2):
    dic1.update(dic2)
    return dic1


def dictsMerge(dics):
    res = reduce(dictUpdate, dics)
    return res


def dictDeleteKeys(dic, keys):
    for k in keys:
        del dic[k]
    return dic


def update_nested_dict(dictionary, keys, value):
    current_dict = dictionary
    for key in keys[:-1]:
        current_dict = current_dict.setdefault(key, {})
    current_dict[keys[-1]] = value


def flat(a):
    if isinstance(a, list):
        for i in a:
            yield from flat(i)
    else:
        yield a


def grpBy(iter, key):
    f, grpKeys, grps = key, [], []
    sorted_ = sorted(iter, key=f)
    for key, grp_data in groupby(sorted_, key=f):
        grpKeys.append(key)
        grps.append(list(grp_data))
    return grps, grpKeys


#########################################################################


# def sort_func(input):
#     try:
#         try:
#             if re.match(r"^\d+", input["name"]):  # 문자열이 숫자로 시작하는 경우만 변환
#                 res = go(
#                     re.split(r"(\d+)", input["name"]),
#                     filter(lambda x: x.isdigit()),
#                     next,
#                     int,
#                     chr,
#                 )
#                 return res
#             else:
#                 return input["name"]  # 숫자로 시작하지 않는 경우 그대로 반환
#         except:
#             return input["name"]
#     except:
#         return input


def sort_func(input):
    try:
        name = input.get("name", "")

        # 문자열을 숫자/문자 블록으로 분리: "10.Floor" → [10, ".", "Floor"]
        def alphanum_key(text):
            return [
                int(part) if part.isdigit() else part.lower()
                for part in re.split(r"(\d+)", text)
            ]

        return alphanum_key(name)
    except:
        return input


def sort_func_forCalctype(input):
    try:
        try:
            if re.match(
                r"^\d+", input["name"][1:]
            ):  # 문자열이 숫자로 시작하는 경우만 변환
                res = go(
                    re.split(r"(\d+)", input["name"]),
                    filter(lambda x: x.isdigit()),
                    next,
                    int,
                    chr,
                )
                return res
            else:
                return input["name"]  # 숫자로 시작하지 않는 경우 그대로 반환
        except:
            return input["name"]
    except:
        return input


def avg(*args):
    return sum(args) / len(args)
