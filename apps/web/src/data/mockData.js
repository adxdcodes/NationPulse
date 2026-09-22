export const EVENTS = [
  {
    id: 1, domain: "Parliament", status: "Passed", topic: "Digital Rights", ministry: "MeitY", date: "18 Jun 2025",
    title: "Digital Personal Data Protection Rules, 2025",
    summary: "Finalises enforceable rules for how companies must collect, store, and process Indian citizens' personal data including mandatory consent, purpose limitation, and 72-hour breach notification.",
    why: "Your data on apps like Zomato, Paytm, and banking portals now falls under strict rules. You have the right to know how it is used and to request deletion.",
    stages: ["Introduced", "Committee", "Passed LS", "Passed RS", "Assented", "Act"], stage: 5, amend: false,
    sponsors: [101],
  },
  {
    id: 2, domain: "Executive", status: "Announced", topic: "Energy", ministry: "MNRE", date: "15 Jun 2025",
    title: "PM Surya Ghar: Muft Bijli Yojana Extended to 2027",
    summary: "The rooftop solar scheme for 1 crore households has been extended two more years with an enhanced subsidy of Rs 78,000 per household, covering up to 3 kW systems.",
    why: "If you own a home, you can get up to 300 units of free electricity monthly by installing a subsidised rooftop solar panel.",
    stages: [], stage: 0, amend: false,
    sponsors: [],
  },
  {
    id: 3, domain: "Judiciary", status: "Struck Down", topic: "Elections", ministry: null, date: "10 Jun 2025",
    title: "SC Strikes Down Electoral Bond Scheme",
    summary: "A unanimous Supreme Court Constitution Bench declared the Electoral Bond Scheme unconstitutional, ruling it violated citizens' right to information about political funding.",
    why: "Anonymous corporate donations to political parties are no longer legally permitted. Political funding must be publicly disclosed, giving voters more transparency.",
    stages: [], stage: 0, amend: false,
    sponsors: [],
  },
  {
    id: 4, domain: "Budget", status: "In Effect", topic: "Education", ministry: "Ministry of Finance", date: "01 Feb 2025",
    title: "Union Budget 2025-26: Education Allocation Rs 1.48 Lakh Crore",
    summary: "Total education sector allocation increased 11.2% year-on-year. PM SHRI school upgrades, IIT expansion, and mid-day meal coverage are the key line items.",
    why: "New IIT hostels, digital classrooms in 14,500 government schools, and expanded mid-day meal coverage are funded this year.",
    stages: [], stage: 0, amend: false, allocation: 148000, utilised: 62000,
    sponsors: [],
  },
  {
    id: 5, domain: "Parliament", status: "Under Review", topic: "Property & Law", ministry: "MMA", date: "08 Jun 2025",
    title: "Waqf (Amendment) Bill, 2024",
    summary: "Proposes major changes to the Waqf Act, 1995 including non-Muslims on the Central Waqf Council and civil court review of tribunal decisions.",
    why: "Affects management of 8.7 lakh registered Waqf properties across India. Currently under Joint Parliamentary Committee review.",
    stages: ["Introduced", "Committee", "Passed LS", "Passed RS", "Assented", "Act"], stage: 1, amend: true,
    prevLaw: "Waqf Act, 1995",
    changes: [
      { before: "Only Muslims on Central Waqf Council", after: "Non-Muslims may also be included as members" },
      { before: "Tribunal decisions not subject to civil court review", after: "Civil courts may review tribunal decisions in certain cases" },
    ],
    sponsors: [102],
  },
  {
    id: 6, domain: "Executive", status: "In Effect", topic: "Finance & Banking", ministry: "RBI / NPCI", date: "05 Jun 2025",
    title: "UPI Lite X: Offline Payments Enabled Up to Rs 500",
    summary: "RBI and NPCI launch UPI Lite X, allowing UPI payments without internet up to Rs 500 per transaction and Rs 2,000 per day.",
    why: "You can now pay digitally in areas with no mobile signal, useful in rural India, metro stations with poor connectivity, and during outages.",
    stages: [], stage: 0, amend: false,
    sponsors: [],
  },
  {
    id: 7, domain: "Parliament", status: "Passed", topic: "Transport", ministry: "MoCA", date: "28 May 2025",
    title: "Bharatiya Vayuyan Vidheyak, 2024 - Aviation Reform",
    summary: "Modernises aviation regulation, delegating oversight to DGCA and BCAS with a statutory mandate and targeting 30-day aircraft registration.",
    why: "Aircraft registration drops from 8-12 months to 30 days. More aircraft entering service quickly could reduce domestic airfares.",
    stages: ["Introduced", "Committee", "Passed LS", "Passed RS", "Assented", "Act"], stage: 4, amend: true,
    prevLaw: "Aircraft Act, 1934",
    changes: [
      { before: "Central Government directly holds all aircraft oversight powers", after: "Powers delegated to DGCA and BCAS with clear statutory mandate" },
      { before: "Average registration time: 8-12 months", after: "Target registration time: 30 days" },
    ],
    sponsors: [103],
  },
  {
    id: 8, domain: "Judiciary", status: "Upheld", topic: "Education", ministry: null, date: "20 May 2025",
    title: "SC Upholds 10% EWS Reservation in Higher Education",
    summary: "A Constitution Bench upheld the 103rd Constitutional Amendment providing 10% reservation to Economically Weaker Sections in central institutions and government jobs.",
    why: "If your household income is below Rs 8 lakh/year and you do not belong to any reserved category, you are eligible for the EWS quota in IITs, central universities, and government jobs.",
    stages: [], stage: 0, amend: false,
    sponsors: [],
  },
];

