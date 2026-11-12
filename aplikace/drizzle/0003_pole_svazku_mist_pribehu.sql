ALTER TABLE "place" ADD COLUMN "parish" text;--> statement-breakpoint
ALTER TABLE "place" ADD COLUMN "estate" text;--> statement-breakpoint
ALTER TABLE "place" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "place" ADD COLUMN "modern_name" text;--> statement-breakpoint
ALTER TABLE "story" ADD COLUMN "year_from" smallint;--> statement-breakpoint
ALTER TABLE "story" ADD COLUMN "year_to" smallint;--> statement-breakpoint
ALTER TABLE "story" ADD COLUMN "cover_sha" text;--> statement-breakpoint
ALTER TABLE "volume" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "volume" ADD COLUMN "year_from" smallint;--> statement-breakpoint
ALTER TABLE "volume" ADD COLUMN "year_to" smallint;--> statement-breakpoint
ALTER TABLE "volume" ADD COLUMN "image_count" integer;--> statement-breakpoint
ALTER TABLE "volume" ADD COLUMN "place_slug" text;--> statement-breakpoint
ALTER TABLE "volume" ADD COLUMN "meta" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_cover_sha_media_sha256_fk" FOREIGN KEY ("cover_sha") REFERENCES "public"."media"("sha256") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volume" ADD CONSTRAINT "volume_place_slug_place_slug_fk" FOREIGN KEY ("place_slug") REFERENCES "public"."place"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "volume_place_kind_idx" ON "volume" USING btree ("place_slug","kind","year_from");