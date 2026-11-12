CREATE TYPE "public"."certainty" AS ENUM('doc', 'prob', 'fam', 'mh', 'unk', 'lit');--> statement-breakpoint
CREATE TYPE "public"."date_qual" AS ENUM('presne', 'asi', 'pred', 'po', 'mezi');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('narozeni', 'krest', 'snatek', 'umrti', 'pohreb', 'povolani', 'sluzba', 'jine');--> statement-breakpoint
CREATE TYPE "public"."media_variant" AS ENUM('web', 'plny');--> statement-breakpoint
CREATE TYPE "public"."name_kind" AS ENUM('rodne', 'po_snatku', 'varianta', 'v_zapisu');--> statement-breakpoint
CREATE TYPE "public"."question_state" AS ENUM('otevrene', 'hypoteza', 'vyreseno');--> statement-breakpoint
CREATE TYPE "public"."record_kind" AS ENUM('N', 'O', 'Z', 'I', 'S', 'G', 'K', 'M', 'C', 'L', 'J');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('rodic', 'manzele');--> statement-breakpoint
CREATE TYPE "public"."research_result" AS ENUM('nalezeno', 'nenalezeno', 'castecne', 'jine');--> statement-breakpoint
CREATE TYPE "public"."review" AS ENUM('rozpracovano', 'ke_kontrole', 'overeno');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('M', 'F', 'U');--> statement-breakpoint
CREATE TYPE "public"."story_kind" AS ENUM('pribeh', 'pribeh_rodu', 'pribeh_domu', 'zajimavosti', 'jine');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('otevreny', 'rozpracovany', 'ceka', 'hotovy', 'zruseny');--> statement-breakpoint
CREATE TYPE "public"."tip_kind" AS ENUM('od_rodiny', 'zvest', 'oprava', 'napad');--> statement-breakpoint
CREATE TYPE "public"."tip_status" AS ENUM('nezpracovano', 'overuje_se', 'potvrzeno', 'vyvraceno', 'nelze_overit');--> statement-breakpoint
CREATE TYPE "public"."token_role" AS ENUM('admin', 'agent');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "api_token" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "api_token_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"role" "token_role" DEFAULT 'agent' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"last_used" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "change_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "change_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "citation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "citation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" integer,
	"relation_id" integer,
	"residence_id" integer,
	"person_id" text,
	"record_key" text,
	"tip_id" integer,
	"document_id" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "citation_one_target" CHECK (num_nonnulls("citation"."event_id", "citation"."relation_id", "citation"."residence_id", "citation"."person_id") = 1),
	CONSTRAINT "citation_one_source" CHECK (num_nonnulls("citation"."record_key", "citation"."tip_id", "citation"."document_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text,
	"group_name" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_house" (
	"document_id" integer NOT NULL,
	"house_key" text NOT NULL,
	CONSTRAINT "document_house_document_id_house_key_pk" PRIMARY KEY("document_id","house_key")
);
--> statement-breakpoint
CREATE TABLE "document_person" (
	"document_id" integer NOT NULL,
	"person_id" text NOT NULL,
	CONSTRAINT "document_person_document_id_person_id_pk" PRIMARY KEY("document_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "event_type" NOT NULL,
	"date_text" text,
	"date_qual" date_qual DEFAULT 'presne' NOT NULL,
	"year_from" smallint,
	"year_to" smallint,
	"month" smallint,
	"day" smallint,
	"place_slug" text,
	"house_key" text,
	"place_text" text,
	"text" text,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_person" (
	"event_id" integer NOT NULL,
	"person_id" text NOT NULL,
	"role" text DEFAULT 'hlavni' NOT NULL,
	CONSTRAINT "event_person_event_id_person_id_role_pk" PRIMARY KEY("event_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "highlight" (
	"record_key" text PRIMARY KEY NOT NULL,
	"boxes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "house" (
	"key" text PRIMARY KEY NOT NULL,
	"place_slug" text NOT NULL,
	"cp" text NOT NULL,
	"name" text,
	"kind" text,
	"description" text,
	"lat" double precision,
	"lon" double precision,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "house_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "house_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"house_key" text NOT NULL,
	"year" smallint,
	"text" text NOT NULL,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"record_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "house_holder" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "house_holder_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"house_key" text NOT NULL,
	"person_id" text,
	"name" text NOT NULL,
	"from_text" text,
	"to_text" text,
	"year_from" smallint,
	"how" text,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"record_key" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "house_inhabitant" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "house_inhabitant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"house_key" text NOT NULL,
	"person_id" text,
	"name" text NOT NULL,
	"years_text" text,
	"role" text,
	"facts" text,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"record_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "house_number" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "house_number_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"house_key" text NOT NULL,
	"period" text NOT NULL,
	"number" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hypothesis" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hypothesis_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"person_id" text,
	"title" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hypothesis_record" (
	"hypothesis_id" integer NOT NULL,
	"record_key" text NOT NULL,
	CONSTRAINT "hypothesis_record_hypothesis_id_record_key_pk" PRIMARY KEY("hypothesis_id","record_key")
);
--> statement-breakpoint
CREATE TABLE "line" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"founder_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempt" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_attempt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"ip" text,
	"ok" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_sheet" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "map_sheet_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"year" smallint,
	"url" text,
	"source" text,
	"description" text,
	"group_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"sha256" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"size" integer NOT NULL,
	"variant" "media_variant" DEFAULT 'web' NOT NULL,
	"record_key" text,
	"document_id" integer,
	"map_id" integer,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" text PRIMARY KEY NOT NULL,
	"sex" "sex" DEFAULT 'U' NOT NULL,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"living" boolean,
	"years_text" text,
	"note" text,
	"note_private" text,
	"same_as_id" text,
	"placeholder" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_name" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_name_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"person_id" text NOT NULL,
	"given" text DEFAULT '' NOT NULL,
	"surname" text DEFAULT '' NOT NULL,
	"kind" "name_kind" DEFAULT 'rodne' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"note" text,
	"search" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "place" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"parent_slug" text,
	"lat" double precision,
	"lon" double precision,
	"osm" text,
	"query" text,
	"pattern" text,
	"hypothesis" boolean DEFAULT false NOT NULL,
	"description" text,
	"search" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "place_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"place_slug" text NOT NULL,
	"year" smallint,
	"text" text NOT NULL,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"record_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_name" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "place_name_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"place_slug" text NOT NULL,
	"name" text NOT NULL,
	"lang" text,
	"note" text,
	"search" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"person_id" text,
	"question" text NOT NULL,
	"answer" text,
	"state" "question_state" DEFAULT 'otevrene' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record" (
	"key" text PRIMARY KEY NOT NULL,
	"volume_key" text,
	"image_no" integer,
	"kind" "record_kind" NOT NULL,
	"date_text" text,
	"year" smallint,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"url" text,
	"transcript_orig" text,
	"transcript_cs" text,
	"review" "review" DEFAULT 'rozpracovano' NOT NULL,
	"search" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_person" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "record_person_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"record_key" text NOT NULL,
	"person_id" text NOT NULL,
	"role" text DEFAULT 'zminen' NOT NULL,
	"name_as_written" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "relation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "relation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "relation_type" NOT NULL,
	"a_id" text NOT NULL,
	"b_id" text NOT NULL,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relation_not_self" CHECK ("relation"."a_id" <> "relation"."b_id")
);
--> statement-breakpoint
CREATE TABLE "research_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "research_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"author" text,
	"title" text NOT NULL,
	"text_md" text DEFAULT '' NOT NULL,
	"volume_key" text,
	"pages" text,
	"result" "research_result" DEFAULT 'jine' NOT NULL,
	"search" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "research_log_person" (
	"log_id" integer NOT NULL,
	"person_id" text NOT NULL,
	CONSTRAINT "research_log_person_log_id_person_id_pk" PRIMARY KEY("log_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "research_log_record" (
	"log_id" integer NOT NULL,
	"record_key" text NOT NULL,
	CONSTRAINT "research_log_record_log_id_record_key_pk" PRIMARY KEY("log_id","record_key")
);
--> statement-breakpoint
CREATE TABLE "research_log_tip" (
	"log_id" integer NOT NULL,
	"tip_id" integer NOT NULL,
	CONSTRAINT "research_log_tip_log_id_tip_id_pk" PRIMARY KEY("log_id","tip_id")
);
--> statement-breakpoint
CREATE TABLE "residence" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "residence_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"person_id" text NOT NULL,
	"place_slug" text,
	"house_key" text,
	"place_text" text,
	"cp" text,
	"from_text" text,
	"to_text" text,
	"year_from" smallint,
	"year_to" smallint,
	"role" text,
	"certainty" "certainty" DEFAULT 'unk' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "side_note" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "side_note_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"person_id" text NOT NULL,
	"title" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story" (
	"slug" text PRIMARY KEY NOT NULL,
	"kind" "story_kind" DEFAULT 'pribeh' NOT NULL,
	"title" text NOT NULL,
	"lead" text,
	"body_md" text DEFAULT '' NOT NULL,
	"line_slug" text,
	"house_key" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surname_variant" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "surname_variant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"surname" text NOT NULL,
	"variant" text NOT NULL,
	"note" text,
	"search" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'badani' NOT NULL,
	"status" "task_status" DEFAULT 'otevreny' NOT NULL,
	"priority" smallint DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_person" (
	"task_id" integer NOT NULL,
	"person_id" text NOT NULL,
	CONSTRAINT "task_person_task_id_person_id_pk" PRIMARY KEY("task_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "tip" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tip_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" "tip_kind" DEFAULT 'od_rodiny' NOT NULL,
	"text" text NOT NULL,
	"told_by_person_id" text,
	"told_by_name" text,
	"channel" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sensitive" boolean DEFAULT false NOT NULL,
	"submitted_by_user_id" integer,
	"status" "tip_status" DEFAULT 'nezpracovano' NOT NULL,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"search" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tip_person" (
	"tip_id" integer NOT NULL,
	"person_id" text NOT NULL,
	CONSTRAINT "tip_person_tip_id_person_id_pk" PRIMARY KEY("tip_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "tip_record" (
	"tip_id" integer NOT NULL,
	"record_key" text NOT NULL,
	CONSTRAINT "tip_record_tip_id_record_key_pk" PRIMARY KEY("tip_id","record_key")
);
--> statement-breakpoint
CREATE TABLE "user_account" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"person_id" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"password_changed_at" timestamp with time zone,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"last_seen" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volume" (
	"key" text PRIMARY KEY NOT NULL,
	"archive" text NOT NULL,
	"portal" text,
	"title" text NOT NULL,
	"description" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_relation_id_relation_id_fk" FOREIGN KEY ("relation_id") REFERENCES "public"."relation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_residence_id_residence_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_tip_id_tip_id_fk" FOREIGN KEY ("tip_id") REFERENCES "public"."tip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_house" ADD CONSTRAINT "document_house_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_house" ADD CONSTRAINT "document_house_house_key_house_key_fk" FOREIGN KEY ("house_key") REFERENCES "public"."house"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_person" ADD CONSTRAINT "document_person_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_person" ADD CONSTRAINT "document_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_place_slug_place_slug_fk" FOREIGN KEY ("place_slug") REFERENCES "public"."place"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_house_key_house_key_fk" FOREIGN KEY ("house_key") REFERENCES "public"."house"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_person" ADD CONSTRAINT "event_person_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_person" ADD CONSTRAINT "event_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlight" ADD CONSTRAINT "highlight_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house" ADD CONSTRAINT "house_place_slug_place_slug_fk" FOREIGN KEY ("place_slug") REFERENCES "public"."place"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_event" ADD CONSTRAINT "house_event_house_key_house_key_fk" FOREIGN KEY ("house_key") REFERENCES "public"."house"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_event" ADD CONSTRAINT "house_event_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_holder" ADD CONSTRAINT "house_holder_house_key_house_key_fk" FOREIGN KEY ("house_key") REFERENCES "public"."house"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_holder" ADD CONSTRAINT "house_holder_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_holder" ADD CONSTRAINT "house_holder_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_inhabitant" ADD CONSTRAINT "house_inhabitant_house_key_house_key_fk" FOREIGN KEY ("house_key") REFERENCES "public"."house"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_inhabitant" ADD CONSTRAINT "house_inhabitant_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_inhabitant" ADD CONSTRAINT "house_inhabitant_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_number" ADD CONSTRAINT "house_number_house_key_house_key_fk" FOREIGN KEY ("house_key") REFERENCES "public"."house"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hypothesis" ADD CONSTRAINT "hypothesis_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hypothesis_record" ADD CONSTRAINT "hypothesis_record_hypothesis_id_hypothesis_id_fk" FOREIGN KEY ("hypothesis_id") REFERENCES "public"."hypothesis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hypothesis_record" ADD CONSTRAINT "hypothesis_record_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line" ADD CONSTRAINT "line_founder_id_person_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_map_id_map_sheet_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map_sheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_same_as_id_person_id_fk" FOREIGN KEY ("same_as_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_name" ADD CONSTRAINT "person_name_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place" ADD CONSTRAINT "place_parent_slug_place_slug_fk" FOREIGN KEY ("parent_slug") REFERENCES "public"."place"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_event" ADD CONSTRAINT "place_event_place_slug_place_slug_fk" FOREIGN KEY ("place_slug") REFERENCES "public"."place"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_event" ADD CONSTRAINT "place_event_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_name" ADD CONSTRAINT "place_name_place_slug_place_slug_fk" FOREIGN KEY ("place_slug") REFERENCES "public"."place"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_volume_key_volume_key_fk" FOREIGN KEY ("volume_key") REFERENCES "public"."volume"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_person" ADD CONSTRAINT "record_person_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_person" ADD CONSTRAINT "record_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation" ADD CONSTRAINT "relation_a_id_person_id_fk" FOREIGN KEY ("a_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation" ADD CONSTRAINT "relation_b_id_person_id_fk" FOREIGN KEY ("b_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_log" ADD CONSTRAINT "research_log_volume_key_volume_key_fk" FOREIGN KEY ("volume_key") REFERENCES "public"."volume"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_log_person" ADD CONSTRAINT "research_log_person_log_id_research_log_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."research_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_log_person" ADD CONSTRAINT "research_log_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_log_record" ADD CONSTRAINT "research_log_record_log_id_research_log_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."research_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_log_record" ADD CONSTRAINT "research_log_record_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_log_tip" ADD CONSTRAINT "research_log_tip_log_id_research_log_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."research_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_log_tip" ADD CONSTRAINT "research_log_tip_tip_id_tip_id_fk" FOREIGN KEY ("tip_id") REFERENCES "public"."tip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residence" ADD CONSTRAINT "residence_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residence" ADD CONSTRAINT "residence_place_slug_place_slug_fk" FOREIGN KEY ("place_slug") REFERENCES "public"."place"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residence" ADD CONSTRAINT "residence_house_key_house_key_fk" FOREIGN KEY ("house_key") REFERENCES "public"."house"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_note" ADD CONSTRAINT "side_note_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_line_slug_line_slug_fk" FOREIGN KEY ("line_slug") REFERENCES "public"."line"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_house_key_house_key_fk" FOREIGN KEY ("house_key") REFERENCES "public"."house"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_person" ADD CONSTRAINT "task_person_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_person" ADD CONSTRAINT "task_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip" ADD CONSTRAINT "tip_told_by_person_id_person_id_fk" FOREIGN KEY ("told_by_person_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip" ADD CONSTRAINT "tip_submitted_by_user_id_user_account_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_person" ADD CONSTRAINT "tip_person_tip_id_tip_id_fk" FOREIGN KEY ("tip_id") REFERENCES "public"."tip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_person" ADD CONSTRAINT "tip_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_record" ADD CONSTRAINT "tip_record_tip_id_tip_id_fk" FOREIGN KEY ("tip_id") REFERENCES "public"."tip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_record" ADD CONSTRAINT "tip_record_record_key_record_key_fk" FOREIGN KEY ("record_key") REFERENCES "public"."record"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_token_hash_uq" ON "api_token" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "api_token_name_uq" ON "api_token" USING btree ("name");--> statement-breakpoint
CREATE INDEX "change_log_entity_idx" ON "change_log" USING btree ("entity","entity_id","at");--> statement-breakpoint
CREATE INDEX "change_log_at_idx" ON "change_log" USING btree ("at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "citation_event_idx" ON "citation" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "citation_relation_idx" ON "citation" USING btree ("relation_id");--> statement-breakpoint
CREATE INDEX "citation_residence_idx" ON "citation" USING btree ("residence_id");--> statement-breakpoint
CREATE INDEX "citation_person_idx" ON "citation" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "citation_record_idx" ON "citation" USING btree ("record_key");--> statement-breakpoint
CREATE INDEX "citation_tip_idx" ON "citation" USING btree ("tip_id");--> statement-breakpoint
CREATE INDEX "citation_document_idx" ON "citation" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_group_idx" ON "document" USING btree ("group_name","sort");--> statement-breakpoint
CREATE INDEX "document_house_house_idx" ON "document_house" USING btree ("house_key");--> statement-breakpoint
CREATE INDEX "document_person_person_idx" ON "document_person" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "event_type_year_idx" ON "event" USING btree ("type","year_from");--> statement-breakpoint
CREATE INDEX "event_place_idx" ON "event" USING btree ("place_slug");--> statement-breakpoint
CREATE INDEX "event_house_idx" ON "event" USING btree ("house_key");--> statement-breakpoint
CREATE INDEX "event_person_person_idx" ON "event_person" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "house_place_cp_uq" ON "house" USING btree ("place_slug","cp");--> statement-breakpoint
CREATE INDEX "house_event_house_idx" ON "house_event" USING btree ("house_key","year");--> statement-breakpoint
CREATE INDEX "house_event_record_idx" ON "house_event" USING btree ("record_key");--> statement-breakpoint
CREATE INDEX "house_holder_house_idx" ON "house_holder" USING btree ("house_key","year_from");--> statement-breakpoint
CREATE INDEX "house_holder_person_idx" ON "house_holder" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "house_holder_record_idx" ON "house_holder" USING btree ("record_key");--> statement-breakpoint
CREATE INDEX "house_inhabitant_house_idx" ON "house_inhabitant" USING btree ("house_key");--> statement-breakpoint
CREATE INDEX "house_inhabitant_person_idx" ON "house_inhabitant" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "house_inhabitant_record_idx" ON "house_inhabitant" USING btree ("record_key");--> statement-breakpoint
CREATE INDEX "house_number_house_idx" ON "house_number" USING btree ("house_key");--> statement-breakpoint
CREATE INDEX "hypothesis_person_idx" ON "hypothesis" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "hypothesis_record_record_idx" ON "hypothesis_record" USING btree ("record_key");--> statement-breakpoint
CREATE INDEX "line_founder_idx" ON "line" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "login_attempt_username_at_idx" ON "login_attempt" USING btree ("username","at");--> statement-breakpoint
CREATE INDEX "login_attempt_ip_at_idx" ON "login_attempt" USING btree ("ip","at");--> statement-breakpoint
CREATE INDEX "media_record_idx" ON "media" USING btree ("record_key","variant");--> statement-breakpoint
CREATE INDEX "media_document_idx" ON "media" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "media_map_idx" ON "media" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "person_same_as_idx" ON "person" USING btree ("same_as_id");--> statement-breakpoint
CREATE INDEX "person_name_person_idx" ON "person_name" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_name_primary_uq" ON "person_name" USING btree ("person_id") WHERE "person_name"."is_primary";--> statement-breakpoint
CREATE INDEX "person_name_search_trgm" ON "person_name" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "place_parent_idx" ON "place" USING btree ("parent_slug");--> statement-breakpoint
CREATE INDEX "place_search_trgm" ON "place" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "place_event_place_idx" ON "place_event" USING btree ("place_slug","year");--> statement-breakpoint
CREATE INDEX "place_event_record_idx" ON "place_event" USING btree ("record_key");--> statement-breakpoint
CREATE INDEX "place_name_place_idx" ON "place_name" USING btree ("place_slug");--> statement-breakpoint
CREATE INDEX "place_name_search_trgm" ON "place_name" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "question_state_idx" ON "question" USING btree ("state");--> statement-breakpoint
CREATE INDEX "question_person_idx" ON "question" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "record_volume_idx" ON "record" USING btree ("volume_key","image_no");--> statement-breakpoint
CREATE INDEX "record_kind_year_idx" ON "record" USING btree ("kind","year");--> statement-breakpoint
CREATE INDEX "record_review_idx" ON "record" USING btree ("review") WHERE "record"."review" <> 'overeno';--> statement-breakpoint
CREATE INDEX "record_search_trgm" ON "record" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "record_person_uq" ON "record_person" USING btree ("record_key","person_id","role");--> statement-breakpoint
CREATE INDEX "record_person_person_idx" ON "record_person" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relation_uq" ON "relation" USING btree ("type","a_id","b_id");--> statement-breakpoint
CREATE INDEX "relation_type_b_idx" ON "relation" USING btree ("type","b_id");--> statement-breakpoint
CREATE INDEX "relation_b_idx" ON "relation" USING btree ("b_id");--> statement-breakpoint
CREATE INDEX "research_log_at_idx" ON "research_log" USING btree ("at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "research_log_volume_idx" ON "research_log" USING btree ("volume_key");--> statement-breakpoint
CREATE INDEX "research_log_search_trgm" ON "research_log" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "research_log_person_person_idx" ON "research_log_person" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "research_log_record_record_idx" ON "research_log_record" USING btree ("record_key");--> statement-breakpoint
CREATE INDEX "research_log_tip_tip_idx" ON "research_log_tip" USING btree ("tip_id");--> statement-breakpoint
CREATE INDEX "residence_person_idx" ON "residence" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "residence_place_idx" ON "residence" USING btree ("place_slug");--> statement-breakpoint
CREATE INDEX "residence_house_idx" ON "residence" USING btree ("house_key");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "side_note_person_idx" ON "side_note" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "story_kind_idx" ON "story" USING btree ("kind","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "surname_variant_uq" ON "surname_variant" USING btree ("surname","variant");--> statement-breakpoint
CREATE INDEX "surname_variant_search_trgm" ON "surname_variant" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "task_status_idx" ON "task" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "task_person_person_idx" ON "task_person" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tip_open_idx" ON "tip" USING btree ("status","received_at") WHERE "tip"."status" in ('nezpracovano', 'overuje_se');--> statement-breakpoint
CREATE INDEX "tip_told_by_idx" ON "tip" USING btree ("told_by_person_id");--> statement-breakpoint
CREATE INDEX "tip_user_idx" ON "tip" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE INDEX "tip_search_trgm" ON "tip" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "tip_person_person_idx" ON "tip_person" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tip_record_record_idx" ON "tip_record" USING btree ("record_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_account_username_uq" ON "user_account" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "user_account_person_uq" ON "user_account" USING btree ("person_id");