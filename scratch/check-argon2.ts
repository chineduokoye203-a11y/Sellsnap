import * as argon2 from 'argon2';

async function main() {
  try {
    const hash = await argon2.hash('password123');
    console.log('Hash created:', hash);
    const valid = await argon2.verify(hash, 'password123');
    console.log('Verification successful:', valid);
  } catch (error) {
    console.error('Argon2 failed:', error);
  }
}

main();
