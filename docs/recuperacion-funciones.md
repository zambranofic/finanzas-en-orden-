# FINORVE: recuperación de funciones del servidor

Copia del código desplegado capturada el 30 de septiembre de 2026, hora de Ecuador.

## Lo que se conserva

Las 21 funciones obtenidas del servidor están en `supabase/functions/<nombre>/index.ts`. `supabase/functions.snapshot.json` registra la versión desplegada, la huella del paquete del servidor y una huella SHA256 del archivo fuente. Estas dos huellas describen objetos distintos y no deben compararse entre sí.

`supabase/config.toml` conserva el valor real de `verify_jwt` por función y su punto de entrada. La copia no redespliega funciones ni concede permisos nuevos. Las funciones públicas conservan las validaciones que ya estaban en su código; no se debe desactivar la verificación JWT globalmente al recuperar.

Las funciones `paypal-health`, `paypal-env-diagnostic` y `paypal-browser-token` devuelven actualmente 404 de forma intencionada. Se conservan tal como están: tener una función desplegada no implica que esté habilitada o validada funcionalmente.

## Configuración privada necesaria

El código usa estos nombres de variables; sus valores no están en el repositorio:

| Variable | Recuperación |
|---|---|
| SUPABASE_URL | URL del proyecto de destino |
| SUPABASE_ANON_KEY | Clave compatible con el código para el proyecto de destino |
| SUPABASE_SERVICE_ROLE_KEY | Clave privada del destino; solo en el servidor |
| PAYPAL_CLIENT_ID | Aplicación PayPal del entorno correspondiente |
| PAYPAL_CLIENT_SECRET | Secreto de esa misma aplicación |
| PAYPAL_WEBHOOK_ID | Webhook registrado para el destino y entorno correctos |
| PAYPAL_BASE_URL | Entorno elegido; la recuperación se valida primero con Sandbox |
| APP_BASE_URL | URL real de la aplicación recuperada |
| PAYPHONE_TOKEN | Credencial privada de Payphone del entorno elegido |
| PAYPHONE_STORE_ID | Tienda de Payphone configurada para FINORVE |
| PAYPHONE_LIVE_ENABLED | Mantener deshabilitado durante la recuperación aislada |
| RESEND_API_KEY | Credencial privada de Resend con permiso de envío |
| MEMBERSHIP_EMAIL_FROM | FINORVE <avisos@finorve.com>, con dominio verificado |

No copies a un proyecto nuevo las claves de servicio del proyecto anterior. No publiques un archivo .env con valores reales. No solicites ni envíes estas claves por chat.

## Orden de recuperación

1. Recupera y comprueba primero la base de datos en un destino aislado.
2. Elige una revisión concreta del repositorio y ejecuta `node scripts/verify-function-snapshot.mjs`. El 30 de septiembre pasó la comparación de las 21 fuentes y sus configuraciones JWT; todas coincidieron con las fuentes desplegadas.
3. Configura las variables del destino de forma privada.
4. Revisa las dependencias y la configuración de las funciones. Esta copia preserva las importaciones originales: varias usan `@supabase/supabase-js@2` y no tienen una versión exacta bloqueada. Por eso copiar el código no garantiza un paquete futuro idéntico; hace falta verificar el empaquetado y fijar versiones tras probarlas.
5. Usa la herramienta de despliegue de Supabase para cada función, con el nombre, punto de entrada y `verify_jwt` correspondientes. Si usas CLI, descubre los comandos disponibles con `supabase --help` y `supabase functions deploy --help`, y selecciona explícitamente el proyecto de destino. No despliegues en producción durante la prueba.
6. Configura las redirecciones de Auth y el webhook de PayPal del destino. Comprueba las URLs codificadas dentro de las funciones antes de cambiar de dominio: algunas conservan referencias al dominio actual o a dominios anteriores.
7. Prueba autenticación, aislamiento de cuentas, compra Sandbox, captura, alta, activación de licencia y recarga. Comprueba que visitantes sin sesión no pueden usar las funciones administrativas.
8. Recupera Payphone y Resend: revisa URLs, claves públicas y referencias de proyecto incrustadas en funciones y frontend; cambia todas para el destino. Verifica Auth (registro, acceso y recuperación), permisos de destinatarios de correo y los cron de avisos antes de activarlos. La membresía actual es anual con renovación manual; conserva fechas y precio individual pactado.
9. Habilita cobros y tareas del servicio únicamente después de completar las comprobaciones y revisar el cambio de destino.

## Estado

- Verde: código de las 21 funciones conservado; copia comparada con las fuentes obtenidas del servidor.
- Verde: configuración de verificación JWT y versiones documentadas; nombres de variables incluidos sin valores secretos.
- Rojo: empaquetado reproducible y ejecución de las funciones en otro destino.
- Rojo: recuperación de secretos y configuración privada por el propietario.
- Verde: Payphone y el trabajador HTML de avisos incluidos en el inventario actualizado.
- Rojo: recuperación completa en otro entorno, primer aviso automático a un destinatario real elegible y pago real de membresía; este último fue aplazado por el propietario.

Esta copia complementa el [respaldo de base de datos](recuperacion-respaldos.md). No reemplaza esa copia ni demuestra por sí sola la recuperación de todo el servicio.

Referencias oficiales: [configuración por función](https://supabase.com/docs/guides/functions/function-configuration), [variables de entorno](https://supabase.com/docs/guides/functions/secrets) y [despliegue](https://supabase.com/docs/guides/functions/deploy).
