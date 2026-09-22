"""Maps sansad.in's raw status strings onto the frontend's existing badge
taxonomy (STATUS_META in ThemeContext.jsx), and derives the 6-stage
legislative-journey stepper from whichever lifecycle dates are populated.

Both of these are judgment calls made here in the API rather than upstream
in ingestion, so they're easy to retune without touching (or re-testing)
the ingestion service. See README "Suggested changes" for the caveats.
"""

# Real values seen from sansad.in so far: "Introduced", "Passed", "Assented".
# Extend this as more raw values show up in production data — anything not
# listed falls back to "Pending" rather than crashing.
STATUS_MAP = {
    "Introduced": "Pending",
    "Passed": "Passed",
    "Assented": "In Effect",
    "Withdrawn": "Struck Down",
    "Lapsed": "Struck Down",
    "Under Consideration": "Under Review",
}


def normalize_status(raw_status: str) -> str:
    return STATUS_MAP.get(raw_status, "Pending")


# Matches BillStepper's fixed stage list in the frontend. Real bills don't
# always pass LS before RS (bills introduced in RS often pass RS first) —
# this fixed order is an approximation kept for UI consistency with the
# existing stepper component; see README for the house-aware alternative.
STAGES = ["Introduced", "Committee", "Passed LS", "Passed RS", "Assented", "Act"]


def compute_stage(bill: dict) -> int:
    idx = 0
    if bill.get("introduced_date"):
        idx = max(idx, 0)
    if bill.get("referred_to_committee_date"):
        idx = max(idx, 1)
    if bill.get("passed_ls_date"):
        idx = max(idx, 2)
    if bill.get("passed_rs_date"):
        idx = max(idx, 3)
    if bill.get("assented_date"):
        idx = max(idx, 4)
    if bill.get("act_no"):
        idx = max(idx, 5)
    return idx
