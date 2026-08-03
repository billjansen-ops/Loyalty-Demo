# Note to Erica — three monitoring-core design questions

Drafted and sent Session 166 (2026-08-03, Bill from AMS airport). Her
answers shape story 3 (check-in channel), the excused-absence re-roll,
and the result-record model (story 4). None block stories 1-2.
Plain-text body below.

---

Erica,

Three design questions as we start the monitoring and toxicology core, your rank 1. Your answers shape how we build it, so early beats perfect.

First, daily check-ins. They only work if the participant checks in each day and learns only then whether they test today. Real participant logins arrive with the consent architecture, your rank 2, which comes after this build. In the meantime, is it acceptable to offer the daily check-in through the same lightweight participant app the weekly check-in uses today, without formal logins? Or would you rather staff record check-ins on the participant's behalf until consents are in place?

Second, excused absences. When a test is excused for travel or illness, should the engine reschedule that test for later in the same period, or drop it? We can build either.

Third, positive results. When a positive comes back from the lab, what should the workflow be? Is a positive recorded and alarmed immediately, or does it sit in a review state until someone, presumably the Medical Director, confirms it after any confirmation testing? And who should be alerted at each step? This shapes how we build the result record itself, so an early answer here helps the most.

None of this blocks the start. Collection sites, testing paradigms, and the random selection engine build the same way regardless, so we are beginning there.

Bill
