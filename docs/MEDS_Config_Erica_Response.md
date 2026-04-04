# MEDS Configuration — Erica's Response (March 26, 2026)

## Context
Bill sent configuration questions on MEDS defaults. This is Erica's complete response with clinical reasoning.

---

## Decisions

### 1. What Gets Tracked
- Mini PPSI: weekly
- Full PPSI: monthly
- Provider Pulse: monthly
- All compliance items: per selected cadence
- Anchor battery instruments: enrollment, month 1, month 3, month 6
  - **Sunset after 6 months** — do NOT flag missed anchor instruments after month 6 (intentionally discontinued)
  - **NOT calculated in overall score** — anchor instruments are for PPSI validation only

### 2. Grace Period
- **Surveys (PPSI, Provider Pulse, anchor battery): 1 day grace**
  - Reasoning: Supportive not punitive. Don't flag someone who completes at midnight.
- **Compliance items (drug tests, check-ins, appointments): 0 days grace**
  - Reasoning: Contractual and regulatory weight. Detect immediately, interpret generously.
  - The grace period for interpreting the miss is built into the intervention protocol (Protocol Card C), not the detection window.

### 3. Escalation Timing
- **One notification per missed event to assigned item owner** (keep current)
- **NEW REQUEST: 48-hour unacknowledged follow-up**
  - If the registry item created by MEDS goes unacknowledged (not opened/viewed) by the assigned owner for 48+ hours, send ONE follow-up notification
  - This is an operational safety net for staff (sick, on leave, notification buried)
  - Not a reminder to the physician
  - After that, SLA overdue timers in the worklist handle visibility

### 4. Consecutive Miss Threshold
- **Changed from 3 to 2 consecutive misses** for all items
  - Weekly Mini PPSI: 2 consecutive misses = 2 weeks radio silence = critical alert
  - Monthly instruments: 2 consecutive misses = 2 months disengagement = critical alert
- **Critical alert goes to everyone** (all clinical staff)
  - Erica's concern: sending to everyone could dilute accountability
  - Decision: keep it to everyone for now, revisit per program as teams form
  - "I don't want it to be missed. That would have the worst outcome."

### 5. Physician Notification
- **Single notification, no repeated reminders** (keep current)
  - "Repeated system-generated reminders would shift the tone from supportive to punitive"
  - Clinician handles follow-up directly per Protocol Card C
  - First interpretation of a miss is always logistical friction
  - "Automated nag sequences would undermine that clinical relationship"

---

## Changes Required to Current Implementation
1. Change consecutive miss threshold from 3 to 2
2. Add grace_days: 1 day for surveys, 0 days for compliance items
3. Add 48-hour unacknowledged registry item follow-up notification
4. Anchor battery sunset: stop MEDS tracking after enrollment + 6 months
5. Ensure anchor battery scores do NOT feed into composite PPII score
