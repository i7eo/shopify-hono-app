CREATE TYPE "public"."file_bucket_provider" AS ENUM('local', 'r2');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('uploading', 'available', 'expired', 'deleted', 'failed');--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_domain" text NOT NULL,
	"original_name" text NOT NULL,
	"safe_name" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" bigint DEFAULT 0 NOT NULL,
	"bucket_provider" "file_bucket_provider" NOT NULL,
	"bucket_key" text NOT NULL,
	"status" "file_status" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "files_shop_created_at_idx" ON "files" USING btree ("shop_domain","created_at");--> statement-breakpoint
CREATE INDEX "files_shop_status_idx" ON "files" USING btree ("shop_domain","status");--> statement-breakpoint
CREATE INDEX "files_expires_at_idx" ON "files" USING btree ("expires_at");