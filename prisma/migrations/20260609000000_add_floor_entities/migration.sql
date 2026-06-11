-- Data in events/allotments is intentionally discarded for this migration.
-- Venue rows are preserved and receive a default "Térreo" floor.
DELETE FROM "Allotment";
DELETE FROM "RecentActivity";
DELETE FROM "Event";

CREATE TABLE "VenueFloor" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueFloor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventFloor" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "venueFloorId" TEXT,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventFloor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Allotment" ADD COLUMN "eventFloorId" TEXT NOT NULL;

CREATE UNIQUE INDEX "VenueFloor_venueId_level_key" ON "VenueFloor"("venueId", "level");
CREATE UNIQUE INDEX "EventFloor_eventId_level_key" ON "EventFloor"("eventId", "level");

ALTER TABLE "VenueFloor" ADD CONSTRAINT "VenueFloor_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventFloor" ADD CONSTRAINT "EventFloor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventFloor" ADD CONSTRAINT "EventFloor_venueFloorId_fkey" FOREIGN KEY ("venueFloorId") REFERENCES "VenueFloor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Allotment" ADD CONSTRAINT "Allotment_eventFloorId_fkey" FOREIGN KEY ("eventFloorId") REFERENCES "EventFloor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "VenueFloor" (
    "id",
    "venueId",
    "name",
    "level",
    "width",
    "height",
    "sortOrder",
    "isDefault",
    "updatedAt"
)
SELECT
    md5(random()::text || clock_timestamp()::text),
    "id",
    'Térreo',
    0,
    "width",
    "height",
    0,
    true,
    CURRENT_TIMESTAMP
FROM "Venue";
