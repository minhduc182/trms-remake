import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import type PrismaTypes from '@pothos/plugin-prisma/generated';
import { Prisma } from '@prisma/client';
import { prisma, GraphQLContext } from './context.js';
import { FeatureCode } from '@trms/shared';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: GraphQLContext;
  Scalars: {
    BigInt: {
      Input: bigint | string | number;
      Output: bigint | string;
    };
    Decimal: {
      Input: Prisma.Decimal | string | number;
      Output: Prisma.Decimal | string | number;
    };
    DateTime: {
      Input: Date | string;
      Output: Date | string;
    };
  };
  AuthScopes: {
    authenticated: boolean;
    feature: FeatureCode | string;
    anyFeature: (FeatureCode | string)[];
  };
}>({
  plugins: [ScopeAuthPlugin, PrismaPlugin],
  prisma: {
    client: prisma,
    dmmf: Prisma.dmmf,
    exposeDescriptions: false,
    filterConnectionTotalCount: true,
  },
  scopeAuth: {
    authorizeOnSubscribe: true,
    authScopes: async (ctx) => ({
      authenticated: () => Boolean(ctx.user),
      feature: (code) => {
        if (!ctx.user) return false;
        if (ctx.user.isAdmin) return true;
        return ctx.user.features.has(code);
      },
      anyFeature: (codes) => {
        if (!ctx.user) return false;
        if (ctx.user.isAdmin) return true;
        return codes.some((c) => ctx.user!.features.has(c));
      },
    }),
  },
});

builder.scalarType('BigInt', {
  serialize: (val) => String(val),
  parseValue: (val) => BigInt(String(val)),
});

builder.scalarType('Decimal', {
  serialize: (val) => (val instanceof Prisma.Decimal ? val.toFixed(2) : String(val)),
  parseValue: (val) => new Prisma.Decimal(String(val)),
});

builder.scalarType('DateTime', {
  serialize: (val) => (val instanceof Date ? val.toISOString() : String(val)),
  parseValue: (val) => (val instanceof Date ? val : new Date(String(val))),
});

builder.queryType({});
builder.mutationType({});
