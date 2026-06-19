# Automatizacion Make.com - Clasificacion de Clientes con IA

## Resumen

Este documento describe el flujo de automatizacion principal que se utiliza como **columna vertebral tecnica** en las tres fases del negocio. El sistema clasifica clientes automaticamente usando inteligencia artificial.

**Flujo principal:** Airtable (datos de entrada) -> Claude API (clasificacion por IA) -> Airtable (resultado clasificado)

---

## Diagrama del Flujo

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│                  │     │                  │     │                      │     │                      │     │                      │
│   AIRTABLE       │     │  VALIDACION      │     │     CLAUDE API       │     │   ERROR HANDLER      │     │     AIRTABLE         │
│   (Entrada)      │────>│  (Filtro)        │────>│     (Procesamiento)  │────>│   (Si JSON invalido) │────>│     (Resultado)      │
│                  │     │                  │     │                      │     │                      │     │                      │
│  - Nombre        │     │  Nombre vacio?   │     │  - Analiza datos     │     │  - Reintenta 1 vez   │     │  - Clasificacion     │
│  - Email         │     │  Email vacio?    │     │  - Clasifica cliente │     │  - Si falla: marca   │     │  - Puntuacion        │
│  - Telefono      │     │                  │     │  - Asigna prioridad  │     │    como "Error IA"   │     │  - Accion siguiente  │
│  - Origen        │     │  SI -> marcar    │     │  - Sugiere accion    │     │                      │     │  - Fecha proceso     │
│  - Mensaje       │     │  "Datos insuf."  │     │                      │     │                      │     │  - Notas IA          │
│                  │     │                  │     │                      │     │                      │     │                      │
└──────────────────┘     └──────────────────┘     └──────────────────────┘     └──────────────────────┘     └──────────────────────┘
       │                         │                        │                            │                            │
       │                         │                        │                            │                            │
   TRIGGER:                  MODULO 1b:              MODULO 2+3:                  MODULO 3b:                   MODULO 4:
   Nuevo registro            Router/Filter           HTTP Request +               Error Handler              Actualizar registro
   en Airtable               (validacion)            JSON Parse                   (fallback)                 en Airtable
```

---

## Modulos del Escenario Make.com

### Modulo 1: Watch Records (Airtable)
- **Tipo:** Trigger
- **Funcion:** Detecta nuevos registros en la tabla de leads/clientes
- **Configuracion:**
  - Base: Base de clientes
  - Tabla: Leads entrantes
  - Vista: "Sin clasificar"
  - Frecuencia: Cada 5 minutos

### Modulo 1b: Validacion de Datos (Router/Filter)
- **Tipo:** Router con filtro condicional
- **Funcion:** Verifica que el lead tenga los datos minimos antes de llamar a la API
- **Configuracion:**
  - **Ruta 1 (Datos suficientes):** Si `Nombre` NO esta vacio Y `Email` NO esta vacio, continua al Modulo 2
  - **Ruta 2 (Datos insuficientes):** Si falta Nombre o Email, actualiza el registro con Clasificacion = "Datos insuficientes" y Prioridad = "Baja", sin consumir llamada a la API
- **Por que:** Evita gastar llamadas API en leads sin datos minimos y previene que Claude genere clasificaciones impredecibles con campos vacios

### Modulo 2: HTTP Request (Claude API)
- **Tipo:** Accion
- **Funcion:** Envia los datos del cliente a Claude para clasificacion
- **Configuracion:**
  - URL: `https://api.anthropic.com/v1/messages`
  - Metodo: POST
  - Headers:
    - `x-api-key`: (ver nota de seguridad abajo)
    - `anthropic-version`: 2023-06-01
    - `content-type`: application/json
  - Body: Prompt con datos del cliente para clasificar

> **IMPORTANTE - Seguridad de la API Key:**
> La API key de Anthropic NUNCA debe escribirse directamente en el cuerpo del modulo HTTP.
> En Make.com, configurarla como:
> - **Opcion recomendada:** Crear una Connection personalizada de tipo "API Key Auth"
> - **Alternativa:** Almacenarla en Variables del Escenario (Scenario > Variables)
> 
> Esto es critico porque: (1) si compartes el escenario con partners en Fase 2, no expondras tu key,
> (2) si necesitas rotar la key, solo la cambias en un sitio, (3) las keys en texto plano
> aparecen en logs y exports del escenario.

### Modulo 3: JSON Parse
- **Tipo:** Transformacion
- **Funcion:** Parsear la respuesta de Claude API
- **Configuracion:**
  - Input: Respuesta del modulo HTTP
  - Output: Objeto JSON con clasificacion, puntuacion y accion sugerida

