"""Stands in for sansad.in during local testing. Serves a small, realistic
bill list per house at /api_rs/legislation/getBills, matching the exact
JSON shape from the real API. A tiny control endpoint lets the test script
add a bill mid-run to exercise the new-bill detection path.
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

RS_BILLS = [
    {
        "billNumber": "LVII", "billName": "The Chief Election Commissioner and Other Election Commissioners (Appointment, Conditions of Service and Term of Office) Bill, 2023",
        "billType": "Government", "billCategory": "Ordinary Bill", "ministryName": "LAW AND JUSTICE",
        "billYear": 2023, "billIntroducedInHouse": "Rajya Sabha", "billIntroducedBy": None,
        "billIntroducedDate": "2023-08-10 00:00:00.0",
        "billIntroducedFile": "http://TESTHOST/getFile/chief-election-introduced.pdf",
        "billPassedInLSDate": "2023-12-21 00:00:00.0", "billPassedInLSFile": None,
        "billPassedInRSDate": "2023-12-12 00:00:00.0",
        "billPassedInRSFile": "http://TESTHOST/getFile/chief-election-passed-rs.pdf",
        "billPassedInBothHousesFile": "http://TESTHOST/getFile/chief-election-both-houses.pdf",
        "errataFile": None, "referredToCommitteeDate": None, "reportPresentedDate": None, "reportFile": None,
        "actNo": "49 ", "actYear": 2023, "billAssentedDate": "28/12/2023",
        "billGazettedFile": None, "billSynopsisFile": None, "status": "Assented",
    },
    {
        "billNumber": "LVIII", "billName": "The Post Office Bill, 2023",
        "billType": "Government", "billCategory": "Ordinary Bill", "ministryName": "COMMUNICATIONS",
        "billYear": 2023, "billIntroducedInHouse": "Rajya Sabha", "billIntroducedBy": None,
        "billIntroducedDate": "2023-08-10 00:00:00.0",
        "billIntroducedFile": "http://TESTHOST/getFile/post-office-introduced.pdf",
        "billPassedInLSDate": "2023-12-18 00:00:00.0", "billPassedInLSFile": None,
        "billPassedInRSDate": "2023-12-04 00:00:00.0",
        "billPassedInRSFile": "http://TESTHOST/getFile/post-office-passed-rs.pdf",
        "billPassedInBothHousesFile": "http://TESTHOST/getFile/post-office-both-houses.pdf",
        "errataFile": None, "referredToCommitteeDate": None, "reportPresentedDate": None, "reportFile": None,
        "actNo": "43 ", "actYear": 2023, "billAssentedDate": "24/12/2023",
        "billGazettedFile": None, "billSynopsisFile": None, "status": "Assented",
    },
]

LS_BILLS = [
    {
        "billNumber": "112", "billName": "The Digital Personal Data Protection Bill, 2023",
        "billType": "Government", "billCategory": "Ordinary Bill", "ministryName": "MEITY",
        "billYear": 2023, "billIntroducedInHouse": "Lok Sabha", "billIntroducedBy": None,
        "billIntroducedDate": "2023-08-03 00:00:00.0",
        "billIntroducedFile": "http://TESTHOST/getFile/dpdp-introduced.pdf",
        "billPassedInLSDate": "2023-08-07 00:00:00.0",
        "billPassedInLSFile": "http://TESTHOST/getFile/dpdp-passed-ls.pdf",
        "billPassedInRSDate": None, "billPassedInRSFile": None,
        "billPassedInBothHousesFile": None,
        "errataFile": None, "referredToCommitteeDate": None, "reportPresentedDate": None, "reportFile": None,
        "actNo": "22", "actYear": 2023, "billAssentedDate": "11/08/2023",
        "billGazettedFile": None, "billSynopsisFile": None, "status": "Assented",
    },
]

# A bill to "publish" mid-test to exercise the delta-detection path.
NEW_RS_BILL = {
    "billNumber": "LIX", "billName": "The Test New Bill, 2024",
    "billType": "Government", "billCategory": "Ordinary Bill", "ministryName": "FINANCE",
    "billYear": 2024, "billIntroducedInHouse": "Rajya Sabha", "billIntroducedBy": None,
    "billIntroducedDate": "2024-02-01 00:00:00.0",
    "billIntroducedFile": "http://TESTHOST/getFile/new-bill-introduced.pdf",
    "billPassedInLSDate": None, "billPassedInLSFile": None,
    "billPassedInRSDate": None, "billPassedInRSFile": None,
    "billPassedInBothHousesFile": None,
    "errataFile": None, "referredToCommitteeDate": None, "reportPresentedDate": None, "reportFile": None,
    "actNo": None, "actYear": None, "billAssentedDate": None,
    "billGazettedFile": None, "billSynopsisFile": None, "status": "Introduced",
}

state = {"rs_bills": list(RS_BILLS)}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # keep test output quiet

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        host_header = f"http://{self.headers.get('Host', 'localhost')}"

        if parsed.path == "/api_rs/legislation/getBills":
            house = qs.get("house", [""])[0]
            rows = state["rs_bills"] if house == "Rajya Sabha" else LS_BILLS
            body = json.dumps(rows).replace("http://TESTHOST", host_header).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/__test__/add_bill":
            state["rs_bills"].append(NEW_RS_BILL)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
            return

        # Serve fake PDFs for any /getFile/*.pdf path — used by the PDF pipeline stage
        if parsed.path.startswith("/getFile/"):
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.end_headers()
            self.wfile.write(make_fake_pdf(parsed.path))
            return

        self.send_response(404)
        self.end_headers()


def make_fake_pdf(path: str) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    import io
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, 760, f"Fake bill text for {path}")
    c.setFont("Helvetica", 11)
    c.drawString(72, 730, "BE it enacted by Parliament in the following manner:")
    c.drawString(72, 710, "1. Short title. This Act may be called the Test Act.")
    c.showPage()
    c.save()
    return buf.getvalue()


if __name__ == "__main__":
    server = HTTPServer(("localhost", 8892), Handler)
    print("Fake sansad.in running on http://localhost:8892")
    server.serve_forever()
