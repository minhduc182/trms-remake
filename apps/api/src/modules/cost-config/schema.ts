import { Prisma } from '@prisma/client';
import { builder } from '../../builder.js';
import { prisma, writeAuditLog } from '../../context.js';
import {
  FEATURE_CODES,
  COST_CONFIG_TYPES,
  PASSENGER_TYPES,
  nextSnowflakeId,
} from '@trms/shared';
import { subtractOneDay } from '@trms/domain';

function getTodayStr(): string {
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

export const CostConfigRuleObj = builder.prismaObject('CostConfigRule', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    costConfigId: t.expose('costConfigId', { type: 'BigInt' }),
    ruleCode: t.exposeString('ruleCode'),
    rateType: t.exposeString('rateType'),
    dayType: t.exposeString('dayType', { nullable: true }),
    minDistanceKm: t.expose('minDistanceKm', { type: 'Decimal', nullable: true }),
    maxDistanceKm: t.expose('maxDistanceKm', { type: 'Decimal', nullable: true }),
    minDistanceInclusiveFlag: t.exposeString('minDistanceInclusiveFlag', { nullable: true }),
    maxDistanceInclusiveFlag: t.exposeString('maxDistanceInclusiveFlag', { nullable: true }),
    dailyTripCount: t.exposeInt('dailyTripCount', { nullable: true }),
    includedDistanceKm: t.expose('includedDistanceKm', { type: 'Decimal', nullable: true }),
    unitPrice: t.expose('unitPrice', { type: 'Decimal' }),
    priceUnit: t.exposeString('priceUnit'),
    stackableFlag: t.exposeString('stackableFlag'),
    priority: t.exposeInt('priority'),
    description: t.exposeString('description', { nullable: true }),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
  }),
});

export const CostConfigObj = builder.prismaObject('CostConfig', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    versionCode: t.exposeString('versionCode'),
    configType: t.exposeString('configType'),
    passengerType: t.exposeString('passengerType'),
    vehicleType: t.exposeString('vehicleType'),
    pricingScope: t.exposeString('pricingScope', { nullable: true }),
    currencyCode: t.exposeString('currencyCode'),
    effectiveFrom: t.exposeString('effectiveFrom'),
    effectiveTo: t.exposeString('effectiveTo', { nullable: true }),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createBy: t.expose('createBy', { type: 'BigInt', nullable: true }),
    editBy: t.expose('editBy', { type: 'BigInt', nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    rules: t.relation('rules', {
      query: () => ({ where: { delFlag: 'N' }, orderBy: { priority: 'asc' } }),
    }),
  }),
});

export const CostConfigRuleInput = builder.inputType('CostConfigRuleInput', {
  fields: (t) => ({
    ruleCode: t.string(),
    rateType: t.string({ required: true }),
    dayType: t.string(),
    minDistanceKm: t.field({ type: 'Decimal' }),
    maxDistanceKm: t.field({ type: 'Decimal' }),
    minDistanceInclusiveFlag: t.string(),
    maxDistanceInclusiveFlag: t.string(),
    dailyTripCount: t.int(),
    includedDistanceKm: t.field({ type: 'Decimal' }),
    unitPrice: t.field({ type: 'Decimal', required: true }),
    priceUnit: t.string({ defaultValue: 'VND' }),
    stackableFlag: t.string({ defaultValue: 'N' }),
    priority: t.int({ defaultValue: 1 }),
    description: t.string(),
  }),
});

