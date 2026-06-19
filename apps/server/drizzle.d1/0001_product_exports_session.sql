ALTER TABLE `product_exports` ADD `shopify_session_id` text REFERENCES shopify_sessions(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `product_exports_shopify_session_idx` ON `product_exports` (`shopify_session_id`);
