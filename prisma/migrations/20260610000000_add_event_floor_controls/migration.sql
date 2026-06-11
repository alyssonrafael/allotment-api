ALTER TABLE "Event"
ADD COLUMN "allowFloorDimensionChanges" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "defaultAllotmentPrice" DOUBLE PRECISION;