export function registerCostConfigModule() {
  builder.queryFields((t) => ({
    costConfigs: t.prismaField({
      type: ['CostConfig'],
      authScopes: { feature: FEATURE_CODES.COST_CONFIG_LIST },
      args: {
        configType: t.arg.string(),
        passengerType: t.arg.string(),
        vehicleType: t.arg.string(),
        pricingScope: t.arg.string(),
        activeFlag: t.arg.string(),
        search: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        prisma.costConfig.findMany({
          ...query,
          where: {
            delFlag: 'N',
            ...(args.configType ? { configType: args.configType } : {}),
            ...(args.passengerType ? { passengerType: args.passengerType } : {}),
            ...(args.vehicleType ? { vehicleType: args.vehicleType } : {}),
            ...(args.pricingScope ? { pricingScope: args.pricingScope } : {}),
            ...(args.activeFlag ? { activeFlag: args.activeFlag } : {}),
            ...(args.search
              ? {
                  OR: [
                    { versionCode: { contains: args.search, mode: 'insensitive' } },
                    { vehicleType: { contains: args.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: [{ effectiveFrom: 'desc' }, { versionCode: 'desc' }],
        }),
    }),
  }));

  builder.mutationFields((t) => ({
    upsertCostConfig: t.prismaField({
      type: 'CostConfig',
      authScopes: { feature: FEATURE_CODES.COST_CONFIG_UPSERT },
      args: {
        id: t.arg({ type: 'BigInt' }),
        previousConfigId: t.arg({ type: 'BigInt' }),
        versionCode: t.arg.string(),
        configType: t.arg.string({ required: true }),
        passengerType: t.arg.string({ required: true }),
        vehicleType: t.arg.string({ required: true }),
        pricingScope: t.arg.string(),
        currencyCode: t.arg.string({ defaultValue: 'VND' }),
        effectiveFrom: t.arg.string({ required: true }),
        effectiveTo: t.arg.string(),
        activeFlag: t.arg.string(),
        rules: t.arg({ type: [CostConfigRuleInput], required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const configType = args.configType.trim().toUpperCase();
        const passengerType = args.passengerType.trim().toUpperCase();
        const vehicleType = args.vehicleType.trim().toUpperCase();
        const effectiveFrom = args.effectiveFrom.trim().slice(0, 10);
        const effectiveTo = args.effectiveTo?.trim() ? args.effectiveTo.trim().slice(0, 10) : null;
        const today = getTodayStr();

        if (!(COST_CONFIG_TYPES as readonly string[]).includes(configType)) {
          throw new Error('configType chỉ chấp nhận COMMUTE hoặc EXTRA');
        }
        if (!(PASSENGER_TYPES as readonly string[]).includes(passengerType)) {
          throw new Error('passengerType chỉ chấp nhận STAFF hoặc WORKER');
        }
        if (!vehicleType) {
          throw new Error('Loại xe là bắt buộc');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
          throw new Error('Ngày bắt đầu hiệu lực (effectiveFrom) không hợp lệ (YYYY-MM-DD)');
        }
        if (effectiveTo && effectiveTo < effectiveFrom) {
          throw new Error('Ngày kết thúc hiệu lực không được nhỏ hơn ngày bắt đầu hiệu lực');
        }

        // QA §1.7.1 / AT-CC-001..003: pricingScope validation
        let normalizedPricingScope: string | null = null;
        if (configType === 'EXTRA' && passengerType === 'WORKER') {
          const scope = args.pricingScope?.trim().toUpperCase();
          if (!scope || !['STANDARD', 'HOA_BINH'].includes(scope)) {
            throw new Error(
              'Bảng giá Chuyến phát sinh (EXTRA) cho Công nhân (WORKER) bắt buộc chọn Phạm vi tính giá (STANDARD hoặc HOA_BINH)',
            );
          }
          normalizedPricingScope = scope;
        } else {
          // COMMUTE or EXTRA+STAFF does not use pricingScope
          normalizedPricingScope = null;
        }

        if (!args.rules || args.rules.length === 0) {
          throw new Error('Bảng giá phải có ít nhất một dòng quy tắc tính giá');
        }

        for (const r of args.rules) {
          const rType = r.rateType.trim().toUpperCase();
          const uPrice = Number(r.unitPrice);
          if (Number.isNaN(uPrice) || uPrice < 0) {
            throw new Error('Đơn giá không được nhỏ hơn 0');
          }
          if (configType === 'COMMUTE' && rType === 'OVERNIGHT') {
            throw new Error('Phụ phí lưu đêm (OVERNIGHT) không áp dụng cho bảng giá Tuyến cố định (COMMUTE)');
          }
        }

        // Case 1: Editing an existing config in-place (id is provided without previousConfigId)
        if (args.id && !args.previousConfigId) {
          const targetId = BigInt(args.id);
          const existing = await prisma.costConfig.findUnique({ where: { id: targetId } });
          if (!existing || existing.delFlag !== 'N') {
            throw new Error('Phiên bản cấu hình giá không tồn tại');
          }
          // QA §1.7: Khi sửa một phiên bản thì không đổi được Loại xe
          if (existing.vehicleType.toUpperCase() !== vehicleType) {
            throw new Error('Khi sửa phiên bản cấu hình chi phí thì không được thay đổi Loại xe');
          }

          await prisma.costConfig.update({
            where: { id: targetId },
            data: {
              ...(args.versionCode ? { versionCode: args.versionCode.trim() } : {}),
              effectiveFrom,
              effectiveTo,
              ...(args.activeFlag ? { activeFlag: args.activeFlag } : {}),
              editBy: ctx.user?.id ?? null,
            },
          });

          await prisma.costConfigRule.deleteMany({ where: { costConfigId: targetId } });
          for (let idx = 0; idx < args.rules.length; idx++) {
            const r = args.rules[idx];
            await prisma.costConfigRule.create({
              data: {
                id: nextSnowflakeId(),
                costConfigId: targetId,
                ruleCode: r.ruleCode?.trim() || `${r.rateType.trim().toUpperCase()}_${idx + 1}`,
                rateType: r.rateType.trim().toUpperCase(),
                dayType: r.dayType?.trim().toUpperCase() || null,
                minDistanceKm:
                  r.minDistanceKm !== undefined && r.minDistanceKm !== null
                    ? new Prisma.Decimal(String(r.minDistanceKm))
                    : null,
                maxDistanceKm:
                  r.maxDistanceKm !== undefined && r.maxDistanceKm !== null
                    ? new Prisma.Decimal(String(r.maxDistanceKm))
                    : null,
                minDistanceInclusiveFlag: r.minDistanceInclusiveFlag || 'Y',
                maxDistanceInclusiveFlag: r.maxDistanceInclusiveFlag || 'Y',
                dailyTripCount: r.dailyTripCount ?? null,
                includedDistanceKm:
                  r.includedDistanceKm !== undefined && r.includedDistanceKm !== null
                    ? new Prisma.Decimal(String(r.includedDistanceKm))
                    : null,
                unitPrice: new Prisma.Decimal(String(r.unitPrice)),
                priceUnit: r.priceUnit?.trim().toUpperCase() || 'VND',
                stackableFlag: r.stackableFlag || 'N',
                priority: r.priority ?? idx + 1,
                description: r.description?.trim() || null,
                activeFlag: 'Y',
                delFlag: 'N',
              },
            });
          }

          await writeAuditLog(
            ctx,
            'COST_CONFIG',
            targetId,
            'UPDATE',
            `Cập nhật bảng giá ${existing.versionCode}`,
          );

          return prisma.costConfig.findUniqueOrThrow({
            ...query,
            where: { id: targetId },
          });
        }

        // Case 2: Creating a new version (AT-CC-004..006)
        if (effectiveFrom < today) {
          throw new Error('Ngày bắt đầu hiệu lực không được ở trong quá khứ');
        }

        // Find all active versions with the same key (configType + passengerType + vehicleType + pricingScope)
        const sameKeyConfigs = await prisma.costConfig.findMany({
          where: {
            delFlag: 'N',
            configType,
            passengerType,
            vehicleType,
            pricingScope: normalizedPricingScope,
          },
          orderBy: { effectiveFrom: 'asc' },
        });

        // Any future version with effectiveFrom >= newEffectiveFrom will be superseded
        const supersededFutureConfigs = sameKeyConfigs.filter((c) => c.effectiveFrom >= effectiveFrom);
        for (const fut of supersededFutureConfigs) {
          const tripCount = await prisma.trip.count({
            where: { pricingConfigId: fut.id, delFlag: 'N' },
          });
          if (tripCount > 0) {
            throw new Error(
              `Phiên bản tương lai ${fut.versionCode} (${fut.effectiveFrom}) đã có chuyến xe thực tế neo vào, không thể ghi đè`,
            );
          }
        }

        // Soft-delete superseded future configs
        for (const fut of supersededFutureConfigs) {
          await prisma.costConfig.update({
            where: { id: fut.id },
            data: { delFlag: 'Y', activeFlag: 'N', editBy: ctx.user?.id ?? null },
          });
        }

        // Find the immediately preceding version (effectiveFrom < newEffectiveFrom) and cut its effectiveTo = subtractOneDay(effectiveFrom)
        const precedingConfigs = sameKeyConfigs.filter((c) => c.effectiveFrom < effectiveFrom);
        const immediatePrev =
          precedingConfigs.length > 0 ? precedingConfigs[precedingConfigs.length - 1] : null;

        if (immediatePrev) {
          const cutDate = subtractOneDay(effectiveFrom);
          await prisma.costConfig.update({
            where: { id: immediatePrev.id },
            data: {
              effectiveTo: cutDate,
              editBy: ctx.user?.id ?? null,
            },
          });
        }

        const newId = nextSnowflakeId();
        const versionCode =
          args.versionCode?.trim() ||
          `CC-${configType}-${passengerType}-${vehicleType}-${effectiveFrom.replace(/-/g, '')}`;

        await prisma.costConfig.create({
          data: {
            id: newId,
            versionCode,
            configType,
            passengerType,
            vehicleType,
            pricingScope: normalizedPricingScope,
            currencyCode: args.currencyCode?.trim().toUpperCase() || 'VND',
            effectiveFrom,
            effectiveTo,
            activeFlag: args.activeFlag === 'N' ? 'N' : 'Y',
            delFlag: 'N',
            createBy: ctx.user?.id ?? null,
            editBy: ctx.user?.id ?? null,
          },
        });

        for (let idx = 0; idx < args.rules.length; idx++) {
          const r = args.rules[idx];
          await prisma.costConfigRule.create({
            data: {
              id: nextSnowflakeId(),
              costConfigId: newId,
              ruleCode: r.ruleCode?.trim() || `${r.rateType.trim().toUpperCase()}_${idx + 1}`,
              rateType: r.rateType.trim().toUpperCase(),
              dayType: r.dayType?.trim().toUpperCase() || null,
              minDistanceKm:
                r.minDistanceKm !== undefined && r.minDistanceKm !== null
                  ? new Prisma.Decimal(String(r.minDistanceKm))
                  : null,
              maxDistanceKm:
                r.maxDistanceKm !== undefined && r.maxDistanceKm !== null
                  ? new Prisma.Decimal(String(r.maxDistanceKm))
                  : null,
              minDistanceInclusiveFlag: r.minDistanceInclusiveFlag || 'Y',
              maxDistanceInclusiveFlag: r.maxDistanceInclusiveFlag || 'Y',
              dailyTripCount: r.dailyTripCount ?? null,
              includedDistanceKm:
                r.includedDistanceKm !== undefined && r.includedDistanceKm !== null
                  ? new Prisma.Decimal(String(r.includedDistanceKm))
                  : null,
              unitPrice: new Prisma.Decimal(String(r.unitPrice)),
              priceUnit: r.priceUnit?.trim().toUpperCase() || 'VND',
              stackableFlag: r.stackableFlag || 'N',
              priority: r.priority ?? idx + 1,
              description: r.description?.trim() || null,
              activeFlag: 'Y',
              delFlag: 'N',
            },
          });
        }

        await writeAuditLog(
          ctx,
          'COST_CONFIG',
          newId,
          'CREATE',
          `Tạo phiên bản bảng giá ${versionCode} (hiệu lực từ ${effectiveFrom})`,
        );

        return prisma.costConfig.findUniqueOrThrow({
          ...query,
          where: { id: newId },
        });
      },
    }),

    deleteCostConfig: t.prismaField({
      type: 'CostConfig',
      authScopes: { feature: FEATURE_CODES.COST_CONFIG_UPSERT },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const configId = BigInt(args.id);
        const target = await prisma.costConfig.findUnique({ where: { id: configId } });
        if (!target || target.delFlag !== 'N') {
          throw new Error('Phiên bản cấu hình giá không tồn tại');
        }

        const today = getTodayStr();
        // AT-CC-007: Chỉ được xóa bản tương lai (effectiveFrom > today)
        if (target.effectiveFrom <= today) {
          throw new Error(
            'Chỉ được xóa phiên bản cấu hình giá tương lai chưa áp dụng (effectiveFrom > hôm nay)',
          );
        }

        const tripCount = await prisma.trip.count({
          where: { pricingConfigId: configId, delFlag: 'N' },
        });
        if (tripCount > 0) {
          throw new Error('Phiên bản bảng giá đã có chuyến xe thực tế neo vào, không thể xóa');
        }

        // Find remaining configs of the same key to restore effectiveTo of the immediately preceding version
        const siblings = await prisma.costConfig.findMany({
          where: {
            id: { not: configId },
            delFlag: 'N',
            configType: target.configType,
            passengerType: target.passengerType,
            vehicleType: target.vehicleType,
            pricingScope: target.pricingScope,
          },
          orderBy: { effectiveFrom: 'asc' },
        });

        const preceding = siblings.filter((c) => c.effectiveFrom < target.effectiveFrom);
        const following = siblings.filter((c) => c.effectiveFrom > target.effectiveFrom);
        const immediatePrev = preceding.length > 0 ? preceding[preceding.length - 1] : null;
        const immediateNext = following.length > 0 ? following[0] : null;

        if (immediatePrev) {
          const expectedCutDate = subtractOneDay(target.effectiveFrom);
          // Reopen effectiveTo (or bridge to next future config if one exists)
          if (!immediatePrev.effectiveTo || immediatePrev.effectiveTo === expectedCutDate) {
            await prisma.costConfig.update({
              where: { id: immediatePrev.id },
              data: {
                effectiveTo: immediateNext ? subtractOneDay(immediateNext.effectiveFrom) : null,
                editBy: ctx.user?.id ?? null,
              },
            });
          }
        }

        const deleted = await prisma.costConfig.update({
          ...query,
          where: { id: configId },
          data: {
            delFlag: 'Y',
            activeFlag: 'N',
            editBy: ctx.user?.id ?? null,
          },
        });

        await writeAuditLog(
          ctx,
          'COST_CONFIG',
          deleted.id,
          'DELETE',
          `Xóa phiên bản bảng giá tương lai ${deleted.versionCode}`,
        );
        return deleted;
      },
    }),
  }));
}

registerCostConfigModule();
