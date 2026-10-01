# FINORVE — alcance aprobado y orden de implementación

Este documento conserva las decisiones del usuario del 1 de octubre de 2026. Una propuesta visual no significa que una función esté implementada. Actualizar los estados después de comprobar el recorrido real.

## Estado de esta entrega

- Implementado: capa visual compartida blanca, azul #0593ED, bordes suaves, Geom, botones legibles, navegación móvil flotante, logotipo y favicon aprobados, indicador de carga discreto con movimiento reducido.
- Pendiente: revisión visual completa de todas las rutas, móvil y administración.
- Implementado: Inicio Personal, gasto rápido con fijo/variable/hormiga, Base financiera y fondos independientes, supervivencia configurable (3–60 meses), aportes/retiradas, metas personalizadas y gráfica verde. Metadatos compatibles con Supabase; los registros anteriores permanecen sin asignar hasta revisión.
- Verificado: npm test; prueba Supabase/RLS y JSON revertida; navegador de demostración con guardado/recarga de gasto, configuración 800×3=2400, aporte 1600 y retirada válida/rechazada.
- Implementado en Negocio: navegación Resumen / Anotar el día / Organizar; caja inicial; ventas/cobros a crédito; compras pagadas separadas del costo vendido; préstamos, aportes, retiros, capital e intereses; resumen editable sin duplicados; días explícitos sin movimiento; equilibrio estimado y gráfica verde. Iconos de navegación de línea fina unificados.
- Verificado en esta etapa: pruebas financieras y de metadatos; SQL autenticado con licencia, registros de importe cero y configuración, revertido sin dejar fixtures. Recorrido de demostración en navegador: caja inicial 400, gastos fijos 1200, margen 40% → equilibrio 3000; cobros 1000 con 200 anteriores y 300 ventas a crédito → ventas 1100. Edición, costo vendido 350, pagos 450+100, deuda 50+10, préstamo 300, aporte 100, retiro 40 → caja 1150, resultado parcial 640, un solo día tras recarga. Revisión visual PC en claro y oscuro.
- Pendiente: móvil real y cuenta de producción; recurrencias y agenda de deuda automática, saldos de deuda de negocio, reserva/metas, calculador opcional de productos, tutorial anclado, guía contextual completa y perfil ampliado.

## Reglas comunes

Conservar acceso, recuperación de contraseña, datos, aislamiento por usuario, sincronización, membresías, renovaciones, avisos de correo y respaldos. No ejecutar cobros reales en esta etapa. Mantener servicios gratuitos. No reemplazar el logotipo por una reinterpretación ni cambiar el diseño aprobado. Geom regular/medium/semibold; blanco, negro, azul; sombras discretas, tarjetas claras, iconos finos. No usar lavanda como fondo de la aplicación.

Diseñar para personas mayores o sin conocimientos técnicos: texto visible junto al icono, controles grandes, lenguaje corriente, ejemplos junto al campo, categorías sugeridas más «Otro», teclado y contraste. Una acción recomendada cada vez. Conservar el formulario si falla el guardado; permitir editar sin duplicar. Mostrar información faltante en vez de inventar cifras. Las simulaciones y proyecciones deben indicar supuestos.

## Personal — implementación parcial; mantener pendientes los puntos no verificados

- Inicio: ingresos, gastos y disponible; acción rápida «Apuntar gasto» y «Añadir ahorro».
- Gastos fijos, variables y hormiga: importe, concepto, categoría, fecha de hoy editable, categorías recientes. Hormiga se muestra por separado y no se suma dos veces dentro de variables.
- Base financiera: supervivencia con objetivo de 3, 6 o más meses de gastos esenciales mensuales; emergencia con aportes progresivos, retiradas e historial; vacaciones, formación y objetivos personalizados.
- Capital futuro: inversión, negocios u otros proyectos. Sugerirlo después de alcanzar tres meses de supervivencia y avanzar en emergencia, sin bloquearlo.
- Deudas: saldo, interés, plazo, cuota y próximo vencimiento; separar amortización e intereses.
- Patrimonio: activos menos deudas; evitar sumar dos veces el ahorro incluido en un activo o saldo.
- Mi guía: reglas gratuitas para excesos semanales/mensuales de variables y hormiga respecto a una referencia válida, efecto sobre objetivos y una próxima acción. No dar por ciertos datos desconocidos ni garantizar fechas.
- Gráfica verde en Inicio y Base financiera: evolución real del fondo de supervivencia, objetivo, cobertura en meses y restante. Puede bajar cuando hay retiradas. Ejemplo de referencia: gastos esenciales 800/mes, objetivo 2400, saldo 1600, cobertura 2 meses, restante 800. No son datos predeterminados de usuarios.
- Gastos recurrentes: programar y confirmar pago; no contabilizar lo previsto como dinero gastado.

