-- CreateEnum
CREATE TYPE "SupplyStatus" AS ENUM ('REQUESTED', 'ORDERED', 'RECEIVED', 'DENIED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RecordType" AS ENUM ('SUPPLY_REQUEST');

-- CreateTable
CREATE TABLE "SupplyRequest" (
    "id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "dateNeeded" DATE,
    "notes" TEXT,
    "status" "SupplyStatus" NOT NULL DEFAULT 'REQUESTED',
    "statusReason" TEXT,
    "requestedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordEvent" (
    "id" TEXT NOT NULL,
    "entityType" "RecordType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplyRequest_status_idx" ON "SupplyRequest"("status");

-- CreateIndex
CREATE INDEX "SupplyRequest_requestedById_idx" ON "SupplyRequest"("requestedById");

-- CreateIndex
CREATE INDEX "SupplyRequest_dateNeeded_idx" ON "SupplyRequest"("dateNeeded");

-- CreateIndex
CREATE INDEX "RecordEvent_entityType_entityId_createdAt_idx" ON "RecordEvent"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordEvent" ADD CONSTRAINT "RecordEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

