ALTER TABLE "files" ALTER COLUMN "bucket_provider" SET DATA TYPE text;--> statement-breakpoint
UPDATE "files" SET "bucket_provider" = 'memory' WHERE "bucket_provider" = 'local';--> statement-breakpoint
DROP TYPE "public"."file_bucket_provider";--> statement-breakpoint
CREATE TYPE "public"."file_bucket_provider" AS ENUM('memory', 'r2');--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "bucket_provider" SET DATA TYPE "public"."file_bucket_provider" USING "bucket_provider"::"public"."file_bucket_provider";--> statement-breakpoint
CREATE TABLE "shopify_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"state" text NOT NULL,
	"isOnline" boolean DEFAULT false NOT NULL,
	"scope" text,
	"expires" timestamp,
	"accessToken" text NOT NULL,
	"userId" bigint,
	"firstName" text,
	"lastName" text,
	"email" text,
	"accountOwner" boolean,
	"locale" text,
	"collaborator" boolean,
	"emailVerified" boolean,
	"refreshToken" text,
	"refreshTokenExpires" timestamp
);
