-- AlterTable
ALTER TABLE "irrigation_zones" ADD COLUMN "activeMaxSeconds" INTEGER;

-- CreateTable
CREATE TABLE "irrigation_schedules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "zoneId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Riego programado',
    "startTime" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 900,
    "daysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,0',
    "climateAdjust" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "irrigation_schedules_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "irrigation_zones" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_moisture_readings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "zoneId" INTEGER NOT NULL,
    "moisture" REAL NOT NULL,
    "ambientTemp" REAL NOT NULL,
    "airHumidity" REAL NOT NULL,
    "rainProbability" REAL NOT NULL DEFAULT 0,
    "windSpeedKmh" REAL NOT NULL DEFAULT 8,
    "forecastRainProb" REAL NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL,
    "valveOpen" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SIMULACION',
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "moisture_readings_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "irrigation_zones" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_moisture_readings" ("airHumidity", "ambientTemp", "id", "moisture", "rainProbability", "recordedAt", "source", "status", "valveOpen", "zoneId") SELECT "airHumidity", "ambientTemp", "id", "moisture", "rainProbability", "recordedAt", "source", "status", "valveOpen", "zoneId" FROM "moisture_readings";
DROP TABLE "moisture_readings";
ALTER TABLE "new_moisture_readings" RENAME TO "moisture_readings";
CREATE INDEX "moisture_readings_zoneId_recordedAt_idx" ON "moisture_readings"("zoneId", "recordedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "irrigation_schedules_zoneId_enabled_idx" ON "irrigation_schedules"("zoneId", "enabled");