## Negocio — pendiente de implementar/verificar

Tres entradas principales: Resumen, Anotar el día y Organizar. No es un sistema de punto de venta ni exige venta por venta.

- Inicio progresivo: actividad, saldo inicial de caja/banco y fecha; el saldo inicial no es una venta.
- Resumen: efectivo disponible, próximos pagos, resultado cuando hay datos suficientes y una siguiente acción.
- Anotar el día: fecha, total cobrado, mercancía/materiales pagados, otros pagos. Opción para ventas pendientes de cobro y otros movimientos: préstamo, aporte, retiro del dueño, cuota e impuestos. Guardar totales del día sin duplicarlos al editar.
- Distinguir «Sin registrar», «Guardado» y «Sin movimientos» confirmado. Un día sin datos no equivale a cero.
- Costos: mercancía, materiales, empaques y Otro. Gastos: alquiler, luz/agua, administración, publicidad y Otro. Explicar y preguntar en casos ambiguos como transporte o salarios; adaptar sugerencias por actividad.
- Separar ventas de cobros, compras pagadas de costo de lo vendido, efectivo de ganancia. Si falta costo vendido/inventario, mostrar ganancia pendiente o estimada con su supuesto. No exigir inventario por producto para registrar un total del período.
- Organizar: deudas, próximos pagos, reserva, metas y herramientas opcionales.
- Próximos pagos: vista inicial de siete días. Confirmar importe, fecha y cuenta; enlazar o crear un movimiento una sola vez. No registrar automáticamente un pago previsto.
- Deudas: saldo, capital, intereses y fechas. Préstamos recibidos y capital amortizado no son ventas/gastos operativos.
- Aportes y retiros del dueño separados; si se enlazan con Personal, no duplicar ingresos.
- Reserva del negocio: 3–6 meses de gastos fijos; obligaciones esenciales adicionales visibles. Una transferencia a reserva no es un gasto.
- Metas: equipos, inventario, expansión y objetivos personalizados.
- Productos/precios opcionales: costo unitario, comisiones y precio; distinguir margen sobre precio de recargo sobre costo. No crear ventas al usar el calculador.
- Punto de equilibrio: gastos fijos / margen de contribución. Usar ventas y mezcla real o margen estimado explícito. No confundir cobros con ventas ni todo lo vendido por encima del umbral con ganancia.
- Gráfica verde en Resumen: ventas acumuladas frente al umbral mensual, porcentaje y restante. Detalle con ingresos y costos que se cruzan. Ejemplo de referencia: umbral 3000, ventas 2400, 80%, faltan 600; no insertar como dato real.
- Proyecciones opcionales con días registrados, período comparable y supuestos; no convertir días sin registrar en cero.

## Calendario de cada modo — implementado parcialmente

Implementado: mes seleccionable y lista del día; colores con texto; registros reales de ambos modos; recordatorios manuales y confirmación única de pago/cobro/aporte; próximos siete días; vencimiento de membresía. Pendiente: recorridos reales en móvil y cuenta autenticada, recurrencias y conexión automática de cuotas de deuda.

Acceso en cabecera y lateral de PC; enlace desde próximos movimientos en Inicio. Móvil: mes compacto y lista debajo. PC: mes y lista del día al lado. Selección manual del día, añadir y editar, estado y categoría visibles.

Verde entradas, azul pagos/gastos, morado ahorros/reserva, naranja pendiente, siempre con texto/icono. Mostrar ingresos extra, gastos fijos/variables/hormiga, ahorros, cuotas, registros diarios de negocio y vencimiento de membresía según el modo. Lo previsto no modifica saldos. Una confirmación de pago no crea duplicados. Diferencia entradas/salidas no se etiqueta ganancia. Fechas coherentes con la zona local.

## Perfil y ayuda — pendiente de verificar/completar

Foto personal; nombre obligatorio; correo con confirmación segura de cambios; celular; nacimiento válido y privado. Guardado y errores visibles. Membresía anual y aviso persistente de renovación.

Borrar registros financieros de Personal o de Negocio por separado, con confirmación explícita del alcance; conservar perfil y otro modo. No confundir con eliminar la cuenta. Simulación de al menos un año de cada modo en entorno aislado, sin mezclar ejemplos y datos reales. Ya existe demo anual: revisar integración con el nuevo diseño.

