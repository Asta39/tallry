import postgres from 'postgres';

process.loadEnvFile('.env.local');

const sql = postgres(process.env.DATABASE_URL);

async function fix() {
  try {
    console.log('Creating logos bucket...');
    await sql`
      INSERT INTO storage.buckets (id, name, public) 
      VALUES ('logos', 'logos', true) 
      ON CONFLICT (id) DO NOTHING;
    `;

    console.log('Creating storage policies...');
    
    // Enable RLS on objects if not already
    await sql`ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`;

    // Drop existing policies if any
    await sql`DROP POLICY IF EXISTS "Public Access" ON storage.objects;`;
    await sql`DROP POLICY IF EXISTS "Auth Uploads" ON storage.objects;`;
    await sql`DROP POLICY IF EXISTS "Auth Updates" ON storage.objects;`;

    // Anyone can read from the logos bucket
    await sql`
      CREATE POLICY "Public Access" 
      ON storage.objects FOR SELECT 
      USING ( bucket_id = 'logos' );
    `;

    // Authenticated users can insert
    await sql`
      CREATE POLICY "Auth Uploads" 
      ON storage.objects FOR INSERT 
      TO authenticated 
      WITH CHECK ( bucket_id = 'logos' );
    `;

    // Authenticated users can update their own logos (optional, we use upsert)
    await sql`
      CREATE POLICY "Auth Updates" 
      ON storage.objects FOR UPDATE 
      TO authenticated 
      USING ( bucket_id = 'logos' );
    `;

    console.log('Done!');
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

fix();
