# Validación del guardado anual en Supabase

30/09/2026, Ecuador. Pruebas SQL ejecutadas con rol authenticated y dos cuentas licenciadas sin privilegios de administrador. No se realizaron cobros ni envíos de correo. Cada prueba terminó con ROLLBACK.

- scripts/verify-user-isolation.sql: lectura y CRUD propios, separación Personal/Negocio, protección frente a lectura/escritura/borrado de otra cuenta, cambio de propietario rechazado, visitantes sin acceso. PASS.
- scripts/verify-annual-sync.mjs: genera una transacción SQL que usa public.replace_my_movements, la función que llama el guardado de la aplicación. Importó los 314 movimientos ficticios; verificó ambos modos; editó sin duplicar; eliminó un movimiento; rechazó un modo inválido sin perder el estado previo; comprobó conteos/importes de otras cuentas sin cambios. PASS.
- Verificación posterior: cero filas de prueba permanecen.

La validación de base de datos usa identidad JWT de prueba establecida dentro de una transacción de administrador y rol authenticated. No comprueba el transporte HTTP ni la renovación de tokens del navegador. El usuario confirmó previamente el CRUD y la recarga en su cuenta para ingresos personales y ventas del negocio. La demostración anual probó interfaz/cálculos con almacenamiento local separado.

Repetición: node scripts/verify-annual-sync.mjs genera SQL. Ejecutarlo íntegro mediante una conexión administrativa autorizada; requiere una cuenta no administradora con licencia activa. No eliminar el ROLLBACK ni ejecutar fragmentos separados. No utilizar con un cliente que haga commit automáticamente entre sentencias.
