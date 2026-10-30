import bcrypt from 'bcryptjs';
import { pool } from './db';

// Simple deterministic Mulberry32 PRNG
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(1337);

function randBetween(min: number, max: number): number {
  return min + random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1));
}

function pickOne<T>(arr: readonly T[] | T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function pickMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - random());
  return shuffled.slice(0, count);
}

const CITIES = [
  {
    city: 'Bengaluru',
    state: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
    neighborhoods: ['Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield', 'Jayanagar', 'Hebbal', 'Marathahalli', 'Malleshwaram'],
    zipPrefix: '5600',
  },
  {
    city: 'Mumbai',
    state: 'Maharashtra',
    lat: 19.0760,
    lng: 72.8777,
    neighborhoods: ['Bandra West', 'Andheri East', 'Juhu', 'Powai', 'Worli', 'Colaba', 'Malad West', 'Thane West'],
    zipPrefix: '4000',
  },
  {
    city: 'Delhi',
    state: 'Delhi',
    lat: 28.6139,
    lng: 77.2090,
    neighborhoods: ['Hauz Khas', 'Connaught Place', 'Saket', 'Vasant Kunj', 'Greater Kailash', 'Dwarka', 'Rohini', 'Karol Bagh'],
    zipPrefix: '1100',
  },
  {
    city: 'Hyderabad',
    state: 'Telangana',
    lat: 17.3850,
    lng: 78.4867,
    neighborhoods: ['Gachibowli', 'Hitec City', 'Jubilee Hills', 'Banjara Hills', 'Madhapur', 'Kondapur', 'Kukatpally', 'Begumpet'],
    zipPrefix: '5000',
  },
  {
    city: 'Pune',
    state: 'Maharashtra',
    lat: 18.5204,
    lng: 73.8567,
    neighborhoods: ['Koregaon Park', 'Kothrud', 'Viman Nagar', 'Baner', 'Hinjewadi', 'Aundh', 'Wakad', 'Magarpatta'],
    zipPrefix: '4110',
  },
  {
    city: 'Chennai',
    state: 'Tamil Nadu',
    lat: 13.0827,
    lng: 80.2707,
    neighborhoods: ['Adyar', 'Anna Nagar', 'Besant Nagar', 'T Nagar', 'Velachery', 'Mylapore', 'OMR', 'Thiruvanmiyur'],
    zipPrefix: '6000',
  },
  {
    city: 'Kolkata',
    state: 'West Bengal',
    lat: 22.5726,
    lng: 88.3639,
    neighborhoods: ['Salt Lake', 'New Town', 'Ballygunge', 'Alipore', 'Park Street', 'Gariahat', 'Jadavpur', 'Behala'],
    zipPrefix: '7000',
  },
  {
    city: 'Ahmedabad',
    state: 'Gujarat',
    lat: 23.0225,
    lng: 72.5714,
    neighborhoods: ['Bodakdev', 'Satellite', 'Vastrapur', 'Navrangpura', 'Prahlad Nagar', 'Thaltej', 'SG Highway', 'Maninagar'],
    zipPrefix: '3800',
  },
  {
    city: 'Jaipur',
    state: 'Rajasthan',
    lat: 26.9124,
    lng: 75.7873,
    neighborhoods: ['Malviya Nagar', 'Vaishali Nagar', 'C-Scheme', 'Mansarovar', 'Raja Park', 'Bani Park', 'Civil Lines', 'Jagatpura'],
    zipPrefix: '3020',
  },
  {
    city: 'Goa',
    state: 'Goa',
    lat: 15.2993,
    lng: 74.1240,
    neighborhoods: ['Panaji', 'Candolim', 'Calangute', 'Anjuna', 'Margao', 'Vagator', 'Assagao', 'Porvorim'],
    zipPrefix: '4030',
  },
];

const ADJECTIVES = ['Spacious', 'Modern', 'Cozy', 'Sunlit', 'Luxury', 'Minimalist', 'Charming', 'Elegant', 'Executive', 'Peaceful'];
const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'STUDIO', 'VILLA'] as const;
const ALL_AMENITIES = ['wifi', 'parking', 'gym', 'pool', 'air_conditioning', 'balcony', 'elevator', 'security', 'power_backup', 'furnished'];

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800&auto=format&fit=crop&q=80',
];

