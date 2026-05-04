# SevaSetu AI — Demo Video Script & Plan

> A storytelling-style walkthrough of the live application, written for delivery in clear, confident English (≈ IELTS Band 7.5). Designed to be recorded as a single 4–5 minute screencast.

---

## 1. The framing — why this video must tell a story, not list features

Judges sit through dozens of demos. Most of them sound the same: *"first we built X, then we added Y, and here is a screenshot of Z."* That kind of demo is forgotten the moment the next one starts.

We will do the opposite. We will follow **one human being** — a coordinator named Priya — through one real working day. Every click on the screen will move her story forward. The platform becomes the supporting cast. By the time the video ends, the judges should not be thinking *"that was a nice app"*; they should be thinking *"that is the way this work should be done."*

Three principles guide the script:

1. **Show the pain before you show the cure.** Spend the first 30 seconds making the judges *feel* the chaos that NGO coordinators live with today — WhatsApp messages, paper forms, gut-feel decisions.
2. **Let the AI speak in human language.** Never say "we call the Gemini API". Say "the system reads the field report the way a senior coordinator would, and pulls out the urgent signals."
3. **End on impact, not on technology.** The final shot should be a number — patients reached, time saved, reports triaged — not a logo or a stack diagram.

---

## 2. What you need ready before recording

| Item | Why |
|---|---|
| Browser at `https://sevasetu-ai-152831472198.asia-south1.run.app` | The live deployed product. Use Chrome, full-screen, 1080p, dock hidden. |
| Logged in as a **coordinator** account (Ram Charan / your account) | So all coordinator-only screens are unlocked. |
| 1 fresh community report ready to paste (Koraput / anaemia / pregnant women — the one we already tested) | Guaranteed clean extraction, fast Gemini response. |
| 1 second report ready (TB outbreak / Rampur) | Shows the system handling a *high-urgency* signal differently from a routine one. |
| Camp Planner open in a second tab, locality "Rampur" pre-selected | Saves 20 seconds of clicking on camera. |
| Operations tab open in a third tab | For the "dispense medicine" reveal at the end. |
| OBS or Loom set to record at 1080p, 30 fps, with mic gain tested | A crisp voice carries the story. |
| A glass of water nearby | One take, no coughs. |

**Rehearse the click path twice without recording.** Muscle memory is the difference between a 4-minute demo and a 7-minute one.

---

## 3. The story arc

```
   ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
   │  THE PAIN  │ -> │  THE INPUT │ -> │  THE BRAIN │ -> │ THE HUMAN  │ -> │ THE IMPACT │
   │  (0:00)    │    │  (0:30)    │    │  (1:15)    │    │  (2:30)    │    │  (4:00)    │
   └────────────┘    └────────────┘    └────────────┘    └────────────┘    └────────────┘
       Priya           Field           Gemini             Workbench         Camp run,
       drowning        report          reads &            review &          patients
       in WhatsApp     pasted          ranks              approval          served
```

Each act is roughly 45–60 seconds. Total target: **4 minutes 30 seconds**, hard cap at **5 minutes**.

---

## 4. The full script — to be read aloud while screen-recording

> **Pacing tip:** Speak slightly slower than you think you should. A relaxed pace sounds confident; a rushed pace sounds nervous. Pause for one full beat after each section heading on screen.

### ACT 1 — The Pain (0:00 – 0:30)

**On screen:** A blurred mock-up of a WhatsApp group full of unread messages, or simply a dark splash screen with the SevaSetu logo. Optional: 2-second cut of a paper register.

> *"Every day, across rural India, a coordinator named Priya wakes up to a hundred unread WhatsApp messages. A village has run out of iron tablets. A child has been hospitalised in the next district. A volunteer is asking which camp to attend on Saturday. Priya has to read all of it, decide what is urgent, and send the right doctor to the right village — before lunch. Today, she does this with a notebook and a gut feeling. We thought she deserved better."*

**Transition:** Fade into the live SevaSetu Dashboard.

---