export const DOMAINS = ["All", "Parliament", "Executive", "Budget", "Judiciary"];
export const TOPICS = ["All", "Digital Rights", "Energy", "Elections", "Education", "Finance & Banking", "Transport", "Property & Law"];
export const STATUSES = ["All", "Passed", "In Effect", "Pending", "Under Review", "Struck Down", "Announced", "Upheld"];

export const TOPIC_INFO = {
  "Digital Rights": { blurb: "Data protection, online speech, and platform regulation." },
  "Energy": { blurb: "Power generation, subsidies, and the renewable transition." },
  "Elections": { blurb: "Electoral law, funding transparency, and voting rights." },
  "Education": { blurb: "School and higher-ed policy, funding, and access." },
  "Finance & Banking": { blurb: "Payments, RBI regulation, and financial inclusion." },
  "Transport": { blurb: "Aviation, rail, and road regulation and infrastructure." },
  "Property & Law": { blurb: "Land, religious endowments, and civil law reform." },
};

// Fictional MPs for demonstration purposes — not real public figures.
export const MPS = [
  {
    id: 101, name: "Ananya Krishnan", house: "Lok Sabha", state: "Tamil Nadu", constituency: "Chennai Central",
    party: "National Unity Front", bloc: "NDA", term: "2024 – present", terms: 2, age: 47,
    education: "LLB, University of Madras", committee: "Standing Committee on IT & Communications",
    topics: ["Digital Rights", "Finance & Banking"],
    stats: { billsSponsored: 4, questionsAsked: 62, attendance: 91, debates: 18 },
    bio: "A former technology-policy lawyer, has focused her parliamentary work on consumer data protection and digital consent frameworks.",
  },
  {
    id: 102, name: "Rajeev Malhotra", house: "Rajya Sabha", state: "Uttar Pradesh", constituency: "Nominated (UP)",
    party: "Bharat Praja Party", bloc: "NDA", term: "2022 – present", terms: 1, age: 55,
    education: "M.A. Public Administration, Lucknow University", committee: "Joint Committee on the Waqf (Amendment) Bill",
    topics: ["Property & Law", "Elections"],
    stats: { billsSponsored: 2, questionsAsked: 38, attendance: 87, debates: 11 },
    bio: "Serves on the Joint Parliamentary Committee reviewing amendments to religious-endowment law and has chaired several state-level land-reform panels.",
  },
  {
    id: 103, name: "Meera Iyer", house: "Lok Sabha", state: "Karnataka", constituency: "Bengaluru South",
    party: "Progressive Alliance", bloc: "INDIA", term: "2019 – present", terms: 3, age: 52,
    education: "B.Tech Aerospace Engineering, IIT Bombay", committee: "Standing Committee on Transport, Tourism & Culture",
    topics: ["Transport", "Energy"],
    stats: { billsSponsored: 6, questionsAsked: 104, attendance: 95, debates: 27 },
    bio: "An aerospace engineer before entering politics, has pushed for faster aircraft-registration timelines and civil aviation modernisation.",
  },
  {
    id: 104, name: "Suresh Naidu", house: "Lok Sabha", state: "Andhra Pradesh", constituency: "Vijayawada",
    party: "Telugu Praja Samithi", bloc: "Regional", term: "2024 – present", terms: 1, age: 43,
    education: "MBA Finance, ISB Hyderabad", committee: "Standing Committee on Finance",
    topics: ["Finance & Banking", "Budget"],
    stats: { billsSponsored: 1, questionsAsked: 45, attendance: 89, debates: 9 },
    bio: "A first-term MP and former banker, focuses on financial inclusion and digital-payments policy in his committee work.",
  },
  {
    id: 105, name: "Farah Sheikh", house: "Rajya Sabha", state: "West Bengal", constituency: "Nominated (WB)",
    party: "Progressive Alliance", bloc: "INDIA", term: "2021 – present", terms: 1, age: 39,
    education: "PhD Education Policy, JNU", committee: "Standing Committee on Education, Women, Children, Youth & Sports",
    topics: ["Education"],
    stats: { billsSponsored: 3, questionsAsked: 71, attendance: 93, debates: 21 },
    bio: "An education researcher who has campaigned for expanded EWS access and mid-day meal coverage in government schools.",
  },
  {
    id: 106, name: "Vikram Deshmukh", house: "Lok Sabha", state: "Maharashtra", constituency: "Pune",
    party: "Independent", bloc: "Independent", term: "2024 – present", terms: 1, age: 61,
    education: "LLM Constitutional Law, ILS Law College", committee: "Standing Committee on Personnel, Public Grievances, Law & Justice",
    topics: ["Elections", "Property & Law"],
    stats: { billsSponsored: 2, questionsAsked: 53, attendance: 82, debates: 14 },
    bio: "A retired judge sitting as an independent, has been a vocal advocate for electoral funding transparency.",
  },
];

