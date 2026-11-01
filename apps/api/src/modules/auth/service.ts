import { createHash, randomBytes } from "node:crypto";
import { Prisma, type Database } from "@cord/database";
import type { RegisterRequest, LoginRequest, PublicUser } from "@cord/contracts";
import { HttpError } from "../../common/http.ts";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password.ts";

const publicUser = { id: true, username: true } as const;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function createAuthService(database: Database) {
  const revocations = new Set<(token: string) => void>();
  return {
    onRevoked(listener: (token: string) => void) {
      revocations.add(listener);
      return () => {
        revocations.delete(listener);
      };
    },
    async register(input: RegisterRequest): Promise<PublicUser> {
      const passwordHash = await hashPassword(input.password);
      try {
        return await database.user.create({
          data: { username: input.username, email: input.email, passwordHash },
          select: publicUser,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
          throw new HttpError(
            409,
            "ACCOUNT_EXISTS",
            "An account with these details already exists.",
          );
        throw error;
      }
    },
    async login(input: LoginRequest) {
      const user = await database.user.findUnique({ where: { username: input.username } });
      const valid = await verifyPassword(input.password, user?.passwordHash ?? dummyPasswordHash);
      if (!user || !valid)
        throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await database.$transaction([
        database.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: new Date() } } }),
        database.session.create({
          data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
        }),
      ]);
      return {
        user: { id: user.id, username: user.username },
        token,
        expiresAt: expiresAt.toISOString(),
      };
    },
    async authenticate(token: string): Promise<PublicUser> {
      const session = await database.session.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: { select: publicUser } },
      });
      if (!session || session.expiresAt.getTime() <= Date.now())
        throw new HttpError(401, "UNAUTHORIZED", "A valid session is required.");
      return session.user;
    },
    async logout(token: string): Promise<void> {
      await database.session.deleteMany({ where: { tokenHash: hashToken(token) } });
      for (const listener of revocations) listener(token);
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
