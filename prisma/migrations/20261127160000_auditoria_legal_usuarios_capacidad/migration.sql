-- AlterTable: agregar correo, activo y consentimiento legal a usuario
ALTER TABLE "usuario"
  ADD COLUMN IF NOT EXISTS "correo" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "acepto_terminos_en" TIMESTAMP(3);

-- CreateTable: libro de reclamaciones virtual (Indecopi D.S. 011-2011-PCM / Ley 31435)
CREATE TABLE IF NOT EXISTS "reclamo" (
  "id_reclamo" SERIAL NOT NULL,
  "codigo" VARCHAR(20) NOT NULL,
  "tipo" VARCHAR(15) NOT NULL,
  "nombre_consumidor" VARCHAR(120) NOT NULL,
  "tipo_documento" VARCHAR(20) NOT NULL,
  "numero_documento" VARCHAR(15) NOT NULL,
  "correo" VARCHAR(120) NOT NULL,
  "telefono" VARCHAR(15) NOT NULL,
  "domicilio" VARCHAR(200) NOT NULL,
  "servicio" VARCHAR(100) NOT NULL,
  "monto_reclamado" DECIMAL(10,2),
  "detalle" VARCHAR(1000) NOT NULL,
  "pedido" VARCHAR(500) NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reclamo_pkey" PRIMARY KEY ("id_reclamo")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reclamo_codigo_key" ON "reclamo"("codigo");

-- CreateTable: capacidad persistente de espacios (DEF-77-08)
CREATE TABLE IF NOT EXISTS "configuracion_espacios" (
  "id_configuracion" INTEGER NOT NULL DEFAULT 1,
  "capacidad_autos" INTEGER NOT NULL DEFAULT 10,
  "capacidad_motos" INTEGER NOT NULL DEFAULT 10,
  "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "configuracion_espacios_pkey" PRIMARY KEY ("id_configuracion")
);
