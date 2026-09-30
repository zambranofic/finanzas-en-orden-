# Captura PayPal: fallo intermitente y verificación

## Evidencia

En la ventana 30/09/2026 02:30–02:42 UTC los registros de la función muestran un POST 503 seguido de un POST 200. El intento fallido ocurrió antes del diagnóstico añadido a la versión 14. La consulta de las etiquetas de diagnóstico no devolvió un detalle que permita atribuir ese fallo a PayPal, a credenciales o a la base de datos. La causa histórica permanece pendiente; un reintento exitoso no demuestra que se haya corregido.

## Mejora publicada

La versión 15 de `paypal-capture-checkout` maneja las excepciones de conexión al obtener el token OAuth, consultar la orden y enviar la captura. Comprueba además que una respuesta OAuth válida contiene un token no vacío. Los errores se devuelven como códigos controlados; no se devuelve el mensaje original de una excepción de red.

Los registros de dependencia contienen únicamente una etapa y un estado HTTP, sin correo, contraseña, token OAuth, clave de servicio ni secreto de checkout. Las etapas son `oauth_network`, `oauth_http`, `oauth_response`, `order_lookup_network`, `order_lookup_http`, `capture_network_uncertain` y `capture_http`. Una captura cuya respuesta se pierde se trata como incierta; no se añade un reintento automático del cobro.

Se conserva la orden original y `PayPal-Request-Id: public-capture-<checkout_id>`. En una nueva solicitud, el código consulta primero la orden y recupera una captura ya completada. Se mantienen la comparación exacta del importe y moneda, los límites de intentos y la validación del secreto de checkout.

## Comprobaciones realizadas

- La fuente de la versión 15 obtenida de Supabase coincide exactamente con la guardada en el repositorio.
- Las 13 suites de `npm test` pasaron, incluida `paypal-capture-tests.mjs`, que ejecuta el handler real con PayPal y base de datos simulados.
- Casos probados: fallo del límite de intentos; OAuth 401 y 503; fallo de conexión OAuth; respuesta OAuth sin token; fallo de consulta; checkout completado recuperable; orden completada sin nueva captura; importe incorrecto; error de escritura final; y captura completada por el proveedor con respuesta perdida, seguida de reconciliación sin otra captura.
- Las peticiones reales sin JSON válido o sin datos de checkout devolvieron 400; GET devolvió 405; OPTIONS desde un origen no permitido devolvió 403. Estas pruebas se rechazan antes de pagos o acceso a datos del checkout.

## Qué sigue en rojo

La causa del 503 histórico y la compra completa desde el navegador. Los ensayos simulados no verifican las credenciales actuales ni el estado real de PayPal. No se ha efectuado un nuevo cobro para probar esta mejora. La interfaz sigue pendiente de publicación por la cuota gratuita de Vercel.

Si vuelve a fallar una compra Sandbox, revisar la etapa y el estado del servidor de ese intento antes de cambiar credenciales, redesplegar o pedir que se repita el proceso. No se debe pedir pagar otra vez para resolver una captura incierta.

Referencia: [idempotencia de solicitudes PayPal](https://developer.paypal.com/api/rest/requests/).
