CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_domain` text NOT NULL,
	`original_name` text NOT NULL,
	`safe_name` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer DEFAULT 0 NOT NULL,
	`bucket_provider` text NOT NULL,
	`bucket_key` text NOT NULL,
	`status` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `files_shop_created_at_idx` ON `files` (`shop_domain`,`created_at`);--> statement-breakpoint
CREATE INDEX `files_shop_status_idx` ON `files` (`shop_domain`,`status`);--> statement-breakpoint
CREATE INDEX `files_expires_at_idx` ON `files` (`expires_at`);--> statement-breakpoint
CREATE TABLE `shopify_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`state` text NOT NULL,
	`isOnline` integer DEFAULT false NOT NULL,
	`scope` text,
	`expires` text,
	`accessToken` text NOT NULL,
	`userId` blob,
	`firstName` text,
	`lastName` text,
	`email` text,
	`accountOwner` integer,
	`locale` text,
	`collaborator` integer,
	`emailVerified` integer,
	`refreshToken` text,
	`refreshTokenExpires` text
);
