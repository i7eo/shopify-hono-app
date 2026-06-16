CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "bucket_provider" SET DATA TYPE text;--> statement-breakpoint
UPDATE "files" SET "bucket_provider" = 'memory' WHERE "bucket_provider" = 'local';--> statement-breakpoint
DROP TYPE "public"."file_bucket_provider";--> statement-breakpoint
CREATE TYPE "public"."file_bucket_provider" AS ENUM('memory', 'r2');--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "bucket_provider" SET DATA TYPE "public"."file_bucket_provider" USING "bucket_provider"::"public"."file_bucket_provider";
