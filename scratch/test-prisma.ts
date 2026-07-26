import { db } from './lib/db';

async function test() {
    try {
        const user = await db.user.findFirst({
            select: {
                id: true,
                onboardingComplete: true
            }
        });
        console.log('User found:', user);
    } catch (err) {
        console.error('Prisma Error:', err);
    } finally {
        await db.$disconnect();
    }
}

test();
