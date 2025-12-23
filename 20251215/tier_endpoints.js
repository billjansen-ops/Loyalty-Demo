// ADD THESE ENDPOINTS TO YOUR server_db_api.js FILE

// ============================================
// MEMBER TIER CRUD ENDPOINTS
// ============================================

// POST - Add new tier assignment to member
app.post('/v1/member/:id/tiers', async (req, res) => {
  const memberId = req.params.id;
  const { tier_id, start_date, end_date } = req.body;

  try {
    const query = `
      INSERT INTO member_tier (member_id, tier_id, start_date, end_date)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        member_tier_id,
        member_id,
        tier_id,
        start_date,
        end_date
    `;

    const result = await pool.query(query, [
      memberId,
      tier_id,
      start_date,
      end_date || null
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update existing tier assignment
app.put('/v1/member/:id/tiers/:tierId', async (req, res) => {
  const { id: memberId, tierId } = req.params;
  const { tier_id, start_date, end_date } = req.body;

  try {
    const query = `
      UPDATE member_tier
      SET 
        tier_id = $1,
        start_date = $2,
        end_date = $3
      WHERE member_tier_id = $4
        AND member_id = $5
      RETURNING 
        member_tier_id,
        member_id,
        tier_id,
        start_date,
        end_date
    `;

    const result = await pool.query(query, [
      tier_id,
      start_date,
      end_date || null,
      tierId,
      memberId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tier assignment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Remove tier assignment
app.delete('/v1/member/:id/tiers/:tierId', async (req, res) => {
  const { id: memberId, tierId } = req.params;

  try {
    const query = `
      DELETE FROM member_tier
      WHERE member_tier_id = $1
        AND member_id = $2
      RETURNING member_tier_id
    `;

    const result = await pool.query(query, [tierId, memberId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tier assignment not found' });
    }

    res.json({ success: true, deleted_id: tierId });
  } catch (error) {
    console.error('Error deleting tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Look up tier on specific date (Party Trick!)
app.get('/v1/member/:id/tiers/on-date', async (req, res) => {
  const memberId = req.params.id;
  const { date } = req.query;

  try {
    const query = `
      SELECT * FROM get_member_tier_on_date($1, $2)
    `;

    const result = await pool.query(query, [memberId, date]);

    if (result.rows.length === 0 || !result.rows[0].tier_id) {
      // No tier on that date
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error looking up tier on date:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - List all tier definitions (for dropdown)
app.get('/v1/tiers', async (req, res) => {
  try {
    const query = `
      SELECT 
        tier_id,
        tier_code,
        tier_description,
        tier_ranking,
        is_active
      FROM tier_definition
      WHERE is_active = true
      ORDER BY tier_ranking DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tiers:', error);
    res.status(500).json({ error: error.message });
  }
});
