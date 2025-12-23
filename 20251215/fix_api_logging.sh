#!/bin/bash
# Make carrier save endpoint log full errors and return details to the UI

perl -0777 -i -pe '
s{
app\.post\('/api/lookup/carriers',\s*async\s*\(req,\s*res\)\s*=>\s*\{\s*try\s*\{\s*const tenant[\s\S]*?res\.json\(\{\s*ok:\s*true\s*\}\);\s*\}\s*catch\s*\(e\)\s*\{\s*res\.status\(500\)\.json\(\{\s*error:\s*String\(e\)\s*\}\);\s*\}\s*\}\);
}{
app.post('/api/lookup/carriers', async (req, res) => {
  try {
    const tenant = (req.query.tenant || "delta").trim();
    const { code, name, alliance = null, country = null, is_active = true } = req.body;
    if (!code || !name) return res.status(400).json({ error: "code and name required" });
    await qTenant(
      tenant,
      `
      INSERT INTO carriers (code, name, alliance, country, is_active)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            alliance = EXCLUDED.alliance,
            country = EXCLUDED.country,
            is_active = EXCLUDED.is_active
      `,
      [code.trim(), name.trim(), alliance, country, is_active]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("[carrier save] error:", e);            // log to server console
    res.status(500).json({ error: String(e), stack: e.stack || "" }); // return details to client
  }
});
}xms' api.js

echo "✅ api.js updated to log & return detailed errors."
