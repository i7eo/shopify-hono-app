DROP INDEX IF EXISTS `files_shop_created_at_idx`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `files_shop_created_id_idx` ON `files` (`shop_domain`,`created_at`,`id`);--> statement-breakpoint
DROP INDEX IF EXISTS `product_exports_shop_created_at_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `product_exports_shop_status_idx`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `product_exports_shop_created_id_idx` ON `product_exports` (`shop_domain`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `product_exports_shop_status_created_id_idx` ON `product_exports` (`shop_domain`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `product_exports_status_updated_id_idx` ON `product_exports` (`status`,`updated_at`,`id`);
