/* Semester HQ demo runtime.
   Stands in for Claude's runtime so the dashboard runs on its own:
   a simulated Gmail and Google Calendar, plus an in-memory database.
   Every person, company, class and email here is made up. Dates are
   relative to today so the demo always looks current. */
(() => {
  const DAY = 864e5;
  const now = new Date();
  const base0 = new Date(now); base0.setHours(0, 0, 0, 0);
  const pad = n => String(n).padStart(2, "0");
  const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const D = n => ds(new Date(base0.getTime() + n * DAY));                       // date string n days from today
  const at = (n, h, m = 0) => { const d = new Date(base0.getTime() + n * DAY); d.setHours(h, m, 0, 0); return d; };
  const iso = d => d.toISOString();
  const tm = d => { let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${h}:${pad(d.getMinutes())} ${ap}`; };
  const short = n => new Date(base0.getTime() + n * DAY).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dow = (base0.getDay() + 6) % 7;                                         // 0 = Monday
  const monday = -dow;

  /* ------------------------------------------------------------ calendars */
  const CLASSES = [
    { code: "FIN 3400", name: "Corporate Finance", prof: "Prof. Alvarez", loc: "BUS 120", days: [0, 2], h: 9, m: 40, len: 80, color: "c1" },
    { code: "ACCT 3010", name: "Intermediate Accounting", prof: "Prof. Nguyen", loc: "BUS 214", days: [1, 3], h: 11, m: 50, len: 80, color: "c2" },
    { code: "IS 2010", name: "Business Analytics", prof: "Prof. Okafor", loc: "TECH 105", days: [1, 3], h: 14, m: 0, len: 80, color: "c4" },
    { code: "MKTG 3000", name: "Principles of Marketing", prof: "Prof. Bennett", loc: "BUS 330", days: [0, 2], h: 13, m: 25, len: 80, color: "c3" },
    { code: "ECON 2010", name: "Intermediate Microeconomics", prof: "Prof. Haddad", loc: "SOC 202", days: [4], h: 10, m: 0, len: 110, color: "c5" },
  ];
  const calId = c => "cal" + c.code.replace(/\s/g, "").toLowerCase() + "@group.calendar.demo";
  const link = "https://calendar.google.com/";

  // assignments and exams on each class calendar: [days from today, hour, minute, title, description]
  const WORK = {
    "FIN 3400": [[-2, 23, 59, "Problem Set 3 due", "Chapters 5–6: bond valuation and yield curves."], [1, 23, 59, "Case: Harbor Tools capital budgeting due", "Group case write-up, 4 pages max."], [6, 9, 40, "Midterm Exam", "Chapters 1–7. Bring a financial calculator."], [13, 23, 59, "Problem Set 4 due", "WACC and capital structure."], [27, 23, 59, "Valuation project due", "DCF of an assigned public company."]],
    "ACCT 3010": [[0, 23, 59, "Homework 6 due", "Job-order costing exercises 6-1 to 6-9."], [3, 11, 50, "Quiz 3", "Cost-volume-profit analysis."], [10, 23, 59, "Homework 7 due", "Activity-based costing."], [16, 11, 50, "Exam 2", "Chapters 5–8."]],
    "IS 2010": [[2, 23, 59, "Excel lab 5 due", "Pivot tables and lookup functions."], [8, 23, 59, "Tableau dashboard project due", "Build a sales dashboard from the class dataset."], [15, 14, 0, "Midterm Exam", "SQL basics, Excel modeling, data visualization."]],
    "MKTG 3000": [[4, 23, 59, "Reading: Chapter 9", "Pricing strategies."], [9, 23, 59, "Brand audit presentation", "Teams of four, 10 minutes."], [20, 13, 25, "Midterm Exam", "Chapters 1–9."]],
    "ECON 2010": [[1, 23, 59, "Problem set 5 due", "Consumer choice and elasticity."], [11, 10, 0, "Exam 1", "Units 1–4."], [18, 23, 59, "Problem set 6 due", "Production and cost."]],
  };

  const classEvents = {};
  CLASSES.forEach(c => {
    const id = calId(c), evs = [];
    for (let w = -1; w < 20; w++) c.days.forEach(d => {
      const st = at(monday + w * 7 + d, c.h, c.m), en = new Date(st.getTime() + c.len * 6e4);
      evs.push({ id: `lec${c.code.replace(/\s/g, "")}${w + 1}${d}`.toLowerCase(), summary: `${c.code} ${c.name}`, location: c.loc, start: { dateTime: iso(st) }, end: { dateTime: iso(en) }, recurringEventId: "rec" + c.code.replace(/\s/g, ""), htmlLink: link, status: "confirmed" });
    });
    (WORK[c.code] || []).forEach(([n, h, m, t, desc], i) => {
      const isExam = /exam|quiz/i.test(t);
      const st = at(n, h, m), en = isExam ? new Date(st.getTime() + c.len * 6e4) : st;
      evs.push({ id: `as${c.code.replace(/\s/g, "")}${i}`.toLowerCase(), summary: `${c.code} ${t}`, description: desc, start: { dateTime: iso(st) }, end: { dateTime: iso(en) }, htmlLink: link, status: "confirmed" });
    });
    classEvents[id] = evs;
  });

  const INTERN_CAL = "brightline.internship@group.calendar.demo";
  classEvents[INTERN_CAL] = [
    [0, 15, 30, 60, "Brightline standup: Q3 pricing model", "Weekly analytics team sync."],
    [2, 16, 0, 45, "1:1 with manager (Priya)", "Review dashboard progress."],
    [4, 13, 0, 90, "Client data review", "Walk through the churn analysis."],
  ].map(([n, h, m, len, t, d], i) => ({ id: `int${i}`, summary: t, description: d, start: { dateTime: iso(at(n, h, m)) }, end: { dateTime: iso(new Date(at(n, h, m).getTime() + len * 6e4)) }, htmlLink: link, status: "confirmed" }));

  const primary = [
    [0, 7, 0, 60, "Gym"], [0, 17, 30, 60, "Finance Club general meeting", "Room BUS 101"], [1, 12, 30, 30, "Coffee chat: Marcus Webb (Summit Peak Partners)", "Zoom"],
    [2, 15, 0, 60, "Interview: Northwind Capital (Superday round 1)", "Video interview"], [3, 18, 0, 120, "Career fair: Business & Analytics", "Student Union ballroom"],
    [4, 9, 0, 30, "Advising appointment", "Plan spring schedule"], [5, 10, 0, 120, "Shift at campus bookstore"], [6, 16, 0, 90, "Study group: FIN 3400 midterm", "Library room 2B"],
    [8, 11, 0, 45, "HireVue: Lumen Bank", "Recorded video interview"], [9, 17, 0, 60, "Investment Club stock pitch practice"],
  ].map(([n, h, m, len, t, loc], i) => ({ id: `pri${i}`, summary: t, location: loc || "", start: { dateTime: iso(at(n, h, m)) }, end: { dateTime: iso(new Date(at(n, h, m).getTime() + len * 6e4)) }, htmlLink: link, status: "confirmed" }));
  classEvents.primary = primary;

  const CALENDARS = [
    { id: "primary", summary: "jordan.lee@stateu.edu" },
    ...CLASSES.map(c => ({ id: calId(c), summary: `${c.code} ${c.name}`, description: `${c.prof} · ${c.loc}` })),
    { id: INTERN_CAL, summary: "Brightline Analytics", description: "Internship calendar" },
    { id: "holidays@group.calendar.demo", summary: "Holidays in United States" },
  ];
  classEvents["holidays@group.calendar.demo"] = [];

  /* ------------------------------------------------------------ applications + gmail */
  const COMPANIES = {
    "Northwind Capital": "northwindcap.com", "Lumen Bank": "lumenbank.com", "Summit Peak Partners": "summitpeak.com", "Bluebird Analytics": "bluebirdanalytics.com",
    "Cedar & Pine Advisors": "cedarpine.com", "Atlas Consulting Group": "atlasconsulting.com", "Harbor Point Securities": "harborpoint.com", "Kestrel Ventures": "kestrelvc.com",
    "Meridian Insurance": "meridianins.com", "Granite State Bank": "granitestatebank.com", "Oakline Retail": "oakline.com", "Vista Energy": "vistaenergy.com",
    "Copperleaf Health": "copperleafhealth.com", "Redwood Asset Management": "redwoodam.com", "Silverline Tech": "silverline.io",
  };
  // [company, role, stage, outcome, events: [daysAgo, stage, subject, snippet], deadline?, nextStep]
  const APPS = [
    ["Northwind Capital", "Investment Banking Summer Analyst", "Interviewing", "", [[24, "Applied", "Thank you for applying to Northwind Capital", "We received your application for the 2027 Investment Banking Summer Analyst program."], [12, "Online assessment", "Next steps: Northwind Capital online assessment", "Please complete the online assessment within 5 days."], [3, "Interviewing", "Invitation: Northwind Capital Superday", "Congratulations! We'd like to invite you to our Superday round."]], "", "Prepare for the Superday: review technicals and your deal walk-through."],
    ["Lumen Bank", "Corporate Finance Intern", "Online assessment", "", [[15, "Applied", "Application received: Corporate Finance Intern", "Thanks for applying to Lumen Bank."], [2, "Online assessment", "Complete your HireVue interview for Lumen Bank", "Your recorded video interview is ready. Please complete it by the deadline."]], "", "Record the HireVue interview before it expires."],
    ["Summit Peak Partners", "Private Equity Summer Analyst", "Applied", "", [[9, "Applied", "We received your application", "Thank you for your interest in Summit Peak Partners."]], "", "Follow up with Marcus Webb after the coffee chat."],
    ["Bluebird Analytics", "Data Analyst Intern", "Interviewing", "", [[20, "Applied", "Thanks for applying to Bluebird Analytics!", "Our team will review your application."], [10, "Online assessment", "Bluebird Analytics SQL assessment", "Please complete the HackerRank SQL challenge."], [1, "Interviewing", "Let's schedule your interview", "The hiring team would like to meet with you. Please pick a time."]], "", "Pick an interview time from the scheduling link."],
    ["Cedar & Pine Advisors", "Wealth Management Intern", "Closed", "Rejected", [[30, "Applied", "Your application to Cedar & Pine Advisors", "Thank you for applying."], [6, "Rejected", "Update on your application", "Unfortunately, we have decided to move forward with other candidates."]], "", ""],
    ["Atlas Consulting Group", "Business Analyst Intern", "Applied", "", [[7, "Applied", "Application confirmation: Business Analyst Intern", "Your application has been submitted successfully."]], "", "Network with an Atlas consultant before first-round decisions."],
    ["Harbor Point Securities", "Sales & Trading Summer Analyst", "Online assessment", "", [[18, "Applied", "Harbor Point Securities: application received", "We have received your application."], [5, "Online assessment", "Action required: Harbor Point assessment", "Please complete the numerical reasoning test."]], "", "Finish the numerical reasoning test."],
    ["Kestrel Ventures", "Venture Capital Intern", "Applied", "", [[4, "Applied", "Thanks for applying to Kestrel Ventures", "We review applications on a rolling basis."]], "", "Send a short note to the Kestrel associate you met at the fair."],
    ["Meridian Insurance", "Financial Analyst Intern", "Offer", "", [[35, "Applied", "Meridian Insurance application received", "Thank you for applying."], [21, "Interviewing", "Interview invitation: Meridian Insurance", "We would like to schedule a first-round interview."], [8, "Offer", "Offer: Financial Analyst Intern, Summer 2027", "We are delighted to extend you an offer to join Meridian Insurance."]], D(14), "Decide on the Meridian offer before the deadline."],
    ["Granite State Bank", "Commercial Banking Intern", "Closed", "Rejected", [[26, "Applied", "Granite State Bank: we got your application", "Thanks for applying."], [11, "Rejected", "Your Granite State Bank application", "Unfortunately, we will not be moving forward at this time."]], "", ""],
    ["Oakline Retail", "Finance Rotational Intern", "Applied", "", [[13, "Applied", "Oakline Retail application submitted", "Your application for the Finance Rotational Program was submitted."]], "", ""],
    ["Vista Energy", "FP&A Intern", "Applied", "", [[2, "Applied", "Thank you for applying to Vista Energy", "We'll be in touch about next steps."]], "", ""],
    ["Copperleaf Health", "Strategy & Analytics Intern", "Closed", "Rejected", [[22, "Applied", "Copperleaf Health: application received", "Thanks for your interest."], [9, "Rejected", "Thank you for your interest in Copperleaf Health", "Unfortunately, the position has been filled."]], "", ""],
  ];
  const WISHLIST = [
    ["Redwood Asset Management", "Equity Research Summer Analyst", D(5), "Finish the cover letter and submit."],
    ["Silverline Tech", "Business Operations Intern", D(12), "Ask Dana Kim for a referral first."],
  ];
  const sender = co => `careers@${COMPANIES[co]}`;
  const mid = (i, j) => `msg${i}x${j}`;

  const appThreads = [], apps = [], mailupdates = [];
  APPS.forEach(([co, role, stage, outcome, evs, deadline, nextStep], i) => {
    const msgs = evs.map(([ago, st, subj, snip], j) => ({ id: mid(i, j), date: iso(new Date(now.getTime() - ago * DAY - (i % 5) * 36e5)), sender: `${co} Recruiting <${sender(co)}>`, subject: subj, snippet: snip, labelIds: ago <= 2 ? ["UNREAD", "INBOX"] : ["INBOX"], viewUrl: "https://mail.google.com/" }));
    msgs.forEach(m => appThreads.push({ id: "t" + m.id, messageCount: 1, viewUrl: m.viewUrl, messages: [m] }));
    const notes = evs.map(([ago, st, subj]) => `${short(-ago)} · ${st}: ${subj}`).join("\n");
    apps.push({ id: "app" + i, company: co, role, type: "Internship", term: "Summer 2027", location: ["New York, NY", "Chicago, IL", "Denver, CO", "San Francisco, CA", "Dallas, TX"][i % 5], stage, outcome, deadline, nextStep, notes, source: "Email", emailUrl: "https://mail.google.com/", created: D(-evs[0][0]), updated: D(-evs[evs.length - 1][0]) });
    evs.forEach(([ago, st, subj], j) => {
      // the two newest updates are left for review so the "Application updates" panel has something to show
      const pending = (co === "Bluebird Analytics" && j === 2) || (co === "Lumen Bank" && j === 1);
      mailupdates.push({ id: "m-" + mid(i, j), msgId: mid(i, j), company: co, role, type: "Internship", stage: st, status: pending ? "pending" : "applied", by: "claude", auto: !pending, date: msgs[j].date, subject: subj, sender: sender(co), url: "https://mail.google.com/", nextStep: pending ? nextStep : "", nextDue: pending && co === "Lumen Bank" ? D(3) : "", division: "", location: "", pay: "", reqId: "", term: "Summer 2027" });
    });
  });
  WISHLIST.forEach(([co, role, deadline, nextStep], i) => apps.push({ id: "wish" + i, company: co, role, type: "Internship", term: "Summer 2027", stage: "Wishlist", deadline, nextStep, notes: "", source: "Manual", created: D(-3), updated: D(-3) }));
  apps.push({ id: "pt0", company: "Campus Bookstore", role: "Sales Associate (part-time)", type: "Part-time job", stage: "Offer", outcome: "", notes: `${short(-40)} · Applied\n${short(-30)} · Hired`, source: "Manual", created: D(-40), updated: D(-30) });

  const generalThreads = [
    ["Prof. Alvarez", "alvarez@stateu.edu", "FIN 3400: midterm review session Thursday", "I'll hold an optional review session Thursday at 5 PM in BUS 120.", 0],
    ["Career Services", "careers@stateu.edu", "This week: Business & Analytics career fair", "Over 60 employers are attending. Bring printed copies of your resume.", 1],
    ["Finance Club", "financeclub@stateu.edu", "Stock pitch competition sign-ups are open", "Teams of 2–3, pitches due in three weeks.", 1],
    ["Dana Kim (LinkedIn)", "messages-noreply@linkedin.demo", "Dana Kim replied to your message", "Happy to refer you for the Silverline role. Send me your resume!", 2],
    ["Study Abroad Office", "abroad@stateu.edu", "Reminder: Lisbon program deposit due", "Please submit your $500 commitment deposit through the study abroad portal.", 3],
    ["Brightline Analytics", "priya.shah@brightline.demo", "Dashboard feedback", "Great work on the churn dashboard. Can you add a filter for region?", 0],
  ].map(([name, email, subj, snip, ago], i) => {
    const m = { id: "gen" + i, date: iso(new Date(now.getTime() - ago * DAY - i * 2 * 36e5)), sender: `${name} <${email}>`, subject: subj, snippet: snip, labelIds: ago === 0 ? ["UNREAD", "IMPORTANT", "INBOX"] : ["INBOX"], viewUrl: "https://mail.google.com/" };
    return { id: "t" + m.id, messageCount: 1, viewUrl: m.viewUrl, messages: [m] };
  });
  const abroadThreads = [
    ["Study Abroad Office", "abroad@stateu.edu", "Congratulations! You've been accepted to Business in Lisbon", "You have been accepted to the Spring 2027 Business in Lisbon program. Next steps: commit by paying your deposit.", 6],
    ["Study Abroad Office", "abroad@stateu.edu", "Reminder: Lisbon program deposit due", "Please submit your $500 commitment deposit through the study abroad portal.", 3],
    ["Global Exchange Programs", "exchange@stateu.edu", "Copenhagen exchange application: next steps", "Your application is under review. Interviews will be scheduled next month.", 10],
  ].map(([name, email, subj, snip, ago], i) => {
    const m = { id: "ab" + i, date: iso(new Date(now.getTime() - ago * DAY)), sender: `${name} <${email}>`, subject: subj, snippet: snip, labelIds: ["INBOX"], viewUrl: "https://mail.google.com/" };
    return { id: "t" + m.id, messageCount: 1, viewUrl: m.viewUrl, messages: [m] };
  });

  const bodies = {};
  [...appThreads, ...generalThreads, ...abroadThreads].forEach(t => t.messages.forEach(m => { bodies[m.id] = `${m.snippet}\n\nBest regards,\n${m.sender.split("<")[0].trim()}`; }));

  /* ------------------------------------------------------------ database seed */
  const classes = CLASSES.map(c => ({ id: "cal-" + c.code.replace(/\s/g, ""), code: c.code, name: c.name, professor: c.prof, location: c.loc, schedule: `${c.days.map(d => ["M", "T", "W", "Th", "F"][d]).join("")} ${tm(at(0, c.h, c.m))}–${tm(new Date(at(0, c.h, c.m).getTime() + c.len * 6e4))}`, calendarId: calId(c), color: c.color, created: D(-40) }));
  const tasks = [];
  CLASSES.forEach(c => (WORK[c.code] || []).forEach(([n, h, m, t, desc], i) => {
    const evId = `as${c.code.replace(/\s/g, "")}${i}`.toLowerCase();
    const type = /exam/i.test(t) ? "Exam" : /quiz/i.test(t) ? "Quiz" : /project|presentation|case/i.test(t) ? "Project" : /reading/i.test(t) ? "Reading" : "Assignment";
    tasks.push({ id: "cal-" + evId, calEventId: evId, classId: "cal-" + c.code.replace(/\s/g, ""), title: t.replace(/ due$/, ""), type, due: D(n), dueTime: tm(at(n, h, m)), notes: desc, link, source: "calendar", done: n < 0, created: D(-40) });
  }));
  tasks.push({ id: "own1", title: "Update resume with Brightline project", classId: "", type: "Assignment", due: D(1), dueTime: "", notes: "", source: "manual", done: false, created: D(-2) });

  const outreach = [
    ["Marcus Webb", "Summit Peak Partners", "Associate", "Call scheduled", -6, 1, "Coffee chat booked. Prepare questions about the deal process."],
    ["Dana Kim", "Silverline Tech", "Business Operations Manager", "Replied", -2, 0, "Send resume for the referral."],
    ["Elena Ruiz", "Northwind Capital", "Analyst (alum)", "Messaged", -5, 2, "Follow up if no reply by the end of the week."],
    ["Sam Patel", "Atlas Consulting Group", "Senior Consultant", "Connected", -9, 1, "Ask for 15 minutes before first-round decisions."],
    ["Grace Liu", "Kestrel Ventures", "Associate", "Request sent", -3, 4, "Wait for the connection, then message."],
    ["Owen Brooks", "Harbor Point Securities", "Trader (alum)", "Seen", -7, -1, "Follow up with a specific question about the desk."],
    ["Maya Chen", "Lumen Bank", "Corporate Finance Analyst", "Done", -20, null, "Thanked her after the call."],
    ["Leo Martins", "Redwood Asset Management", "Research Associate", "To connect", 0, 2, "Find a shared connection first."],
  ].map(([name, company, title, status, last, follow, nextStep], i) => ({ id: "out" + i, name, company, title, status, lastTouch: D(last), nextFollowUp: follow == null ? "" : D(follow), nextStep, notes: `${short(last)} · ${status}`, source: "LinkedIn paste", created: D(last - 3), updated: D(last) }));

  const plans = [{ id: "northwindcapital", company: "Northwind Capital", goal: "Land the Investment Banking Summer Analyst offer", created: D(-10), items: [
    { id: "p1", text: "Review the 400 technical questions guide (valuation section)", due: D(0), done: false },
    { id: "p2", text: "Practice the deal walk-through out loud", due: D(1), done: false, every: 2 },
    { id: "p3", text: "Message Elena Ruiz about the Superday format", due: D(-1), done: true },
    { id: "p4", text: "Read Northwind's latest market outlook", due: D(1), done: false },
  ] }];

  const worktasks = [
    ["Add a region filter to the churn dashboard", 1, "From Priya's feedback"],
    ["Clean the Q3 pricing dataset", 0, ""],
    ["Draft slides for the client data review", 3, ""],
    ["Submit timesheet", -1, ""],
  ].map(([text, n, notes], i) => ({ id: "w" + i, text, due: D(n), dueTime: "", notes, channel: "#analytics-team", done: n < 0, created: D(-5) }));

  const abroad = [
    { id: "ab0", program: "Business in Lisbon", provider: "StateU Global", term: "Spring 2027", location: "Lisbon, Portugal", status: "Accepted", deadline: D(-20), submitted: D(-30), portal: "https://example.com/", notes: "Accepted. Need to commit by paying the deposit.",
      nextSteps: [{ text: "Pay the $500 commitment deposit", due: D(2), done: false }, { text: "Apply for a student visa", due: D(25), done: false }, { text: "Meet with an advisor about course credits", due: D(9), done: false }, { text: "Submit the program application", due: D(-20), done: true }] },
    { id: "ab1", program: "Copenhagen Business School exchange", provider: "Global Exchange Programs", term: "Fall 2027", location: "Copenhagen, Denmark", status: "Under review", deadline: D(-10), submitted: D(-12), portal: "https://example.com/", notes: "Interview expected next month.",
      nextSteps: [{ text: "Prepare for the exchange interview", due: D(21), done: false }] },
  ];

  const sessions = [[4, 16, 0, 90], [5, 13, 0, 90]].map(([n, h, m, len]) => ({ start: iso(at(n, h, m)), end: iso(new Date(at(n, h, m).getTime() + len * 6e4)), url: link, eventId: "", calendarId: "primary" }));
  const examKey = "t-cal-asfin34002";
  const studyplans = [{ id: "sp-" + examKey, exam: "FIN 3400 Midterm Exam", date: D(6), sessions }];
  sessions.forEach((s, i) => primary.push({ id: "study" + i, summary: "Study: FIN 3400 Midterm Exam", start: { dateTime: s.start }, end: { dateTime: s.end }, htmlLink: link, status: "confirmed" }));

  const settings = [{ id: "goals", apps: 5, outreach: 5 }, { id: "mailreview", ids: [], at: iso(now) }];

  const DB = { classes, tasks, apps, outreach, hidden: [], mailupdates, digests: [], worktasks, abroad, sync: [], settings, studyplans, logos: [], plans, prep: [] };

  /* ------------------------------------------------------------ fake database */
  const listeners = {};
  const clone = o => JSON.parse(JSON.stringify(o));
  const emit = name => setTimeout(() => (listeners[name] || []).forEach(cb => cb({ docs: (DB[name] || []).map(d => ({ id: d.id, data: () => { const { id, ...rest } = clone(d); return rest; } })) })), 0);
  let autoId = 0;
  const docRef = (name, id) => ({
    id,
    async set(data){ DB[name] = (DB[name] || []).filter(d => d.id !== id).concat([{ ...clone(data), id }]); emit(name); },
    async update(data){ DB[name] = (DB[name] || []).map(d => d.id === id ? { ...d, ...clone(data) } : d); emit(name); },
    async delete(){ DB[name] = (DB[name] || []).filter(d => d.id !== id); emit(name); },
  });
  const collection = name => ({
    onSnapshot(cb){ (listeners[name] ||= []).push(cb); emit(name); return () => { listeners[name] = listeners[name].filter(x => x !== cb); }; },
    doc(id){ return docRef(name, id || "auto" + (++autoId)); },
    async add(data){ const id = "auto" + (++autoId); await docRef(name, id).set(data); return { id }; },
  });
  const db = { doc: () => ({ collection }) };

  /* ------------------------------------------------------------ fake connectors */
  const watchers = [];
  function answer(server, tool, args){
    if (server === "Gmail" && tool === "search_threads"){
      const q = String(args.query || "");
      const threads = /study abroad|learning abroad/.test(q) ? abroadThreads : /thank you for applying|application received|unfortunately/i.test(q) ? appThreads : [...generalThreads, ...appThreads.slice(-6)];
      return { threads: threads.slice().sort((a, b) => b.messages[0].date.localeCompare(a.messages[0].date)).slice(0, args.pageSize || 20) };
    }
    if (server === "Gmail" && tool === "get_message") return { plaintextBody: bodies[args.messageId] || "" };
    if (server === "Google Calendar" && tool === "list_calendars") return { calendars: CALENDARS };
    if (server === "Google Calendar" && tool === "list_events"){
      const from = new Date(args.startTime || 0).getTime(), to = new Date(args.endTime || 8.64e15).getTime();
      const evs = (classEvents[args.calendarId || "primary"] || []).filter(e => { const t = new Date(e.start.dateTime || e.start.date).getTime(); return t >= from && t < to; });
      return { events: evs.sort((a, b) => (a.start.dateTime || "").localeCompare(b.start.dateTime || "")) };
    }
    if (server === "Google Calendar" && tool === "create_event"){
      const ev = { id: "new" + Date.now() + Math.random().toString(36).slice(2, 6), summary: args.summary, description: args.description || "", start: args.start || { dateTime: args.startTime }, end: args.end || { dateTime: args.endTime }, htmlLink: link, status: "confirmed" };
      const cal = args.calendarId || "primary";
      (classEvents[cal] ||= []).push(ev);
      setTimeout(() => watchers.filter(w => w.tool === "list_events").forEach(fire), 300);
      return { event: ev };
    }
    throw { code: "tool_error", message: "Not available in the demo" };
  }
  function fire(w){ try { w.cb({ type: "data", result: { payload: clone(answer(w.server, w.tool, w.args)), cache: { storedAt: Date.now() } } }); } catch(e){ w.cb({ type: "error", error: e }); } }
  const mcp = {
    watchTool(server, tool, args, cb){ const w = { server, tool, args, cb }; watchers.push(w); setTimeout(() => fire(w), 250 + Math.random() * 400); return () => { const i = watchers.indexOf(w); if (i >= 0) watchers.splice(i, 1); }; },
    async callTool(server, tool, args){ await new Promise(r => setTimeout(r, 300)); return { payload: clone(answer(server, tool, args)) }; },
    async invalidate(){ setTimeout(() => watchers.forEach(fire), 400); },
  };

  window.claude = {
    async use(name){
      if (name === "db") return db;
      if (name === "user") return { id: async () => "demo-student", name: async () => "Jordan Lee" };
      if (name === "mcp") return mcp;
      return null;   // AI features stay off in the demo
    },
  };

  /* ------------------------------------------------------------ demo banner */
  addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("div");
    b.setAttribute("role", "note");
    b.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;max-width:calc(100% - 32px);padding:9px 10px 9px 16px;border-radius:999px;background:#0f1d33;color:#fff;font:600 13px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px -8px rgba(0,0,0,.45)";
    b.innerHTML = '<span>Demo with made-up data. Gmail and Google Calendar are simulated.</span><a href="../#projects" style="flex:none;color:#0f1d33;background:#fff;border-radius:999px;padding:6px 12px;text-decoration:none">Back to portfolio</a><button aria-label="Hide demo note" style="flex:none;border:0;background:none;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:2px 6px">×</button>';
    b.querySelector("button").onclick = () => b.remove();
    document.body.appendChild(b);
  });
})();
