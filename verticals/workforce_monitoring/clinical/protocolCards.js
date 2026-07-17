/**
 * protocolCards.js — Protocol Card Reference Library
 * Wisconsin PHP / Insight Health Solutions
 *
 * Complete clinical protocol card content for the PI² platform.
 * Cards are grouped by category:
 *   - PPSI Sub-domain (A1-A8): Domain-specific interventions
 *   - Provider Pulse (P1-P5): Clinician observation signals
 *   - Stream-level (A, B, C, D): Pathway-level cards
 *   - Safety (S1): Suicide risk screening
 *   - Multi-Stream (M1-M3): Co-dominant and discordance patterns
 *   - Trajectory (T1-T5): Destabilization archetypes
 *   - Intervention Failure (F1): Structured reassessment
 *   - Enhanced Events (D2-D3): Compound and state-dependent
 *
 * Authored by Erica Larson, Clinical Director
 * Extended Protocol Cards delivered March 29, 2026
 */

const PROTOCOL_CARDS = {

  // =====================================================================
  // PPSI SUB-DOMAIN CARDS (A1-A8)
  // Original cards — domain-specific interventions when PPSI is dominant
  // =====================================================================

  A1: {
    id: 'A1',
    name: 'Sleep Reset',
    category: 'ppsi_subdomain',
    categoryLabel: 'PPSI Sub-domain',
    color: '#6366f1',
    summary: 'Sleep stability domain is the dominant driver. Sleep disruption is often the earliest-activating domain in destabilization trajectories and a root cause for downstream domain elevation.',
    steps: [
      { step: 1, action: 'Assess sleep pattern changes: onset latency, maintenance, early awakening, total sleep hours, sleep hygiene behaviors, substance use before bed, screen time, call schedule impact.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Review medication list for sleep-affecting agents. Coordinate with prescribing clinician if medication adjustment may help.', timeline: 'At initial contact' },
      { step: 3, action: 'Implement sleep hygiene protocol: consistent wake time, no screens 1h before bed, caffeine cutoff, exercise timing, environment optimization.', timeline: 'Within 1 week' },
      { step: 4, action: 'If call schedule is contributing, discuss schedule modification with employer liaison if appropriate.', timeline: 'Within 2 weeks' },
      { step: 5, action: 'Success checks: Sleep domain score trending down. Monitor for downstream domain improvement (burnout, cognitive often follow sleep).', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly until improved' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user if Orange/Red or if sleep disruption persists beyond 4-week check.',
    successMetric: 'Sleep domain score reduced by 2+ points at 2-week check. Downstream domains stabilizing. No new domain activation.',
    escalationTrigger: 'Sleep domain continues rising despite intervention. OR downstream domains (burnout, cognitive) begin escalating. OR substance use suspected as cause of sleep disruption.',
    registryDisplay: 'Dominant Driver: PPSI — Sleep Stability | Protocol: Card A1',
  },

  A2: {
    id: 'A2',
    name: 'Burnout Mitigation',
    category: 'ppsi_subdomain',
    categoryLabel: 'PPSI Sub-domain',
    color: '#6366f1',
    summary: 'Emotional exhaustion / burnout domain is the dominant driver. Evidence indicates burnout scores of 9-10/15 rarely reverse without active intervention. This domain is often downstream of sleep or work sustainability issues.',
    steps: [
      { step: 1, action: 'Assess burnout dimensions: emotional exhaustion, depersonalization, reduced personal accomplishment. Identify primary contributors (workload, lack of autonomy, values conflict, inadequate support).', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Explore upstream causes: Is sleep disruption driving burnout? Is work environment the root? Is this a values/purpose crisis rather than workload?', timeline: 'At initial contact' },
      { step: 3, action: 'Coordinate with treatment provider on burnout-specific interventions: cognitive restructuring, boundary setting, mindfulness-based stress reduction.', timeline: 'Within 1 week' },
      { step: 4, action: 'If work environment is primary contributor, assess need for employer liaison involvement (Card A3 co-activation).', timeline: 'Within 2 weeks' },
      { step: 5, action: 'Success checks: Burnout domain score trending down. Monitor for improvement in related domains (work, purpose).', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly until improved' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user at Orange/Red or if burnout score is 9+/15.',
    successMetric: 'Burnout domain reduced by 2+ points at 4-week check. At least one contributing factor identified and addressed.',
    escalationTrigger: 'Burnout score reaches or exceeds 9/15. OR depersonalization indicators present (patient safety concern). OR no improvement after 4-week intervention.',
    registryDisplay: 'Dominant Driver: PPSI — Emotional Exhaustion / Burnout | Protocol: Card A2',
  },

  A3: {
    id: 'A3',
    name: 'Work Sustainability',
    category: 'ppsi_subdomain',
    categoryLabel: 'PPSI Sub-domain',
    color: '#6366f1',
    summary: 'Work sustainability domain is the dominant driver. Work-related destabilization often requires coordination beyond the participant, including employer liaison and practice environment assessment.',
    steps: [
      { step: 1, action: 'Assess work-related stressors: hours/call burden, practice demands, colleague relationships, administrative burden, scope changes, patient load.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Determine if stressors are modifiable (schedule adjustment, role change) vs. structural (toxic environment, specialty demands).', timeline: 'At initial contact' },
      { step: 3, action: 'If modifiable: coordinate with employer liaison to discuss accommodations. Document recommendations for practice environment changes.', timeline: 'Within 2 weeks' },
      { step: 4, action: 'If structural: work with treatment provider on coping strategies, boundary reinforcement, and assessment of whether current practice setting is sustainable for recovery.', timeline: 'Within 2 weeks' },
      { step: 5, action: 'Success checks: Work domain score trending down. Monitor burnout domain (often co-activates with work).', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly until improved' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user at Orange/Red or when employer liaison involvement is needed.',
    successMetric: 'Work domain reduced by 2+ points at 4-week check. Modifiable stressors identified and at least one addressed.',
    escalationTrigger: 'Work domain continues rising despite intervention. OR burnout co-activates (Card A2). OR participant reports inability to maintain safe practice.',
    registryDisplay: 'Dominant Driver: PPSI — Work Sustainability | Protocol: Card A3',
  },

  A4: {
    id: 'A4',
    name: 'Isolation / Peer Support',
    category: 'ppsi_subdomain',
    categoryLabel: 'PPSI Sub-domain',
    color: '#6366f1',
    summary: 'Isolation and social support domain is the dominant driver. Evidence indicates isolation scores >8 correlate with 65-75% destabilization within 60 days. This domain carries elevated safety risk when combined with purpose/meaning decline.',
    steps: [
      { step: 1, action: 'Assess isolation dimensions: social withdrawal, loss of peer connections, shame/stigma avoidance, geographic isolation, relationship disruption.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Evaluate current support system: recovery community engagement, peer support contacts, family/friend relationships, professional network.', timeline: 'At initial contact' },
      { step: 3, action: 'Facilitate peer connection: PHP peer support group referral, recovery community engagement, professional re-engagement opportunities.', timeline: 'Within 1 week' },
      { step: 4, action: 'If shame/stigma is primary driver, coordinate with treatment provider on shame resilience work and normalization of monitoring experience.', timeline: 'Within 2 weeks' },
      { step: 5, action: 'Success checks: Isolation domain score trending down. SAFETY CHECK: If Isolation >8 AND Purpose/Meaning (A7) >8 simultaneously, surface safety advisory per Card S1 considerations.', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly until improved' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user if isolation score >8 or if combined with elevated purpose/meaning domain.',
    successMetric: 'Isolation domain reduced by 2+ points at 2-week check. At least one new peer connection facilitated. Support system inventory completed.',
    escalationTrigger: 'Isolation score >8 at any check. OR Isolation + Purpose/Meaning both elevated (safety risk). OR participant becomes unreachable (withdrawal pattern). OR social support system has collapsed.',
    registryDisplay: 'Dominant Driver: PPSI — Isolation + Support | Protocol: Card A4',
  },

  A5: {
    id: 'A5',
    name: 'Cognitive Protection',
    category: 'ppsi_subdomain',
    categoryLabel: 'PPSI Sub-domain',
    color: '#6366f1',
    summary: 'Cognitive load domain is the dominant driver. Cognitive concerns may reflect sleep deprivation, medication effects, substance use, mood disorder, or genuine neurocognitive change. Requires careful differential assessment.',
    steps: [
      { step: 1, action: 'Assess cognitive concerns: concentration, memory, decision-making, mental clarity, processing speed. Distinguish subjective complaints from objective impairment.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Review contributing factors: sleep quality (check A1), medication effects, substance use history, mood/anxiety symptoms, workload/fatigue.', timeline: 'At initial contact' },
      { step: 3, action: 'If sleep-related: address sleep first (cognitive often improves when sleep improves). If medication-related: coordinate with prescriber.', timeline: 'Within 1 week' },
      { step: 4, action: 'If cognitive concerns persist after addressing contributing factors, discuss formal neuropsychological evaluation with treatment provider.', timeline: 'At 4-week check if not improving' },
      { step: 5, action: 'Success checks: Cognitive domain score trending down. Cross-reference with sleep domain improvement.', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly until improved' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user at Orange/Red or if patient safety implications (surgical/procedural specialties).',
    successMetric: 'Cognitive domain reduced by 2+ points at 4-week check. Contributing factor identified. If sleep-related, sleep domain also improving.',
    escalationTrigger: 'Cognitive concerns persist after addressing sleep and medication. OR participant reports near-miss or safety concern related to cognitive function. OR formal evaluation recommended.',
    registryDisplay: 'Dominant Driver: PPSI — Cognitive Load | Protocol: Card A5',
  },

  A6: {
    id: 'A6',
    name: 'Recovery Reconstruction',
    category: 'ppsi_subdomain',
    categoryLabel: 'PPSI Sub-domain',
    color: '#6366f1',
    summary: 'Recovery and routine domain is the dominant driver. Disruption to recovery routines (meetings, therapy, exercise, medication compliance, healthy habits) is a leading indicator of relapse risk.',
    steps: [
      { step: 1, action: 'Assess recovery routine status: meeting attendance, therapy engagement, exercise, medication compliance, sponsor/peer contact, healthy daily structure.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Identify what disrupted the routine: schedule change, travel, illness, complacency, external stressor, relationship change.', timeline: 'At initial contact' },
      { step: 3, action: 'Recovery routine restoration plan: prioritize the highest-impact routine elements first. Typically: therapy/counseling > peer support/meetings > exercise > daily structure.', timeline: 'Within 1 week' },
      { step: 4, action: 'If complacency is the driver ("I don\'t need meetings anymore"), coordinate with treatment provider on relapse prevention refresher and recovery maintenance education.', timeline: 'Within 2 weeks' },
      { step: 5, action: 'Success checks: Recovery domain score trending down. Monitor compliance stream for convergent signals. Consider enhanced drug testing if recovery disruption is significant.', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly until improved' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user at Orange/Red or if relapse risk indicators present.',
    successMetric: 'Recovery domain reduced by 2+ points at 2-week check. At least two key routine elements restored. Compliance stream stable.',
    escalationTrigger: 'Recovery domain continues rising. OR compliance stream begins declining simultaneously (convergent relapse signal). OR participant reports substance use urges/cravings.',
    registryDisplay: 'Dominant Driver: PPSI — Recovery / Routine | Protocol: Card A6',
  },

  A7: {
    id: 'A7',
    name: 'Professional Re-engagement',
    category: 'ppsi_subdomain',
    categoryLabel: 'PPSI Sub-domain',
    color: '#6366f1',
    summary: 'Meaning and professional purpose domain is the dominant driver. Loss of professional identity and purpose is common during monitoring and carries elevated risk when combined with isolation. This domain is often the slowest to recover.',
    steps: [
      { step: 1, action: 'Assess meaning/purpose dimensions: professional identity, career satisfaction, sense of contribution, future outlook, shame about monitoring status.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Explore the narrative: Does the participant see monitoring as temporary vs. career-ending? Is professional identity intact or damaged? Are they engaged in their work or going through the motions?', timeline: 'At initial contact' },
      { step: 3, action: 'Facilitate purpose reconnection: professional development opportunities, mentorship (giving or receiving), teaching, community service, specialty-specific engagement.', timeline: 'Within 2 weeks' },
      { step: 4, action: 'SAFETY CHECK: If Purpose/Meaning >8 AND Isolation (A4) >8, surface safety advisory per Card S1 considerations. This combination carries disproportionate risk.', timeline: 'At every check' },
      { step: 5, action: 'Success checks: Purpose domain score trending down. This domain recovers slowly — expect 8-16 week trajectory. Monitor isolation domain as co-indicator.', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly until improved' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user if purpose score >8 or combined with isolation elevation.',
    successMetric: 'Purpose domain reduced by 1+ points at 4-week check (slower recovery expected). Participant can articulate positive professional identity elements. No safety concern.',
    escalationTrigger: 'Purpose score >8 AND Isolation >8 (safety risk). OR participant expresses hopelessness about career or future. OR no improvement after 8-week intervention.',
    registryDisplay: 'Dominant Driver: PPSI — Meaning + Purpose | Protocol: Card A7',
  },

  A8: {
    id: 'A8',
    name: 'Global Stability',
    category: 'ppsi_subdomain',
    categoryLabel: 'PPSI Sub-domain',
    color: '#6366f1',
    summary: 'Global stability domain is the dominant driver. Elevation in this domain without strong sub-domain specificity suggests diffuse distress or a stressor that cuts across multiple life areas.',
    steps: [
      { step: 1, action: 'Comprehensive assessment: Since global elevation lacks a specific domain target, conduct a broad-spectrum check-in covering all major life domains.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Look for hidden drivers: Is there an undisclosed stressor? A domain that is rising but hasn\'t yet crossed thresholds? A life event not yet reported?', timeline: 'At initial contact' },
      { step: 3, action: 'If a specific driver emerges during assessment, transition to the appropriate sub-domain card (A1-A7) and close global card.', timeline: 'At initial contact' },
      { step: 4, action: 'If diffuse distress without clear driver, coordinate with treatment provider for comprehensive clinical assessment.', timeline: 'Within 1 week' },
      { step: 5, action: 'Success checks: Global domain trending down OR specific driver identified and appropriate sub-domain card activated.', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly until improved' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user at Orange/Red.',
    successMetric: 'Either: global score reduced by 2+ points, OR specific sub-domain driver identified and transitioned to appropriate card.',
    escalationTrigger: 'Global score continues rising without identifiable cause. OR multiple domains begin activating (transition to Card M1). OR participant disengages from assessment.',
    registryDisplay: 'Dominant Driver: PPSI — Global Stability | Protocol: Card A8',
  },

  // =====================================================================
  // PROVIDER PULSE CARDS (P1-P5)
  // Clinician observation signal cards
  // =====================================================================

  P1: {
    id: 'P1',
    name: 'Provider Stability Concern',
    category: 'pulse',
    categoryLabel: 'Provider Pulse',
    color: '#0891b2',
    summary: 'Treating clinician has flagged a general stability concern through the Provider Pulse assessment. Clinician observations are particularly valuable because they detect behavioral changes the participant may not self-report.',
    steps: [
      { step: 1, action: 'Contact treating clinician to discuss specific observations driving the stability concern. What behavioral changes have they noticed?', timeline: 'Within 48h' },
      { step: 2, action: 'Cross-reference with PPSI self-report: Is the participant reporting similar concerns? If discordant (clinician concerned, participant not), consider Card M3.', timeline: 'At clinician contact' },
      { step: 3, action: 'Contact participant for check-in based on clinician observations. Frame supportively, not confrontationally.', timeline: 'Within 72h' },
      { step: 4, action: 'Coordinate care plan: ensure clinician concerns are being addressed in treatment.', timeline: 'Within 1 week' },
      { step: 5, action: 'Success checks: Provider Pulse score improving at next assessment. PPSI concordance improving if previously discordant.', timeline: 'At next Provider Pulse submission, then 4, 8 weeks' },
    ],
    assignment: 'Clinical-authority user (primary). Clinician concerns require clinical-level response.',
    successMetric: 'Provider Pulse stability rating improved at next assessment. Concordance between clinician observation and self-report.',
    escalationTrigger: 'Clinician stability concern persists or worsens. OR discordance with self-report increases (Card M3). OR clinician identifies specific safety concern (Card P5/S1).',
    registryDisplay: 'Dominant Driver: Provider Pulse — Stability Concern | Protocol: Card P1',
  },

  P2: {
    id: 'P2',
    name: 'Sleep Reduction',
    category: 'pulse',
    categoryLabel: 'Provider Pulse',
    color: '#0891b2',
    summary: 'Treating clinician has observed sleep-related deterioration through the Provider Pulse assessment. Clinician-observed sleep changes may be more reliable than self-report, especially when the participant is minimizing.',
    steps: [
      { step: 1, action: 'Confirm clinician observations: What sleep-related changes have they noticed? Fatigue, appearance, cognitive slowing, mood changes linked to sleep?', timeline: 'Within 48h' },
      { step: 2, action: 'Cross-reference with PPSI Sleep domain (A1): Are self-report sleep scores also elevated? If not, the clinician may be detecting what the participant is not reporting.', timeline: 'At clinician contact' },
      { step: 3, action: 'Implement sleep assessment and intervention per Card A1 steps, with additional weight given to clinician observations.', timeline: 'Per Card A1 timeline' },
      { step: 4, action: 'Success checks: Provider Pulse sleep signal improved AND PPSI Sleep domain improved.', timeline: 'At next Provider Pulse, then 4, 8 weeks' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user at Orange/Red.',
    successMetric: 'Provider Pulse sleep signal improved. PPSI Sleep domain concordant. Participant sleep patterns stabilizing.',
    escalationTrigger: 'Clinician sleep concern persists. OR substance use suspected as sleep disruption cause. OR cognitive impairment observed.',
    registryDisplay: 'Dominant Driver: Provider Pulse — Sleep Reduction | Protocol: Card P2',
  },

  P3: {
    id: 'P3',
    name: 'Treatment Engagement',
    category: 'pulse',
    categoryLabel: 'Provider Pulse',
    color: '#0891b2',
    summary: 'Treating clinician has flagged declining treatment engagement through the Provider Pulse assessment. Reduced engagement with treatment is a behavioral signal that often precedes self-report deterioration.',
    steps: [
      { step: 1, action: 'Contact treating clinician: What specific engagement changes? Missed appointments, superficial sessions, resistance to topics, going through the motions?', timeline: 'Within 48h' },
      { step: 2, action: 'Assess engagement barriers: Is this logistical (schedule conflict), motivational (complacency), avoidant (shame/denial), or relational (therapeutic alliance issue)?', timeline: 'At clinician contact' },
      { step: 3, action: 'If logistical: address barriers directly. If motivational: recovery maintenance discussion per Card A6. If avoidant or relational: clinical-authority review.', timeline: 'Within 1 week' },
      { step: 4, action: 'Cross-reference with compliance stream: Are compliance behaviors also declining? Convergent disengagement signal is a higher-risk pattern.', timeline: 'At initial assessment' },
      { step: 5, action: 'Success checks: Clinician reports improved engagement. Compliance stream stable or improving.', timeline: 'At next Provider Pulse, then 4, 8 weeks' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user if engagement decline is avoidance-driven or combined with compliance decline.',
    successMetric: 'Provider Pulse engagement signal improved. Treatment attendance and participation restored. Compliance stream stable.',
    escalationTrigger: 'Engagement continues declining. OR compliance stream declines simultaneously. OR clinician recommends treatment plan change.',
    registryDisplay: 'Dominant Driver: Provider Pulse — Treatment Engagement | Protocol: Card P3',
  },

  P4: {
    id: 'P4',
    name: 'Mood + Workload',
    category: 'pulse',
    categoryLabel: 'Provider Pulse',
    color: '#0891b2',
    summary: 'Treating clinician has observed mood and/or functional workload concerns through the Provider Pulse assessment. This combined signal reflects the clinician\'s view of the participant\'s emotional state and ability to manage professional demands.',
    steps: [
      { step: 1, action: 'Contact treating clinician: What mood changes observed? What functional work concerns? Are these connected (mood affecting work) or independent?', timeline: 'Within 48h' },
      { step: 2, action: 'Cross-reference with PPSI Burnout (A2) and Work (A3) domains. Assess concordance between clinician observation and self-report.', timeline: 'At clinician contact' },
      { step: 3, action: 'If mood-primary: coordinate with treatment provider on mood management — medication review, therapy intensification. If work-primary: assess per Card A3.', timeline: 'Within 1 week' },
      { step: 4, action: 'If both mood and work are elevated, assess for burnout syndrome (Card A2) as the common upstream cause.', timeline: 'Within 2 weeks' },
      { step: 5, action: 'Success checks: Provider Pulse mood/function signals improved. Concordant PPSI domains improving.', timeline: 'At next Provider Pulse, then 4, 8 weeks' },
    ],
    assignment: 'Clinical-authority user (primary). Mood concerns require clinical-level assessment.',
    successMetric: 'Provider Pulse mood + function signals improved. PPSI concordant domains improving. Participant functioning adequately in practice.',
    escalationTrigger: 'Mood concern worsens. OR functional impairment affects patient care. OR clinician recommends practice restriction or higher level of care.',
    registryDisplay: 'Dominant Driver: Provider Pulse — Mood + Workload | Protocol: Card P4',
  },

  P5: {
    id: 'P5',
    name: 'Safety Concern',
    category: 'pulse',
    categoryLabel: 'Provider Pulse',
    color: '#dc2626',
    summary: 'Treating clinician has flagged a safety concern through the Provider Pulse assessment. This is the highest-priority clinician signal and triggers immediate clinical-authority engagement. Safety concerns may include suicidal ideation, patient safety risk, or fitness-for-duty questions.',
    steps: [
      { step: 1, action: 'IMMEDIATE: Contact treating clinician for specifics. What is the nature of the safety concern? Participant safety? Patient safety? Both?', timeline: 'Same day' },
      { step: 2, action: 'If participant safety (suicidal ideation, self-harm risk): Activate Card S1 immediately. Contact participant same day.', timeline: 'Same day' },
      { step: 3, action: 'If patient safety (impairment, fitness-for-duty): Notify escalation-authority user. Assess need for immediate practice restriction pending evaluation.', timeline: 'Same day' },
      { step: 4, action: 'Document safety assessment findings, actions taken, and follow-up plan.', timeline: 'Same day' },
      { step: 5, action: 'Intensive monitoring: daily check-in until safety concern resolved. Weekly success checks.', timeline: 'Daily until resolved, then weekly' },
    ],
    assignment: 'Clinical-authority user (primary). Escalation-authority user notified immediately.',
    successMetric: 'Safety concern resolved. Clinician confirms no ongoing safety risk. Participant stable and safe. Practice safety confirmed.',
    escalationTrigger: 'THIS CARD STARTS AT MAXIMUM URGENCY. Escalation-authority user is notified at activation. Further escalation if participant is unreachable or if imminent risk is identified.',
    registryDisplay: 'Dominant Driver: Provider Pulse — SAFETY CONCERN | Protocol: Card P5 | IMMEDIATE',
  },

  // =====================================================================
  // STREAM-LEVEL PATHWAY CARDS (A, B, C, D)
  // Used when no sub-domain drill-down is available
  // =====================================================================

  A: {
    id: 'A',
    name: 'PPSI Dominant Pathway',
    category: 'stream',
    categoryLabel: 'Stream Pathway',
    color: '#6366f1',
    summary: 'PPSI self-report is the dominant driver but sub-domain analysis was not available (insufficient survey history for comparison). General PPSI intervention pathway applies until sub-domain specificity can be determined.',
    steps: [
      { step: 1, action: 'Contact participant for comprehensive check-in covering all PPSI domains: sleep, burnout, work, isolation, cognitive, recovery, purpose, global stability.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Identify the most elevated domain(s) from the conversation. Once identified, transition to the appropriate sub-domain card (A1-A8).', timeline: 'At initial contact' },
      { step: 3, action: 'Ensure next PPSI survey is completed on schedule to enable sub-domain drill-down for future detection.', timeline: 'At next survey window' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user at Orange/Red.',
    successMetric: 'Sub-domain identified and appropriate card activated. PPSI total score trending down.',
    escalationTrigger: 'Unable to identify specific sub-domain. OR PPSI total continues rising. OR participant disengages from assessment.',
    registryDisplay: 'Dominant Driver: PPSI (sub-domain pending) | Protocol: Pathway A',
  },

  B: {
    id: 'B',
    name: 'Provider Pulse Dominant Pathway',
    category: 'stream',
    categoryLabel: 'Stream Pathway',
    color: '#0891b2',
    summary: 'Provider Pulse is the dominant driver but signal-level analysis was not available (insufficient Pulse history for comparison). General Pulse intervention pathway applies.',
    steps: [
      { step: 1, action: 'Contact treating clinician to discuss overall observations driving the Pulse elevation.', timeline: 'Within 48h' },
      { step: 2, action: 'Identify the specific signal(s) driving clinician concern. Once identified, transition to the appropriate signal card (P1-P5).', timeline: 'At clinician contact' },
      { step: 3, action: 'Ensure next Provider Pulse is submitted on schedule to enable signal drill-down.', timeline: 'At next Pulse window' },
    ],
    assignment: 'Clinical-authority user (primary). Clinician observation signals require clinical response.',
    successMetric: 'Specific signal identified and appropriate card activated. Provider Pulse score trending down.',
    escalationTrigger: 'Clinician concern persists without clear signal. OR Pulse score continues rising.',
    registryDisplay: 'Dominant Driver: Provider Pulse (signal pending) | Protocol: Pathway B',
  },

  C: {
    id: 'C',
    name: 'Compliance Dominant Pathway',
    category: 'stream',
    categoryLabel: 'Stream Pathway',
    color: '#d97706',
    summary: 'Compliance stream is the dominant driver. Compliance deterioration (missed drug tests, late check-ins, skipped surveys) is a behavioral signal that may indicate disengagement, relapse, or external stressors disrupting routine.',
    steps: [
      { step: 1, action: 'Review specific compliance failures: Which items were missed? Is there a pattern (same type of item, same day of week, escalating frequency)?', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 2, action: 'Contact participant to assess reason for compliance disruption. Distinguish logistical barriers from behavioral disengagement.', timeline: 'Per tier timeline' },
      { step: 3, action: 'If logistical: address barriers (scheduling, access, reminders). If behavioral: assess for recovery disruption (Card A6) or avoidance pattern.', timeline: 'Within 1 week' },
      { step: 4, action: 'If compliance decline co-occurs with PPSI elevation, treat as convergent signal — heightened relapse risk. Consider enhanced drug testing.', timeline: 'At initial assessment' },
      { step: 5, action: 'Success checks: Compliance items completed on time. No new misses. PPSI stable.', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user if compliance + PPSI both declining or if missed drug tests.',
    successMetric: 'No compliance misses for 2 consecutive weeks. Barriers addressed. PPSI stable or improving.',
    escalationTrigger: 'Compliance continues declining. OR missed drug test. OR compliance + PPSI co-declining (convergent relapse signal). OR participant unreachable.',
    registryDisplay: 'Dominant Driver: Compliance | Protocol: Pathway C',
  },

  D: {
    id: 'D',
    name: 'Events Dominant Pathway',
    category: 'stream',
    categoryLabel: 'Stream Pathway',
    color: '#059669',
    summary: 'A destabilizing event has been reported and is the dominant contributor to PPII elevation. Events include life stressors, professional incidents, health changes, and relationship disruptions. Response intensity scales with event severity.',
    steps: [
      { step: 1, action: 'Review event details: type, severity (1-3), date, participant-reported impact. Assess whether the event is resolved, ongoing, or escalating.', timeline: 'Severity 1: 72h | Severity 2: 48h | Severity 3: Same day' },
      { step: 2, action: 'Contact participant to assess impact and current coping. Is the event being processed in treatment? Are support systems engaged?', timeline: 'Per severity timeline' },
      { step: 3, action: 'Monitor for secondary destabilization: Events often trigger PPSI domain elevation 1-2 weeks after the event. Watch for delayed domain activation.', timeline: 'Ongoing for 4 weeks post-event' },
      { step: 4, action: 'If multiple events in a short window, activate Card D2 (Compound Event Cascade).', timeline: 'At any 2nd event within 14 days' },
      { step: 5, action: 'Success checks: PPII returning to pre-event baseline. No secondary domain activation. Participant reports adequate coping and support.', timeline: '2, 4 weeks post-event' },
    ],
    assignment: 'Outreach-level user (primary) for severity 1-2. Clinical-authority user for severity 3.',
    successMetric: 'PPII returns to pre-event baseline within 4 weeks. No secondary destabilization cascade. Event processed in treatment.',
    escalationTrigger: 'PPII continues rising post-event. OR secondary domains activate. OR additional events occur (Card D2). OR participant reports inadequate coping.',
    registryDisplay: 'Dominant Driver: Event — [type] (Severity [X]) | Protocol: Pathway D',
  },

  // =====================================================================
  // SAFETY CARD (S1)
  // =====================================================================

  S1: {
    id: 'S1',
    name: 'Suicide Risk Screening',
    category: 'safety',
    categoryLabel: 'Safety',
    color: '#dc2626',
    summary: 'SUPERSEDES ALL OTHER CARDS when activated. Triggered when safety indicators are present: Isolation (A4) >8 AND Meaning/Purpose (A7) >8 simultaneously, Provider Pulse safety flag (P5), PPSI safety note, or clinical-authority assessment. Physicians have elevated suicide risk compared to the general population.',
    steps: [
      { step: 1, action: 'IMMEDIATE clinical-authority engagement. Contact participant same day. If imminent risk suspected, follow emergency protocols (911, crisis line, emergency contact).', timeline: 'IMMEDIATE — same day, no exceptions' },
      { step: 2, action: 'Conduct structured safety assessment. Assess: current ideation (passive vs. active), plan specificity, access to means, protective factors, recent losses/stressors.', timeline: 'At initial contact' },
      { step: 3, action: 'Coordinate with treating clinician immediately. Ensure safety plan is in place or created. Assess need for higher level of care (inpatient, intensive outpatient).', timeline: 'Same day as participant contact' },
      { step: 4, action: 'If means restriction is needed (especially firearms), coordinate with clinician and support system. Document safety plan.', timeline: 'Same day' },
      { step: 5, action: 'Intensive monitoring: daily contact until clinical-authority confirms safety. Then weekly until Isolation and Purpose domains both below 6. All other protocol cards are suspended until S1 is resolved.', timeline: 'Daily until cleared, then weekly' },
    ],
    assignment: 'Clinical-authority user (primary). Escalation-authority user notified IMMEDIATELY at activation. This is non-negotiable.',
    successMetric: 'Safety plan in place. No active suicidal ideation. Treating clinician confirms stability. Isolation <6 AND Purpose <6. Connected to appropriate support resources.',
    escalationTrigger: 'THIS CARD OPERATES AT MAXIMUM ESCALATION. Any indication of imminent risk triggers emergency protocols. Participant unreachable for >4 hours triggers welfare check coordination.',
    registryDisplay: 'SAFETY ALERT — Card S1 Active | ALL OTHER CARDS SUSPENDED | Clinical Authority Required | IMMEDIATE',
  },

  // =====================================================================
  // MULTI-STREAM & CO-DOMINANT CARDS (M1-M3)
  // Extended Protocol Cards — Erica Larson, March 29 2026
  // =====================================================================

  M1: {
    id: 'M1',
    name: 'Multi-Domain PPSI Deterioration',
    category: 'multi_stream',
    categoryLabel: 'Multi-Stream',
    color: '#8b5cf6',
    summary: 'Three or more PPSI domains are simultaneously elevated 2+ points above the participant\'s personal trailing baseline. Standard sub-domain routing (Cards A1-A8) is insufficient because the destabilization is broader than any single domain. This pattern is present at the point of clinical concern in approximately 70-80% of destabilization trajectories.',
    whatThisIsNot: 'Not a collection of independent domain problems. Multi-domain elevation typically reflects a systemic destabilization process with an underlying driver that may not be the highest-scoring domain. Treating each domain independently fragments the clinical response.',
    steps: [
      { step: 1, action: 'Domain breadth assessment: Count domains elevated 2+ above personal baseline. Identify the domain activation sequence from historical weekly data (which domain rose first, second, third). The earliest-activating domain is the likely root cause, not the highest-scoring domain.', timeline: 'Automated by system at detection' },
      { step: 2, action: 'Root cause analysis: Contact participant. Rather than asking about each domain independently, ask: "What has changed in your life or practice over the past few weeks that might be affecting multiple areas?" Explore for: schedule/workload change, relationship disruption, substance use recurrence, medication change, untreated medical condition.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 3, action: 'Integrated intervention plan: Based on root cause, design a single coordinated intervention that addresses the upstream driver rather than multiple parallel interventions. If root cause is work-related, prioritize Card A3 + employer liaison. If relapse-related, prioritize treatment plan review + Card A6. If personal crisis, prioritize Card D event triage + Cards A1/A4.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 4, action: 'Expedited Provider Pulse: Request expedited Provider Pulse assessment within 1-2 weeks (do not wait for monthly cycle) to cross-reference clinician observation with self-report pattern.', timeline: 'Within 2 weeks of initial contact' },
      { step: 5, action: 'Success checks: Evaluate at 2, 4, and 8 weeks. Success requires improvement in the root-cause domain AND at least one secondary domain. Track domain breadth (number of elevated domains) as the primary metric rather than any single domain score.', timeline: 'Yellow/Orange: 2, 4, 8 weeks | Red: weekly until Yellow/Orange, then 2, 4, 8 weeks' },
    ],
    assignment: 'Clinical-authority user (primary) when 4+ domains elevated or at Orange/Red. Outreach-level user (primary) when exactly 3 domains elevated at Yellow.',
    successMetric: 'Domain breadth reduced by 1+ (at least one domain returns below elevated threshold) at 2-week check. Root cause identified and addressed. PPII trend stable or improving. At 4-week check: 2+ domains improved. At 8-week check: no more than 1 domain remains elevated.',
    escalationTrigger: 'Domain breadth increases (additional domains join) at any success check. OR no domain improves after 2 weeks. OR compliance stream begins to decline concurrent with multi-domain PPSI elevation. Escalate to escalation-authority user for comprehensive clinical review.',
    tierAdjustedSuccess: 'Yellow: 1+ point reduction in root-cause domain. Orange: 2+ points total reduction across domains. Red: 3+ points total OR tier-level improvement.',
    registryDisplay: 'Dominant Driver: PPSI — Multi-Domain ([count] domains elevated) | Root Cause: [identified or pending] | Protocol: Card M1',
  },

  M2: {
    id: 'M2',
    name: 'Cross-Stream Co-Dominant Pattern',
    category: 'multi_stream',
    categoryLabel: 'Multi-Stream',
    color: '#8b5cf6',
    summary: 'Two or more PPII streams (PPSI, Provider Pulse, Compliance, Events) contribute within 5 percentage points of each other to the overall PPII score increase. The standard Dominant Driver algorithm selects one, but the clinical significance lies in the co-occurrence. Evidence indicates that self-report elevation + compliance decline occurring simultaneously is 2-3 times more predictive of destabilization than either signal alone.',
    whatThisIsNot: 'Not two unrelated problems requiring separate protocol cards. Co-dominant streams typically reflect the same underlying destabilization expressed through different measurement channels.',
    steps: [
      { step: 1, action: 'Co-dominance detection: System flags when the top two stream contributions are within 5 percentage points. Display both streams and their specific sub-signals in the Registry item. Do NOT force selection of a single driver.', timeline: 'Automated by system at detection' },
      { step: 2, action: 'Stream concordance assessment: Evaluate whether the two streams are telling a consistent story. PPSI + Compliance co-dominant: Are the PPSI domains that are rising consistent with the compliance items that are declining? PPSI + Provider Pulse co-dominant: Is the clinician observing what the participant is self-reporting, or is there discordance? Compliance + Events co-dominant: Are events driving compliance disruption, or is compliance declining independently?', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 3, action: 'Unified intervention: Execute the protocol card for whichever stream represents the upstream cause. The secondary stream is monitored as a confirmation signal. If PPSI + Compliance: treat as potential Silent Slide precursor (see Card T4). If PPSI + Provider Pulse concordant: standard intervention per dominant sub-domain with heightened confidence in the signal. If PPSI + Provider Pulse discordant: prioritize Provider Pulse assessment (clinician observation more reliable when discordant).', timeline: 'Per tier SLA' },
      { step: 4, action: 'Dual-stream success tracking: Both streams must show improvement for the item to progress toward resolution. If only one stream improves while the other continues to deteriorate, the item remains open and the intervention is reassessed.', timeline: '2, 4, 8 week checks (both streams evaluated at each)' },
    ],
    assignment: 'Clinical-authority user (primary) when any stream combination includes Provider Pulse or when overall tier is Orange/Red. Outreach-level user when PPSI + Compliance at Yellow.',
    successMetric: 'Both co-dominant streams show improvement at 2-week check. The more severe stream shows 1+ point improvement in its dominant sub-signal. Concordance between streams improves (gap narrows if previously discordant).',
    escalationTrigger: 'Either stream continues to worsen at 2-week check despite intervention targeting the other stream. OR a third stream begins to contribute (expansion from 2 to 3 co-dominant streams). OR PPSI + Compliance co-dominance persists for 2+ consecutive assessments (elevated Silent Slide risk).',
    registryDisplay: 'Dominant Driver: Co-Dominant — [Stream 1] + [Stream 2] | Protocol: Card M2 | Concordance: [Aligned / Discordant]',
  },

  M3: {
    id: 'M3',
    name: 'Self-Report / Clinician Observation Discordance',
    category: 'multi_stream',
    categoryLabel: 'Multi-Stream',
    color: '#8b5cf6',
    summary: 'Provider Pulse severity exceeds PPSI self-report by >15% on comparable scales for 2+ consecutive months, OR PPSI self-report is stable/low while Provider Pulse Stability Alert is "Emerging instability" or higher. This discordance is itself an independent predictive signal. Evidence indicates the Silent Slide pattern (3-5% of monitored participants) is characterized precisely by this discordance and carries disproportionate SENTINEL event risk.',
    whatThisIsNot: 'Not a signal that the participant is lying. Discordance can reflect: (1) genuine lack of self-awareness, (2) denial as a clinical feature of SUD, (3) impression management motivated by fear of consequences, or (4) clinician over-sensitivity. The first three require intervention; the fourth requires calibration. Approach with curiosity, not accusation.',
    steps: [
      { step: 1, action: 'Discordance quantification: System computes the concordance gap: (Provider Pulse total, scaled to 0-102 range) minus (PPSI total). Flag when gap exceeds 15 points for 2+ consecutive months, OR when Provider Pulse Stability Alert is "Emerging" or higher while PPSI total is <20.', timeline: 'Automated at each Provider Pulse submission' },
      { step: 2, action: 'Clinical-authority engagement: This card routes to clinical-authority user, not outreach-level. Contact the submitting clinician first: confirm observations, discuss specific behavioral cues driving the discordance. Ask: "What are you seeing that the participant may not be reporting?"', timeline: 'Within 48h regardless of tier (discordance signals are inherently urgent)' },
      { step: 3, action: 'Participant contact: Frame as a care coordination conversation, not a confrontation about honesty. "Your care team has noticed some things that they want to make sure you have support for. Can we talk about how things are going?" Listen for evasion, deflection, or overly uniform positive responses.', timeline: 'Within 72h of clinician contact' },
      { step: 4, action: 'Enhanced monitoring: Increase Mini PPSI frequency or activate signal-triggered expansion modules. Request Provider Pulse at 2-week interval rather than monthly. Monitor compliance engagement quality metrics (survey timeliness, response variability) for Silent Slide indicators.', timeline: 'Ongoing from detection' },
      { step: 5, action: 'Success checks: Evaluate concordance gap at each Provider Pulse cycle. Track whether discordance is narrowing (either self-report rising to match clinician observation, OR clinician observation improving).', timeline: 'At next Provider Pulse (request expedited), then monthly' },
    ],
    assignment: 'Clinical-authority user (primary). Outreach-level user supports logistics only. This card requires clinical judgment to navigate the discordance without damaging the participant\'s trust in the monitoring system.',
    successMetric: 'Concordance gap narrows to <10 points. Provider Pulse Stability Alert returns to "No immediate concern." Participant\'s self-report aligns more closely with clinical observation. No SENTINEL event within 90 days.',
    escalationTrigger: 'Concordance gap widens or persists for 3+ consecutive months. OR compliance engagement begins to decline (confirming Silent Slide progression). OR SENTINEL event occurs. Escalate to escalation-authority user.',
    safetyIntegration: 'If Isolation (A4) is 8+ AND Meaning/Purpose (A7) is 8+ AND discordance is present, system surfaces advisory to clinical-authority user recommending heightened awareness for safety risk per Card S1 considerations.',
    registryDisplay: 'CONCORDANCE ALERT — Provider Pulse / PPSI Discordance (Gap: [X] points, [Y] months) | Protocol: Card M3',
  },

  // =====================================================================
  // DESTABILIZATION ARCHETYPE CARDS (T1-T5)
  // Extended Protocol Cards — Erica Larson, March 29 2026
  // =====================================================================

  T1: {
    id: 'T1',
    name: 'Slow Burn Trajectory',
    category: 'trajectory',
    categoryLabel: 'Trajectory Archetype',
    color: '#f59e0b',
    summary: 'PPSI total score has increased by 15+ points over 6+ weeks with no single-week spike >8 points, AND 3+ domains have joined the upward trend sequentially. This is the most common destabilization pattern (~30-35% of destabilizers) and represents gradual, multi-week deterioration without a clear triggering event. The existing threshold-based system misses 30-40% of Slow Burns because no single 3-week window shows a +14 point jump.',
    distinguishingFeature: 'The Slow Burn card activates based on TRAJECTORY SHAPE, not absolute score. A participant at PPSI 28 (Yellow) who has risen from 12 over 8 weeks triggers this card even though they are below the Orange threshold. This is the predictive advantage over threshold-based detection.',
    steps: [
      { step: 1, action: 'Trajectory confirmation: System flags Slow Burn when cumulative 6-week PPSI increase is 15+ AND week-over-week increases have been consistent (+1 to +3 per week) without spikes. Review domain activation sequence: which domain rose first (likely root cause)?', timeline: 'Automated by system when pattern criteria met' },
      { step: 2, action: 'Clinical timeline reconstruction: Contact participant. Map the trajectory to life events: "Looking back over the past 6-8 weeks, can you identify when things started to shift?" The participant may not have noticed the gradual change. Presenting their own score trend (via mobile app Trends view) can be a powerful awareness tool.', timeline: 'Yellow: 72h | Orange: 48h | Red: Same day' },
      { step: 3, action: 'Root-cause intervention: Address the earliest-activating domain (typically Sleep or Recovery/Routine per evidence). Execute the corresponding sub-domain card (A1 or A6). Simultaneously address any external stressor identified in timeline reconstruction.', timeline: 'Per tier SLA' },
      { step: 4, action: 'Cascade prevention: Because Slow Burns involve sequential domain activation, intervening on the root domain may prevent downstream domains from escalating further. Monitor the next domain in the expected cascade sequence. If Sleep was root, monitor Burnout closely.', timeline: 'Ongoing from detection' },
      { step: 5, action: 'Extended success monitoring: Slow Burns develop over 8-16 weeks, so recovery takes longer (evidence: 12-24 weeks for moderate-to-severe). Extend the success check schedule to 2, 4, 8, AND 12 weeks. The 8-week sustained stability confirmation may be premature for this trajectory.', timeline: '2, 4, 8, 12 week checks' },
    ],
    assignment: 'Outreach-level user (primary) at Yellow. Clinical-authority user (primary) at Orange/Red or if 4+ domains involved.',
    successMetric: 'Cumulative PPSI trend reverses (week-over-week change becomes negative or flat for 2+ consecutive weeks). Root-cause domain improves by 2+ points. Domain breadth stops expanding. At 12-week check: PPSI total returned to within 10 points of pre-trajectory baseline.',
    escalationTrigger: 'Trajectory continues to steepen (weekly increases accelerating). OR compliance stream begins declining (signals transition from Slow Burn toward crisis). OR 5+ domains elevated simultaneously. Escalate to clinical-authority user.',
    registryDisplay: 'TRAJECTORY ALERT — Slow Burn Pattern Detected (6-week delta: +[X] pts, [Y] domains activated) | Protocol: Card T1 + [Active Dominant Driver Card]',
  },

  T2: {
    id: 'T2',
    name: 'Acute Break Trajectory',
    category: 'trajectory',
    categoryLabel: 'Trajectory Archetype',
    color: '#f59e0b',
    summary: 'PPSI total has increased by 20+ points within 1-2 weeks, OR 3+ domains have spiked simultaneously by 3+ points each. This pattern accounts for ~15-20% of destabilizers and is almost always triggered by an identifiable event. Response must be immediate and comprehensive because the destabilization is already in progress.',
    steps: [
      { step: 1, action: 'Trigger identification: System flags Acute Break when single-week PPSI increase >15 points OR 2-week increase >20 points. Immediately check Event stream: was an event reported in the same period? Check compliance: any SENTINEL signals?', timeline: 'Automated at detection — auto-elevate urgency to minimum Orange' },
      { step: 2, action: 'Immediate stabilization contact: This is NOT a routine outreach. Contact participant same day regardless of computed tier. Ask directly: "Something significant appears to have changed. Are you safe? What has happened?" Assess for: active substance use, psychiatric crisis, acute personal crisis, patient safety event.', timeline: 'Same day (all tiers)' },
      { step: 3, action: 'Multi-stream rapid assessment: Within 24 hours, evaluate all four PPII streams. Request emergency Provider Pulse from treating clinician (do not wait for monthly cycle). Review compliance status from the same period. The goal is a complete 4-stream picture within 48 hours.', timeline: 'Within 24-48h' },
      { step: 4, action: 'Crisis stabilization plan: Based on trigger identification, deploy the most intensive intervention available. If event-triggered: Card D event triage at severity-3 response level. If relapse-related: immediate treatment plan review + enhanced drug testing. If psychiatric: Card S1 safety screening consideration + treating clinician coordination.', timeline: 'Same day' },
      { step: 5, action: 'Intensive monitoring: Weekly PPSI + weekly success checks until scores show 2 consecutive weeks of improvement. Daily compliance monitoring. Provider Pulse at 1-week and 2-week intervals.', timeline: 'Weekly until stabilized' },
    ],
    assignment: 'Clinical-authority user (primary for all Acute Breaks). Escalation-authority user notified automatically. Outreach-level user supports logistics.',
    successMetric: 'PPSI total decreasing from peak for 2 consecutive weeks. Triggering event identified and addressed. No SENTINEL event. Compliance behavior intact or re-established. At 4 weeks: PPSI reduced by 50%+ from peak. At 8 weeks: PPSI within 15 points of pre-break baseline.',
    escalationTrigger: 'THIS CARD STARTS AT ELEVATED RESPONSE. Further escalation if: PPSI continues rising after initial intervention. OR SENTINEL event occurs. OR participant is unreachable for >24 hours. Escalate to escalation-authority user + fitness-for-duty consideration.',
    registryDisplay: 'TRAJECTORY ALERT — Acute Break Detected (1-week delta: +[X] pts) | Trigger: [Event/Unknown] | Protocol: Card T2 + [Active Driver Cards] | URGENT',
  },

  T3: {
    id: 'T3',
    name: 'Oscillator Trajectory',
    category: 'trajectory',
    categoryLabel: 'Trajectory Archetype',
    color: '#f59e0b',
    summary: 'PPSI scores show a repeating pattern of rise and partial recovery over 3+ cycles (typically 3-6 week periods), fluctuating between Yellow and Orange without achieving sustained Green stability or progressing to Red crisis. This accounts for ~20-25% of destabilizers. The system must distinguish escalating oscillation (worsening prognosis) from stabilizing oscillation (improving prognosis).',
    steps: [
      { step: 1, action: 'Oscillation detection: System flags when PPSI total has crossed above and below the same threshold (e.g., Yellow/Green boundary or Yellow/Orange boundary) 3+ times within 12 weeks. Compute: peak-to-peak trend (are peaks getting higher?), trough-to-trough trend (are troughs getting higher?), amplitude (is the swing widening?).', timeline: 'Automated when 3rd oscillation cycle detected' },
      { step: 2, action: 'Pattern classification: Escalating oscillator: peaks increasing AND/OR troughs increasing — prognosis unfavorable, treat as pre-crisis. Stabilizing oscillator: peaks decreasing AND/OR troughs decreasing — prognosis favorable, maintain current support. Stable oscillator: neither trending — chronic borderline management (see Card T5).', timeline: 'At detection' },
      { step: 3, action: 'Cycle-aware intervention timing: Interventions are most effective during the upswing (when scores are rising), not during the trough (when scores have temporarily improved). If the participant is currently in a trough phase, do NOT close the Registry item. Schedule the intervention for when the next upswing begins (proactive rather than reactive).', timeline: 'Proactive: at next predicted upswing onset' },
      { step: 4, action: 'Underlying pattern exploration: Oscillation often reflects cyclical external stressors (call rotation, monthly schedule patterns, menstrual cycle, medication compliance cycling) or comorbid mood disorders (bipolar spectrum, cyclothymia). Explore with participant: "We\'ve noticed your scores tend to improve and then worsen again on a [X]-week cycle. Does that pattern match anything in your schedule or experience?"', timeline: 'Within first cycle after detection' },
      { step: 5, action: 'Sustained monitoring: This card remains active until 2 consecutive cycles show improvement (peaks lower than previous peaks, troughs lower than previous troughs) OR the participant achieves 8 consecutive weeks in Green. Standard 2/4/8-week checks are insufficient for oscillators — use cycle-aligned checks instead.', timeline: 'Evaluated at each oscillation peak and trough' },
    ],
    assignment: 'Outreach-level user (primary) for stabilizing oscillators. Clinical-authority user (primary) for escalating oscillators.',
    successMetric: 'Oscillation amplitude decreasing (each peak lower than previous). Trough scores improving (each low point closer to Green). At 12 weeks: either sustained Green achieved OR oscillation classified as stabilizing. Compliance behavior stable throughout oscillation cycles.',
    escalationTrigger: 'Escalating oscillator pattern confirmed (3+ cycles with increasing peaks). OR compliance begins declining during trough phases (should be stable even when scores are temporarily better). OR peak score crosses into Red tier at any cycle. Escalate to clinical-authority user.',
    registryDisplay: 'TRAJECTORY ALERT — Oscillator Pattern Detected ([X] cycles over [Y] weeks) | Classification: [Escalating/Stabilizing/Stable] | Peak Trend: [Rising/Flat/Falling] | Protocol: Card T3',
  },

  T4: {
    id: 'T4',
    name: 'Silent Slide Pattern',
    category: 'trajectory',
    categoryLabel: 'Trajectory Archetype',
    color: '#f59e0b',
    summary: 'PPSI self-report is stable or low (<25) while one or more of the following is true: (1) Provider Pulse scores are rising or Provider Stability Alert is "Emerging" or higher, (2) Compliance engagement quality is declining (later submissions, decreased response variability, reduced app engagement), (3) Concordance gap exceeds 15 points for 2+ months. This is the least common (~8-12% of destabilizers) but most dangerous pattern, carrying disproportionate SENTINEL event risk.',
    criticalNote: 'DETECTION REQUIRES SECONDARY SIGNALS. The Silent Slide cannot be detected by PPSI alone (that is its defining feature). Detection depends on: concordance gap monitoring (Card M3), compliance engagement quality metrics (survey timeliness, response variability, app login frequency), and Provider Pulse signals. These secondary detection mechanisms must be built into the promotion engine.',
    steps: [
      { step: 1, action: 'Silent Slide flag: System activates when PPSI <25 AND (Provider Pulse equivalent >35 for 2+ months OR compliance engagement quality score declining for 3+ weeks OR Provider Stability Alert "Emerging"+ with PPSI Green). This flag supersedes the standard Dominant Driver analysis because the dominant driver calculation will show no PPSI signal.', timeline: 'Automated when criteria met' },
      { step: 2, action: 'Clinical-authority engagement (mandatory): This card ALWAYS routes to clinical-authority user regardless of tier. Contact treating clinician first to confirm clinical observations. Discuss specific behavioral cues. Assess whether the discordance reflects denial, minimization, or impression management.', timeline: 'Within 48h (regardless of computed tier)' },
      { step: 3, action: 'Non-confrontational participant engagement: Contact participant. Do NOT reveal the discordance directly or accuse of underreporting. Frame as: "Your care team wants to check in. How are you really doing? Sometimes people in monitoring programs feel pressure to present things positively — this is a safe space to be honest." Listen for evasion, deflection, or overly uniform positive responses.', timeline: 'Within 72h of clinician contact' },
      { step: 4, action: 'Enhanced surveillance activation: (a) Increase drug testing frequency per clinical determination. (b) Activate signal-triggered PPSI expansion modules for all domains. (c) Request Provider Pulse at 2-week intervals. (d) Monitor compliance engagement quality metrics weekly. (e) Track survey completion patterns: are responses becoming formulaic (identical scores week after week)?', timeline: 'Ongoing from detection' },
      { step: 5, action: '90-day intensive monitoring: This card remains active for 90 days minimum. Success is measured by either: the discordance resolving (self-report aligning with clinician observation), OR a genuine clinical explanation emerging (clinician agrees participant is actually stable and clinician adjusts assessment), OR the Silent Slide converting to an overt pattern (PPSI rises to match Provider Pulse, at which point standard cards activate).', timeline: '90-day minimum active period' },
    ],
    assignment: 'Clinical-authority user (primary). Escalation-authority user notified at detection. This is a high-risk pattern requiring clinical judgment throughout.',
    successMetric: 'Concordance gap narrows to <10 points. OR clinician confirms participant is genuinely stable (Provider Pulse improves to match PPSI). No SENTINEL event within 90 days. Compliance engagement quality metrics stabilize or improve.',
    escalationTrigger: 'SENTINEL event occurs (confirms Silent Slide was masking active relapse). OR concordance gap widens despite intervention. OR participant becomes unreachable or disengages from contact. OR compliance items begin to be formally missed (transition from engagement quality decline to overt compliance failure). Immediate escalation to Red workflow.',
    registryDisplay: 'PATTERN ALERT — Silent Slide Suspected (Concordance Gap: [X] pts, Duration: [Y] months, PPSI: [Z]) | Protocol: Card T4 + Card M3 | CLINICAL AUTHORITY REQUIRED',
  },

  T5: {
    id: 'T5',
    name: 'Chronic Borderline Management',
    category: 'trajectory',
    categoryLabel: 'Trajectory Archetype',
    color: '#f59e0b',
    summary: 'Participant has remained in Yellow tier (PPSI 20-39) for 12+ consecutive weeks without achieving sustained Green stability, despite at least one full protocol card intervention cycle. Standard protocol cards have been activated, interventions delivered, and the participant improved partially but did not return to Green. This accounts for ~10-15% of destabilizers and is the most resource-intensive pattern for clinical management.',
    steps: [
      { step: 1, action: 'Chronicity recognition: System flags when a participant has been in Yellow tier for 12+ consecutive weeks AND has had at least 1 completed protocol card cycle (activated, intervened, success-checked, but not fully resolved). Distinguish from oscillator: Chronic Borderline scores are relatively stable within the Yellow range, not cycling above and below.', timeline: 'Automated when 12-week Yellow threshold met' },
      { step: 2, action: 'Comprehensive clinical review: This is not a repeat of the previous intervention. Clinical-authority user conducts a full stabilization assessment: treatment plan adequacy, medication review, support system inventory, monitoring agreement review, and consideration of whether the participant\'s baseline has shifted (some participants may have a "new normal" that is higher than pre-monitoring baseline).', timeline: 'Within 1 week of detection' },
      { step: 3, action: 'Adapted expectations and goal-setting: Collaborative discussion with participant about realistic stability goals. If the participant\'s functional status is adequate at Yellow (performing well clinically, engaged in treatment, compliant), consider whether the Yellow range represents stable recovery for this individual rather than ongoing destabilization.', timeline: 'At clinical review' },
      { step: 4, action: 'Long-term monitoring plan: Transition from acute intervention cadence (2/4/8 week checks) to sustained monitoring cadence: monthly check-ins, quarterly comprehensive review, continued weekly Mini PPSI. Reduce intervention intensity to prevent monitoring fatigue while maintaining detection capability.', timeline: 'Ongoing — monthly checks, quarterly reviews' },
      { step: 5, action: 'Trajectory boundary monitoring: While accepting Yellow as a potentially stable state, the system must still detect if the Chronic Borderline begins to deteriorate toward Orange. Set personalized thresholds: if PPSI total exceeds the participant\'s personal Yellow-tier average by >5 points, reactivate acute protocol card response.', timeline: 'Ongoing — system monitors personal thresholds' },
    ],
    assignment: 'Outreach-level user (primary) for ongoing monitoring. Clinical-authority user for quarterly reviews and any threshold breach.',
    successMetric: 'Stable Yellow maintenance without Orange excursions. Compliance fully intact. Participant engaged in treatment and monitoring. Functional work status maintained. At 6-month review: either gradual improvement toward Green, OR documented clinical determination that current Yellow range is stable recovery for this participant.',
    escalationTrigger: 'PPSI exceeds personal Yellow-tier average by >5 points (suggests progression beyond chronic borderline). OR compliance begins to decline (suggests disengagement from stable management). OR Provider Pulse Stability Alert changes from "No concern" to "Emerging." Reactivate acute protocol card response.',
    registryDisplay: 'MANAGEMENT PLAN — Chronic Borderline (Yellow-tier [X] weeks, [Y] completed intervention cycles) | Protocol: Card T5 | Monitoring: Sustained Cadence',
  },

  // T6: Repeated Moderate — Early Warning (3-week trigger that precedes T5's
  // 12-week chronic threshold). Shipped in pointers.js detection but missing
  // from the card library — Erica found dead links on Yellow/Orange items
  // that had been open for 3+ weeks. Modeled on T5 (same trajectory family)
  // with timelines and success criteria adjusted for the earlier window.
  T6: {
    id: 'T6',
    name: 'Repeated Moderate — Early Warning',
    category: 'trajectory',
    categoryLabel: 'Trajectory Archetype',
    color: '#f59e0b',
    summary: 'Participant has had an open Yellow- or Orange-tier registry item for 3+ consecutive weeks without resolution. The standard 2-week success check has passed, the item is still active, and the destabilization is now classified as repeated moderate — sustained but not yet chronic. T6 fires before T5\'s 12-week chronic threshold to surface participants who may be sliding toward Chronic Borderline (T5) so that a course-correction is attempted while the window for acute intervention is still open. T6 is suppressed if T5 is already active for the same participant — once chronic borderline status is established, T5 supersedes.',
    whatThisIsNot: 'T6 is not a relapse signal and not a tier escalation — the participant remains at the same Yellow or Orange tier as the source item. It is also not Card T1 (Slow Burn): T1 detects gradual cumulative increase from a Green baseline, while T6 detects sustained elevation in an already-open registry item.',
    distinguishingFeature: 'Time-on-registry trigger, not a score-pattern trigger. The source registry item is still open and the urgency has not changed — what triggers T6 is duration alone (21+ days). This early-warning window between week 3 and week 12 is the highest-yield intervention period: the participant has not yet adapted to a chronic borderline state, but the original protocol card has clearly not produced full resolution.',
    steps: [
      { step: 1, action: 'Confirm the source item is genuinely unresolved (not a stale-status clerical issue): re-check the most recent PPSI, Provider Pulse, and compliance signals. If any signal indicates resolution, close the source item and skip T6 activation.', timeline: 'Within 48h of T6 detection' },
      { step: 2, action: 'Mid-cycle review of the active intervention: was the original protocol card the right call given everything we now know? Re-examine the Dominant Driver — has it shifted in the past 3 weeks? Has a second domain activated (consider escalating to M1)? Is participant engagement intact (sessions attended, surveys submitted on time)?', timeline: 'Within 1 week of T6 detection' },
      { step: 3, action: 'Course-correct or reaffirm: if the reassessment surfaces a new driver or a missed factor, modify the active intervention (this may include activating Card F1 if the original card has formally failed at its 2-week success check). If the reassessment confirms the original plan, document the explicit decision to continue and set an early-warning success check at 6 weeks total (3 weeks from now).', timeline: 'At reassessment completion' },
      { step: 4, action: 'Bridge to T5 watch: T6 is the early warning for chronic borderline drift. Begin tracking weeks-at-tier explicitly so the transition to T5 (at 12 weeks) is anticipated rather than reactive. Set the participant on a personalized weekly Mini PPSI check-in if they are not already.', timeline: 'Ongoing — through week 12 or item resolution' },
      { step: 5, action: 'Resolution or escalation: if the participant returns to Green within the T6 window, close both the source item and T6. If the source item remains open at 12 weeks, T6 closes and T5 (Chronic Borderline) takes over as the active trajectory card.', timeline: 'At source-item resolution OR week 12' },
    ],
    assignment: 'Outreach-level user (primary) for routine T6. Clinical-authority user when reassessment surfaces a new Dominant Driver or when course-correction modifies the intervention plan.',
    successMetric: 'Source registry item resolves to Green within the T6 window (weeks 3–12). Mid-cycle review documented in the registry resolution notes. No tier escalation during the T6 window. If the participant transitions to T5 at week 12, the T6 documentation provides the intervention history that T5\'s comprehensive review depends on.',
    escalationTrigger: 'Tier worsens (Yellow → Orange or Orange → Red) during the T6 window. OR a second domain activates (escalate via M1). OR original protocol card hits its formal failure trigger (escalate via F1). OR participant disengages from monitoring.',
    registryDisplay: 'EARLY WARNING — Repeated Moderate (Source registry #[X], [Y] weeks at [Yellow/Orange]) | Protocol: Card T6 | Watch for T5 transition at 12 weeks',
  },

  // =====================================================================
  // INTERVENTION FAILURE CARD (F1)
  // Extended Protocol Cards — Erica Larson, March 29 2026
  // =====================================================================

  F1: {
    id: 'F1',
    name: 'Intervention Failure — Structured Reassessment',
    category: 'intervention_failure',
    categoryLabel: 'Intervention Failure',
    color: '#ef4444',
    summary: 'A standard protocol card (A-D or sub-domain) has been activated, intervention delivered per protocol steps, and the escalation trigger has fired at the 2-week or 4-week success check because the success metric was not met. OR: the initial protocol card showed partial improvement that subsequently reversed (brief dip pattern). This card defines what the "next capability level" does when it receives an escalated item.',
    steps: [
      { step: 1, action: 'Failure pattern classification: Review the score trajectory since the original protocol card was activated. Classify as: (a) No response — scores remained elevated with no meaningful improvement. (b) Brief dip then resumption — scores improved 20-30% for 1-3 weeks, then resumed destabilization trajectory. (c) Domain shift — the targeted domain improved but a different domain escalated. (d) Partial plateau — scores improved partially but stalled at a level above the success threshold.', timeline: 'At escalation receipt' },
      { step: 2, action: 'Root cause reassessment: The original intervention targeted the wrong root cause, OR the root cause was correctly identified but the intervention was insufficient. Clinical-authority user conducts a structured reassessment: Was the Dominant Driver correctly identified? (Check Driver Override history.) Was the intervention delivered fully and on time? (Check SLA compliance.) Did the participant engage with the intervention? (Check participant feedback, session attendance.) Are there undisclosed factors? (Request updated Provider Pulse.)', timeline: 'Within 48h of escalation' },
      { step: 3, action: 'Intervention modification (by failure pattern): (a) No response: Re-evaluate Dominant Driver. Consider Driver Override. Increase intervention intensity (more frequent contact, higher-level clinician engagement). (b) Brief dip: The underlying cause was not addressed. Consider relapse-related trajectory — activate enhanced drug testing and treatment plan review. (c) Domain shift: Activate Card M1 (Multi-Domain). The destabilization is broader than the initial single-domain intervention addressed. (d) Partial plateau: Consider whether the participant is a Chronic Borderline (Card T5). Adjust success criteria to reflect realistic recovery trajectory.', timeline: 'Within 72h of reassessment' },
      { step: 4, action: 'Tier reassessment: If the participant\'s PPII score has crossed a tier boundary during the failed intervention period, the new tier\'s SLA requirements apply to the modified intervention. If tier has worsened, all timelines compress.', timeline: 'At intervention modification' },
      { step: 5, action: 'Second-cycle success checks: The modified intervention follows a new 2/4/8-week success check cycle. If the second cycle also fails to produce improvement, the item escalates to escalation-authority user for program-level review: Is the monitoring agreement adequate? Does the treatment plan need revision? Is a higher level of care indicated?', timeline: 'New 2, 4, 8 week cycle from modified intervention' },
    ],
    assignment: 'Clinical-authority user (primary) for all escalated items. Escalation-authority user notified if this is the second intervention failure for the same participant.',
    successMetric: 'Modified intervention produces measurable improvement (1+ point in target domain, or tier improvement) within 2 weeks of modification. Failure pattern does not repeat. At 8 weeks: PPII trend is clearly improving.',
    escalationTrigger: 'Second consecutive intervention failure (original card + Card F1 modification both unsuccessful). OR participant disengages from the reassessment process. OR SENTINEL event occurs during the failed intervention period. Escalate to escalation-authority user for program-level review.',
    documentation: 'The failure classification, reassessment findings, and intervention modification are documented in the Registry resolution notes. This data feeds directly into the annual review\'s protocol effectiveness analysis, specifically: which cards have the highest failure rates, which failure patterns are most common, and whether specific participant populations are overrepresented in intervention failures.',
    registryDisplay: 'INTERVENTION FAILURE — [Original Card] Failed at [2/4/8]-Week Check | Failure Pattern: [No Response / Brief Dip / Domain Shift / Partial Plateau] | Protocol: Card F1 | Modified Intervention: [Description]',
  },

  // =====================================================================
  // ENHANCED EVENT CARDS (D2-D3)
  // Extended Protocol Cards — Erica Larson, March 29 2026
  // =====================================================================

  D2: {
    id: 'D2',
    name: 'Compound Event Cascade',
    category: 'enhanced_events',
    categoryLabel: 'Enhanced Events',
    color: '#059669',
    summary: 'Two or more destabilizing events have occurred within a 2-week window. Evidence indicates the effect of multiple concurrent events is super-additive: two severity-1 events produce a larger PPSI response (+8 to +12 points) than a single severity-2 event (+5 to +10 points). The compound effect overwhelms coping capacity more than equivalent single stressors. This pattern accounts for ~3-5% of destabilizations and is characterized by intact PPSI scores until the second or third event, after which multiple domains elevate simultaneously.',
    steps: [
      { step: 1, action: 'Compound detection: System flags when 2+ events are logged within a 14-day window. Calculate compound severity: sum of individual severities + 1 (compounding bonus). Example: two severity-1 events = compound severity 3. Three events of any severity = automatic compound severity 3.', timeline: 'Automated when 2nd event within 14-day window detected' },
      { step: 2, action: 'Immediate stabilization outreach: Treat compound events at the response level of the computed compound severity, not the individual event severities. Compound severity 3 = same-day contact + clinical-authority engagement, even if both individual events were severity 1.', timeline: 'Per compound severity: Sev 1-2 = 48h | Sev 3 = Same day' },
      { step: 3, action: 'Cumulative impact assessment: Ask the participant about the combined weight of the events, not each one individually. "You\'ve had [event 1] and [event 2] happen very close together. How are you managing the combined load?" Assess for the tipping-point effect: was the participant managing event 1 adequately before event 2 occurred?', timeline: 'At initial contact' },
      { step: 4, action: 'Proactive cascade monitoring: Multiple events in a short window create a destabilization vulnerability that persists for 4-6 weeks beyond the events themselves. Extend post-event monitoring to 6 weeks (vs. standard 2-4 weeks for single events). Watch specifically for secondary domain activation in domains not directly related to the events.', timeline: '4-6 weeks post-event window' },
      { step: 5, action: 'Success checks: Evaluate PPII trajectory at 2, 4, and 6 weeks post-event window (extended from standard D card). Success requires no secondary destabilization cascade and return to pre-event PPII baseline.', timeline: '2, 4, 6 week checks (extended)' },
    ],
    assignment: 'Clinical-authority user (primary) when compound severity 3+. Outreach-level user (primary) when compound severity <3.',
    successMetric: 'PPII returns to pre-event baseline within 4 weeks. No secondary destabilization cascade (no new domains activating after the initial event response). Participant reports adequate support. Compliance fully intact.',
    escalationTrigger: 'PPII continues rising 2+ weeks after compound event window closes. OR a third event occurs within 4 weeks of the original compound (extending the cascade). OR compliance stream begins declining. Escalate per compound severity level.',
    registryDisplay: 'Dominant Driver: Event — Compound Cascade ([X] events in [Y] days, Compound Severity: [Z]) | Protocol: Card D2 | Extended Monitoring: 6 weeks',
  },

  D3: {
    id: 'D3',
    name: 'State-Dependent Event Response',
    category: 'enhanced_events',
    categoryLabel: 'Enhanced Events',
    color: '#059669',
    summary: 'A destabilizing event has occurred in a participant who is already at Yellow or Orange tier. Evidence indicates the same event produces a 1.5-2.0x larger PPSI impact in a Yellow participant and 2.0-3.0x in an Orange participant compared to a Green-tier baseline. A severity-1 event in an Orange participant can be the tipping point that triggers Red-tier destabilization. Standard Protocol Card D applies the same response regardless of baseline state — this card adjusts the response intensity to match the amplified risk.',
    steps: [
      { step: 1, action: 'State-dependent severity calculation: When an event occurs in a participant at Yellow or Orange tier, the system computes an adjusted severity: Actual severity + tier modifier. Tier modifiers: Green = +0, Yellow = +1, Orange = +2. Example: a severity-1 event in an Orange participant = adjusted severity 3 (severity 1 + tier modifier 2). Response follows adjusted severity timelines.', timeline: 'Automated at event detection' },
      { step: 2, action: 'Elevated response: Apply Protocol Card D steps at the adjusted severity level. A severity-1 event that would normally receive 72-hour outreach instead receives same-day contact if the participant is at Orange tier. The participant is already destabilizing — additional stressors require faster response.', timeline: 'Per adjusted severity: Adj. 1 = 72h | Adj. 2 = 48h | Adj. 3 = Same day' },
      { step: 3, action: 'Interaction assessment: Evaluate how the event interacts with the participant\'s existing destabilization. Is the event in the same domain as the current Dominant Driver (compounding)? Or is it in a different domain (broadening)? Compounding events intensify the existing trajectory; broadening events activate Card M1 (Multi-Domain).', timeline: 'At initial contact' },
      { step: 4, action: 'Active card coordination: If the participant already has an open Registry item with an active protocol card, the event response must be coordinated with the existing intervention. The event card (D3) does not replace the existing card — it supplements it. The item owner must assess whether the event invalidates the current intervention plan or requires modification.', timeline: 'At initial contact' },
      { step: 5, action: 'Tier transition monitoring: An event in a Yellow/Orange participant may trigger a tier transition (Yellow to Orange, Orange to Red). If tier transitions within 48 hours of the event, all active SLA timelines compress to the new tier\'s requirements per the Compliance Follow-Up Date Build Spec.', timeline: 'Continuous for 2 weeks post-event' },
    ],
    assignment: 'Per adjusted severity. Adjusted severity 3 = clinical-authority user (primary). Adjusted severity 1-2 = outreach-level user (primary).',
    successMetric: 'PPII does not cross the next tier boundary within 2 weeks of the event. Existing protocol card intervention remains on track. Event impact absorbed without triggering new domain activation. At 4 weeks: PPII trajectory has returned to pre-event trend.',
    escalationTrigger: 'Tier transition occurs within 48 hours of event (the event was the tipping point). OR existing protocol card success metric becomes unachievable due to event impact. OR multiple events in an already-elevated participant (triggers Card D2 compound logic at elevated baseline).',
    registryDisplay: 'Dominant Driver: Event — [Type] (Severity [X], Adjusted Severity [Y] due to [Tier] baseline) | Protocol: Card D3 + [Active Card] | State: Pre-existing [Tier]',
  },

};

// =====================================================================
// CATEGORY DEFINITIONS — for organizing the reference library
// =====================================================================

const CARD_CATEGORIES = [
  { key: 'ppsi_subdomain', label: 'PPSI Sub-domain Cards', description: 'Domain-specific interventions when PPSI self-report is the dominant driver.', cards: ['A1','A2','A3','A4','A5','A6','A7','A8'] },
  { key: 'pulse', label: 'Provider Pulse Cards', description: 'Clinician observation signal cards from the Provider Pulse assessment.', cards: ['P1','P2','P3','P4','P5'] },
  { key: 'stream', label: 'Stream Pathway Cards', description: 'Pathway-level cards used when no sub-domain drill-down is available.', cards: ['A','B','C','D'] },
  { key: 'safety', label: 'Safety', description: 'Safety screening protocols. Card S1 supersedes all other cards when activated.', cards: ['S1'] },
  { key: 'multi_stream', label: 'Multi-Stream & Co-Dominant', description: 'Activate when the standard single-driver model is insufficient. Multi-domain, co-dominant, and discordance patterns.', cards: ['M1','M2','M3'] },
  { key: 'trajectory', label: 'Destabilization Archetypes', description: 'Trajectory patterns detected through longitudinal analysis. Supplement active Dominant Driver cards.', cards: ['T1','T2','T3','T4','T5','T6'] },
  { key: 'intervention_failure', label: 'Intervention Failure', description: 'Structured reassessment when a standard protocol card intervention has not produced the expected outcome.', cards: ['F1'] },
  { key: 'enhanced_events', label: 'Enhanced Events', description: 'Compound event interactions and state-dependent event response adjustments.', cards: ['D2','D3'] },
];

// Response timeline reference (unchanged across all cards)
const RESPONSE_TIMELINE = {
  YELLOW:   { initial: 'Within 72 hours', successChecks: '2-week, 4-week, 8-week' },
  ORANGE:   { initial: 'Within 48 hours', successChecks: '2-week, 4-week, 8-week' },
  RED:      { initial: 'Same day', successChecks: 'Weekly until Yellow/Orange, then 2, 4, 8 weeks' },
  SENTINEL: { initial: 'Immediate', successChecks: 'At 48 hours, then weekly' },
};

// Card co-activation priority ordering (highest priority first)
// When multiple supplementary cards are active, the highest-priority card
// determines the item's urgency level and SLA.
const CARD_PRIORITY = [
  'S1',  // Suicide Risk — supersedes all
  'T2',  // Acute Break
  'T4',  // Silent Slide
  'M1',  // Multi-Domain
  'M3',  // Discordance
  'T1',  // Slow Burn
  'T3',  // Oscillator
  'D2',  // Compound Events
  'D3',  // State-Dependent
  'T6',  // Repeated Moderate (Early Warning) — precedes T5 chronic threshold
  'T5',  // Chronic Borderline
];

// Promotion engine detection rules — documents how each extended card should be detected
// (Implementation is in custauth.js / dominantDriver.js — this is the reference spec)
const DETECTION_RULES = {
  M1: { rule: '3+ PPSI domains 2+ points above personal trailing baseline simultaneously', frequency: 'Weekly PPSI processing', behavior: 'Supplements active Dominant Driver card' },
  M2: { rule: 'Top two PPII stream contributions within 5 percentage points', frequency: 'Weekly PPII computation', behavior: 'Supplements or replaces single-driver card' },
  M3: { rule: 'Provider Pulse equivalent exceeds PPSI by >15 points for 2+ consecutive months', frequency: 'At each Provider Pulse submission', behavior: 'Creates new Registry item if none exists' },
  T1: { rule: 'Cumulative 6-week PPSI increase 15+ with no single-week spike >8', frequency: 'Weekly, using 6-week rolling window', behavior: 'Supplements active card(s)' },
  T2: { rule: 'Single-week PPSI increase >15 OR 2-week increase >20', frequency: 'Weekly PPSI processing', behavior: 'Auto-elevates urgency to minimum Orange' },
  T3: { rule: 'PPSI total crosses same tier boundary 3+ times in 12 weeks', frequency: 'Weekly, using 12-week rolling window', behavior: 'Supplements active card(s)' },
  T4: { rule: 'PPSI <25 AND (Provider Pulse equiv. >35 for 2+ months OR compliance quality declining 3+ weeks)', frequency: 'At each Provider Pulse + weekly compliance quality check', behavior: 'Creates new Registry item; clinical-authority required' },
  T5: { rule: 'Yellow tier for 12+ consecutive weeks with 1+ completed intervention cycle', frequency: 'Weekly tier duration check', behavior: 'Transitions item to sustained monitoring cadence' },
  T6: { rule: 'Open Yellow- or Orange-tier registry item for 21+ consecutive days with no open T5/T6 already on the participant', frequency: 'Daily F1_T5 detection sweep', behavior: 'Creates supplementary early-warning item; T5 supersedes if it activates at 12 weeks' },
  F1: { rule: 'Escalation trigger fires on any active protocol card', frequency: 'At each success check date', behavior: 'Replaces escalated card as active protocol' },
  D2: { rule: '2+ events within 14-day window', frequency: 'At each event submission', behavior: 'Supplements or replaces Card D' },
  D3: { rule: 'Event occurs while participant is at Yellow or Orange tier', frequency: 'At each event submission when tier >= Yellow', behavior: 'Supplements Card D with adjusted severity' },
};

export { PROTOCOL_CARDS, CARD_CATEGORIES, RESPONSE_TIMELINE, CARD_PRIORITY, DETECTION_RULES };
