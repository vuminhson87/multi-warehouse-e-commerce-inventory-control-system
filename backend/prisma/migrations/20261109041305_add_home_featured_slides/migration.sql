-- CreateTable
CREATE TABLE "home_featured_slides" (
    "product_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "image_url_override" VARCHAR(500),
    "description_override" VARCHAR(200),

    CONSTRAINT "home_featured_slides_pkey" PRIMARY KEY ("product_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_featured_slides_position_key" ON "home_featured_slides"("position");

-- AddForeignKey
ALTER TABLE "home_featured_slides" ADD CONSTRAINT "home_featured_slides_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "home_featured_slides"
ADD CONSTRAINT "home_featured_slides_position_range"
CHECK ("position" BETWEEN 1 AND 5);
