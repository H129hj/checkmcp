"""Plan limits for the hosted API — mirror of web/lib/plans.ts. Keep in sync."""

PLANS = {
    "free": {"name": "Free", "monitors": 3,   "api_per_day": 50,    "private_audits": False, "webhook_alerts": False},
    "pro":  {"name": "Pro",  "monitors": 50,  "api_per_day": 2000,  "private_audits": True,  "webhook_alerts": True},
    "team": {"name": "Team", "monitors": 500, "api_per_day": 20000, "private_audits": True,  "webhook_alerts": True},
}


def plan_of(plan_id):
    return PLANS.get(plan_id or "free", PLANS["free"])
