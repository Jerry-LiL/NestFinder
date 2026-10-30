# NestFinder

A full-stack property rental and booking platform built with React, Next.js, Node.js, Express, and PostgreSQL. It allows property managers to list residential rentals with image uploads and manage reservations, while tenants can search listings using multi-parameter filters, explore properties on an interactive map, and submit booking requests with concurrency-safe reservation scheduling.

Repository: https://github.com/Jerry-LiL/NestFinder

## Features

- Multi-parameter search: filter by city, monthly price range, minimum bedrooms, property type, required amenities (GIN index), availability dates, and map bounds.
- Interactive map view: Leaflet and OpenStreetMap integration for visual browsing with markers and popups.
- Concurrency-safe reservations: PostgreSQL `btree_gist` exclusion constraint prevents overlapping approved bookings at the database level.
- Role-based access control: JWT authentication separating Tenant and Manager capabilities with route-level middleware.
- Media storage: Multer upload with optional AWS S3 client storage (`@aws-sdk/client-s3`) and local static file fallback.
- Indexed search: average search API latency of about 4 ms across 5,200 seeded listings, measured locally (see Performance below).

## Tech Stack

- Frontend: Next.js 14 (App Router), React 18, Tailwind CSS, Leaflet, React-Leaflet, Lucide React
- Backend: Node.js, Express 4, TypeScript, Zod, bcryptjs, jsonwebtoken, Multer, AWS SDK for S3
- Database: PostgreSQL 16 (plain `pg` driver, raw SQL migrations, `btree_gist` extension)
- Testing: Vitest, Supertest, React Testing Library, jsdom
- Tooling: npm workspaces, Docker Compose, GitHub Actions CI

## Architecture

```mermaid
graph TD
    Client["Web Client (Next.js App Router)"]
    API["Express REST API (Node.js + TypeScript)"]
    DB[("PostgreSQL 16 (btree_gist, GIN, B-tree Indexes)")]
    S3[("AWS S3 / Local Disk Storage")]

    Client -->|"HTTP / REST (JWT Auth)"| API
    API -->|"SQL Queries & Transactions"| DB
    API -->|"Multipart File Uploads"| S3
```

## Getting Started

### Prerequisites

- Node.js 20 or later
- PostgreSQL 16 running locally or via Docker
- npm 9 or later

### 1. Database Setup

Using Docker Compose:

```bash
docker compose up -d
```

Or connect to an existing local PostgreSQL instance:

```bash
psql -U postgres -c "CREATE DATABASE nestfinder;"
psql -U postgres -c "CREATE DATABASE nestfinder_test;"
```

### 2. Environment Configuration

Copy the example environment files:

```bash
cp .env.example .env
cp server/.env.example server/.env
cp web/.env.example web/.env.local
```

Default connection strings:
- Server: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/nestfinder`
- Tests: `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/nestfinder_test`
- Web API target: `NEXT_PUBLIC_API_URL=http://localhost:5000`

### 3. Install Dependencies and Run Migrations

```bash
npm install
npm run db:migrate
```

### 4. Seed Database (5,000+ Listings)

Run the deterministic seed script to populate demo users, 5,200+ properties across 10 Indian cities, images, and initial bookings:

```bash
npm run db:seed
```

### 5. Start Development Servers

Run both the API server (port 5000) and Next.js frontend (port 3000) concurrently:

```bash
npm run dev
```

The web application will be accessible at http://localhost:3000.

## Demo Accounts

The seed script creates the following pre-configured test users:

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Property Manager | manager@nestfinder.dev | password123 | Create, edit, and delete listings; review and approve/reject bookings |
| Tenant | tenant@nestfinder.dev | password123 | Search properties, submit booking requests, track booking statuses |

## REST API Endpoints

The API consists of exactly 12 endpoints under `/api`, plus an uncounted health check endpoint.

| Method | Path | Auth / Role | Description |
|--------|------|-------------|-------------|
| POST | `/api/auth/register` | Public | Register a new user (`TENANT` or `MANAGER`) |
| POST | `/api/auth/login` | Public | Authenticate with email/password and obtain JWT |
| GET | `/api/properties` | Public | Search properties with filters (city, price, beds, type, amenities, dates, map bounds, sort, pagination) |
| GET | `/api/properties/:id` | Public | Retrieve single property details, images, and manager contact |
| POST | `/api/properties` | Manager | Create a new property listing |
| PATCH | `/api/properties/:id` | Manager (Owner) | Update an owned property listing |
| DELETE | `/api/properties/:id` | Manager (Owner) | Delete an owned property listing |
| POST | `/api/properties/:id/images` | Manager (Owner) | Upload property image (stores to S3 or local disk fallback) |
| POST | `/api/bookings` | Tenant | Request a booking reservation; returns 409 on overlap |
| GET | `/api/bookings/mine` | Tenant | Retrieve bookings belonging to authenticated tenant |
| GET | `/api/manager/bookings` | Manager | Retrieve incoming bookings for owned properties with optional `status` filter |
| PATCH | `/api/bookings/:id/status` | Manager / Tenant | Manager can set `APPROVED` or `REJECTED`; Tenant can set `CANCELLED` on own pending booking |

### Additional Endpoint (Not Counted)
- `GET /health`: Health check endpoint returning `{ status: "ok", timestamp: "..." }`.

### Availability Filtering Design Choice

In `GET /api/properties`, filtering by `availableFrom` and `availableTo` excludes only properties with an overlapping `APPROVED` booking. `PENDING` bookings are intentionally not excluded from search results because pending requests are subject to manager rejection or tenant cancellation. Blocking availability on unconfirmed pending requests would allow arbitrary unconfirmed bookings to lock out other potential tenants. When a manager approves a booking, it runs inside a database transaction and enforces the exclusion constraint.

