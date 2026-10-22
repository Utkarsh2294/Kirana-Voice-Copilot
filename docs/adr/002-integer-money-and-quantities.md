# ADR-002: Exact money and quantities

Accepted. Money is integer paise. Quantities are integer g, ml, pc. Display-unit sizes are kg=1000, L=1000, pc=1, dozen=12. Shared ratio multiplication uses BigInt intermediate values, one half-up rounding rule, and a safe-integer bound on results. Negative values are rejected. `fromPaise` returns a decimal string; formatting uses Intl parts without dividing money with binary floats.
