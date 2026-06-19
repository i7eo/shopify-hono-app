ALTER TABLE "product_exports" ADD COLUMN "shopify_session_id" text;--> statement-breakpoint
ALTER TABLE "product_exports" ADD CONSTRAINT "product_exports_shopify_session_id_shopify_sessions_id_fk" FOREIGN KEY ("shopify_session_id") REFERENCES "public"."shopify_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_exports_shopify_session_idx" ON "product_exports" USING btree ("shopify_session_id");
