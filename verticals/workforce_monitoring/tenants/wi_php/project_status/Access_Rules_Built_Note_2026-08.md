# Note to Erica — document access rules built (Story 4 complete)

Drafted Session 166 (2026-08-03, Bangalore hours). Bill sends directly to
Erica. Flags the two spec wrinkles for her confirmation. Bill's call
2026-08-03: the raw-database/hosting-credentials boundary does NOT go in
this note (it stays stated on the Emergency Access screen and in the
build record). Plain-text body below.

---

Subject: Your document access rules are built

Erica,

Your PI2 document access rules are now fully built. All four pieces are done and proven: the confidentiality tiers with the role permission matrix, audit-before-serve on every view, download, and export, the registrant boundary with the explicit promotion and release actions, and the break-glass procedure with the IHS lockout.

Nothing changes on screen yet. Every program is still running in open mode, exactly as today. The rules wake up only when we flip a program to rules mode, and that flip is one setting per program, reversible, whenever you say the word.

Your section 9 acceptance criteria, AC-1 through AC-8, are all proven by an automated test that now runs on every change we make. That includes the one that constrains us: with rules on, my logins and my assistant's logins get no document content and no document metadata at all. The only way back in is an emergency grant your program records in advance, naming the person and the specific documents, expiring on its own in 24 hours, with you and your Program Administrator notified automatically and every document opened written to the audit trail. There is a small Emergency Access page under Program Settings where those grants are recorded and revoked.

Two places in your spec needed an interpretation, and we would like your confirmation on both. First, your lifecycle rules make superseded versions visible to the Medical Director and Case Manager only, but your matrix gives the Program Administrator full management of org-level business documents. We resolved it this way: superseded versions of participant documents follow your lifecycle rule, and the Program Administrator additionally keeps visibility of superseded org-level documents they manage. Second, your matrix gives the Program Administrator no upload permission on sensitive documents, but your spec also says the PA manages ingestion and inbound faxes default to sensitive. We resolved it this way: uploads that have not yet been classified are open to all three classifying roles, and uploads with a type attached require upload permission at that type's default tier. If either reading is wrong, it is a small change.

When you are ready to turn the rules on for a program, just say so. Happy to walk through any of it.

Bill
