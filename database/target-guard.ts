type TargetEnvironment = Record<string, string | undefined>;

const projectRefPattern = /^[a-z0-9]{20}$/;

function isLoopback(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

export function databaseTargetIssue(
  connectionString: string | undefined,
  env: TargetEnvironment = process.env,
  operation: 'runtime' | 'migration' | 'seed' = 'runtime',
): string | undefined {
  if (!connectionString) return 'POSTGRES_URL is missing.';

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return 'POSTGRES_URL is not a valid PostgreSQL URL.';
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    return 'POSTGRES_URL must use the PostgreSQL protocol.';
  }

  // Production runtime is the only context where a production database is valid.
  // Migration and fixture commands are deliberately never allowed in that context.
  if (env.VERCEL === '1' && env.VERCEL_ENV === 'production' && env.NODE_ENV === 'production') {
    return operation === 'runtime' ? undefined : 'Database mutations are blocked in the production environment.';
  }

  // Test harnesses may use a disposable PostgreSQL/PGlite socket on loopback.
  if (env.TEST_ISOLATED === '1' && isLoopback(url.hostname)) return undefined;

  if (env.DATABASE_TARGET === 'local') {
    return isLoopback(url.hostname)
      ? undefined
      : 'DATABASE_TARGET=local requires a loopback PostgreSQL host.';
  }

  if (env.DATABASE_TARGET === 'staging') {
    const stagingRef = env.STAGING_SUPABASE_PROJECT_REF;
    const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF;
    if (!stagingRef || !projectRefPattern.test(stagingRef)) {
      return 'Staging database use requires a valid STAGING_SUPABASE_PROJECT_REF.';
    }
    if (!productionRef || !projectRefPattern.test(productionRef)) {
      return 'Staging database use requires the verified PRODUCTION_SUPABASE_PROJECT_REF.';
    }
    if (stagingRef === productionRef) {
      return 'The staging and production Supabase project references must differ.';
    }
    if (url.hostname !== `db.${stagingRef}.supabase.co`) {
      return 'Staging POSTGRES_URL must identify the configured staging Supabase project directly.';
    }
    return undefined;
  }

  return 'Database access is blocked until DATABASE_TARGET is explicitly set to local or staging.';
}

export function assertSafeDatabaseTarget(
  operation: 'runtime' | 'migration' | 'seed' = 'runtime',
  connectionString = process.env.POSTGRES_URL,
  env: TargetEnvironment = process.env,
) {
  const issue = databaseTargetIssue(connectionString, env, operation);
  if (issue) throw new Error(issue);
}
