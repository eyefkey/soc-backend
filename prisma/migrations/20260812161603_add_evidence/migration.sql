/*
  Warnings:

  - Changed the type of `type` on the `Evidence` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IP_ADDRESS', 'DOMAIN', 'URL', 'FILE_HASH', 'LOG', 'SCREENSHOT', 'FILE', 'OTHER');

-- DropForeignKey
ALTER TABLE "Evidence" DROP CONSTRAINT "Evidence_incidentId_fkey";

-- AlterTable
ALTER TABLE "Evidence" DROP COLUMN "type",
ADD COLUMN     "type" "EvidenceType" NOT NULL;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
