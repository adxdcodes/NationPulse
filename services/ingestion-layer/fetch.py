"""Fetches the full bill list for one house from the endpoint you found via
DevTools. Both houses use the same `/api_rs/legislation/getBills` path with
a `house` query param — that's not a typo, sansad.in really does serve both
Lok Sabha and Rajya Sabha bills from the "rs" path.
"""
import httpx

import config


class FetchError(Exception):
    pass


def fetch_house_bills(house: str, endpoint: str, size: int) -> list[dict]:
    """Returns the raw bill records for one house. `size` should be set
    comfortably above the real total so this single request returns
    everything — see the pagination note in README.md.
    """
    params = {
        "loksabha": "", "sessionNo": "", "billName": "", "house": house,
        "ministryName": "", "billType": "Government", "billCategory": "",
        "billStatus": "", "introductionDateFrom": "", "introductionDateTo": "",
        "passedInLsDateFrom": "", "passedInLsDateTo": "",
        "passedInRsDateFrom": "", "passedInRsDateTo": "",
        "page": 1, "size": size, "locale": "en",
        "sortOn": "billIntroducedDate", "sortBy": "desc",
    }
    url = f"{config.SANSAD_BASE_URL}{endpoint}"

    try:
        with httpx.Client(timeout=config.REQUEST_TIMEOUT_SECONDS) as client:
            resp = client.get(url, params=params, headers={"User-Agent": config.USER_AGENT})
        resp.raise_for_status()
        body = resp.json()
    except httpx.HTTPError as e:
        raise FetchError(f"Request to {url} failed: {e}") from e
    except ValueError as e:
        raise FetchError(f"Response from {url} wasn't valid JSON: {e}") from e

    # Handle the response wrappers used by sansad.in as well as a bare array.
    if isinstance(body, dict):
        rows = body.get("records") or body.get("content") or body.get("data") or body.get("bills") or []
    elif isinstance(body, list):
        rows = body
    else:
        raise FetchError(f"Unexpected response shape from {url}: {type(body)}")

    if not isinstance(rows, list):
        raise FetchError(f"Expected a list of bills from {url}, got {type(rows)}")

    return rows


def fetch_all() -> dict[str, list[dict]]:
    """Fetches every configured house. Returns {house_name: [raw_bill, ...]}."""
    results = {}
    for h in config.HOUSES:
        results[h["house"]] = fetch_house_bills(h["house"], h["endpoint"], h["size"])
    return results
