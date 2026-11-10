import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUMP_DIR = path.resolve(__dirname, '../../data/oracle-dump');

async function main() {
  console.log('=== [Reconcile §5.4] Comparing Legacy Oracle Dump vs PostgreSQL App DB ===');

  const rawCosts = JSON.parse(
    await fs.readFile(path.join(DUMP_DIR, 'TRMS_DATA__TRMS_COST_RECORDS.json'), 'utf-8'),
  ) as Record<string, any>[];

  const rawMonthly = JSON.parse(
    await fs.readFile(path.join(DUMP_DIR, 'TRMS_DATA__TRMS_MONTHLY_PAYMENTS.json'), 'utf-8'),
  ) as Record<string, any>[];

  const oracleCostIds = rawCosts.map((r) => BigInt(String(r.ID)));

  // 1. Row counts
  const pgCostCount = await prisma.costRecord.count({
    where: { id: { in: oracleCostIds } },
  });
  const pgMonthlyCount = await prisma.monthlyPayment.count();

  console.log(`  CostRecords count   : Oracle=${rawCosts.length} | Postgres=${pgCostCount}`);
  console.log(`  MonthlyPayments cnt : Oracle=${rawMonthly.length} | Postgres=${pgMonthlyCount}`);

  // 2. Sum of appliedAmount & amountAfterVat in CostRecord
  let oracleCostBeforeVat = new Prisma.Decimal(0);
  let oracleCostAfterVat = new Prisma.Decimal(0);
  for (const r of rawCosts) {
    oracleCostBeforeVat = oracleCostBeforeVat.plus(new Prisma.Decimal(String(r.APPLIED_AMOUNT || '0')));
    oracleCostAfterVat = oracleCostAfterVat.plus(new Prisma.Decimal(String(r.AMOUNT_AFTER_VAT || '0')));
  }

  const pgCostAgg = await prisma.costRecord.aggregate({
    where: { id: { in: oracleCostIds } },
    _sum: {
      appliedAmount: true,
      amountAfterVat: true,
    },
  });

  const pgBefore = pgCostAgg._sum.appliedAmount ?? new Prisma.Decimal(0);
  const pgAfter = pgCostAgg._sum.amountAfterVat ?? new Prisma.Decimal(0);

  const diffBefore = oracleCostBeforeVat.minus(pgBefore);
  const diffAfter = oracleCostAfterVat.minus(pgAfter);

  console.log(`  SUM(CostRecords.appliedAmount)  : Oracle=${oracleCostBeforeVat.toFixed(2)} | PG=${pgBefore.toFixed(2)} | Diff=${diffBefore.toFixed(2)}`);
  console.log(`  SUM(CostRecords.amountAfterVat) : Oracle=${oracleCostAfterVat.toFixed(2)} | PG=${pgAfter.toFixed(2)} | Diff=${diffAfter.toFixed(2)}`);

  // 3. MonthlyPayment totals
  let oracleMonthlyAfterVat = new Prisma.Decimal(0);
  for (const m of rawMonthly) {
    oracleMonthlyAfterVat = oracleMonthlyAfterVat.plus(new Prisma.Decimal(String(m.TOTAL_AFTER_VAT || '0')));
  }
  const pgMonthlyAgg = await prisma.monthlyPayment.aggregate({
    _sum: { totalAfterVat: true },
  });
  const pgMonthlyAfter = pgMonthlyAgg._sum.totalAfterVat ?? new Prisma.Decimal(0);
  const diffMonthly = oracleMonthlyAfterVat.minus(pgMonthlyAfter);

  console.log(`  SUM(MonthlyPayment.totalAfterVat): Oracle=${oracleMonthlyAfterVat.toFixed(2)} | PG=${pgMonthlyAfter.toFixed(2)} | Diff=${diffMonthly.toFixed(2)}`);

  if (!diffBefore.isZero() || !diffAfter.isZero() || !diffMonthly.isZero()) {
    console.error('❌ Reconciliation FAILED: Non-zero cost difference detected!');
    process.exit(1);
  }

  console.log('✅ Reconciliation PASSED: 0 VND difference across all cost records & monthly payments!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