### Modulo 3b: Error Handler (Router de Errores)
- **Tipo:** Error Handler / Router
- **Funcion:** Gestionar respuestas invalidas de Claude (cuando no devuelve JSON valido)
- **Configuracion:**
  - **Ruta 1 (JSON valido):** Continua al Modulo 4 (actualizar Airtable)
  - **Ruta 2 (JSON invalido o error):**
    1. Actualizar el registro en Airtable con:
       - Clasificacion = "Error IA"
       - Notas_IA = "Respuesta no procesable. Reintentar manualmente."
       - Prioridad = "Media"
    2. (Opcional) Reintentar la llamada 1 vez con un delay de 5 segundos
    3. Si el segundo intento falla, dejar como "Error IA"
- **Como configurarlo en Make.com:**
  - Click derecho en el modulo JSON Parse > Add Error Handler
  - Anadir un modulo "Router" en el error handler
  - Ruta A: Resume (reintentar 1 vez)
  - Ruta B: Update Record en Airtable marcando como error
- **Por que:** Claude puede devolver texto extra antes del JSON, o formatos inesperados cuando se satura. Sin este handler, el escenario entero se detiene y pierdes leads sin clasificar.

### Modulo 4: Update Record (Airtable)
- **Tipo:** Accion
- **Funcion:** Actualiza el registro original con la clasificacion de la IA
- **Configuracion:**
  - Base: Base de clientes
  - Tabla: Leads entrantes
  - Record ID: ID del registro del Modulo 1
  - Campos a actualizar: Clasificacion, Puntuacion, Accion siguiente, Notas IA

---

## Mapeo de Campos

### Campos de Entrada (Airtable -> Claude)

| Campo Airtable | Descripcion | Uso en el Prompt |
|---|---|---|
| Nombre | Nombre del lead | Contexto de personalizacion |
| Email | Correo electronico | Identificar tipo de empresa |
| Telefono | Numero de contacto | Verificar si es empresa o particular |
| Origen | De donde vino el lead | Determinar calidad del canal |
| Mensaje | Texto libre del lead | Analisis principal de intencion |
| Empresa | Nombre de la empresa | Clasificar por sector/tamano |
| Ubicacion | Ciudad/Region | Relevancia geografica |

### Campos de Salida (Claude -> Airtable)

| Campo | Valores Posibles | Descripcion |
|---|---|---|
| Clasificacion | Caliente / Tibio / Frio | Nivel de interes del lead |
| Puntuacion | 1-10 | Score numerico de calidad |
| Accion_siguiente | Llamar / Email / WhatsApp / Descartar | Proxima accion recomendada |
| Prioridad | Alta / Media / Baja | Urgencia de seguimiento |
| Notas_IA | Texto libre | Explicacion de la clasificacion |
| Sector | Tecnologia / Comercio / Servicios / Otro | Sector de la empresa |

---

## Prompt de Clasificacion

```
Eres un asistente de ventas experto. Analiza los siguientes datos de un lead 
y clasifícalo segun su probabilidad de conversion.

IMPORTANTE:
- Responde SIEMPRE en espanol.
- Si algun campo esta vacio o no tiene informacion, indicalo en las notas 
  y clasifica con Puntuacion maxima de 4.
- No inventes datos que no estan presentes.
- Si el campo "mensaje" esta vacio, basate en los demas campos disponibles.

Datos del lead:
- Nombre: {{nombre}}
- Email: {{email}}
- Empresa: {{empresa}}
- Origen: {{origen}}
- Mensaje: {{mensaje}}
- Ubicacion: {{ubicacion}}

Responde UNICAMENTE con un objeto JSON valido (sin texto antes ni despues) 
con esta estructura exacta:
{
  "clasificacion": "Caliente|Tibio|Frio",
  "puntuacion": 1-10,
  "accion_siguiente": "Llamar|Email|WhatsApp|Descartar",
  "prioridad": "Alta|Media|Baja",
  "notas": "explicacion breve de tu clasificacion",
  "sector": "sector identificado",
  "datos_faltantes": ["lista de campos que estaban vacios"]
}

Criterios:
- Caliente (7-10): Menciona necesidad especifica, tiene empresa, pregunta por precios
- Tibio (4-6): Muestra interes general, pide informacion, no es urgente
- Frio (1-3): Mensaje generico, no hay empresa clara, posible spam
- Datos insuficientes: Si faltan Nombre o Email, max puntuacion 4 (independientemente del resto)
```

