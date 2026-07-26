import { Pool } from 'pg';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  console.log('Testing connection to:', connectionString);
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  
  try {
    const client = await pool.connect();
    console.log('✅ pg connected successfully');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    client.release();
  } catch (error) {
    console.error('❌ pg connection failed:', error);
  } finally {
    await pool.end();
  }
}

main();
