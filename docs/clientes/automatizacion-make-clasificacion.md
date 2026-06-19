# Automatizacion Make.com - Clasificacion de Clientes con IA

## Resumen

Este documento describe el flujo de automatizacion principal que se utiliza como **columna vertebral tecnica** en las tres fases del negocio. El sistema clasifica clientes automaticamente usando inteligencia artificial.

**Flujo principal:** Airtable (datos de entrada) -> Claude API (clasificacion por IA) -> Airtable (resultado clasificado)

---

## Diagrama del Flujo

```
┌──────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐
│                  │        │                      │        │                      │
│   AIRTABLE       │        │     CLAUDE API       │        │     AIRTABLE         │
│   (Entrada)      │───────>│     (Procesamiento)  │───────>│     (Resultado)      │
│                  │        │                      │        │                      │
│  - Nombre        │        │  - Analiza datos     │        │  - Clasificacion     │
│  - Email         │        │  - Clasifica cliente │        │  - Puntuacion        │
│  - Telefono      │        │  - Asigna prioridad  │        │  - Accion siguiente  │
│  - Origen        │        │  - Sugiere accion    │        │  - Fecha proceso     │
│  - Mensaje       │        │                      │        │  - Notas IA          │
│                  │        │                      │        │                      │
└──────────────────┘        └──────────────────────┘        └──────────────────────┘
       │                            │                              │
       │                            │                              │
   TRIGGER:                    MODULO:                        ACCION:
   Nuevo registro              HTTP Request a                 Actualizar registro
   en Airtable                 Claude API                     en Airtable
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

### Modulo 2: HTTP Request (Claude API)
- **Tipo:** Accion
- **Funcion:** Envia los datos del cliente a Claude para clasificacion
- **Configuracion:**
  - URL: `https://api.anthropic.com/v1/messages`
  - Metodo: POST
  - Headers:
    - `x-api-key`: [API Key de Anthropic]
    - `anthropic-version`: 2023-06-01
    - `content-type`: application/json
  - Body: Prompt con datos del cliente para clasificar

### Modulo 3: JSON Parse
- **Tipo:** Transformacion
- **Funcion:** Parsear la respuesta de Claude API
- **Configuracion:**
  - Input: Respuesta del modulo HTTP
  - Output: Objeto JSON con clasificacion, puntuacion y accion sugerida

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

Datos del lead:
- Nombre: {{nombre}}
- Email: {{email}}
- Empresa: {{empresa}}
- Origen: {{origen}}
- Mensaje: {{mensaje}}
- Ubicacion: {{ubicacion}}

Responde SOLO en formato JSON con esta estructura:
{
  "clasificacion": "Caliente|Tibio|Frio",
  "puntuacion": 1-10,
  "accion_siguiente": "Llamar|Email|WhatsApp|Descartar",
  "prioridad": "Alta|Media|Baja",
  "notas": "explicacion breve de tu clasificacion",
  "sector": "sector identificado"
}

Criterios:
- Caliente (7-10): Menciona necesidad especifica, tiene empresa, pregunta por precios
- Tibio (4-6): Muestra interes general, pide informacion, no es urgente
- Frio (1-3): Mensaje generico, no hay empresa clara, posible spam
```

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

1. **Crear la base en Airtable** con los campos de entrada y salida
2. **Crear escenario en Make.com** con los 4 modulos
3. **Configurar el trigger** de Airtable (nuevos registros)
4. **Configurar la peticion HTTP** a Claude API con el prompt
5. **Mapear la respuesta** JSON a los campos de Airtable
6. **Activar el escenario** y probar con un registro de prueba
7. **Verificar** que la clasificacion se guarda correctamente

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
| 401 Unauthorized | API key invalida | Verificar key en configuracion HTTP |
| 429 Rate Limit | Demasiadas peticiones | Anadir delay entre ejecuciones |
| JSON Parse Error | Respuesta no es JSON valido | Ajustar prompt para forzar formato |
| Campo vacio en Airtable | Mapeo incorrecto | Revisar mapeo de campos en Make.com |
