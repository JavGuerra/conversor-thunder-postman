# 🚀 Conversor de Colecciones: Thunder Client a Postman

**Autor:** Javier Guerra  
**Fecha de creación:** 2025-08-22  
**Última modificación:** 2026-04-02

Este script de Node.js permite convertir colecciones exportadas desde **Thunder Client** al formato estándar **Postman Collection v2.1.0**, y puede usarse también para migrar flujos de trabajo hacia otros clientes API como Bruno.

---

## Características implementadas

**Migración precisa de estructura**: Recrea fielmente toda la jerarquía de carpetas, incluyendo subcarpetas anidadas a cualquier nivel. Detecta automáticamente la estructura mediante identificadores únicos (folderId, containerId, parentId) para garantizar que cada petición se ubique en su lugar correcto. Si la colección no utiliza identificadores, aplica un método de conversión alternativo para no perder ninguna petición.

**Extracción exhaustiva de peticiones**: Localiza automáticamente todas las peticiones estén donde estén en el archivo JSON. Rastrea ubicaciones comunes como raíz, carpetas, ítems o tests, pero también detecta arrays con nombres personalizados (ej. requests_carpeta_auth), sin depender de una estructura fija.

**Compatibilidad con Bruno**: Segmenta el Host (ej. ["api", "google", "com"]) y limpia rutas para que la importación en Bruno sea perfecta y sin errores de red.

**Manejo de URLs con variables**: Detecta el uso de {{variables}} en las URLs para evitar errores de parseo, manteniendo la URL original intacta.

**Autenticación automática**: Convierte y mapea esquemas de seguridad Bearer, Basic Auth y API Key.

**Soporte para archivos**: Detecta y convierte campos de tipo file en formularios multipart (formdata).

**Resaltado de JSON**: Indica a Postman y Bruno que el contenido del cuerpo es JSON, logrando que se muestre con colores e indentado al importar la colección.

**Manejo robusto de errores**: Valida la existencia del archivo y el formato JSON, mostrando mensajes claros y amigables. Elimina automáticamente la marca de orden de bytes (BOM) presente en archivos exportados desde Windows.

**Estadísticas detalladas**: Muestra el número total de peticiones y carpetas convertidas al finalizar el proceso.

## Limitaciones

**Autenticación OAuth 2.0, AWS Signature y Digest**: Este conversor no procesa estos tipos de autenticación. Si los utilizabas en Thunder Client, deberás configurarlos manualmente en Postman o Bruno tras la importación.

**Variables de entorno y colección**: Este conversor no importa los archivos de configuración de entornos (environments). Tampoco procesa las variables de colección. Si utilizabas variables en Thunder Client, deberás recrearlas manualmente en Postman o Bruno tras la importación.

**Scripts (pre-request y tests)**: Este conversor no procesa scripts de pruebas automáticas, ni los que se ejecutan antes de la petición (pre-request) ni los que se ejecutan después (tests). Si tu colección incluía este tipo de scripts, deberás recrearlos manualmente en Postman o Bruno tras la importación. Ten en cuenta que Thunder Client utiliza una API compatible con Postman, por lo que la migración suele ser sencilla.

## Requisitos

* **Node.js**: Versión 12 o superior.
* No requiere la instalación de librerías externas (utiliza módulos nativos de Node.js).

## Modo de uso

1. **Exportar**: Obtén el archivo JSON de tu colección desde Thunder Client.
2. **Convertir**: Abre una terminal en la carpeta donde se encuentra el script y ejecuta:

   ```bash
   node convertir-thunder-a-postman.js <archivo_thunder.json> <nombre_destino.json>
   ```

   Ejemplo:
   
   ```bash
   node convertir-thunder-a-postman.js prueba-thunder.json coleccion-postman.json
   ```

## Importación

**En Postman**: Usa el botón "Import" y selecciona el archivo generado.

**En Bruno**: Selecciona "Import Collection" -> "Postman Collection".

## Seguridad

**Valores sensibles en peticiones**: Si tus peticiones en Thunder Client contienen tokens, contraseñas o API keys directamente en headers, body o URL, estos valores se mantendrán en texto plano en el archivo JSON generado.

**Recomendaciones**:
- Antes de compartir o versionar el archivo generado, revisa que no contenga credenciales reales
- Considera usar variables de entorno en Postman/Bruno para valores sensibles
- Siempre excluye archivos con credenciales de repositorios públicos

## Licencia

Este script ha sido generado con la ayuda de IA. Se otorga total libertad para su copia, modificación y distribución según las necesidades del usuario.