### ACT 2 — The Input (0:30 – 1:15)

**On screen:** The Dashboard at `/dashboard`, then click into **Command Center**.

> *"This is SevaSetu AI. The first thing Priya sees every morning is the Command Center — a live map of every locality her NGO covers, colour-coded by urgency. The deeper the red, the more help that area needs right now."*

**Action:** Hover one of the red localities so the tooltip with the urgency score appears. Pause for a beat.

> *"That redness is not arbitrary. It is calculated from the field reports flowing in from volunteers, ASHA workers, and citizens — exactly the messages Priya used to read by hand. Let me show you how a new report enters the system."*

**Action:** Click into the **community report submission** form (or Workbench — wherever you accept input). Paste the Koraput anaemia report.

> *"This report just came in from Koraput block in Odisha. It is in plain language — the way a tired field worker actually writes at the end of the day. Watch what happens when we hit submit."*

---

### ACT 3 — The Brain (1:15 – 2:30)

**On screen:** Workbench page. The new Koraput report appears in the queue with a spinner, then turns into a fully extracted card.

> *"In a few seconds, the AI has read the report end-to-end. It has identified the locality. It has separated the medical needs — anaemia screening, blood tests, iron supplements — and given each one a severity score and a confidence number. It has flagged two urgency signals: a vulnerable group, because the patients are pregnant women, and a supply stockout, because the local PHC has run out of iron tablets."*

**Action:** Click the report so the right pane opens. Slowly highlight the **evidence span** — the yellow-highlighted quote from the original text.

> *"Notice the yellow highlight. Every piece of structured data the AI produces is anchored to the exact words in the original report. This is how we make AI trustworthy in a humanitarian setting — the coordinator can always see the receipt. No hallucinations, no black boxes."*

**Action:** Briefly hover the confidence percentage on one of the needs.

> *"Where the model is less than 80 percent confident, we flag it for human review. Anything above that threshold can be approved with one click."*

---

### ACT 4 — The Human in the Loop (2:30 – 3:30)

**On screen:** Still on Workbench. Click **Approve** on the Koraput report.

> *"Priya reads the extraction, agrees with it, and approves. The moment she does, three things happen automatically: the locality's urgency score is recalculated, the report is added to the evidence trail for audits, and the camp planner is notified that Koraput now has a higher priority than it did this morning."*

**Action:** Switch tab to the **Camp Planner** at `/planner` with Rampur already selected.

> *"Now Priya wants to send a health camp to Rampur tomorrow. She tells the system she needs three doctors, two pharmacists, five field volunteers, and three support staff. Then she clicks one button."*

**Action:** Click **Get AI Staff Recommendations**. Pause as the ranked list animates in.

> *"In under two seconds, the AI has scanned every available volunteer, looked at their language skills, their preferred area, their travel radius, their experience level, and their current rating, and ranked the best matches. Each card explains *why* this volunteer was chosen — strong Hindi skills, preferred area match, twelve previous camps, low travel distance. The coordinator is not being replaced. She is being briefed by the best assistant she has ever had."*

**Action:** Tick a few checkboxes (or rely on the pre-selected ones), then click **Create Camp Plan**.

> *"The camp is on the calendar. The volunteers will get their notifications. The work that used to take Priya half a day is done in under a minute."*

---

### ACT 5 — The Impact (3:30 – 4:30)

**On screen:** Switch to **Operations** tab. Show one camp in progress with a "Dispense Medicine" button.

> *"On the day of the camp, our app does not stop helping. Field volunteers use Operations mode to log every patient they see and every medicine they hand out — even when the rural network drops to zero bars."*

**Action:** Click the dispense button or just scroll the operations list.

> *"Everything is queued offline and synced the moment connectivity returns. No data lost, no double-counting, every transaction idempotent."*

**Action:** Switch to **Impact** tab. Show the headline metric — patients reached, camps run, urgency scores trending downward.

