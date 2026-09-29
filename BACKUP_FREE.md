# FINORVE: respaldo externo manteniendo Supabase Free

Estado: preparado, sin activar. No hay una copia real hasta que termine correctamente la primera ejecución.

## Activación

1. Abrir Settings > Secrets and variables > Actions:
   https://github.com/zambranofic/finanzas-en-orden-/settings/secrets/actions
2. Crear dos Repository secrets, nunca enviarlos por chat:
   - FINORVE_DB_URL: URI PostgreSQL de Connect > Session pooler, puerto 5432, para euqhrqsatbhnxgohbild. Insertar la contraseña existente de la base de datos; codificar los caracteres especiales de la contraseña para una URI. No usar la clave anon. No restablecer la contraseña por defecto.
   - FINORVE_BACKUP_PASSPHRASE: frase aleatoria de al menos 32 caracteres. Conservar también en un gestor de contraseñas independiente. Sin ella las copias son irrecuperables.
3. Actions > FINORVE encrypted database backup > Run workflow.
4. Confirmar ejecución verde y descargar el artifact cifrado a una ubicación externa propia.
5. Hacer una prueba de restauración en un destino aislado compatible, nunca en producción. Una copia descifrable aún no es una recuperación probada.
6. Tras verificar, crear la variable FINORVE_BACKUP_ENABLED con valor true en Settings > Secrets and variables > Actions > Variables. El horario aproximado diario es 03:23 de Ecuador (08:23 UTC). GitHub puede retrasar u omitir ejecuciones; revisar Actions.
7. Revisar fallos y descargar periódicamente una copia independiente. Los artifacts caducan a los 7 días; borrar el repositorio o perder acceso también puede hacer perder las copias.

## Cobertura y límites

Exporta roles personalizados, estructura de aplicación (tablas, funciones, políticas RLS) y datos mediante el procedimiento oficial de Supabase CLI. Cada exportación SQL usa su propia instantánea: detener cambios estructurales durante el respaldo; no es PITR ni una copia física consistente entre los tres archivos.

No respalda los objetos binarios de Storage, código de Edge Functions, secretos, configuración de Auth/SMTP, DNS ni Vercel. En la inspección de 2026-09-29 el bucket privado avatars tenía 0 objetos. Antes de añadir archivos, preparar una copia externa de Storage.

Los cambios propios en esquemas auth/storage y el historial de migraciones requieren exportación y restauración adicional; no asumir que el dump de schema los incluye. El destino debe proporcionar las estructuras gestionadas compatibles de Supabase. Registrar extensiones, funciones desplegadas y configuración por separado.

No contrata Pro ni otro servicio de pago. GitHub Actions y artifacts están sujetos a los límites y configuración de facturación de la cuenta. La retención corta reduce espacio; no se promete almacenamiento ilimitado ni costo cero ante cualquier volumen.

## Recuperación manual

Descargar el artifact y extraer el archivo .gpg. En una máquina privada:
```sh
gpg --output finorve-backup.tar.gz --decrypt finorve-backup.tar.gz.gpg
mkdir finorve-restauracion
tar -xzf finorve-backup.tar.gz -C finorve-restauracion
cd finorve-restauracion
sha256sum -c SHA256SUMS
```
GPG solicita la frase de cifrado. Mantener los SQL privados.
Seguir la guía oficial y OPERATIONS_RECOVERY.md para restaurar en un destino aislado, revisar roles y privilegios antes de ejecutar, y probar cuentas, licencias, pagos, RLS y movimientos. No automatizar restauraciones en producción.

Fuentes:
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/platform/backups
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts
