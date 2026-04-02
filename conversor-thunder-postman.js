const fs = require('fs');
const path = require('path');
const { URL } = require('url');

/**
 * Script: Conversor Universal de Thunder Client a Postman Collection v2.1.0
 * Versión: 3.6
 * Autor: Javier Guerra & AI Assistant
 */

if (process.argv.length < 4) {
  console.error('Uso: node convertir-thunder-a-postman.js <thunder.json> <postman.json>');
  process.exit(1);
}

const thunderPath = process.argv[2];
const postmanPath = process.argv[3];

// Helper para asegurar que siempre trabajamos con arrays
function asegurarArray(v) {
  return Array.isArray(v) ? v : (v ? [v] : []);
}

// Función para extraer TODAS las peticiones de cualquier lugar del objeto
function extraerTodasLasPeticiones(obj, recorrido = false) {
  var peticiones = [];
  
  // Si es un array, recorrer cada elemento
  if (Array.isArray(obj)) {
    obj.forEach(function(item) {
      peticiones = peticiones.concat(extraerTodasLasPeticiones(item, true));
    });
    return peticiones;
  }
  
  // Si es un objeto, buscar propiedades que parezcan peticiones
  if (obj && typeof obj === 'object') {
    // Propiedades comunes donde suelen estar las peticiones
    var posiblesArrays = ['requests', 'items', 'tests', 'request'];
    
    posiblesArrays.forEach(function(prop) {
      if (obj[prop] && Array.isArray(obj[prop])) {
        obj[prop].forEach(function(item) {
          // Si el item tiene método o URL, es una petición
          if (item.method || item.url || (item.request && (item.request.method || item.request.url))) {
            peticiones.push(item);
          } else {
            // Si no, podría ser una carpeta con más peticiones
            peticiones = peticiones.concat(extraerTodasLasPeticiones(item, true));
          }
        });
      }
    });
    
    // Buscar propiedades que contengan "request" en el nombre
    for (var key in obj) {
      if (key.toLowerCase().includes('request') && Array.isArray(obj[key])) {
        obj[key].forEach(function(item) {
          if (item.method || item.url || (item.request && (item.request.method || item.request.url))) {
            peticiones.push(item);
          } else {
            peticiones = peticiones.concat(extraerTodasLasPeticiones(item, true));
          }
        });
      }
    }
    
    // Si estamos en modo recursivo, buscar también en las propiedades del objeto
    if (recorrido) {
      for (var key in obj) {
        if (obj[key] && typeof obj[key] === 'object' && key !== 'request' && !key.toLowerCase().includes('request')) {
          peticiones = peticiones.concat(extraerTodasLasPeticiones(obj[key], true));
        }
      }
    }
  }
  
  return peticiones;
}