> **Nota sobre el campo `datos_faltantes`:** Este campo permite que el Modulo 4 
> (Update Record) escriba en Airtable que campos faltaban, facilitando la limpieza 
> posterior de la base de datos y el contacto manual para completar informacion.

---

## Uso en las 3 Fases

### Fase 1 - Venta para Auvesta
- Clasifica leads interesados en productos de Auvesta
- Prioriza a los que tienen mayor probabilidad de compra
- Automatiza el seguimiento segun la clasificacion

### Fase 2 - Servicios a Partners
- Clasifica partners potenciales que necesitan servicios
- Identifica cuales tienen mas probabilidad de contratar
- Segmenta por tipo de servicio que necesitan

### Fase 3 - Negocio Propio
- Clasifica leads que llegan a kepatecnologia.com
- Prioriza clientes potenciales para servicios de automatizacion
- Automatiza el primer contacto segun la clasificacion

---

## Configuracion Paso a Paso

1. **Crear la base en Airtable** con los campos de entrada y salida (incluir campo "datos_faltantes")
2. **Crear escenario en Make.com** con los modulos descritos
3. **Configurar la API key** como Connection en Make.com (nunca en texto plano en el modulo)
4. **Configurar el trigger** de Airtable (nuevos registros en vista "Sin clasificar")
5. **Anadir el Router de validacion (Modulo 1b)** con filtro para Nombre y Email no vacios
6. **Configurar la peticion HTTP** a Claude API con el prompt mejorado
7. **Anadir Error Handler al JSON Parse (Modulo 3b)** con reintento y marcado de errores
8. **Mapear la respuesta** JSON a los campos de Airtable (incluir datos_faltantes)
9. **Anadir checkbox de consentimiento** al formulario de captacion (RGPD)
10. **Activar el escenario** y probar con registros de prueba (uno completo, uno con campos vacios, uno que fuerce error)
11. **Verificar** que la clasificacion, el filtro de datos insuficientes, y el error handler funcionan correctamente

---

## Costes Estimados

| Servicio | Plan | Coste Mensual |
|---|---|---|
| Make.com | Core (10.000 ops) | 9 EUR/mes |
| Airtable | Free (1.200 registros) | 0 EUR/mes |
| Claude API | Pay as you go | ~5-15 EUR/mes (segun volumen) |
| **Total estimado** | | **14-24 EUR/mes** |

---

## Errores Comunes y Soluciones

| Error | Causa | Solucion |
|---|---|---|
| 401 Unauthorized | API key invalida o mal configurada | Verificar key en la Connection de Make.com (no en el modulo) |
| 429 Rate Limit | Demasiadas peticiones | Anadir delay entre ejecuciones (modulo Sleep de 2s) |
| JSON Parse Error | Respuesta de Claude no es JSON valido | El Error Handler (Modulo 3b) reintenta o marca como "Error IA" |
| Campo vacio en Airtable | Mapeo incorrecto | Revisar mapeo de campos en Make.com |
| Respuesta con texto extra | Claude anade explicacion fuera del JSON | El prompt ya indica "UNICAMENTE JSON". Si persiste, usar regex para extraer el JSON del texto |
| Timeout de la API | Claude tarda mas de 30s | Aumentar timeout del modulo HTTP a 60s |
| Lead sin datos minimos | Formulario incompleto | El Modulo 1b filtra estos antes de llamar a la API |

---

## Nota sobre Proteccion de Datos (RGPD)

Este flujo procesa datos personales (nombre, email, telefono, ubicacion) de personas residentes en la UE. Operando desde Bilbao/Espana, es necesario:

1. **Base legal:** Definir la base legal para el tratamiento (legitimo interes comercial o consentimiento explicito)
2. **Informacion al lead:** El formulario de captacion debe incluir un aviso de que los datos se procesaran con IA para mejorar la atencion comercial
3. **Retencion:** Definir periodo maximo de conservacion en Airtable (recomendado: 12 meses sin actividad = borrar o anonimizar)
4. **DPA con Anthropic:** Verificar que el Data Processing Agreement de Anthropic cubre el procesamiento de datos de residentes de la UE (disponible en su web)
5. **Derecho de acceso/borrado:** Documentar proceso para atender solicitudes de acceso, rectificacion y supresion de datos

> **Accion minima:** Anadir al formulario de captacion un checkbox de consentimiento con texto tipo:
> "Acepto que mis datos sean procesados con herramientas de inteligencia artificial para recibir una atencion comercial personalizada."