Tutorial elegido: versión 2, explicación anclada al botón/área real, resaltado, fondo atenuado y tarjeta con puntero; no tapar el control ni salir de la pantalla. Atrás, Siguiente y Omitir; sin avance automático. Explicar gastos, base financiera, ahorros, capital futuro, deudas y patrimonio; recorrido propio para Negocio. Guardar finalización por usuario/modo y repetir desde Ayuda.

## Validación y pendientes operativos

Comprobar cálculos, altas/ediciones/borrados, persistencia al recargar, aislamiento de usuarios y separación entre modos; caja/beneficio, capital/interés, transferencias y pagos pendientes. Probar formulario vacío, errores de guardado, accesibilidad, PC/móvil y administración.

Mantener pendientes anteriores: entrega automática de un aviso real de vencimiento elegible; custodia independiente de la contraseña del respaldo; recuperación completa en un entorno nuevo incluyendo autenticación/proveedores/DNS; protección del checkout de prueba frente a cobros de prueba no deseados. El cobro real se dejó para más adelante.

Orden: diseño común → gastos rápidos y Base financiera → registro diario y Resumen del negocio → calendarios → perfil/tutorial/guía → revisión integral. No marcar terminado por una maqueta o una prueba parcial.

Actualización visual: retirada la franja verde de la demostración; solo se conserva una etiqueta discreta de datos ficticios.


## Selector de área en móvil — 1 octubre 2026
- Corregida la desaparición de Personal / Negocio cuando la barra lateral se oculta: ambas entradas HTML incorporan un select nativo con etiqueta accesible en la esquina superior izquierda, visible hasta 760 px.
- La selección usa la misma navegación de cuenta y modo que los botones de escritorio; se sincroniza al renderizar. Se conserva la separación entre datos personales y de negocio.
- Cabecera distribuida en dos filas a 760 px o menos: selector y acciones arriba, título debajo; botones táctiles de 44 px y variante estrecha para 320 px. Se limita el tamaño intrínseco de las columnas del calendario.
- Comprobaciones: sintaxis de ambos scripts y suite npm test completa aprobadas, incluyendo cambio Personal → Negocio → Personal y rechazo de modo desconocido. Publicación de producción confirmada por Vercel.
- Pendiente: comprobación visual y de desbordamiento en viewport móvil real. El navegador de revisión disponible permanece en 1348 px incluso al solicitar un popup de 390 px; no se presenta su captura de escritorio como una prueba móvil.


## Revisión visual transversal — 1 octubre 2026

Se revisó la interfaz publicada de demostración con datos ficticios, en un navegador de escritorio de 1348 px. Esta revisión visual no sustituye la validación financiera, de pagos ni de permisos.

| Área | Evidencia y estado |
| --- | --- |
| Personal | Inicio claro/oscuro, Base financiera, Movimientos, Ingresos, Gastos, Deudas, Decisiones y Diagnóstico inspeccionados. Ahorro y activos comparten componentes revisados; su recorrido individual completo queda pendiente. |
| Negocio | Resumen, Anotar el día, Organizar, Historial de caja y calendario inspeccionados. Formularios de configuración abiertos sin guardar. Ventas/costos/gastos históricos comparten la lista revisada; falta su recorrido individual completo. |
| Cuenta | Perfil, preferencias, membresía informativa, Ajustes y tutorial actual inspeccionados. |
| Correcciones publicadas | Etiquetas completas en acciones principales y de caja; filas de cifras separadas; tarjetas de ahorro adaptables; navegación vuelve al comienzo; iconos de línea consistentes; formularios con títulos en singular; textos auxiliares y campos más legibles; tablas y tarjetas con límites de ancho; selector Personal/Negocio también disponible en ancho intermedio. |
| Identidad | Logotipo aprobado conservado. Favicon de la demostración actualizado al mismo de la entrada principal. Tipografía Geom cargada en la revisión. |
| Móvil y tableta | CSS revisado y corregido, sin certificación visual: el navegador disponible permanece en 1348 px y no permite cambiar el viewport. Debe verificarse a 320/360/390/768/1024 px, incluyendo selector de área, teclado, listas, formularios, menú inferior y calendario. |
| Administración y acceso | Interfaz administrativa y recorridos de acceso/recuperación no certificados en esta revisión. |
| Pendientes del producto | Mantener los pendientes anteriores: tutorial contextual, teléfono/fecha de nacimiento en perfil, inteligencia financiera completa y módulos de deuda/reserva según alcance. Diagnóstico sin registros debe revisarse para evitar mensajes que sugieran estabilidad financiera con datos insuficientes. |
| Cobro | Sigue aplazado por instrucción del usuario; no se realizaron pagos ni renovaciones. |

