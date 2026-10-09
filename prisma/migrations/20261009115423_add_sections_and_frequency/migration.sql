-- CreateEnum
CREATE TYPE "CheckFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "section" TEXT;

-- AlterTable
ALTER TABLE "ChecklistTemplate" ADD COLUMN     "frequency" "CheckFrequency" NOT NULL DEFAULT 'WEEKLY';
