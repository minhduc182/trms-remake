import oracledb from 'oracledb';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Parse oracle://USER:PASS@HOST:PORT/SERVICE
function parseOracleDsn(dsn: string) {
  const url = new URL(dsn);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    connectString: `${url.hostname}:${url.port || '1521'}${url.pathname}`,
  };
}

const TABLES_TO_EXTRACT = [
  // PLATFORM_CORE (GA_CORE)
  { schema: 'GA_CORE', table: 'USERS' },
  { schema: 'GA_CORE', table: 'EMPLOYEES' },
  { schema: 'GA_CORE', table: 'ORG_UNITS' },
  { schema: 'GA_CORE', table: 'USER_ORG_UNITS_POSITIONS' },
  { schema: 'GA_CORE', table: 'ROLES' },
  { schema: 'GA_CORE', table: 'USER_ROLES' },
  { schema: 'GA_CORE', table: 'ROLE_FEATURES' },
  { schema: 'GA_CORE', table: 'FEATURES' },
  { schema: 'GA_CORE', table: 'SYSTEMS' },
  { schema: 'GA_CORE', table: 'GLOBAL_VARIABLE' },
  { schema: 'GA_CORE', table: 'SHIFTS' },
  // TRMS_CORE
  { schema: 'TRMS_CORE', table: 'TRMS_VENDORS' },
  { schema: 'TRMS_CORE', table: 'TRMS_POINTS' },
  { schema: 'TRMS_CORE', table: 'TRMS_VEHICLES' },
  { schema: 'TRMS_CORE', table: 'TRMS_DRIVERS' },
  { schema: 'TRMS_CORE', table: 'TRMS_LEG_DEFINITIONS' },
  { schema: 'TRMS_CORE', table: 'TRMS_ROUTES' },
  { schema: 'TRMS_CORE', table: 'TRMS_ROUTE_SEGMENTS' },
  { schema: 'TRMS_CORE', table: 'TRMS_SEGMENT_POINTS' },
  { schema: 'TRMS_CORE', table: 'TRMS_SEGMENT_SHIFTS' },
  { schema: 'TRMS_CORE', table: 'TRMS_ROUTE_VEHICLES' },
  { schema: 'TRMS_CORE', table: 'TRMS_SHIFT_DEFINITIONS' },
  { schema: 'TRMS_CORE', table: 'TRMS_EMPLOYEE_TRANSPORT_PROFILES' },
  { schema: 'TRMS_CORE', table: 'TRMS_COST_CONFIGS' },
  { schema: 'TRMS_CORE', table: 'TRMS_COST_CONFIG_RULES' },
  // TRMS_DATA
  { schema: 'TRMS_DATA', table: 'TRMS_IMPORT_BATCHES' },
  { schema: 'TRMS_DATA', table: 'TRMS_IMPORT_BATCH_ROWS', query: 'SELECT * FROM TRMS_DATA.TRMS_IMPORT_BATCH_ROWS FETCH FIRST 5000 ROWS ONLY' },
  { schema: 'TRMS_DATA', table: 'TRMS_IMPORT_BATCH_ERRORS', query: 'SELECT * FROM TRMS_DATA.TRMS_IMPORT_BATCH_ERRORS FETCH FIRST 2000 ROWS ONLY' },
  { schema: 'TRMS_DATA', table: 'TRMS_VEHICLE_STATUS' },
  { schema: 'TRMS_DATA', table: 'TRMS_TRANSPORT_REQUESTS' },
  { schema: 'TRMS_DATA', table: 'TRMS_REQUEST_PASSENGERS' },
  { schema: 'TRMS_DATA', table: 'TRMS_REQUEST_STATUS_HISTORY' },
  { schema: 'TRMS_DATA', table: 'TRMS_APPROVAL_RECORDS' },
  { schema: 'TRMS_DATA', table: 'TRMS_DAILY_PLANS' },
  { schema: 'TRMS_DATA', table: 'TRMS_PLAN_VERSIONS' },
  { schema: 'TRMS_DATA', table: 'TRMS_PLAN_DEMAND_ITEMS' },
  { schema: 'TRMS_DATA', table: 'TRMS_PLAN_ASSIGNMENTS' },
  { schema: 'TRMS_DATA', table: 'TRMS_TRIPS' },
  { schema: 'TRMS_DATA', table: 'TRMS_TRIP_REQUEST_LINKS' },
  { schema: 'TRMS_DATA', table: 'TRMS_TRIP_ASSIGNMENTS' },
  { schema: 'TRMS_DATA', table: 'TRMS_DRIVER_CONFIRMATIONS' },
  { schema: 'TRMS_DATA', table: 'TRMS_TRIP_EXECUTION_FACTS' },
  { schema: 'TRMS_DATA', table: 'TRMS_DISPATCH_CONFLICTS' },
  { schema: 'TRMS_DATA', table: 'TRMS_CONFLICT_OVERRIDE_LOGS' },
  { schema: 'TRMS_DATA', table: 'TRMS_COST_RECORDS' },
  { schema: 'TRMS_DATA', table: 'TRMS_MONTHLY_PAYMENTS' },
  { schema: 'TRMS_DATA', table: 'TRMS_MONTHLY_COST_DETAILS' },
  { schema: 'TRMS_DATA', table: 'TRMS_AUDIT_LOGS' },
];

async function main() {
  const dsn = process.env.LEGACY_ORACLE_DSN || 'oracle://GA_CORE:Mkac12345@192.84.100.96:1522/SYSTEMPDB1';
  const outDir = path.resolve(process.cwd(), 'data/oracle-dump');
  await fs.mkdir(outDir, { recursive: true });

  console.log(`[Extract] Connecting to Oracle (${dsn.replace(/:[^:@]+@/, ':***@')})...`);
  const cfg = parseOracleDsn(dsn);

  let conn: oracledb.Connection | null = null;
  const summary: Record<string, { count: number; status: string; error?: string }> = {};

  try {
    oracledb.fetchAsString = [oracledb.NUMBER, oracledb.CLOB];
    conn = await oracledb.getConnection(cfg);
    console.log('[Extract] Connected to Oracle successfully!');

    for (const item of TABLES_TO_EXTRACT) {
      const fullName = `${item.schema}.${item.table}`;
      const outPath = path.join(outDir, `${item.schema}__${item.table}.json`);
      try {
        const stat = await fs.stat(outPath).catch(() => null);
        if (stat && stat.size > 10) {
          console.log(`  ↷ ${fullName}: already extracted (${stat.size} bytes), skipping`);
          continue;
        }
        const sql = (item as any).query || `SELECT * FROM ${fullName}`;
        const res = await conn.execute(sql, [], {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });
        const rows = res.rows || [];
        await fs.writeFile(
          outPath,
          JSON.stringify(rows, null, 2),
          'utf-8',
        );
        summary[fullName] = { count: rows.length, status: 'OK' };
        console.log(`  ✓ ${fullName}: ${rows.length} rows`);
      } catch (err: any) {
        summary[fullName] = { count: 0, status: 'SKIPPED', error: err.message };
        console.warn(`  ⚠ ${fullName}: ${err.message}`);
      }
    }

    await fs.writeFile(
      path.join(outDir, '_summary.json'),
      JSON.stringify({ extractedAt: new Date().toISOString(), tables: summary }, null, 2),
      'utf-8',
    );
    console.log('[Extract] Completed! Summary saved to data/oracle-dump/_summary.json');
  } catch (err: any) {
    console.error(`[Extract] Could not connect to Oracle directly: ${err.message}`);
    console.log('[Extract] Will rely on deterministic seed / existing dump.');
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

main();
