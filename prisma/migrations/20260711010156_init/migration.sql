-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'OFFICER');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "ItemResultStatus" AS ENUM ('PASS', 'FAIL', 'NA');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "image" TEXT,
    "googleId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apparatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apparatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apparatusId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apparatusId" TEXT,
    "equipmentItemId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckSubmission" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "apparatusId" TEXT,
    "equipmentItemId" TEXT,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallStatus" "CheckStatus" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "CheckSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckItemResult" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "status" "ItemResultStatus" NOT NULL,
    "note" TEXT,

    CONSTRAINT "CheckItemResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailureAlert" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "recipientEmails" TEXT[],
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailureAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Apparatus_unitNumber_key" ON "Apparatus"("unitNumber");

-- CreateIndex
CREATE INDEX "EquipmentItem_apparatusId_idx" ON "EquipmentItem"("apparatusId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_apparatusId_idx" ON "ChecklistTemplate"("apparatusId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_equipmentItemId_idx" ON "ChecklistTemplate"("equipmentItemId");

-- CreateIndex
CREATE INDEX "ChecklistItem_templateId_idx" ON "ChecklistItem"("templateId");

-- CreateIndex
CREATE INDEX "CheckSubmission_apparatusId_submittedAt_idx" ON "CheckSubmission"("apparatusId", "submittedAt");

-- CreateIndex
CREATE INDEX "CheckSubmission_equipmentItemId_submittedAt_idx" ON "CheckSubmission"("equipmentItemId", "submittedAt");

-- CreateIndex
CREATE INDEX "CheckSubmission_submittedById_idx" ON "CheckSubmission"("submittedById");

-- CreateIndex
CREATE INDEX "CheckSubmission_overallStatus_idx" ON "CheckSubmission"("overallStatus");

-- CreateIndex
CREATE INDEX "CheckItemResult_submissionId_idx" ON "CheckItemResult"("submissionId");

-- CreateIndex
CREATE INDEX "CheckItemResult_checklistItemId_idx" ON "CheckItemResult"("checklistItemId");

-- CreateIndex
CREATE INDEX "FailureAlert_submissionId_idx" ON "FailureAlert"("submissionId");

-- CreateIndex
CREATE INDEX "FailureAlert_status_idx" ON "FailureAlert"("status");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentItem" ADD CONSTRAINT "EquipmentItem_apparatusId_fkey" FOREIGN KEY ("apparatusId") REFERENCES "Apparatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_apparatusId_fkey" FOREIGN KEY ("apparatusId") REFERENCES "Apparatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckSubmission" ADD CONSTRAINT "CheckSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckSubmission" ADD CONSTRAINT "CheckSubmission_apparatusId_fkey" FOREIGN KEY ("apparatusId") REFERENCES "Apparatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckSubmission" ADD CONSTRAINT "CheckSubmission_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "EquipmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckSubmission" ADD CONSTRAINT "CheckSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckItemResult" ADD CONSTRAINT "CheckItemResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CheckSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckItemResult" ADD CONSTRAINT "CheckItemResult_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailureAlert" ADD CONSTRAINT "FailureAlert_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CheckSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