// Función de mapeo de peticiones individuales
function convertirPeticion(tReq) {
  var reqName = tReq.name || (tReq.request && tReq.request.name) || 'Petición';
  var method = tReq.method || (tReq.request && tReq.request.method) || 'GET';
  var urlString = tReq.url || (tReq.request && tReq.request.url) || '';

  var req = {
    name: reqName,
    request: {
      method: method.toUpperCase(),
      header: [],
      body: undefined,
      url: { raw: urlString, host: [], path: [] }
    }
  };

  // URL segmentada y protección de variables
  try {
    // Solo intentamos desglosar si NO contiene variables {{...}} para evitar errores de parseo
    if (urlString && !urlString.includes('{{')) {
      var u = new URL(urlString);
      // Dividimos el host por puntos para compatibilidad total con Bruno/Postman
      req.request.url.host = u.hostname ? u.hostname.split('.') : [];
      // Limpiamos el path de elementos vacíos
      req.request.url.path = u.pathname ? u.pathname.split('/').filter(Boolean) : [];
      
      var q = [];
      u.searchParams.forEach(function(value, key) {
        q.push({ key: key, value: value });
      });
      if (q.length) req.request.url.query = q;
    }
  } catch (err) {
    // Si falla el parseo, se mantiene el campo 'raw' original
  }

  // Procesar headers
  var headers = asegurarArray(tReq.headers || (tReq.request && tReq.request.headers));
  headers.forEach(function(h) {
    var key = h.name || h.key || '';
    var value = (h.value === undefined) ? '' : h.value;
    if (key) req.request.header.push({ key: key, value: String(value), type: "text" });
  });

  // Procesar autenticación (Bearer, Basic y API Key)
  var auth = tReq.auth || (tReq.request && tReq.request.auth);
  if (auth) {
    if (auth.type === 'bearer' && auth.token) {
      req.request.header.push({ key: 'Authorization', value: 'Bearer ' + auth.token });
    } else if (auth.type === 'basic' && auth.username !== undefined) {
      var token = Buffer.from(auth.username + ':' + (auth.password || '')).toString('base64');
      req.request.header.push({ key: 'Authorization', value: 'Basic ' + token });
    } else if (auth.type === 'apikey') {
      var key = auth.key || 'X-API-Key';
      var value = auth.value || '';
      // Por defecto añadir a header, si addTo es 'query' añadir a query params
      if (auth.addTo === 'query') {
        req.request.url.query = req.request.url.query || [];
        req.request.url.query.push({ key: key, value: value });
      } else {
        req.request.header.push({ key: key, value: value });
      }
    }
  }

  // Procesar body (Con resaltado de sintaxis JSON y soporte para archivos)
  var body = tReq.body || (tReq.request && tReq.request.body);
  if (body) {
    var pmBody = {};
    var mode = body.mode || (body.raw ? 'raw' : (body.form ? 'formdata' : 'raw'));
    
    if (mode === 'raw') {
      pmBody.mode = 'raw';
      var raw = (body.raw !== undefined) ? body.raw : (typeof body === 'string' ? body : (body.text || ''));
      pmBody.raw = (typeof raw === 'object') ? JSON.stringify(raw, null, 2) : String(raw);
      
      // Activa el modo JSON en la interfaz de Postman/Bruno
      pmBody.options = { raw: { language: "json" } };
      
      var hasCT = req.request.header.some(h => h.key.toLowerCase() === 'content-type');
      if (!hasCT && (body.mimeType || body.mime)) {
        req.request.header.push({ key: 'Content-Type', value: body.mimeType || body.mime });
      }
    } else if (mode === 'formdata' || mode === 'urlencoded') {
      pmBody.mode = mode === 'formdata' ? 'formdata' : 'urlencoded';
      pmBody[pmBody.mode] = [];
      var parts = body.form || body[pmBody.mode] || [];
      
      asegurarArray(parts).forEach(function(p) {
        var field = { key: p.name || p.key };
        
        // Detectar si es un archivo (file upload)
        var isFile = false;
        
        // Caso 1: Thunder Client explícitamente marca el campo como tipo file
        if (p.type === 'file') {
          isFile = true;
        }
        // Caso 2: El valor es un objeto con propiedad path (estructura común en Thunder)
        else if (p.value && typeof p.value === 'object' && p.value.path) {
          isFile = true;
        }
        // Caso 3: El valor es una string que parece una ruta de archivo (comienza con @/ o contiene /)
        else if (typeof p.value === 'string' && (p.value.startsWith('@/') || p.value.startsWith('/') || p.value.includes(':\\'))) {
          isFile = true;
        }
        
        if (isFile) {
          field.type = 'file';
          // Extraer la ruta del archivo
          if (p.value && typeof p.value === 'object' && p.value.path) {
            field.src = p.value.path;
          } else if (typeof p.value === 'string') {
            field.src = p.value;
          } else {
            field.src = '';
          }
        } else {
          field.type = 'text';
          field.value = String(p.value || '');
        }
        
        pmBody[pmBody.mode].push(field);
      });
    }
    req.request.body = pmBody;
  }
  return req;
}

function convertirThunder(t) {
  var collName = t.collectionName || t.name || (t.collection && t.collection.name) || path.basename(thunderPath, '.json');
  
  // Extraer TODAS las peticiones de cualquier lugar del objeto
  var allRequests = extraerTodasLasPeticiones(t);
  
  // Extraer carpetas
  var allFolders = asegurarArray(t.collections || (t.collection && t.collection.folders) || []);
  
  // Detectar si tenemos estructura con IDs
  var hasIds = asegurarArray(allRequests).some(function(r) {
    return r.folderId !== undefined || r.containerId !== undefined;
  }) || asegurarArray(allFolders).some(function(f) {
    return f.parentId !== undefined || f._parentId !== undefined;
  });
  
  // Si NO hay IDs, usar fallback (método original)
  if (!hasIds) {
    var rootRequests = allRequests.filter(function(r) {
      return !r.folderId && !r.containerId;
    });
    
    var finalItems = rootRequests.map(convertirPeticion);
    
    // Procesar carpetas como grupos (si hay carpetas definidas)
    if (Array.isArray(t.collections) && t.collections.length) {
      t.collections.forEach(function(c) {
        if (c.requests && c.requests.length) {
          finalItems.push({
            name: c.name || 'Carpeta',
            item: asegurarArray(c.requests).map(convertirPeticion)
          });
        }
      });
    }
    
    return {
      info: {
        name: collName,
        _postman_id: t.collectionId || "",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: finalItems
    };
  }
  
  // ==============================================
  // MÉTODO PRINCIPAL: Recursivo con IDs
  // Soporta carpetas anidadas (subcarpetas)
  // ==============================================
  
  /**
   * Función recursiva para construir la estructura de Postman
   * @param {string|null} parentId - ID de la carpeta actual (null para raíz)
   */
  function construirNivel(parentId) {
    var items = [];
    
    // A. Agregar Subcarpetas: Buscamos carpetas cuyo parentId coincida
    var subFolders = allFolders.filter(function(f) {
      return (f.parentId || f._parentId || null) === parentId;
    });
    
    subFolders.forEach(function(f) {
      var folderId = f._id || f.id;
      var folderItem = {
        name: f.name || 'Carpeta',
        item: construirNivel(folderId) // Llamada recursiva
      };
      // Solo añadimos la carpeta si tiene contenido
      if (folderItem.item.length > 0) items.push(folderItem);
    });
    
    // B. Agregar Peticiones: Buscamos peticiones en este nivel
    var folderRequests = allRequests.filter(function(r) {
      var rParentId = r.folderId || r.containerId || null;
      return rParentId === parentId;
    });
    
    folderRequests.forEach(function(r) {
      items.push(convertirPeticion(r));
    });
    
    return items;
  }
  
  // Iniciar la recursión desde la raíz (null)
  var finalItems = construirNivel(null);
  
  return {
    info: {
      name: collName,
      _postman_id: t.collectionId || "",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: finalItems
  };
}

// Bloque principal de ejecución
try {
  // 1. Validar existencia del archivo
  if (!fs.existsSync(thunderPath)) {
    console.error('\x1b[31m%s\x1b[0m', `❌ El archivo de entrada no existe: ${thunderPath}`);
    process.exit(1);
  }
  
  // 2. Leer el archivo como string con codificación utf8
  const contenidoCrudo = fs.readFileSync(thunderPath, 'utf8');
  
  // 3. Limpiar el BOM (Byte Order Mark) si existe
  // El regex /^\uFEFF/ busca el carácter específico solo al inicio del string
  const contenidoLimpio = contenidoCrudo.replace(/^\uFEFF/, '');
  
  // 4. Parsear el contenido ya saneado
  let tObj;
  try {
    tObj = JSON.parse(contenidoLimpio);
  } catch (parseErr) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Error: El archivo no es un JSON válido o está corrupto.');
    console.error('\x1b[33m%s\x1b[0m', `   Detalle: ${parseErr.message}`);
    process.exit(1);
  }
  
  // 5. Proceder con la conversión
  const postman = convertirThunder(tObj);
  
  // 6. Guardar el archivo de salida
  fs.writeFileSync(postmanPath, JSON.stringify(postman, null, 2), 'utf8');
  
  // 7. Calcular estadísticas
  let totalRequests = 0;
  let totalFolders = 0;
  
  function contarItems(items) {
    items.forEach(function(item) {
      if (item.item) {
        totalFolders++;
        contarItems(item.item);
      } else {
        totalRequests++;
      }
    });
  }
  
  contarItems(postman.item);
  
  // 8. Mostrar resultados
  console.log('\x1b[32m%s\x1b[0m', '✅ Conversión completada con éxito.');
  console.log('🚀 Fichero generado:', postmanPath);
  console.log(`📊 Peticiones: ${totalRequests} | Carpetas: ${totalFolders}`);
  
} catch (err) {
  console.error('\x1b[31m%s\x1b[0m', '❌ Error inesperado durante la conversión:', err.message);
}
