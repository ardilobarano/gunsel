-- CreateTable
CREATE TABLE "CustomPuzzle" (
    "id" TEXT NOT NULL,
    "shareCode" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "maxGuesses" INTEGER NOT NULL,
    "timeLimitSeconds" INTEGER,
    "dictionaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomPuzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPuzzleWord" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "word" TEXT NOT NULL,

    CONSTRAINT "CustomPuzzleWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomPuzzle_shareCode_key" ON "CustomPuzzle"("shareCode");

-- CreateIndex
CREATE UNIQUE INDEX "CustomPuzzleWord_puzzleId_orderIndex_key" ON "CustomPuzzleWord"("puzzleId", "orderIndex");

-- AddForeignKey
ALTER TABLE "CustomPuzzle" ADD CONSTRAINT "CustomPuzzle_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPuzzleWord" ADD CONSTRAINT "CustomPuzzleWord_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "CustomPuzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
