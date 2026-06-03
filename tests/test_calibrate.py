from checkmcp.calibrate import pearson, ols, calibrate, PILLARS


def test_pearson_extremes():
    assert round(pearson([1, 2, 3, 4], [1, 2, 3, 4]), 3) == 1.0
    assert round(pearson([1, 2, 3, 4], [4, 3, 2, 1]), 3) == -1.0


def test_ols_recovers_linear_relationship():
    # y = 2*x0 + 0.5*x1 + 1
    X = [[i, j] for i in range(1, 6) for j in range(1, 6)]
    y = [2 * a + 0.5 * b + 1 for a, b in X]
    coefs, intercept, r2 = ols(X, y)
    assert round(r2, 3) == 1.0
    assert abs(coefs[0] - 2) < 1e-6 and abs(coefs[1] - 0.5) < 1e-6


def _samples(n, fn, jitter):
    import math
    out = []
    for i in range(n):
        pil = {p: 40 + (i * 7 + k * 13) % 60 for k, p in enumerate(PILLARS)}  # déterministe, varié
        out.append({"pillars": pil, "outcome": fn(pil, i)})
    return out


def test_calibrate_refuses_insufficient_samples():
    rep = calibrate([{"pillars": {p: 50 for p in PILLARS}, "outcome": 0.5}] * 4)
    assert rep["ok"] is False


def test_calibrate_refuses_low_variance():
    rep = calibrate([{"pillars": {p: 50 + i for p in PILLARS}, "outcome": 1.0} for i in range(12)])
    assert rep["ok"] is False
    assert "variance" in rep["reason"]


def test_calibrate_suppresses_overfit_when_n_small():
    # variance présente mais n < 3*(k+1) -> univariate_only, pas de R² multivarié trompeur
    rows = [{"pillars": {p: 30 + (i * 9) % 70 for p in PILLARS}, "outcome": (i % 3) / 2.0} for i in range(12)]
    rep = calibrate(rows)
    assert rep["ok"] is True
    assert rep.get("fit") == "univariate_only"
    assert rep["construct_validity_r2"] is None
    assert "pillar_correlation" in rep
