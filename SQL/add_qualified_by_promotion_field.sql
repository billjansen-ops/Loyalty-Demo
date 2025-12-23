-- Add qualified_by_promotion_id to track which promotion actually earned the tier
-- Used in tier cascade logic to prevent duplicate fulfillment

ALTER TABLE member_promotion
ADD COLUMN qualified_by_promotion_id INTEGER;

COMMENT ON COLUMN member_promotion.qualified_by_promotion_id IS 
  'Tracks which promotion actually earned the tier reward. NULL = this promotion earned it. 
   Non-NULL = courtesy qualified via cascade from another promotion.';

-- Add foreign key constraint
ALTER TABLE member_promotion
ADD CONSTRAINT fk_qualified_by_promotion
FOREIGN KEY (qualified_by_promotion_id) 
REFERENCES promotion(promotion_id);

-- Verification query
SELECT 
  mp.member_promotion_id,
  mp.promotion_id as this_promotion,
  mp.qualified_by_promotion_id as earned_by_promotion,
  CASE 
    WHEN mp.qualified_by_promotion_id IS NULL THEN 'EARNED'
    ELSE 'CASCADE'
  END as qualification_type,
  mp.qualify_date,
  mp.process_date
FROM member_promotion mp
WHERE mp.qualify_date IS NOT NULL
ORDER BY mp.qualify_date DESC
LIMIT 10;
