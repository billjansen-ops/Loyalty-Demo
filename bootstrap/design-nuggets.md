Lookup and Label Architecture: tenant-specific lookup tables seeded at provisioning
Dynamic Data Elements: tenant attr_def registry for custom attributes on member/activity
Labels & Terminology: tenant-scoped label mapping; points_label drives UI text
Rules Integration: custauth-style invoke_hook(name,payload) pattern, default no-op
Ledger Safety: acquire row-level lock on member for balance updates
Activity model: activity_date authoritative for retro credit and rule evaluation
