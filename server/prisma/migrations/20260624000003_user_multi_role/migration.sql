-- Multi-role RBAC: a user can hold additional roles beyond the primary roleId.
CREATE TABLE IF NOT EXISTS "user_roles" (
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId", "roleId")
);

ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId")
    REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
