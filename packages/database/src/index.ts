import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

export function createDatabase(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 5000 }),
  });
}
export type Database = ReturnType<typeof createDatabase>;
export { Prisma } from "./generated/prisma/client.ts";
