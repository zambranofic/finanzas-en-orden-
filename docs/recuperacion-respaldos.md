# FINORVE: respaldos y recuperación

Guía verificada el 29 de septiembre de 2026, hora de Ecuador.

## 1. Encontrar y guardar el respaldo

1. Abre [el flujo de respaldos en GitHub](https://github.com/zambranofic/finanzas-en-orden-/actions/workflows/finorve-backup.yml) con la cuenta propietaria del repositorio.
2. Abre la ejecución más reciente que haya terminado correctamente. En el trabajo `backup`, comprueba que **Export and encrypt** y **Verify isolated database restore** tienen resultado verde. Un archivo puede haberse subido aunque la restauración posterior falle; por eso no basta con encontrar un archivo.
3. En **Artifacts**, descarga `finorve-database-<número de ejecución>-<intento>`. GitHub entrega un ZIP que contiene `finorve-backup.tar.gz.gpg`.
4. Guarda el ZIP cifrado fuera de GitHub, en una ubicación privada que controles. Comprueba que la descarga terminó y conserva la fecha y el enlace de la ejecución junto al archivo.
5. Conserva por separado la contraseña de cifrado en tu gestor de contraseñas. No la publiques ni la envíes por chat. GitHub no permite leer de nuevo el valor guardado como secreto; la contraseña de Supabase es distinta de la contraseña del respaldo. No cambies la contraseña de cifrado esperando que abra archivos antiguos.

El horario configurado es **03:23 de Ecuador cada día** (`08:23 UTC`); GitHub puede iniciar las ejecuciones programadas con retraso. Los archivos de Actions se conservan **7 días**. La ejecución no programada también puede iniciarse con **Run workflow → main → Run workflow**. Un resultado verde confirma esa ejecución, no que todas las ejecuciones futuras funcionarán.

La variable `FINORVE_BACKUP_ENABLED=false` desactiva las ejecuciones programadas. Los secretos necesarios son `FINORVE_DB_URL` y `FINORVE_BACKUP_PASSPHRASE`; esta guía no contiene sus valores.

## 2. Qué recupera este archivo

| Elemento | Cobertura |
|---|---|
| Estructura, registros y roles exportados de PostgreSQL | Incluidos según los archivos SQL del respaldo |
| Permisos, políticas RLS y personalizaciones de Auth/Storage | Exportados y comparados en la prueba aislada |
| Definiciones de tareas de base de datos | Recuperadas en pausa; requieren revisión antes de activarlas |
| Historial de migraciones | Incluido cuando existe en el origen |
| Archivos binarios subidos a Storage | No incluidos por el export de base de datos |
| Código de la web y de funciones desplegadas | Necesita su copia/versionado independiente |
| Secretos de funciones y del alojamiento | Necesitan recuperación desde el gestor de secretos |
| Ajustes Auth, redirecciones, correo, PayPal y dominio | Necesitan revisión/configuración independiente |
| Sesiones y funcionamiento completo del servicio | Deben probarse tras recuperar; no se garantizan por importar SQL |

El ZIP descargado contiene datos sensibles cifrados. Al descifrarlo, los SQL contienen datos privados; no los subas al repositorio ni los adjuntes a incidencias.

## 3. Verificación técnica sin tocar producción

El flujo ejecuta `scripts/verify-backup.sh` después de cada exportación. Descifra el archivo, comprueba `SHA256SUMS` e importa los SQL en un contenedor nuevo de Supabase/Postgres 17. Desconecta la red del contenedor antes de ejecutar los SQL recuperados. Compara cantidades de registros, políticas, RLS y triggers, y ejecuta `private.recovery_healthcheck()`.

Para repetir esta prueba con un archivo descargado, un operador necesita Linux, Docker, Node/npm, Python 3, GPG, tar y sha256sum, además de los scripts del repositorio:

1. Extrae del ZIP únicamente `finorve-backup.tar.gz.gpg` a una carpeta temporal privada.
2. Establece `RUNNER_TEMP` con esa carpeta, y carga `FINORVE_BACKUP_PASSPHRASE` de forma privada en el entorno. No escribas el valor en el historial de comandos ni actives `set -x`.
3. Desde la raíz del repositorio, ejecuta `bash scripts/verify-backup.sh`.
4. Confirma la salida `Isolated restore passed`. El script elimina los archivos temporales descifrados y el contenedor al terminar.

Este script no acepta una URL de destino ni restaura sobre producción. La creación inicial del contenedor requiere conexión para descargar dependencias; la importación del respaldo se realiza con la red del contenedor desconectada.

## 4. Ante una pérdida real

1. Evita nuevas escrituras en la aplicación y conserva el estado actual si es accesible. Anota cuándo ocurrió el problema.
2. Elige un respaldo anterior al incidente con restauración aislada correcta. La fecha de exportación indica hasta qué punto se recuperan datos; se pueden perder cambios posteriores.
3. Repite la prueba aislada antes de elegir el archivo definitivo.
4. Prepara un destino vacío y compatible; revisa extensiones, roles y versiones. La importación en un proyecto Supabase alojado necesita un procedimiento adaptado a ese destino: no copies sin revisión los pasos de privilegios elevados usados en el contenedor desechable.
5. Importa en el destino nuevo, valida datos y permisos, recupera funciones y sus secretos y configura Auth/SMTP. Mantén tareas, webhooks y cobros desactivados durante la prueba.
6. Comprueba inicio de sesión y recuperación de contraseña; licencia; lectura y guardado de movimientos Personal y Negocio; aislamiento entre dos cuentas; y recarga de la página.
7. Reconcilia los pagos posteriores al respaldo con el proveedor antes de reactivar procesos. Restaurar una fila no ejecuta ni deshace un cobro en PayPal.
8. Cambia la aplicación al destino validado, activa únicamente las tareas revisadas y crea un nuevo respaldo.

La restauración sobre producción y el cambio de destino no se han realizado como parte de esta guía. Solo deben ejecutarse con un destino concreto y un plan revisado; la prueba aislada ya realizada permite preparar esa recuperación.

## 5. Evidencia y pendientes

| Estado | Evidencia / límite |
|---|---|
| Verde: exportación cifrada y recuperación aislada | [Ejecución 36650987313](https://github.com/zambranofic/finanzas-en-orden-/actions/runs/36650987313), exportación y restauración correctas |
| Verde: archivo disponible al revisar | `finorve-database-36650987313-1`, creado 29/09/2026 19:38 Ecuador; caduca 06/10/2026 19:38 Ecuador |
| Verde: aislamiento en la base de datos | `scripts/verify-user-isolation.sql` pasó el 29/09/2026; dos cuentas con licencia, rol `authenticated`, visitantes `anon`, transacción revertida y cero registros de prueba restantes |
| Rojo: respaldo posterior a los últimos arreglos | La ejecución citada es anterior a los ajustes del alta y la activación de acceso. Verificar una nueva ejecución que los incluya |
| Rojo: acceso del propietario a archivo y clave | Confirmar que conserva una copia privada descargada y la contraseña correspondiente fuera del secreto de GitHub |
| Rojo: recuperación completa en otro destino | Funciones, secretos, archivos Storage si los hubiera, configuración y prueba de servicio necesitan comprobación propia |
| Rojo: interfaz Personal y Negocio | Corrección preparada; publicación bloqueada por cuota gratuita de Vercel, pendiente de prueba en navegador |

Referencias: [Backups de Supabase](https://supabase.com/docs/guides/platform/backups) y [políticas RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). El horario y la retención proceden de `.github/workflows/finorve-backup.yml` del proyecto, no de un servicio de respaldos de pago de Supabase.
