
-- AlterTable
ALTER TABLE "DailyResult" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'server',
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "DailyResult_userId_idx" ON "DailyResult"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyResult_userId_gameId_dateKey_key" ON "DailyResult"("userId", "gameId", "dateKey");

-- AddForeignKey
ALTER TABLE "DailyResult" ADD CONSTRAINT "DailyResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

