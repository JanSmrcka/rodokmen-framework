ALTER TABLE "house_event" ADD COLUMN "more_record_keys" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "house_holder" ADD COLUMN "more_record_keys" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "house_inhabitant" ADD COLUMN "more_record_keys" text[] DEFAULT '{}'::text[] NOT NULL;