-- CreateEnum
CREATE TYPE "MitreTactic" AS ENUM ('RECONNAISSANCE', 'RESOURCE_DEVELOPMENT', 'INITIAL_ACCESS', 'EXECUTION', 'PERSISTENCE', 'PRIVILEGE_ESCALATION', 'DEFENSE_EVASION', 'CREDENTIAL_ACCESS', 'DISCOVERY', 'LATERAL_MOVEMENT', 'COLLECTION', 'COMMAND_AND_CONTROL', 'EXFILTRATION', 'IMPACT');

-- AlterEnum
ALTER TYPE "AssetStatus" ADD VALUE 'QUARANTINED';

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "affectedUser" TEXT,
ADD COLUMN     "tactic" "MitreTactic";

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "tactic" "MitreTactic";

-- CreateIndex
CREATE INDEX "Alert_tactic_idx" ON "Alert"("tactic");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_number_key" ON "Incident"("number");

-- CreateIndex
CREATE INDEX "Incident_tactic_idx" ON "Incident"("tactic");

