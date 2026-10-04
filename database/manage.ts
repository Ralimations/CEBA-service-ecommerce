import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrate, closeDb } from '@/server/db';
import { seed } from './seed';
if (existsSync('.env'))
    process.loadEnvFile('.env');
const command = process.argv[2];
if (!['migrate', 'seed', 'reset'].includes(command))
    throw new Error('Use migrate, seed, or reset.');
if (command === 'reset') {
    (await closeDb());
    const target = resolve(process.env.DATABASE_PATH || './data/marketplace.sqlite');
    const dataRoot = resolve('data');
    if (!target.startsWith(dataRoot + '\\') && !target.startsWith(dataRoot + '/'))
        throw new Error('Reset only permits database files inside this project data directory.');
    for (const suffix of ['', '-wal', '-shm'])
        if (existsSync(target + suffix))
            unlinkSync(target + suffix);
}
(await migrate());
console.log('SQLite migration 1 applied.');
if (command !== 'migrate')
    console.log((await seed()) ? 'Development data seeded.' : 'Database already contains users; seed skipped.');
(await closeDb());
