# Checkout integrado de FINORVE

## Comportamiento preparado

El checkout renderiza el botón oficial PayPal dentro de la página. Se elimina la navegación explícita a `approve_url` desde el botón anterior. PayPal puede abrir su ventana de autorización; FINORVE conserva la página de compra y muestra el alta de cuenta cuando el servidor confirma el pago.

Los campos seguros de tarjeta (titular, número, caducidad y CVV) se renderizan con CardFields únicamente cuando el SDK indica que la operación es elegible. Los datos de tarjeta van al proveedor. No se crean campos de tarjeta propios ni se guardan datos de tarjeta en la base de FINORVE.

La disponibilidad de CardFields y la aprobación de la cuenta comercial son requisitos del proveedor. Ecuador no aparece en la lista de países de Expanded Checkout consultada el 29/09/2026. Falta comprobar el país de registro y la elegibilidad de la cuenta comercial real; no se debe prometer tarjeta directa en producción antes de esa comprobación. Una autorización bancaria puede exigir una ventana o paso adicional.

## Verificación

Las 14 suites pasan. `embedded-checkout-tests.mjs` comprueba con SDK simulado: una sola carga/inicialización concurrente, validación de correo antes de crear orden, reutilización de la orden activa, aprobación y captura en servidor, botón PayPal disponible aunque CardFields no lo esté, recuperación pendiente que bloquea nuevas compras, y reintento tras fallo de carga del SDK.

El SDK se carga desde la URL oficial `https://www.paypal.com/sdk/js`, con `buttons,card-fields`, USD e intención de captura. Las credenciales de la aplicación determinan el entorno Sandbox/Live; el código no convierte una cuenta Sandbox en una cuenta de cobros reales.

## Pendientes

- Publicación de la interfaz: actualmente bloqueada por la cuota gratuita de Vercel.
- Comprobación de renderizado real del SDK en escritorio y móvil.
- Elegibilidad comercial para tarjetas integradas y configuración Live.
- Compra Sandbox completa dentro del nuevo checkout y comprobación de alta/licencia.
- La causa del antiguo error 503 sigue pendiente, aunque el servidor ya tiene manejo de errores y diagnóstico mejorados.

Fuentes: [configuración del SDK](https://developer.paypal.com/sdk/js/configuration/) y [elegibilidad de Expanded Checkout](https://developer.paypal.com/expanded/eligibility).
