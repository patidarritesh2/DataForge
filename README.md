# DataForge — Data Processing Platform

A full-stack application that allows users to upload CSV/JSON datasets, apply dynamic transformations (filter, group by, aggregations), and query results through a clean Angular UI backed by a Node.js/Express API with MSSQL storage via Sequelize.

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | Angular 18+ (standalone, signals) |
| Backend    | Node.js 24, Express 4             |
| ORM        | Sequelize 6                       |
| Database   | Microsoft SQL Server (MSSQL)      |
| File parse | csv-parse, native JSON            |

---

## Project Structure

```
mini-data-platform/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js         
│   │   ├── controllers/
│   │   │   ├── datasetController.js 
│   │   │   └── queryController.js  
│   │   ├── middleware/
│   │   │   ├── asyncHandler.js    
│   │   │   └── errorHandler.js    
│   │   ├── models/
│   │   │   └── Dataset.js           
│   │   ├── routes/
│   │   │   └── datasetRoutes.js   
│   │   ├── services/
│   │   │   ├── ingestionService.js  
│   │   │   └── queryService.js      
│   │   └── index.js             
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.ts     
│   │   │   ├── app.config.ts      
│   │   │   ├── app.routes.ts    
│   │   │   ├── core/services/
│   │   │   │   └── dataset.service.ts  
│   │   │   └── features/
│   │   │       ├── datasets/dataset-list/  
│   │   │       └── query/query-builder/
│   │   ├── styles.css
│   │   ├── index.html
│   │   └── main.ts
│   ├── angular.json
│   ├── tsconfig.json
│   └── package.json
└── sample-data/
    ├── marketing_data.csv   
    └── sales_orders.json   
```

---

## Prerequisites

- **Node.js** 18+ 
- **npm** 9+
- **Microsoft SQL Server** 
- **Angular CLI** 18+



---

## Setup Instructions

### 1. Clone & install backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MSSQL credentials
npm install
```

### 2. Configure `.env`

```env

PORT=3000
NODE_ENV=development
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=data_platform
DB_DOMAIN=R
DB_USER=HP
DB_PASSWORD=yourpasword
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
```

> Create it manually first if needed:
> ```sql
> CREATE DATABASE data_platform;
> ```

### 3. Start the backend

```bash
cd backend
npm run dev       
# or
npm start      
```

Server starts at `http://localhost:3000`. You should see:
```
 MSSQL connection established successfully.
 Database synchronized.
 Server running on http://localhost:3000
```

### 4. Install & start the frontend

```bash
cd frontend
npm install
npx ng serve
```

Frontend available at `http://localhost:4200`.

---

## API Reference

### Datasets

| Method | Endpoint                        | Description                        |
|--------|---------------------------------|------------------------------------|
| POST   | `/api/datasets/upload`          | Upload CSV or JSON file (multipart)|
| GET    | `/api/datasets`                 | List all datasets                  |
| GET    | `/api/datasets/:id`             | Get single dataset metadata        |
| DELETE | `/api/datasets/:id`             | Delete dataset + its table         |
| GET    | `/api/datasets/:id/schema`      | Get column definitions             |
| GET    | `/api/datasets/:id/stats`       | Numeric column statistics          |
| GET    | `/api/datasets/:id/distinct?field=channel` | Distinct values for a field |
| POST   | `/api/datasets/:id/query`       | Run a transformation query         |

### Query API Body

```json
{
  "filters": [
    { "field": "channel", "operator": "=", "value": "Instagram" },
    { "field": "revenue", "operator": ">", "value": "5000" }
  ],
  "groupBy": ["channel"],
  "aggregations": [
    { "field": "revenue", "function": "sum", "alias": "total_revenue" },
    { "field": "*",       "function": "count", "alias": "total_rows" }
  ],
  "orderBy": [
    { "field": "total_revenue", "direction": "DESC" }
  ],
  "limit": 100,
  "offset": 0
}
```

**Supported operators:** `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`  
**Supported aggregations:** `sum`, `avg`, `count`, `min`, `max`

### Query Response

```json
{
  "success": true,
  "data": [ { "channel": "Instagram", "total_revenue": 23500 } ],
  "pagination": {
    "total": 5,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Approach & Design Decisions

### Dynamic Schema Handling

Each uploaded dataset gets its own **dedicated SQL table** (`ds_<filename>_<uuid>`) rather than a single wide table. This allows truly dynamic, schema-free operation:

- Schema is detected automatically by sampling the first 50 rows
- Column types inferred: `BIGINT` for integers, `FLOAT` for decimals, `NVARCHAR(MAX)` for everything else
- Original column names mapped to sanitized SQL-safe names
- The `Dataset` table in MSSQL stores schema metadata as JSON

### Transformation Engine

The query service builds safe parameterized SQL dynamically:

- **Filters** → `WHERE` clause with `:named` parameters (prevents SQL injection)
- **Group By** → `GROUP BY` clause with column whitelist validation
- **Aggregations** → `SELECT SUM/AVG/COUNT/MIN/MAX` expressions
- **Pagination** → `OFFSET ... FETCH NEXT` (SQL Server native)

### Processing Model

Uploads return a `202 Accepted` immediately. Actual parsing and table creation happens asynchronously via `setImmediate`. The frontend polls every 3 seconds for datasets in `processing` state.

### Security

- All field/column names validated against detected schema before use in SQL
- Values passed via Sequelize parameterized queries — no string interpolation
- File type validated both by extension and multer filter
- File size limited to 50MB

---

## Assumptions Made

1. Data is flat (no nested JSON objects per row — nested arrays/objects are serialized as strings)
2. First row of CSV is always the header row
3. A numeric column is detected when ≥ 1 non-null sampled values are all parseable as numbers
4. Column name collisions after sanitization (e.g., `my field` and `my_field`) — last one wins; field names should be distinct
5. Max 10,000 rows per query response (server-side cap)
6. MSSQL instance is accessible on `localhost:1433` by default

---

## Edge Cases Handled

| Scenario | Handling |
|---|---|
| Non-CSV/JSON upload | 400 error from multer filter |
| Empty file / no rows | Dataset marked `error` with message |
| Missing fields in some rows | Inserted as `NULL` |
| Inconsistent types across rows | Falls back to `NVARCHAR(MAX)` |
| Invalid filter field name | 400 error: "Invalid filter field" |
| Invalid aggregation function | 400 error: "Invalid aggregation" |
| File > 50MB | 413 error |
| Query on processing dataset | 400 error with current status |
| Empty dataset queried | Returns `data: []` with `total: 0` |
| SQL injection in filter values | Blocked by parameterized queries |

---

## Sample Queries to Try

After uploading `marketing_data.csv`:

**Total revenue by channel:**
```json
{ "groupBy": ["channel"], "aggregations": [{ "field": "revenue", "function": "sum", "alias": "total_revenue" }] }
```

**Instagram campaigns only:**
```json
{ "filters": [{ "field": "channel", "operator": "=", "value": "Instagram" }] }
```

**Top campaigns by conversions:**
```json
{ "groupBy": ["campaign"], "aggregations": [{ "field": "conversions", "function": "sum", "alias": "total_conversions" }], "orderBy": [{ "field": "total_conversions", "direction": "DESC" }] }
```
