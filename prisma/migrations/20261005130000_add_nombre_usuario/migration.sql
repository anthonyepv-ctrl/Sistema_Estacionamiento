-- Agrega el nombre visible del usuario (el login usa "usuario", sin correo)

-- AddColumn
ALTER TABLE "usuario" ADD COLUMN "nombre" VARCHAR(100);

-- Backfill: los usuarios existentes usan su usuario como nombre
UPDATE "usuario" SET "nombre" = "usuario";

-- Require value
ALTER TABLE "usuario" ALTER COLUMN "nombre" SET NOT NULL;

-- Unificar credencial de desarrollo: admin@cochera.pe -> admin
UPDATE "usuario" SET "usuario" = 'admin', "nombre" = 'Administrador' WHERE "usuario" = 'admin@cochera.pe';
