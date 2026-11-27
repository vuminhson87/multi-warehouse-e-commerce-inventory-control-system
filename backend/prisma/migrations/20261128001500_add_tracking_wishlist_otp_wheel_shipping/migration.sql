-- Consolidated migration: Order Tracking, Admin Audit Logs, Wishlist, Gmail OTP, Welcome Wheel Vouchers, and Order Shipping Address

-- ============================================================================
-- 1. Order Tracking Events & Admin Audit Logs
-- ============================================================================
CREATE TYPE "DeliveryStage" AS ENUM ('PROCESSING_STARTED', 'PACKED', 'HANDED_TO_CARRIER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED');

CREATE TYPE "AuditTargetType" AS ENUM ('ORDER', 'PRODUCT', 'USER', 'INVENTORY');

CREATE TABLE "order_tracking_events" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "stage" "DeliveryStage" NOT NULL,
    "note" VARCHAR(255) NOT NULL DEFAULT '',
    "location" VARCHAR(160),
    "tracking_code" VARCHAR(64),
    "actor_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_tracking_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_user_id" INTEGER NOT NULL,
    "actor_role" "Role" NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" "AuditTargetType" NOT NULL,
    "target_id" INTEGER,
    "warehouse_id" INTEGER,
    "summary" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_tracking_events_order_id_created_at_idx" ON "order_tracking_events"("order_id", "created_at");
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at" DESC);
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");
CREATE INDEX "admin_audit_logs_actor_user_id_created_at_idx" ON "admin_audit_logs"("actor_user_id", "created_at" DESC);

ALTER TABLE "order_tracking_events" ADD CONSTRAINT "order_tracking_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_tracking_events" ADD CONSTRAINT "order_tracking_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 2. Wishlist Items
-- ============================================================================
CREATE TABLE "wishlist_items" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wishlist_items_user_id_created_at_idx" ON "wishlist_items"("user_id", "created_at" DESC);
CREATE UNIQUE INDEX "wishlist_items_user_id_product_id_key" ON "wishlist_items"("user_id", "product_id");

ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 3. Gmail OTP Registration & Verified Email on Users
-- ============================================================================
ALTER TABLE "users" ADD COLUMN "email" VARCHAR(120),
ADD COLUMN "email_verified_at" TIMESTAMP(3);

CREATE TABLE "registration_otps" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registration_otps_email_created_at_idx" ON "registration_otps"("email", "created_at" DESC);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- ============================================================================
-- 4. Welcome Wheel Vouchers & Order Discount / Shipping Address
-- ============================================================================
ALTER TABLE "users" ADD COLUMN "has_spun_welcome_wheel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "login_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orders" ADD COLUMN "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN "voucher_code" VARCHAR(32),
ADD COLUMN "shipping_address_line" VARCHAR(255),
ADD COLUMN "shipping_full_name" VARCHAR(120),
ADD COLUMN "shipping_note" VARCHAR(255),
ADD COLUMN "shipping_phone" VARCHAR(30),
ADD COLUMN "shipping_province" VARCHAR(100);

CREATE TABLE "vouchers" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_order_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");
CREATE UNIQUE INDEX "vouchers_used_order_id_key" ON "vouchers"("used_order_id");
CREATE INDEX "vouchers_user_id_created_at_idx" ON "vouchers"("user_id", "created_at" DESC);

ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_used_order_id_fkey" FOREIGN KEY ("used_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
