# FINORVE: respaldo externo manteniendo Supabase Free

Primera exportación real completada: 2026-09-29, ejecución 36647204929, intento 2. El workflow actualizado crea una copia diaria y prueba su restauración en un contenedor temporal de Supabase/Postgres 17, aislado de la red antes de importar datos.

## Activación

1. Abrir Settings > Secrets and variables > Actions:
   https://github.com/zambranofic/finanzas-en-orden-/settings/secrets/actions
2. Crear dos Repository secrets, nunca enviarlos por chat:
   - FINORVE_DB_URL: URI PostgreSQL de Connect > Session pooler, puerto 5432, para euqhrqsatbhnxgohbild. Insertar la contraseña existente de la base de datos; codificar los caracteres especiales de la contraseña para una URI. No usar la clave anon. No restablecer la contraseña por defecto.
   - FINORVE_BACKUP_PASSPHRASE: frase aleatoria de al menos 32 caracteres. Conservar también en un gestor de contraseñas independiente. Sin ella las copias son irrecuperables.
3. Actions > FINORVE encrypted database backup > Run workflow.
4. Confirmar ejecución verde y descargar el artifact cifrado a una ubicación externa propia.
5. Confirmar también el paso verde Verify isolated database restore. Comprueba SHA256, conteos exactos de las filas del dump, RLS, todas las propiedades de las políticas, triggers propios en auth/storage y las comprobaciones de tablas, funciones y seguridad de private.recovery_healthcheck(). No prueba pagos reales ni proveedores externos.
6. El horario diario está habilitado por defecto a las 03:23 de Ecuador (08:23 UTC). Para pausarlo, crear la variable FINORVE_BACKUP_ENABLED con valor false en Settings > Secrets and variables > Actions > Variables. Borrarla o cambiarla a true reanuda los respaldos. GitHub puede retrasar u omitir ejecuciones; revisar Actions.
7. Revisar fallos y descargar periódicamente una copia independiente. Los artifacts caducan a los 7 días; borrar el repositorio o perder acceso también puede hacer perder las copias.

## Cobertura y límites

Exporta roles personalizados, estructura de aplicación (tablas, funciones, políticas RLS) y datos mediante el procedimiento oficial de Supabase CLI. Añade managed-customizations.sql para los triggers propios en auth/storage, las políticas de esos esquemas y las definiciones de tareas cron (se restauran pausadas); inventory.json conserva su horario y estado original. Incluye el historial supabase_migrations si existe. Cada exportación SQL usa su propia instantánea: detener cambios estructurales durante el respaldo; no es PITR ni una copia física consistente entre los archivos.

No respalda los objetos binarios de Storage, código de Edge Functions, secretos, configuración de Auth/SMTP, DNS ni Vercel. En la inspección de 2026-09-29 el bucket privado avatars tenía 0 objetos. Antes de añadir archivos, preparar una copia externa de Storage.

El destino debe proporcionar las estructuras gestionadas compatibles de Supabase. Funciones o índices propios creados dentro de auth/storage requieren revisión adicional; FINORVE usa un trigger de auth que llama una función de private y cuatro políticas de avatares, incluidos en esta copia. inventory.json registra extensiones. Vault o cifrado de columnas requiere conservar por separado las claves según la guía oficial; no asumir que el dump basta.

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
Seguir la guía oficial y OPERATIONS_RECOVERY.md para restaurar en un destino aislado, revisar roles y privilegios antes de ejecutar, y probar cuentas, licencias, pagos, RLS y movimientos. Importar roles.sql, schema.sql, data.sql (session_replication_role=replica), managed-customizations.sql y los dos archivos history si existen, en una transacción con ON_ERROR_STOP. Reactivar las tareas cron solamente en el destino definitivo y de acuerdo con inventory.json. No automatizar restauraciones en producción.

El artifact se guarda antes de probar la restauración: un fallo de compatibilidad no elimina la copia cifrada, pero la ejecución se marca como fallida y debe revisarse. Solo se sube el archivo .gpg; SQL, inventarios descifrados y registros privados se eliminan. Cada intento tiene un nombre de artifact distinto para permitir reintentos.

Importante para Supabase local: su instalación inicial concede permisos por defecto a anon/authenticated. Antes de crear los objetos restaurados, verify-backup.sh elimina esos permisos iniciales del creador postgres en la base temporal; schema.sql restablece después los defaults originales. Así no sobreviven grants extra en RPC internos. La prueba exige que los RPC de pagos, activación, administración y límites de uso sigan restringidos. El ajuste de superusuario usado para importar roles se aplica exclusivamente al contenedor desechable; nunca se ejecuta en producción.

Fuentes:
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/platform/backups
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts
