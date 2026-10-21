"""Minimal enum subset for Skulpt.

Skulpt's stdlib has no enum module; the CPython tkinter package needs only
`enum._simple_enum` and `enum.StrEnum` (for EventType). This implements just
that surface, keeping members real str/int subclasses so comparisons like
`event.type == EventType.KeyPress` and `EventType("2")` behave as in CPython.
"""

__all__ = ["Enum", "IntEnum", "StrEnum", "unique"]


class Enum:
    pass


class _EnumMeta(type):
    def __call__(cls, value):
        try:
            return cls._value2member_map_[value]
        except (KeyError, TypeError):
            raise ValueError("%r is not a valid %s" % (value, cls.__name__))

    def __contains__(cls, value):
        try:
            return value in cls._value2member_map_
        except TypeError:
            return False

    def __iter__(cls):
        return iter(cls._member_map_.values())


class IntEnum(int, Enum):
    pass


class StrEnum(str, Enum):
    pass


def _simple_enum(base):
    """Create an enum class from plain class attributes (PEP 663 helper)."""

    def deco(cls):
        # Skulpt has no vars() builtin; __dict__ gives the same namespace.
        source = cls.__dict__
        namespace = {}
        value_map = {}
        member_map = {}
        for name in list(source.keys()):
            if name.startswith("__") and name.endswith("__"):
                namespace[name] = source[name]
                continue
            value = source[name]
            if isinstance(value, (str, int)) and not isinstance(value, bool):
                member = value_map.get(value)
                if member is None:
                    member = base.__new__(base, value)
                    member._name_ = name
                    member._value_ = value
                    value_map[value] = member
                namespace[name] = member
                member_map[name] = member
            else:
                namespace[name] = value
        namespace["_value2member_map_"] = value_map
        namespace["_member_map_"] = member_map
        return _EnumMeta(cls.__name__, (base,), namespace)

    return deco


def unique(enumeration):
    seen = {}
    for name, member in enumeration.__dict__.items():
        if name.startswith("_") or not hasattr(member, "value"):
            continue
        value = member.value
        if value in seen:
            raise ValueError(
                "duplicate value %r found in %r, aliases must be unique"
                % (value, enumeration.__name__)
            )
        seen[value] = name
    return enumeration
