-- Migracion inicial: tablas del Sistema de Gestion de Cochera (UPAO-33)
-- Motor: PostgreSQL

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('RECEPCIONISTA', 'DUEÑO');

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "usuario" VARCHAR(50) NOT NULL,
    "contrasena" VARCHAR(255) NOT NULL,
    "rol" "rol_usuario" NOT NULL DEFAULT 'RECEPCIONISTA',

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

CREATE TABLE "tipo_vehiculo" (
    "id_tipo_vehiculo" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,

    CONSTRAINT "tipo_vehiculo_pkey" PRIMARY KEY ("id_tipo_vehiculo")
);

CREATE TABLE "tarifa" (
    "id_tarifa" SERIAL NOT NULL,
    "id_tipo_vehiculo" INTEGER NOT NULL,
    "precio_hora" DECIMAL(10,2) NOT NULL,
    "precio_fraccion" DECIMAL(10,2) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tarifa_pkey" PRIMARY KEY ("id_tarifa")
);

CREATE TABLE "estadia" (
    "id_estadia" SERIAL NOT NULL,
    "placa" VARCHAR(10) NOT NULL,
    "id_tipo_vehiculo" INTEGER NOT NULL,
    "id_tarifa" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_pago" INTEGER,
    "hora_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hora_salida" TIMESTAMP(3),

    CONSTRAINT "estadia_pkey" PRIMARY KEY ("id_estadia")
);

CREATE TABLE "pago" (
    "id_pago" SERIAL NOT NULL,
    "id_metodo_pago" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "tiempo_horas" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "tiempo_fraccion" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id_pago")
);

CREATE TABLE "metodo_pago" (
    "id_metodo_pago" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,

    CONSTRAINT "metodo_pago_pkey" PRIMARY KEY ("id_metodo_pago")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_usuario_key" ON "usuario"("usuario");

CREATE UNIQUE INDEX "tipo_vehiculo_nombre_key" ON "tipo_vehiculo"("nombre");

CREATE UNIQUE INDEX "metodo_pago_nombre_key" ON "metodo_pago"("nombre");

CREATE UNIQUE INDEX "estadia_id_pago_key" ON "estadia"("id_pago");

CREATE INDEX "estadia_placa_idx" ON "estadia"("placa");

-- Un vehiculo no puede tener dos estadias activas (hora_salida NULL)
CREATE UNIQUE INDEX "estadia_placa_activa_key" ON "estadia"("placa") WHERE "hora_salida" IS NULL;

-- AddForeignKey
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_id_tipo_vehiculo_fkey" FOREIGN KEY ("id_tipo_vehiculo") REFERENCES "tipo_vehiculo"("id_tipo_vehiculo") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "estadia" ADD CONSTRAINT "estadia_id_tipo_vehiculo_fkey" FOREIGN KEY ("id_tipo_vehiculo") REFERENCES "tipo_vehiculo"("id_tipo_vehiculo") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "estadia" ADD CONSTRAINT "estadia_id_tarifa_fkey" FOREIGN KEY ("id_tarifa") REFERENCES "tarifa"("id_tarifa") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "estadia" ADD CONSTRAINT "estadia_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "estadia" ADD CONSTRAINT "estadia_id_pago_fkey" FOREIGN KEY ("id_pago") REFERENCES "pago"("id_pago") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pago" ADD CONSTRAINT "pago_id_metodo_pago_fkey" FOREIGN KEY ("id_metodo_pago") REFERENCES "metodo_pago"("id_metodo_pago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraints (evitar valores negativos)
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_precio_hora_no_negativo" CHECK ("precio_hora" >= 0);

ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_precio_fraccion_no_negativo" CHECK ("precio_fraccion" >= 0);

ALTER TABLE "pago" ADD CONSTRAINT "pago_monto_no_negativo" CHECK ("monto" >= 0);

ALTER TABLE "pago" ADD CONSTRAINT "pago_tiempo_horas_no_negativo" CHECK ("tiempo_horas" >= 0);

ALTER TABLE "pago" ADD CONSTRAINT "pago_tiempo_fraccion_no_negativo" CHECK ("tiempo_fraccion" >= 0);

ALTER TABLE "estadia" ADD CONSTRAINT "estadia_hora_salida_valida" CHECK ("hora_salida" IS NULL OR "hora_salida" >= "hora_ingreso");
