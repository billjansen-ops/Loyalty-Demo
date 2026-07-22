# WPHP Platform Wish List — internal gap analysis (Session 152, 2026-07-22)

**Source:** "Platform Wish List WPHP.docx", sent by Erica 2026-07-22 (her
forward of Washington's list; Bill holds the file — his working docs
stay untracked). **INTERNAL ONLY** — Bill deliberately did NOT share
this analysis with Erica; she was asked for her unprimed read, her
pilot-vs-production split, and a ranking (master-list style). Reconcile
her answer against this when it arrives, then fold into the master
list process. Tom deliberately not included on this thread.

**Headline:** ~60% of the list exists today or is already spec'd on
Erica's ranked roadmap. The true gaps cluster into four construction
groups. Nothing threatens the architecture; nothing on their list has
predictive risk scoring.

## Already have (no gap)
Search (participant search; a global cross-entity search would be M) ·
Alerts (notification system) · Pre-referrals/Inquiries (registrant
pipeline + intake queue) · Case notes · Participant stages
(INTAKE_STATUS) · Demographics · Treatment/assessments (10-instrument
catalog) · Documents (repository) · Notable incidents (event
reporting) · Surveys · Organizations (partners/clinics/affiliations) ·
CSV exports · Participant record as PDF · Worklists (registry, intake
queue, follow-ups cover most of "To Do List/Tasks"; ad-hoc personal
tasks would be M).

## Already planned / spec'd (waiting on non-code gates)
Current medications (Med Registry spec, her #4) · Consents +
agreements (consent architecture, her #2 — legal-gated) · Secure
messaging (consent-gated) · Collection-site-style directories (Network
Directory, her #3) · Lab integrations (LOI commits them for pilot;
scoped at kickoff).

## Gap items, t-shirt sized
| Gap | Size | Note |
|---|---|---|
| Random test selection + notice (Paradigms) | L | Real engine; WA table stakes |
| Daily check-ins | M | Portal machinery exists; participant logins are the dependency |
| Calendar + automated rescheduling | L | No appointment machinery exists (Damian flagged too) |
| Excused absences | S | Request/approve flow once portal has logins |
| Toxicology detail (panels, COC) | L | Folds into med-registry + lab work |
| Lab integrations | XL | Vendors, BAAs, interfaces; pilot-committed |
| Billing | L | Nothing exists |
| Letter/form templates | M | Screen-template machinery exists; letters don't |
| Group requirements + facilitator portal | L | Group machinery + first external-party portal |
| Liaison portal | M | Cheaper once the first external portal pattern exists |
| Participant portal with real logins | M | Consent-gated (her #2 unlocks) |
| Board actions / discipline history | M | Boards + credentials exist; actions are a new record type |
| Drugs of choice | S | One member list |
| Customizable reports | L | Builder is big; canned-reports page covering their 20 examples is M (mostly queries on data we hold) |
| eSignature | L | Vendor + BAA, consent-gated |
| Portal announcements | S | Rides notifications |

## Their 20 report examples
Nearly all are queries over existing data (admissions/discharges,
by-stage, caseloads, missed check-ins/tests, positives, sentinel
events, expiring consents once consents exist). A canned-reports page
is the M-sized answer; a self-serve builder is the L.

## Pilot vs production (Bill's instinct, awaiting Erica's read)
The October pilot is validation, not live monitoring — little of this
list gates the pilot. The June 2027 production date is where the
testing-engine cluster and portals land. Erica's answer decides.
