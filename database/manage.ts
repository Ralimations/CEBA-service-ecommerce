import { existsSync } from 'node:fs';
import { migrate, closeDb } from '@/server/db';
import { seed } from './seed';
if (existsSync('.env'))
    process.loadEnvFile('.env');
if (existsSync('.env.local'))
    process.loadEnvFile('.env.local');
const command = process.argv[2];
if (!['migrate', 'seed'].includes(command))
    throw new Error('Use migrate or seed. PostgreSQL reset is intentionally unavailable.');
(await migrate());
console.log('Supabase PostgreSQL migration applied.');
if (command !== 'migrate')
    console.log((await seed()) ? 'Development data seeded.' : 'Database already contains users; seed skipped.');
(await closeDb());