Validación técnica: sintaxis de ambas aplicaciones y pruebas de navegación, cableado de interfaz y calidad visual automatizada superadas. Las capturas corresponden a la aplicación real, no a maquetas nuevas.


## Patrón visual aprobado — ajuste publicado 1 octubre 2026

Referencia: muestra corregida Móvil y PC enviada por el usuario (tarjetas blancas, botones azul/oscuro, iconos de línea e ilustraciones de fondos). Se conservaron el logo y favicon aprobados.

- Inicio personal: franja de disponible/ingresos/gastos; acciones de gasto/ahorro; supervivencia junto a gastos; emergencia y capital futuro visibles; acceso a guía y cuatro accesos al plan financiero.
- Iconos: caja de supervivencia azul, caja de emergencia verde y alcancía de capital futuro en círculos suaves; vivienda/tarjeta/taza para fijo/variable/hormiga. Sin emoji dependientes del dispositivo.
- Estilos compartidos: sombras ligeras, bordes finos, botones con profundidad sutil y Geom. Aplicados también a los componentes existentes de Negocio.
- Cálculos y registros conservados. No se añadieron saldos ni curvas ficticias para imitar los números de la referencia. La curva representa el historial del fondo cuando existen aportes asignados.
- Verificado en publicación a 1348 px, en claro y oscuro; registro rápido abre el formulario. La adaptación CSS móvil está incluida; su comprobación visual sigue pendiente por la limitación del navegador indicada anteriormente.


## Tutorial contextual — 1 octubre 2026 (estado actual)

El recorrido antiguo centrado de cuatro pasos se sustituyó por avisos junto a la sección explicada. El objetivo es orientar sin exigir registros ficticios ni modificar importes.

| Elemento | Estado |
| --- | --- |
| Personal | Construido: 10 pasos, resumen, registro rápido, tipos de gastos, supervivencia, emergencia, capital futuro, deudas, patrimonio, calendario y guía. Recorrido completo revisado en publicación de escritorio. |
| Negocio | Construido: 8 pasos, resumen, totales diarios, otros movimientos y deuda, configuración/equilibrio, costos frente a gastos, caja, calendario y siguiente paso. Recorrido completo revisado en publicación de escritorio. |
| Interacción | Anterior, Siguiente, Terminar y Salir; Escape; foco contenido dentro del diálogo; retorna a la pantalla desde donde comenzó. Se repite desde Ajustes > Ver recorrido. |
| Diseño | Misma Geom, bordes redondeados, sombras suaves y botón azul; marco sobre el objetivo visible sin desenfocar la aplicación; flecha hacia el elemento. |
| Pantallas estrechas | Posicionamiento probado automáticamente a 320/390/768/1348 px y alturas 500/844/936. Estas pruebas geométricas no equivalen a una certificación visual móvil; la revisión en ancho móvil y con dispositivo permanece pendiente. |
| Datos | Solo se conserva la marca existente de tutorial completado. El recorrido navega y explica; no crea movimientos financieros. Validación browser realizada en la demostración ficticia. |

Verificación: suite completa de pruebas superada; recorrido Personal/Negocio, retroceso, fin y Escape comprobados en navegador. Refinamiento adicional para devolver el foco a Siguiente después del cambio de sección.

El tutorial contextual ya no es un pendiente de implementación. Siguen pendientes los campos de teléfono/fecha de nacimiento del perfil, la comprobación visual móvil/administrativa y los demás módulos funcionales indicados en el alcance anterior. El cobro real sigue aplazado.


### Límite de publicación detectado en Vercel

Tutorial principal publicado en producción desde `b7601bbfcf970a9084b6f02d90bacfb6a71c0c06` (despliegue READY `dpl_F1gja7j7WnNSFnoYP9e2ruX3LCk3`). Recorridos completos Personal/Negocio, Anterior, Terminar y Escape verificados en esa versión.

Vercel rechazó el siguiente despliegue con `api-deployments-free-per-day`: más de 100 despliegues en 24 horas, intentar de nuevo en 24 horas. El refinamiento que devuelve explícitamente el foco a Siguiente después de cada paso está preparado y probado en la rama, pero NO está publicado. La documentación más reciente también espera publicación. La versión publicada mantiene el tutorial contextual y la navegación Tab contenida dentro del aviso comprobada en navegador. No se cambió de plan ni se alteraron protecciones para evitar el límite.



## Multidivisa por país — 1 octubre 2026

Implementación preparada: catálogo de 78 países y 47 monedas. Incluye todos los países hispanohablantes, Puerto Rico, los países europeos (también transcontinentales y Kosovo), Canadá, Brasil, Estados Unidos y otras ubicaciones. Bulgaria usa EUR desde 2026. Referencia de países y presentación: Unicode CLDR 49; precisión guardada: ISO 4217, diferenciada de los decimales habituales de visualización.

