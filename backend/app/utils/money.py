def format_rupees(paise: int) -> str:
    """₹ with Indian digit grouping, for server-written messages.

    9900 → "₹99", 12345650 → "₹1,23,456.50".
    """
    rupees, rest = divmod(abs(paise), 100)
    digits = str(rupees)
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        digits = ",".join([head, *groups, tail])
    sign = "-" if paise < 0 else ""
    return f"{sign}₹{digits}" + (f".{rest:02d}" if rest else "")
