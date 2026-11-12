DROP INDEX "change_log_at_idx";--> statement-breakpoint
DROP INDEX "research_log_at_idx";--> statement-breakpoint
CREATE INDEX "change_log_at_idx" ON "change_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "research_log_at_idx" ON "research_log" USING btree ("at");