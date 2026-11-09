-- CreateTable
CREATE TABLE "TeamVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "meetingDay" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "memberships" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamVersion_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamVersion_semesterId_meetingDay_number_key" ON "TeamVersion"("semesterId", "meetingDay", "number");
