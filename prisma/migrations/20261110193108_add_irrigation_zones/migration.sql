-- CreateTable
CREATE TABLE "irrigation_zones" (
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
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastReadingAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "moisture_readings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "zoneId" INTEGER NOT NULL,
    "moisture" REAL NOT NULL,
    "ambientTemp" REAL NOT NULL,
    "airHumidity" REAL NOT NULL,
    "rainProbability" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "valveOpen" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SIMULACION',
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "moisture_readings_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "irrigation_zones" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "irrigation_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "zoneId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "moistureAtEvent" REAL NOT NULL,
    "waterUsedLiters" REAL NOT NULL DEFAULT 0,
    "userId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "irrigation_events_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "irrigation_zones" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "irrigation_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "moisture_readings_zoneId_recordedAt_idx" ON "moisture_readings"("zoneId", "recordedAt");

-- CreateIndex
CREATE INDEX "irrigation_events_zoneId_createdAt_idx" ON "irrigation_events"("zoneId", "createdAt");
