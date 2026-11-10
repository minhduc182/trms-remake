# AGENTS.md — TRMS Remake (Fast-Track)

## 1. Stack & Quy ước

- **Runtime:** Node.js 22, TypeScript strict (`noImplicitAny`, `strictNullChecks`), `pnpm` workspace + `turbo`.
- **Database & ORM:** PostgreSQL 16 (`localhost:5433`, db `trms_remake`) + Prisma 6 (`prismaSchemaFolder`).
- **ID:** Snowflake `BigInt` (`@id @default(...)`), trên GraphQL serialize dạng `String` / `ID`.
- **Tiền tệ:** `Decimal` (`@db.Decimal(18, 2)`), tuyệt đối không dùng `Float` để cộng trừ tiền.
- **Thời gian:** `DateTime` (`@db.Timestamptz(6)`), quy đổi theo `Asia/Ho_Chi_Minh`. Ngày nghiệp vụ (`serviceDate`, `effectiveFrom`, `effectiveTo`) lưu kiểu `@db.Date` hoặc chuỗi `YYYY-MM-DD` nhất quán.
- **API:** Fastify + `graphql-yoga` + Pothos (`@pothos/core`, `@pothos/plugin-prisma`, `@pothos/plugin-scope-auth`, `@pothos/plugin-zod`).
  - **Đọc (Query):** Cho phép dùng Pothos Prisma object + filter/orderBy tự động.
  - **Ghi (Mutation):** Mọi thao tác ghi phải qua mutation nghiệp vụ có kiểm tra quyền (`FR-*`) và ghi `AuditLog`.
- **Frontend:** React 19 + Vite + Tailwind CSS v4 + shadcn/ui + TanStack Router + TanStack Table + `urql` + `gql.tada`.

## 2. Nguồn đối chiếu (Read-only)

- Backend Go cũ: `E:\platform-monorepo\backend\trms-service`
- Frontend Lit cũ: `E:\platform-monorepo\frontend\src\features\trms`
- Tài liệu & Testcase QA: `E:\platform-monorepo\docs\requirements\trms\TRMS_Tester_Case_MasterData_CaLam_YeuCau.md`
- Ảnh chụp màn hình chuẩn: `E:\platform-monorepo\docs\requirements\trms\user-guide-screenshots`

## 3. Definition of Done (DoD)

1. `pnpm typecheck` xanh (0 lỗi TypeScript trên cả `packages/*`, `apps/api`, `apps/web`).
2. 100% testcase `AT-*` của module trong `tests/acceptance/api` và `tests/acceptance/e2e` pass.
3. Đối soát chi phí (`pnpm data:reconcile`) lệch 0 đồng.
