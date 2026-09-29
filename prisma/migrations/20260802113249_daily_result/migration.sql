-- CreateTable
CREATE TABLE "DailyResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "guessCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyResult_gameId_dateKey_idx" ON "DailyResult"("gameId", "dateKey");
