# Test Button Added to Bonus Management!

## What Changed:

### admin_bonuses.html
**Added "🧪 Test" button in Actions column:**
- Appears between Edit and Delete
- Green styling for visual distinction
- Clicks navigate to: `test-rule.html?bonusId={bonus_id}`

**Example row:**
```
[Edit] [🧪 Test] [Delete]
```

### test-rule.html
**Reads bonusId from URL parameter:**
- If URL is `test-rule.html?bonusId=1` → pre-fills Bonus ID field with "1"
- If no parameter → defaults to "1"
- User can still change it if needed

## The Demo Flow:

**From Admin Screen:**
1. Go to `admin_bonuses.html`
2. See list of bonuses
3. Click "🧪 Test" button on any bonus
4. **Automatically taken to test rig with that bonus pre-selected!**
5. Fill in flight details
6. Click "Test Rule!"
7. See PASS/FAIL

## Installation:

```bash
cp ~/Downloads/admin_bonuses.html ~/Projects/Loyalty-Demo/
cp ~/Downloads/test-rule.html ~/Projects/Loyalty-Demo/
```

## The Party Trick:

> "Here's our TEST_BONUS rule. Let me show you how we test it..."
> 
> [Clicks 🧪 Test button]
> 
> [Fills in: DL, MSP→BOS, 1000 miles]
> 
> [Clicks Test Rule]
> 
> ✅ **PASS!**
> 
> "Now watch what happens when I test with United instead..."
> 
> [Changes to UA]
> 
> ❌ **FAIL!**
> 
> "The engine works EXACTLY as designed!"

**🎤 Crowd goes wild!** 🎉

## What's Next:

Build the `/v1/test-rule/:bonusId` endpoint to make it actually work!
