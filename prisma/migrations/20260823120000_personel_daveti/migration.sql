-- Personel daveti: antrenör/yönetici hesabı artık geçici şifreyle değil,
-- tek kullanımlık davet bağlantısıyla açılıyor; şifreyi davet edilen kurar.
CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'bekliyor',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffInvite_tokenHash_key" ON "StaffInvite"("tokenHash");
CREATE INDEX "StaffInvite_organizationId_status_idx" ON "StaffInvite"("organizationId", "status");
CREATE INDEX "StaffInvite_expiresAt_idx" ON "StaffInvite"("expiresAt");

ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