export const DIGESTS = [
  {
    id: "2025-w25", label: "Week of 16–22 June 2025", published: "22 Jun 2025",
    intro: "A data-protection rulebook takes effect, the rooftop-solar scheme gets a two-year lease on life, and the electoral bonds ruling continues to reshape political funding.",
    highlightIds: [1, 2, 3],
    stat: { label: "Bills tracked this week", value: 5 },
  },
  {
    id: "2025-w24", label: "Week of 09–15 June 2025", published: "15 Jun 2025",
    intro: "The Waqf Amendment Bill moves to committee review while UPI Lite X quietly changes how offline India pays.",
    highlightIds: [5, 6],
    stat: { label: "Bills tracked this week", value: 3 },
  },
  {
    id: "2025-w22", label: "Week of 26 May – 01 June 2025", published: "01 Jun 2025",
    intro: "Aviation reform clears both Houses and the Supreme Court delivers a major EWS reservation ruling.",
    highlightIds: [7, 8],
    stat: { label: "Bills tracked this week", value: 2 },
  },
];

export function getEventById(id) {
  return EVENTS.find(e => String(e.id) === String(id));
}

export function getMPById(id) {
  return MPS.find(m => String(m.id) === String(id));
}

export function getEventsByTopic(topic) {
  return EVENTS.filter(e => e.topic === topic);
}

export function getEventsForMP(mpId) {
  return EVENTS.filter(e => e.sponsors?.includes(Number(mpId)));
}
