# Criteria API Endpoints - COMPLETE! 🎯

## New Endpoints Added:

### 1. GET /v1/bonuses/:bonusId/criteria
**Get all criteria for a bonus**

Response:
```json
[
  {
    "id": 1,
    "source": "Activity",
    "molecule": "Carrier",
    "molecule_key": "carrier",
    "operator": "equals",
    "value": "DL",
    "label": "Fly on Delta",
    "joiner": "OR",
    "sort_order": 1
  },
  {
    "id": 2,
    "source": "Activity",
    "molecule": "Destination",
    "molecule_key": "destination",
    "operator": "equals",
    "value": "BOS",
    "label": "Fly into Boston",
    "joiner": null,
    "sort_order": 2
  }
]
```

### 2. POST /v1/bonuses/:bonusId/criteria
**Add new criterion**

Request body:
```json
{
  "source": "Activity",
  "molecule": "Carrier",
  "operator": "equals",
  "value": "DL",
  "label": "Fly on Delta"
}
```

**Features:**
- Auto-creates rule if bonus doesn't have one
- Auto-assigns sort_order
- Sets previous last criterion joiner to 'AND'
- New criterion gets joiner = NULL

### 3. PUT /v1/bonuses/:bonusId/criteria/:criteriaId
**Update existing criterion**

Request body:
```json
{
  "source": "Activity",
  "molecule": "Destination",
  "operator": "equals",
  "value": "BOS",
  "label": "Fly into Boston"
}
```

### 4. PUT /v1/bonuses/:bonusId/criteria/:criteriaId/joiner
**Update joiner (AND/OR)**

Request body:
```json
{
  "joiner": "OR"
}
```

### 5. DELETE /v1/bonuses/:bonusId/criteria/:criteriaId
**Delete criterion**

**Features:**
- Removes criterion
- Auto-updates last remaining criterion to have NULL joiner

## Installation:

```bash
cp ~/Downloads/server_db_api.js ~/Projects/Loyalty-Demo/
cd ~/Projects/Loyalty-Demo
./bootstrap/start.sh
```

## Testing:

```bash
# Get criteria for BILLSTEST (bonus_id = 1)
curl http://localhost:4001/v1/bonuses/1/criteria

# Add new criterion
curl -X POST http://localhost:4001/v1/bonuses/1/criteria \
  -H "Content-Type: application/json" \
  -d '{"source":"Activity","molecule":"Carrier","operator":"equals","value":"DL","label":"Fly on Delta"}'

# Update criterion
curl -X PUT http://localhost:4001/v1/bonuses/1/criteria/1 \
  -H "Content-Type: application/json" \
  -d '{"source":"Activity","molecule":"Destination","operator":"equals","value":"BOS","label":"Fly to Boston"}'

# Update joiner
curl -X PUT http://localhost:4001/v1/bonuses/1/criteria/1/joiner \
  -H "Content-Type: application/json" \
  -d '{"joiner":"OR"}'

# Delete criterion
curl -X DELETE http://localhost:4001/v1/bonuses/1/criteria/1
```

## Smart Features:

✅ **Auto rule creation**: If bonus has no rule, creates one automatically  
✅ **Auto sort_order**: Assigns next available sort order  
✅ **Joiner management**: Automatically maintains joiner logic (last = NULL)  
✅ **Source detection**: Determines Activity vs Member based on molecule  
✅ **JSONB value storage**: Stores values as JSONB for flexibility  

**Ready to connect frontend!** 🚀