> *"And at the end of the month, Priya does not have to write a report. The platform writes it for her — patients reached, lives touched, supply gaps closed. Donors see exactly where their money went. Auditors see the full chain of evidence. Priya sees, for the first time, the difference she actually made."*

---

### CLOSING (4:30 – 5:00)

**On screen:** A clean closing slide with the tagline and a single number — *"X reports triaged today, Y volunteers matched, Z patients reached."*

> *"SevaSetu AI does not replace the Priyas of this world. It gives them the tools the work has always deserved. Built on Next.js, deployed on Google Cloud, powered by Gemini — and shaped, end to end, by the people who actually run health camps in rural India. Thank you."*

**Fade to black.**

---

## 5. Talking points cheat-sheet (for live Q&A after the video)

Pin these mentally. If a judge asks anything, route the answer back to one of these themes.

**1. Trust by design.** Every AI output is anchored to evidence spans. Coordinators approve, edit, or reject — nothing reaches the field without a human signature.

**2. Designed for low-bandwidth, high-stakes contexts.** Offline-first outbox, idempotent writes, deterministic scoring fallback so the platform keeps working when the AI is unavailable.

**3. Cost-aware AI.** We default every task to `gemini-2.5-flash` (generous free tier) with automatic fallback to flash-lite and 2.0-flash on quota or 5xx. The platform stays up even during a model outage.

**4. Fairness baked in.** The volunteer ranker explicitly considers travel burden and recent assignment load, so the same five-star volunteer is not exhausted while newcomers are overlooked.

**5. Explainable matching.** Every recommendation comes with a one-sentence rationale — "Strong Hindi skills, preferred-area match, 12 prior camps." Coordinators learn to trust the system because they can argue with it.

**6. Auditable from day one.** AI audit log captures model name, prompt version, validation pass/fail, and latency for every call. Donors and regulators can replay any decision.

**7. Built on the platforms NGOs can actually maintain.** Firestore for data, Cloud Run for compute, Firebase Auth for identity — no exotic infrastructure, no vendor lock-in beyond what Google already provides for non-profits at no cost.

**8. Human-in-the-loop is not a slogan, it is the default.** The Workbench exists specifically so that AI extractions go through a coordinator's eyes before they shape any decision downstream.

---

## 6. Recording checklist (do this in order)

1. Close every other tab and notification — Slack, Teams, email, Outlook calendar pop-ups.
2. Set system theme to **light** for the app screens (the orange brand pops better against white).
3. Set browser zoom to **100 %**. Anything else looks unprofessional on playback.
4. Open OBS / Loom. Test mic. Speak the first sentence and play it back. Adjust gain.
5. Do **one full silent rehearsal** — every click, every tab switch — to make sure nothing is broken or slow.
6. Record in **one continuous take** if you can. Mistakes under 3 seconds are fine; we will edit them out. Anything longer, restart.
7. Save the raw recording before editing — never edit the only copy.
8. Trim, add a soft background music bed (free, instrumental, low volume), export at 1080p H.264 MP4.
9. Watch the final cut once with headphones at 0.75x speed to catch audio artefacts.
10. Upload to a *public* link (YouTube unlisted is fine) and put the URL in the submission form.

---

## 7. The "win condition" — what we are actually being judged on

Most hackathon judges score on four axes, weighted roughly equally:

- **Problem fit.** Does the team understand the user? *(Act 1 of the video.)*
- **Technical depth.** Is there real engineering, not just a pretty UI? *(Acts 2–3, plus the talking points on auditability and fallback.)*
- **Polish.** Does it actually work end-to-end? *(The whole live demo.)*
- **Impact narrative.** Will this change anything? *(Act 5.)*

Our video is structured so that each act lands one of those punches. If the judges remember Priya, they will remember us.

---

## 8. One last note before you go to dinner

When you sit down to record, do not try to sound like a product manager. Sound like a person who has spent three weeks thinking about Priya. The warmth in your voice is the part that wins this. The platform is already strong; the storytelling is what carries it across the line.

Good luck. Eat well. Come back and we will polish anything in this script you want to change.


