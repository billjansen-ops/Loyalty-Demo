#!/bin/bash
perl -0777 -i -pe '
s{
app\.post\('/api/lookup/carriers'.*?res\.status\(500\)\.json\(\{ error: String\(e\) \}\);\s*\}\);
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
    res.status(500).json({ error: String(e) });
  }
});
}xms' api.js

echo "✅ Carrier save logic corrected (name/alliance/country now map properly)."
