ALTER TABLE "reserva" RENAME COLUMN "stripe_payment_intent_id" TO "pasarela_pago_id";

ALTER TABLE "reserva"
  ADD COLUMN "pasarela_proveedor" VARCHAR(30) NOT NULL DEFAULT 'culqi',
  ADD COLUMN "pasarela_reembolso_id" VARCHAR(100);

UPDATE "reserva"
  SET "pasarela_proveedor" = 'stripe'
  WHERE "pasarela_pago_id" LIKE 'pi_%';

CREATE UNIQUE INDEX "reserva_pasarela_pago_id_key" ON "reserva"("pasarela_pago_id");

CREATE TABLE "configuracion_pasarela" (
  "id_configuracion" SERIAL NOT NULL,
  "proveedor" VARCHAR(30) NOT NULL,
  "llave_publica" VARCHAR(120) NOT NULL,
  "llave_secreta_cifrada" TEXT NOT NULL,
  "actualizado_por_id" INTEGER,
  "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "configuracion_pasarela_pkey" PRIMARY KEY ("id_configuracion")
);

CREATE UNIQUE INDEX "configuracion_pasarela_proveedor_key" ON "configuracion_pasarela"("proveedor");

ALTER TABLE "configuracion_pasarela"
  ADD CONSTRAINT "configuracion_pasarela_actualizado_por_id_fkey"
  FOREIGN KEY ("actualizado_por_id") REFERENCES "usuario"("id_usuario")
  ON DELETE SET NULL ON UPDATE CASCADE;