## Database Constraints and Concurrency Safety

The bookings table includes a PostgreSQL exclusion constraint:

```sql
CONSTRAINT no_overlapping_approved_bookings EXCLUDE USING gist (
  property_id WITH =,
  daterange(start_date, end_date) WITH &&
) WHERE (status = 'APPROVED');
```

- When creating a booking, the API checks for conflicting approved reservations and returns HTTP 409 if dates overlap.
- When approving a booking (`PATCH /api/bookings/:id/status`), the operation executes inside an explicit database transaction with row-level locks (`SELECT ... FOR UPDATE`).
- If two managers attempt concurrent approvals for overlapping date ranges, PostgreSQL enforces the GiST exclusion constraint. Exactly one transaction commits successfully with HTTP 200, while the conflicting transaction rolls back and returns HTTP 409.

## Performance Benchmark

Latency measurements were taken against the seeded database containing 5,200 properties using `server/scripts/bench-search.ts`.

### Benchmark Results

- Dataset: 5,200 properties across 10 metropolitan cities
- Workload: 200 search requests with varied filter combinations (city, price ranges, minimum beds, property type, amenities, availability dates, bounding boxes, and sorting)
- Measured on: my local Linux machine (Node.js v24, PostgreSQL 17 on localhost, in-process Supertest requests)

| Metric | Measured Value |
|--------|----------------|
| Requests Executed | 200 |
| Total Listings | 5,200 |
| Average Latency | 3.79 ms |
| Median (p50) | 3.53 ms |
| 90th Percentile (p90) | 5.28 ms |
| 95th Percentile (p95) | 6.09 ms |
| 99th Percentile (p99) | 8.65 ms |
| Minimum Latency | 2.06 ms |
| Maximum Latency | 9.20 ms |

### Query Execution Plan (EXPLAIN ANALYZE)

For a typical filtered query (`city = 'Bengaluru'`, `minPrice = 20000`, `maxPrice = 60000`, `beds >= 2`, sorted by price):

```text
Limit  (cost=0.28..84.14 rows=20 width=70) (actual time=0.058..0.071 rows=20 loops=1)
  ->  Index Scan using idx_properties_city_lower_price on properties p  (cost=0.28..876.55 rows=209 width=70) (actual time=0.057..0.069 rows=20 loops=1)
        Index Cond: ((lower((city)::text) = 'bengaluru'::text) AND (price >= '20000'::numeric) AND (price <= '60000'::numeric))
        Filter: (beds >= 2)
        Rows Removed by Filter: 120
Planning Time: 0.103 ms
Execution Time: 0.081 ms
```

To run the benchmark yourself:

```bash
npm run bench
```

## Testing

The project includes automated test coverage for both backend and frontend packages.

### Server Tests (Vitest + Supertest)
Runs against a dedicated PostgreSQL database (`nestfinder_test`):
- Authentication & JWT issuance
- Role-based permissions (tenants cannot create listings, managers cannot book)
- Payload validation (Zod schemas and invalid fields)
- Multi-parameter search filters
- Booking conflict detection (HTTP 409)
- Direct PostgreSQL GiST exclusion constraint rejection test (error code 23P01)
- Concurrent approval race condition test (two concurrent approvals -> exactly one succeeds)

### Web Tests (Vitest + React Testing Library)
- PropertyCard rendering and formatted currency output
- FilterSidebar input interactions and query string construction in API client

Run all tests:

```bash
npm test
```

## Project Structure

```text
NestFinder/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow (Node 20, Postgres 16)
├── server/
│   ├── migrations/
│   │   └── 001_init.sql         # Tables, checks, exclusion constraint, and search indexes
│   ├── scripts/
│   │   ├── bench-search.ts      # 200-request search benchmark runner
│   │   └── migrate.ts           # Migration execution script
│   ├── src/
│   │   ├── __tests__/           # Integration and unit tests
│   │   ├── middleware/          # JWT auth, role validation, and central error handling
│   │   ├── routes/              # Auth, properties, bookings, manager routers
│   │   ├── services/            # Storage service (S3 / local static fallback)
│   │   ├── app.ts               # Express application configuration
│   │   ├── db.ts                # pg connection pool and transaction helpers
│   │   ├── index.ts             # Server entry point
│   │   ├── migrate.ts           # Database migration runner logic
│   │   └── seed.ts              # 5,000+ deterministic listings generator
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages (/, /properties/[id], /login, /register, /bookings, /manager)
│   │   ├── components/          # Navbar, PropertyCard, FilterSidebar, PropertyMap, DetailMap
│   │   ├── context/             # AuthContext with localStorage token persistence
│   │   ├── lib/                 # Typed API client
│   │   └── __tests__/           # React Testing Library component tests
│   ├── tailwind.config.js
│   └── tsconfig.json
├── docker-compose.yml           # PostgreSQL 16 container definition
├── LICENSE                      # MIT License
├── package.json                 # Monorepo workspaces definition
└── README.md
```

## What I'd Improve Next

1. Full-text search: Replace ILIKE/equality queries on title and description with PostgreSQL `tsvector` and `tsquery` with GIN indexing for weighted keyword relevance.
2. In-app messaging: Implement WebSocket (Socket.io) or Server-Sent Events to enable real-time chat between tenants and managers regarding reservation inquiries.
3. Payment integration: Add Razorpay or Stripe webhook handling for security deposit collection upon booking approval.
4. Geospatial indexing: Migrate from simple latitude/longitude bounding box queries to PostgreSQL PostGIS geometry types (`ST_DWithin` on `GEOGRAPHY(Point)`) for true radius-based distance queries.
5. Email notifications: Connect Nodemailer or AWS SES to send automated confirmation emails on reservation submission, approval, or rejection.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
