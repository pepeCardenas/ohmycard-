CREATE TABLE `user_pref` (
	`user_id` text PRIMARY KEY NOT NULL,
	`skin` text DEFAULT 'clasico' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
