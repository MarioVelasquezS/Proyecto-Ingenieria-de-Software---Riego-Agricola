-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_irrigation_zones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "areaHectares" REAL NOT NULL DEFAULT 1.0,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "minMoisture" REAL NOT NULL DEFAULT 35,
    "maxMoisture" REAL NOT NULL DEFAULT 70,
    "currentMoisture" REAL NOT NULL DEFAULT 50,
    "valveOpen" BOOLEAN NOT NULL DEFAULT false,
    "autoMode" BOOLEAN NOT NULL DEFAULT true,
    "flowRateLpm" REAL NOT NULL DEFAULT 25,
    "maxIrrigationSeconds" INTEGER NOT NULL DEFAULT 1800,
    "irrigationStartedAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastReadingAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_irrigation_zones" ("active", "areaHectares", "autoMode", "createdAt", "cropType", "currentMoisture", "flowRateLpm", "id", "lastReadingAt", "latitude", "longitude", "maxMoisture", "minMoisture", "name", "updatedAt", "valveOpen") SELECT "active", "areaHectares", "autoMode", "createdAt", "cropType", "currentMoisture", "flowRateLpm", "id", "lastReadingAt", "latitude", "longitude", "maxMoisture", "minMoisture", "name", "updatedAt", "valveOpen" FROM "irrigation_zones";
DROP TABLE "irrigation_zones";
ALTER TABLE "new_irrigation_zones" RENAME TO "irrigation_zones";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
