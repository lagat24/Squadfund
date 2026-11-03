def fmt_money(cents):
    cents = int(cents)
    sign = "-" if cents < 0 else ""
    cents = abs(cents)
    return f"{sign}${cents // 100:,}.{cents % 100:02d}"


def paypal_value(cents):
    """Integer cents -> PayPal amount string, with no floats involved."""
    return f"{int(cents) // 100}.{int(cents) % 100:02d}"


def ceil_div(a, b):
    return -(-a // b)


def round_up(cents, step=500):
    return ceil_div(cents, step) * step