- Selección de país sugiere moneda únicamente en apartados sin registros. Personal y Negocio pueden tener monedas distintas. La interfaz sigue en español.
- Selector ordenado en español, etiquetas completas de moneda con código ISO; formato regional por país.
- Importes enteros, precisión 0 o 2 según moneda. COP muestra enteros sin decimales y conserva los centavos cuando existen. Los formatos no pierden precisión incluso en el máximo entero seguro.
- Parseo de importes según separadores regionales; grupos mal formados, exceso de decimales e importes fuera de rango se rechazan. No hay cotizaciones ni conversiones automáticas.
- Dashboard, diagnóstico, escenarios y totales de caja excluyen monedas distintas. El historial muestra cada importe en su moneda original y conserva los índices originales para editar/eliminar correctamente. Edición conserva moneda y precisión originales.
- Cambiar una moneda con datos pide confirmación explícita y explica que el historial no se convierte.
- Sincronización guarda base_currency igual a la moneda original cuando fx_rate es 1; no etiqueta registros antiguos con la moneda nueva. Verificación de restricciones en Supabase mediante consulta de solo lectura: perfiles y movimientos aceptan códigos ISO de tres letras; sin migración ni cambios en permisos.
- Demo anual incorpora los mismos ajustes, conserva almacenamiento aislado y sus registros de demostración. La membresía y el cobro en USD no cambian.
- CSS para cantidades largas y selectores móviles; no cambia colores, marca o tipografía.

Validación: currency-tests.mjs prueba los 78 países, 47 monedas, 390 casos de entrada/formato, importes máximos, rechazo de entradas inválidas según locale, aislamiento de saldos, fondos, calendario, resumen diario, perfil sin sobrescribir monedas con datos y edición real de handlers en ambas aplicaciones. Batería general npm test: las 24 suites pasan. Tras la última protección de fondos en otra moneda, se repitieron syntax checks y currency-tests.mjs con resultado correcto.

Estado de entrega actualizado: publicado automáticamente en producción desde `4ad60e0dc9ce57ccaa47682e7aa08cf71c738a3a`, despliegue READY `dpl_GqXoevnPTtVX5SndjKjATGeuSZFr`, aliases finorve.com y www.finorve.com. Se comprobó HTTP 200 y contenido idéntico al código probado para currency-utils.js, app-v4.js y annual-demo-app.js en finorve.com. El límite anterior no bloqueó este despliegue Git automático; no se cambió de plan. Navegador CUA desconectado al intentar comprobar esta versión; revisión visual responsive y comprobación de guardado autenticado en producción pendientes. No se declara visualmente validado. Campos adicionales de perfil (teléfono, identificación fiscal, nacimiento) siguen pendientes; este ajuste usa el campo de país existente, sin modificar datos personales ni esquema.


## Ajuste vigente del selector de país — 1 octubre 2026

Esta decisión sustituye la lista anterior de 78 países: se muestran 54 destinos y 24 monedas. Europa queda limitada a los países que utilizan EUR. Se conservan Latinoamérica (incluidos Brasil, Puerto Rico y destinos limítrofes del continente), Canadá, Australia y Estados Unidos. Se retiran del selector, entre otros, Reino Unido, Suiza, Noruega, Polonia, Japón, Nueva Zelanda y Guinea Ecuatorial.

Las opciones muestran bandera, país, código ISO y denominación breve en mayúsculas, por ejemplo «🇺🇸 Estados Unidos · USD — DÓLAR». Se añade búsqueda de país con coincidencias sin tildes y alias USA/EEUU. Al filtrar, la selección existente permanece explícita y no cambia la moneda por accidente. El país sugiere moneda únicamente para apartados sin registros. Los selectores monetarios utilizan las 24 monedas de la lista reducida; una moneda histórica fuera de la lista se conserva como opción actual para no cambiar datos anteriores involuntariamente.

Las banderas son caracteres Unicode en el selector nativo y su apariencia depende del sistema operativo. Se conserva el país escrito y el código ISO como identificación accesible. Revisión visual móvil continúa pendiente; no se declara validada por renderizar únicamente el HTML en pruebas.

Validación: las 24 suites de npm test pasan. Pruebas nuevas verifican inclusiones/exclusiones, etiquetas, búsqueda de Estados Unidos/EEUU y Canadá sin tilde, filtro euro, selección estable y ausencia de resultados. Se mantienen 270 casos exactos de importes para los 54 países y los tests de aislamiento/edición de registros.
