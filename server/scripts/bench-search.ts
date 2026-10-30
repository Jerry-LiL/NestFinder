import request from 'supertest';
import { performance } from 'node:perf_hooks';
import { app } from '../src/app';
import { pool, query } from '../src/db';

interface BenchQuery {
  name: string;
  query: string;
}

const BENCH_QUERIES: BenchQuery[] = [
  { name: 'City filter (Bengaluru)', query: 'city=Bengaluru' },
  { name: 'City filter (Mumbai)', query: 'city=Mumbai' },
  { name: 'City + Price range', query: 'city=Bengaluru&minPrice=20000&maxPrice=50000' },
  { name: 'City + Beds + Type', query: 'city=Hyderabad&beds=2&type=APARTMENT' },
  { name: 'Price range only', query: 'minPrice=25000&maxPrice=60000' },
  { name: 'Type + Min beds', query: 'type=VILLA&beds=3' },
  { name: 'Amenities filter (GIN)', query: 'amenities=wifi,parking' },
  { name: 'Amenities + City', query: 'city=Pune&amenities=pool,gym' },
  { name: 'Date availability check', query: 'availableFrom=2026-11-01&availableTo=2026-11-10' },
  { name: 'Map bounding box', query: 'minLat=12.9&maxLat=13.1&minLng=77.5&maxLng=77.7' },
  { name: 'Sorted price asc', query: 'city=Delhi&sort=price_asc&limit=20' },
  { name: 'Sorted price desc', query: 'city=Goa&sort=price_desc&limit=20' },
  { name: 'Paginated page 3', query: 'city=Chennai&page=3&limit=20' },
  { name: 'Complex composite query', query: 'city=Bengaluru&minPrice=15000&maxPrice=70000&beds=2&type=APARTMENT&amenities=wifi&sort=price_asc' },
];

async function runExplainAnalyze(): Promise<string> {
  const sql = `
    EXPLAIN ANALYZE
    SELECT
      p.id,
      p.title,
      p.price::float AS price,
      p.city,
      p.beds,
      p.property_type AS "propertyType"
    FROM properties p
    WHERE LOWER(p.city) = 'bengaluru'
      AND p.price >= 20000
      AND p.price <= 60000
      AND p.beds >= 2
    ORDER BY p.price ASC
    LIMIT 20 OFFSET 0;
  `;
  const result = await query(sql);
  return result.rows.map((r: any) => r['QUERY PLAN']).join('\n');
}

async function runBenchmark(): Promise<void> {
  console.log('Running search API latency benchmark...');
  console.log('Connecting to database...');

  const propCountRes = await query('SELECT count(*) FROM properties');
  const totalCount = parseInt(propCountRes.rows[0].count, 10);
  console.log(`Total listings in database: ${totalCount}`);

  if (totalCount < 5000) {
    console.warn(`Warning: Listing count is ${totalCount}, expected 5000+. Please run db:seed first.`);
  }

  // Warmup requests
  console.log('Warming up with 20 requests...');
  for (let i = 0; i < 20; i++) {
    const q = BENCH_QUERIES[i % BENCH_QUERIES.length].query;
    await request(app).get(`/api/properties?${q}`);
  }

  // Run 200 benchmark requests
  const TOTAL_REQUESTS = 200;
  console.log(`Executing ${TOTAL_REQUESTS} varied search requests...`);
  const latencies: number[] = [];

  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    const q = BENCH_QUERIES[i % BENCH_QUERIES.length].query;
    const start = performance.now();
    const res = await request(app).get(`/api/properties?${q}`);
    const duration = performance.now() - start;

    if (res.status !== 200) {
      console.error(`Request failed with status ${res.status}: /api/properties?${q}`);
    }

    latencies.push(duration);
  }

  latencies.sort((a, b) => a - b);

  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const avg = sum / latencies.length;
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p90 = latencies[Math.floor(latencies.length * 0.9)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log('\n================ BENCHMARK RESULTS ================');
  console.log(`Requests:          ${TOTAL_REQUESTS}`);
  console.log(`Total Listings:    ${totalCount}`);
  console.log(`Average Latency:   ${avg.toFixed(2)} ms`);
  console.log(`Median (p50):      ${p50.toFixed(2)} ms`);
  console.log(`p90 Latency:       ${p90.toFixed(2)} ms`);
  console.log(`p95 Latency:       ${p95.toFixed(2)} ms`);
  console.log(`p99 Latency:       ${p99.toFixed(2)} ms`);
  console.log(`Min Latency:       ${min.toFixed(2)} ms`);
  console.log(`Max Latency:       ${max.toFixed(2)} ms`);
  console.log('===================================================\n');

  console.log('--- EXPLAIN ANALYZE (Indexed Query Execution Plan) ---');
  try {
    const plan = await runExplainAnalyze();
    console.log(plan);
  } catch (err) {
    console.error('Failed to run EXPLAIN ANALYZE:', err);
  }

  await pool.end();
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
