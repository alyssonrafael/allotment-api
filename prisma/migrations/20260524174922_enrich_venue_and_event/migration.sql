/*
  Warnings:

  - You are about to drop the column `date` on the `Event` table. All the data in the column will be lost.
  - Added the required column `endDate` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accent` to the `Venue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `Venue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `photo` to the `Venue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `Venue` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('FEIRA', 'CONGRESSO', 'EXPO', 'CORPORATE');

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "date",
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "type" "EventType" NOT NULL;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "accent" TEXT NOT NULL,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "photo" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "zipCode" TEXT;
