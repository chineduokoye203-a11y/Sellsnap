import 'dotenv/config';
import { db } from '../lib/db';

async function main() {
  try {
    console.log('✅ Attempting to connect via lib/db...');
    console.log('Using DATABASE_URL:', process.env.DATABASE_URL);
    const userCount = await db.user.count();
    console.log(`User count: ${userCount}`);
    
    if (userCount > 0) {
      const users = await db.user.findMany({ take: 5 });
      console.log('Sample users:', users.map(u => ({ email: u.email, name: u.name })));
    }
  } catch (error) {
    console.error('❌ Database query failed:', error);
  }
}

main();
