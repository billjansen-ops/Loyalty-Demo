# ML Strategy — Erica's Response (March 26, 2026)

## Context
Bill proposed using synthetic data generated from Erica's clinical expertise to train the ML predictive model before real longitudinal data is available. This is Erica's comprehensive response.

---

## Key Points

### The Gap
- Current architecture is descriptive and threshold-based, not truly predictive
- PPII score summarizes current state but doesn't forecast future destabilization probability
- True predictive modeling would take months to years depending on accumulated data and real outcomes
- Synthetic data approach solves the timing problem

### Framing
- **"Clinician-elicited prior model"** — not a production predictive model
- "A clinically informed baseline model trained on expert-defined synthetic trajectories, designed to be progressively replaced by empirically validated predictions as real program data accumulates"
- Must be transparent about synthetic data origin at all times

### Credibility Safeguards
- Must disclose synthetic training data to state medical boards, licensing bodies, peer reviewers
- Multiple experts needed, not just one clinician — individual biases come with individual insights
- Hard expiration on synthetic model (e.g., 50 real destabilization events OR 12 months longitudinal data, whichever first)
- Display should read: "Clinician-informed model estimate: elevated destabilization risk based on pattern similarity to expert-defined trajectories. Confidence: pre-validation."

### Synthetic Data Requirements
- Destabilization trajectories (the target patterns)
- Stable physicians with normal scores (true negatives)
- Physicians who spike and recover (false positives)
- Physicians who deteriorate slowly vs suddenly
- Physicians whose compliance behavior leads vs lags self-report scores
- Model needs to learn what ISN'T destabilization as much as what is

### Research Value
- Novel research question: "Can structured expert knowledge, encoded as synthetic training data, produce clinically useful predictions before empirical data is available?"
- Applicable beyond physician health programs — any clinical monitoring domain where you need to act before longitudinal data exists
- Document every pattern definition, trajectory template, clinical assumption — becomes research artifact

### Validation Path
1. Build synthetic model using structured knowledge elicitation sessions with a team
2. Synthetic model runs, making predictions on real incoming data — predictions are logged
3. Creates prospective validation dataset
4. Compare: synthetic model vs threshold-based system vs data-trained model
5. Expected result: expert model outperforms thresholds but underperforms data-trained model
6. Both findings support the PI2 architecture

### Integration
- Could align with psychometric validation protocol timeline already in place
- Erica wants to start working on this now
- Interested in federation and state program reactions

---

## Bill's Addition (Session 96)
- ML scores should be stored as molecules with dates, not overwritten
- Only write new molecule when score changes (no redundant entries)
- Enables trajectory, trend analysis, and comparison against PPSI trajectory
- Divergence between ML prediction and clinical score = early warning signal
