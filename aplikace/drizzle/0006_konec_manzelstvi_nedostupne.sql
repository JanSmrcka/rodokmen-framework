CREATE TYPE "public"."relation_end" AS ENUM('umrti', 'rozvod', 'rozluka', 'jine');--> statement-breakpoint
ALTER TYPE "public"."research_result" ADD VALUE 'nedostupne';--> statement-breakpoint
ALTER TABLE "relation" ADD COLUMN "end_reason" "relation_end";--> statement-breakpoint
ALTER TABLE "relation" ADD COLUMN "end_text" text;