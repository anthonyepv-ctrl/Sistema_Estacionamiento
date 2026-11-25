-- CreateEnum
CREATE TYPE "estado_reserva" AS ENUM ('VIGENTE', 'UTILIZADA', 'ANULADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "estado_pago_reserva" AS ENUM ('PAGADO', 'REEMBOLSADO');

-- AlterEnum
ALTER TYPE "rol_usuario" ADD VALUE 'CONDUCTOR';

-- AlterTable
ALTER TABLE "estadia" ADD COLUMN     "id_reserva" INTEGER;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "celular" VARCHAR(9),
ADD COLUMN     "dni" VARCHAR(8);

-- CreateTable
CREATE TABLE "vehiculo_conductor" (
    "id_vehiculo" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "placa" VARCHAR(10) NOT NULL,
    "id_tipo_vehiculo" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehiculo_conductor_pkey" PRIMARY KEY ("id_vehiculo")
);

-- CreateTable
CREATE TABLE "reserva" (
    "id_reserva" SERIAL NOT NULL,
    "codigo" VARCHAR(16) NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_vehiculo" INTEGER NOT NULL,
    "id_tipo_vehiculo" INTEGER NOT NULL,
    "fecha_reserva" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_limite" TIMESTAMP(3) NOT NULL,
    "estado" "estado_reserva" NOT NULL DEFAULT 'VIGENTE',
    "monto_adelanto" DECIMAL(10,2) NOT NULL,
    "stripe_payment_intent_id" VARCHAR(100),
    "estado_pago" "estado_pago_reserva" NOT NULL DEFAULT 'PAGADO',
    "fecha_anulacion" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserva_pkey" PRIMARY KEY ("id_reserva")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehiculo_conductor_id_usuario_placa_key" ON "vehiculo_conductor"("id_usuario", "placa");

-- CreateIndex
CREATE UNIQUE INDEX "reserva_codigo_key" ON "reserva"("codigo");

-- CreateIndex
CREATE INDEX "reserva_estado_id_tipo_vehiculo_idx" ON "reserva"("estado", "id_tipo_vehiculo");

-- CreateIndex
CREATE INDEX "reserva_id_usuario_estado_idx" ON "reserva"("id_usuario", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "estadia_id_reserva_key" ON "estadia"("id_reserva");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_dni_key" ON "usuario"("dni");

-- AddForeignKey
ALTER TABLE "estadia" ADD CONSTRAINT "estadia_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "reserva"("id_reserva") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculo_conductor" ADD CONSTRAINT "vehiculo_conductor_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculo_conductor" ADD CONSTRAINT "vehiculo_conductor_id_tipo_vehiculo_fkey" FOREIGN KEY ("id_tipo_vehiculo") REFERENCES "tipo_vehiculo"("id_tipo_vehiculo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_id_vehiculo_fkey" FOREIGN KEY ("id_vehiculo") REFERENCES "vehiculo_conductor"("id_vehiculo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_id_tipo_vehiculo_fkey" FOREIGN KEY ("id_tipo_vehiculo") REFERENCES "tipo_vehiculo"("id_tipo_vehiculo") ON DELETE RESTRICT ON UPDATE CASCADE;
