/*
  Warnings:

  - You are about to drop the column `pavilionHeight` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `pavilionName` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `pavilionWidth` on the `Event` table. All the data in the column will be lost.
  - Added the required column `canvasHeight` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `canvasWidth` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `venueId` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "pavilionHeight",
DROP COLUMN "pavilionName",
DROP COLUMN "pavilionWidth",
ADD COLUMN     "canvasHeight" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "canvasWidth" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "venueId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