export async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // Clear existing tables
    await client.query('TRUNCATE users, properties, property_images, bookings RESTART IDENTITY CASCADE');

    // 1. Insert Demo Users
    const passwordHash = await bcrypt.hash('password123', 10);

    const userInsertSql = `
      INSERT INTO users (name, email, password_hash, role)
      VALUES
        ('Aarav Sharma', 'manager@nestfinder.dev', $1, 'MANAGER'),
        ('Priya Patel', 'tenant@nestfinder.dev', $1, 'TENANT'),
        ('Vikram Mehta', 'manager2@nestfinder.dev', $1, 'MANAGER'),
        ('Neha Gupta', 'tenant2@nestfinder.dev', $1, 'TENANT')
      RETURNING id, role, email;
    `;
    const usersResult = await client.query(userInsertSql, [passwordHash]);
    const managers = usersResult.rows.filter((u) => u.role === 'MANAGER');
    const tenants = usersResult.rows.filter((u) => u.role === 'TENANT');

    console.log(`Inserted ${usersResult.rows.length} demo users`);

    // 2. Generate 5,200 Listings
    const TOTAL_PROPERTIES = 5200;
    const BATCH_SIZE = 400;

    console.log(`Generating and inserting ${TOTAL_PROPERTIES} properties across 10 cities...`);

    const propertyIds: number[] = [];

    for (let batchStart = 0; batchStart < TOTAL_PROPERTIES; batchStart += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, TOTAL_PROPERTIES - batchStart);
      const values: unknown[] = [];
      const rowPlaceholders: string[] = [];

      for (let i = 0; i < batchCount; i++) {
        const propIndex = batchStart + i;
        const cityData = CITIES[propIndex % CITIES.length];
        const neighborhood = cityData.neighborhoods[randInt(0, cityData.neighborhoods.length - 1)];
        const manager = managers[randInt(0, managers.length - 1)];

        const propType = pickOne(PROPERTY_TYPES);
        let beds = randInt(1, 4);
        if (propType === 'STUDIO') beds = 1;
        if (propType === 'VILLA') beds = randInt(3, 6);

        const baths = Math.max(1, Math.min(beds, randInt(1, 4)));
        const sqft = beds * randInt(350, 600) + randInt(50, 200);

        // Price varies realistically by city and size
        let basePrice = beds * 12000 + randInt(3000, 15000);
        if (cityData.city === 'Mumbai') basePrice = Math.round(basePrice * 1.5);
        if (cityData.city === 'Goa' && propType === 'VILLA') basePrice = Math.round(basePrice * 1.8);
        const price = Math.round(basePrice / 500) * 500;

        const adjective = pickOne(ADJECTIVES);
        const title = `${adjective} ${beds} BHK ${propType.charAt(0) + propType.slice(1).toLowerCase()} in ${neighborhood}`;
        const description = `Well-maintained ${propType.toLowerCase()} situated in prime ${neighborhood}, ${cityData.city}. Featuring ${beds} bedroom(s), ${baths} bathroom(s), and ${sqft} sq ft of usable living area. Close to transit, groceries, and cafes.`;
        const address = `${randInt(10, 999)}, ${neighborhood} Main Road`;
        const zipCode = `${cityData.zipPrefix}${randInt(10, 99)}`;

        // Slight realistic geographic scatter (~3-6 km)
        const latOffset = (random() - 0.5) * 0.08;
        const lngOffset = (random() - 0.5) * 0.08;
        const latitude = Number((cityData.lat + latOffset).toFixed(6));
        const longitude = Number((cityData.lng + lngOffset).toFixed(6));

        const amenityCount = randInt(3, 7);
        const amenities = pickMultiple(ALL_AMENITIES, amenityCount);

        const paramOffset = i * 15;
        rowPlaceholders.push(
          `($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3}, $${paramOffset + 4}, $${paramOffset + 5}, $${paramOffset + 6}, $${paramOffset + 7}, $${paramOffset + 8}, $${paramOffset + 9}, $${paramOffset + 10}, $${paramOffset + 11}, $${paramOffset + 12}, $${paramOffset + 13}, $${paramOffset + 14}, $${paramOffset + 15})`
        );

        values.push(
          manager.id,
          title,
          description,
          price,
          address,
          cityData.city,
          cityData.state,
          zipCode,
          latitude,
          longitude,
          propType,
          beds,
          baths,
          sqft,
          amenities
        );
      }

      const insertBatchSql = `
        INSERT INTO properties (
          manager_id, title, description, price, address, city, state, zip_code,
          latitude, longitude, property_type, beds, baths, sqft, amenities
        )
        VALUES ${rowPlaceholders.join(',\n')}
        RETURNING id;
      `;

      const result = await client.query(insertBatchSql, values);
      for (const row of result.rows) {
        propertyIds.push(row.id);
      }
    }

    console.log(`Successfully inserted ${propertyIds.length} properties.`);

    // 3. Batch insert images
    console.log('Inserting property images...');
    const IMG_BATCH = 1000;
    for (let i = 0; i < propertyIds.length; i += IMG_BATCH) {
      const slice = propertyIds.slice(i, i + IMG_BATCH);
      const imgValues: unknown[] = [];
      const imgPlaceholders: string[] = [];

      slice.forEach((pId, idx) => {
        const sampleUrl = SAMPLE_IMAGES[(pId + idx) % SAMPLE_IMAGES.length];
        const offset = idx * 3;
        imgPlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        imgValues.push(pId, sampleUrl, true);
      });

      const imgSql = `
        INSERT INTO property_images (property_id, url, is_primary)
        VALUES ${imgPlaceholders.join(',\n')};
      `;
      await client.query(imgSql, imgValues);
    }
    console.log(`Inserted primary images for all ${propertyIds.length} properties.`);

    // 4. Insert Seed Bookings
    console.log('Inserting seed bookings...');
    const demoTenant = tenants[0];
    const demoTenant2 = tenants[1];

    // Seed some approved bookings (non-overlapping dates) and pending bookings
    const seedBookings = [
      {
        propertyId: propertyIds[0],
        tenantId: demoTenant.id,
        startDate: '2026-11-01',
        endDate: '2026-11-07',
        status: 'APPROVED',
        totalPrice: 42000,
        message: 'Looking forward to moving in for the work project.',
      },
      {
        propertyId: propertyIds[0],
        tenantId: demoTenant2.id,
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        status: 'PENDING',
        totalPrice: 35000,
        message: 'Family vacation stay.',
      },
      {
        propertyId: propertyIds[1],
        tenantId: demoTenant.id,
        startDate: '2026-12-01',
        endDate: '2026-12-15',
        status: 'APPROVED',
        totalPrice: 65000,
        message: 'Business relocation stay.',
      },
      {
        propertyId: propertyIds[2],
        tenantId: demoTenant.id,
        startDate: '2026-11-05',
        endDate: '2026-11-12',
        status: 'PENDING',
        totalPrice: 28000,
        message: 'Inquiring about early check-in.',
      },
      {
        propertyId: propertyIds[3],
        tenantId: demoTenant2.id,
        startDate: '2026-11-20',
        endDate: '2026-11-25',
        status: 'APPROVED',
        totalPrice: 32000,
        message: 'Attending tech conference.',
      },
    ];

    for (const b of seedBookings) {
      await client.query(
        `INSERT INTO bookings (property_id, tenant_id, start_date, end_date, status, total_price, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [b.propertyId, b.tenantId, b.startDate, b.endDate, b.status, b.totalPrice, b.message]
      );
    }

    console.log(`Inserted ${seedBookings.length} initial bookings.`);
    console.log('Seeding completed successfully.');
  } finally {
    client.release();
  }
}

if (require.main === module || process.argv[1]?.includes('seed.ts')) {
  seed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seeding failed:', err);
      await pool.end();
      process.exit(1);
    });
}
