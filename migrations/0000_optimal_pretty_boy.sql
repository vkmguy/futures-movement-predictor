CREATE TABLE "daily_iv_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_symbol" text NOT NULL,
	"daily_iv" real NOT NULL,
	"date" timestamp NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_predictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_symbol" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"current_price" real NOT NULL,
	"predicted_min" real NOT NULL,
	"predicted_max" real NOT NULL,
	"daily_volatility" real NOT NULL,
	"weekly_volatility" real NOT NULL,
	"confidence" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "futures_contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"current_price" real NOT NULL,
	"previous_close" real NOT NULL,
	"daily_change" real NOT NULL,
	"daily_change_percent" real NOT NULL,
	"volume" integer NOT NULL,
	"weekly_volatility" real NOT NULL,
	"daily_volatility" real NOT NULL,
	"tick_size" real DEFAULT 0.01 NOT NULL,
	"contract_type" text DEFAULT 'equity_index' NOT NULL,
	"expiration_date" timestamp,
	"days_remaining" integer,
	"is_expiration_week" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "futures_contracts_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "historical_daily_expected_moves" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_symbol" text NOT NULL,
	"date" timestamp NOT NULL,
	"last_traded_price" real NOT NULL,
	"previous_close" real NOT NULL,
	"weekly_volatility" real NOT NULL,
	"daily_volatility" real NOT NULL,
	"expected_high" real NOT NULL,
	"expected_low" real NOT NULL,
	"actual_close" real,
	"within_range" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_prices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_symbol" text NOT NULL,
	"date" timestamp NOT NULL,
	"open" real NOT NULL,
	"high" real NOT NULL,
	"low" real NOT NULL,
	"close" real NOT NULL,
	"volume" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iv_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_symbol" text NOT NULL,
	"weekly_volatility" real NOT NULL,
	"update_date" timestamp NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_symbol" text NOT NULL,
	"alert_type" text NOT NULL,
	"target_price" real,
	"percentage" real,
	"is_active" integer DEFAULT 1 NOT NULL,
	"triggered" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_expected_moves" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_symbol" text NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"current_day_of_week" text NOT NULL,
	"week_open_price" real NOT NULL,
	"monday_expected_high" real NOT NULL,
	"monday_expected_low" real NOT NULL,
	"monday_actual_close" real,
	"tuesday_expected_high" real NOT NULL,
	"tuesday_expected_low" real NOT NULL,
	"tuesday_actual_close" real,
	"wednesday_expected_high" real NOT NULL,
	"wednesday_expected_low" real NOT NULL,
	"wednesday_actual_close" real,
	"thursday_expected_high" real NOT NULL,
	"thursday_expected_low" real NOT NULL,
	"thursday_actual_close" real,
	"friday_expected_high" real NOT NULL,
	"friday_expected_low" real NOT NULL,
	"friday_actual_close" real,
	"implied_volatility" real NOT NULL,
	"weekly_volatility" real NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_iv_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_symbol" text NOT NULL,
	"weekly_iv" real NOT NULL,
	"date" timestamp NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL
);
