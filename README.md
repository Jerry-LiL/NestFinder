# NestFinder

Rental listing and booking app. Managers list properties with photos and approve or reject booking requests; tenants search listings (filters or map) and request dates.

## Stack

- Web: Next.js 14, React 18, Tailwind, Leaflet
- API: Node, Express, TypeScript, Zod, JWT, Multer (S3 or local disk)
- DB: PostgreSQL 16 with plain `pg` and SQL migrations
- Tests: Vitest, Supertest, React Testing Library

## Running locally

```bash
docker compose up -d                 # postgres on 5432
cp .env.example .env
cp server/.env.example server/.env
cp web/.env.example web/.env.local
npm install
npm run db:migrate
npm run db:seed                      # demo users + 5,200 listings in 10 cities
npm run dev                          # API on :5000, web on :3000
```

Demo logins (password `password123`): `manager@nestfinder.dev`, `tenant@nestfinder.dev`.

Uploads go to S3 if `S3_BUCKET` and the AWS keys are set, otherwise to `server/uploads`.

## Tests

Server tests need a `nestfinder_test` database (`TEST_DATABASE_URL`):

```bash
psql -U postgres -h localhost -c "CREATE DATABASE nestfinder_test;"
npm test
```

## API

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/properties              search: city, price, beds, type, amenities, dates, map bounds
GET    /api/properties/:id
POST   /api/properties              manager
PATCH  /api/properties/:id          owner
DELETE /api/properties/:id          owner
POST   /api/properties/:id/images   owner
POST   /api/bookings                tenant, 409 on overlap
GET    /api/bookings/mine           tenant
GET    /api/manager/bookings        manager
PATCH  /api/bookings/:id/status     manager approves/rejects, tenant cancels
GET    /health
```

## Notes

- Overlapping approved bookings are blocked by a `btree_gist` exclusion constraint, so two managers approving at the same time can't double-book; the loser gets a 409.
- Search only hides properties with an overlapping *approved* booking. Pending requests don't block other tenants.
- `npm run bench` runs 200 mixed searches against the seeded data. On my machine it averaged about 4 ms per request.

## TODO

- Full-text search with `tsvector`
- PostGIS for radius search instead of bounding boxes
- Email notifications on booking status changes
