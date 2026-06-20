# Flujo de Bienvenida Automatico

> **Kepa Tecnologia** | Documentacion del escenario Make.com
> Trigger: nuevo registro (alguien se apunta)
> Acciones: WhatsApp + Email + Airtable + Tarea de seguimiento

---

## Resumen del Flujo

Cuando alguien se apunta (formulario web, landing de grupo, referido), se activa un flujo automatico completo que:

1. Envia WhatsApp de bienvenida inmediato (template aprobado)
2. Envia email de bienvenida con informacion inicial
3. Registra el contacto en Airtable con todos los datos
4. Crea una tarea de seguimiento automatica para 3 dias despues

**Tiempo total de ejecucion:** < 15 segundos desde que se apunta

---

## Diagrama del Flujo

```
┌──────────────────┐
│  TRIGGER:        │
│  Nuevo registro  │
│  (Webhook)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  1. PARSEAR      │
│  datos del       │
│  formulario      │
└────────┬─────────┘
         │
         ├────────────────────────────────────────┐
         │                                        │
         ▼                                        ▼
┌──────────────────┐                   ┌──────────────────┐
│  2A. WHATSAPP    │                   │  2B. EMAIL       │
│  Mensaje de      │                   │  Bienvenida +    │
│  bienvenida      │                   │  info inicial    │
│  (Twilio)        │                   │  (SMTP/Resend)   │
└────────┬─────────┘                   └────────┬─────────┘
         │                                        │
         └────────────────┬───────────────────────┘
                          │
                          ▼
               ┌──────────────────┐
               │  3. AIRTABLE     │
               │  Crear registro  │
               │  completo        │
               └────────┬─────────┘
                         │
                         ▼
               ┌──────────────────┐
               │  4. AIRTABLE     │
               │  Crear tarea     │
               │  seguimiento     │
               │  (fecha +3 dias) │
               └────────┬─────────┘
                         │
                         ▼
               ┌──────────────────┐
               │  FIN             │
               │  Lead en sistema │
               │  con seguimiento │
               │  programado      │
               └──────────────────┘
```

---

## Modulos Detallados

### Modulo 0: Webhook (Trigger)

**Tipo:** Webhook personalizado de Make.com
**URL:** `https://hook.eu2.make.com/xxxxxxxxxxxxx` (configurar en formulario)

**Datos que recibe:**
```json
{
  "nombre": "Maria Garcia",
  "email": "maria@ejemplo.com",
  "telefono": "+34612345678",
  "empresa": "Mi Empresa SL",
  "mensaje": "Me interesa automatizar mi negocio",
  "origen": "landing-grupo",
  "fecha": "2026-06-15T10:30:00Z"
}
```

**Configuracion:**
- Metodo: POST
- Content-Type: application/json
- IP restriction: desactivada (recibe de cualquier formulario)

---

### Modulo 1: Parsear y Validar Datos

**Tipo:** Tools > Set Multiple Variables

**Variables configuradas:**
| Variable | Valor | Fallback |
|----------|-------|----------|
| nombre_limpio | `{{trim(1.nombre)}}` | "Nuevo contacto" |
| telefono_formato | `{{replace(1.telefono; " "; "")}}` | "" |
| email_valido | `{{1.email}}` | "" |
| tiene_whatsapp | `{{if(length(telefono_formato) > 8; true; false)}}` | false |
| fecha_seguimiento | `{{addDays(now; 3)}}` | - |

**Validaciones:**
- Si no hay telefono: se salta el modulo de WhatsApp
- Si no hay email: se salta el modulo de email
- Si no hay ni telefono ni email: registrar en Airtable con flag "datos_incompletos"

---

### Modulo 2A: WhatsApp de Bienvenida (Twilio)

**Tipo:** HTTP > Make a Request (a Twilio API)
**Condicion:** Solo se ejecuta si `tiene_whatsapp = true`

**Endpoint:**
```
POST https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json
```

**Parametros:**
| Campo | Valor |
|-------|-------|
| From | whatsapp:+34XXXXXXXXX (numero Twilio) |
| To | whatsapp:{{telefono_formato}} |
| ContentSid | HXXXXXXXXXXXXXXXXXXX (template aprobado) |
| ContentVariables | {"1": "{{nombre_limpio}}"} |

**Template de WhatsApp (pre-aprobado por Meta):**
```
Hola {{1}}! 👋

Gracias por apuntarte. Soy Kepa de Kepa Tecnologia.

En las proximas horas te envio toda la informacion por email. Si tienes alguna pregunta urgente, puedes responder aqui directamente.

Un saludo!
```

**Notas importantes:**
- El template debe estar aprobado por Meta/WhatsApp Business antes de usarlo
- No se pueden enviar mensajes de formato libre como primer contacto (solo templates)
- Si el template se rechaza, tener uno alternativo mas generico preparado
- Coste aproximado: 0.04 EUR por mensaje (plantilla de utilidad)

---

### Modulo 2B: Email de Bienvenida

**Tipo:** Email > Send an Email (o HTTP si se usa Resend/SendGrid)
**Condicion:** Solo se ejecuta si `email_valido` no esta vacio

**Configuracion:**
| Campo | Valor |
|-------|-------|
| De | kepa@kepatecnologia.com |
| Para | {{email_valido}} |
| Nombre remitente | Kepa - Kepa Tecnologia |
| Asunto | Bienvenido/a, {{nombre_limpio}} - Esto es lo que viene |
| Formato | HTML |

**Cuerpo del email:**
```html
<div style="font-family: 'DM Mono', monospace; background: #060606; color: #f3eee9; padding: 40px; max-width: 600px;">
  <img src="https://kepatecnologia.com/assets/kepa-logo.png" width="120" alt="Kepa Tecnologia">

  <h1 style="color: #ff6a14; font-family: Anton, sans-serif;">Bienvenido/a, {{nombre_limpio}}</h1>

  <p>Gracias por apuntarte. Has dado el primer paso para automatizar tu negocio.</p>

  <p><strong>Lo que va a pasar ahora:</strong></p>
  <ul>
    <li>En las proximas 24-48h te contacto personalmente para entender tu situacion</li>
    <li>Te envio una serie de emails con valor practico sobre automatizacion</li>
    <li>Si tienes una necesidad urgente, responde a este email directamente</li>
  </ul>

  <p><strong>Mientras tanto, puedes:</strong></p>
  <ul>
    <li><a href="https://kepatecnologia.com" style="color: #00d4ff;">Ver mi web</a></li>
    <li><a href="https://instagram.com/kepatecnologia" style="color: #00d4ff;">Seguirme en Instagram</a></li>
  </ul>

  <p>Un saludo desde Bilbao,<br>
  <strong style="color: #ff6a14;">Kepa</strong></p>

  <hr style="border-color: #333;">
  <small style="color: #666;">Kepa Tecnologia | Bilbao | kepatecnologia.com</small>
</div>
```

---

### Modulo 3: Registrar en Airtable

**Tipo:** Airtable > Create a Record

**Base:** Clientes
**Tabla:** Leads

**Campos mapeados:**
| Campo Airtable | Valor | Tipo |
|----------------|-------|------|
| Nombre | {{nombre_limpio}} | Single line text |
| Email | {{email_valido}} | Email |
| Telefono | {{telefono_formato}} | Phone |
| Empresa | {{1.empresa}} | Single line text |
| Origen | {{1.origen}} | Single select |
| Mensaje | {{1.mensaje}} | Long text |
| Estado | "Nuevo" | Single select |
| Clasificacion | "Pendiente de clasificar" | Single select |
| Fecha_registro | {{now}} | Date |
| WhatsApp_enviado | {{tiene_whatsapp}} | Checkbox |
| Email_enviado | {{if(email_valido != ""; true; false)}} | Checkbox |
| Fuente_formulario | "bienvenida" | Single line text |

---

### Modulo 4: Crear Tarea de Seguimiento

**Tipo:** Airtable > Create a Record

**Base:** Clientes
**Tabla:** Tareas

**Campos mapeados:**
| Campo Airtable | Valor | Tipo |
|----------------|-------|------|
| Titulo | "Seguimiento: {{nombre_limpio}}" | Single line text |
| Descripcion | "Contactar a {{nombre_limpio}} ({{1.empresa}}). Origen: {{1.origen}}. Verificar si recibio WhatsApp/email y si tiene preguntas." | Long text |
| Fecha_limite | {{fecha_seguimiento}} | Date |
| Estado | "Pendiente" | Single select |
| Prioridad | "Media" | Single select |
| Lead_vinculado | {{3.id}} (ID del registro creado en Modulo 3) | Linked record |
| Tipo | "Seguimiento automatico" | Single select |

---

## Manejo de Errores

### Error en WhatsApp (Twilio)
```
Si falla Modulo 2A:
  → Log del error en Airtable (campo "Notas_sistema")
  → Continuar con el resto del flujo (no bloquear)
  → Crear tarea manual: "WhatsApp falló - contactar manualmente a {nombre}"
```

### Error en Email
```
Si falla Modulo 2B:
  → Log del error
  → Continuar flujo
  → Marcar campo "Email_enviado" como false en Airtable
```

### Error en Airtable
```
Si falla Modulo 3 o 4:
  → Reintentar 1 vez (delay 30 seg)
  → Si sigue fallando: notificacion por email a kepa@kepatecnologia.com
  → Guardar datos en Data Store temporal de Make.com
```

### Webhook sin datos requeridos
```
Si faltan nombre Y email Y telefono:
  → No ejecutar el flujo
  → Log en historial como "webhook vacio"
  → No crear registro en Airtable
```

---

## Flujo de Seguimiento (Dia +3)

Escenario separado que se ejecuta diariamente:

```
┌──────────────────┐
│  TRIGGER:        │
│  Schedule        │
│  (cada dia 9:00) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Buscar tareas   │
│  con fecha_limite│
│  = HOY y estado  │
│  = "Pendiente"   │
└────────┬─────────┘
         │
         ▼ (por cada tarea)
┌──────────────────┐
│  Enviar          │
│  recordatorio    │
│  WhatsApp/Email  │
│  al lead         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Notificar a     │
│  Kepa por        │
│  WhatsApp:       │
│  "Hoy toca       │
│  seguimiento de  │
│  X leads"        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Marcar tarea    │
│  como "Enviado"  │
└──────────────────┘
```

**Mensaje de seguimiento al lead (template):**
```
Hola {{nombre}}! Soy Kepa de Kepa Tecnologia.

Te escribi hace unos dias. Solo queria saber si tuviste oportunidad de ver la informacion.

¿Tienes alguna duda? Estoy disponible para una llamada rapida de 10 minutos si te viene bien.

Un saludo!
```

---

## Metricas del Flujo

| Metrica | Objetivo | Como medir |
|---------|----------|------------|
| Tiempo de respuesta | < 15 seg | Log de Make.com (timestamp) |
| Tasa entrega WhatsApp | > 95% | Dashboard Twilio |
| Tasa apertura email bienvenida | > 60% | Metricas email provider |
| Registros completos Airtable | 100% | Filtro "datos_incompletos" |
| Tareas seguimiento creadas | 100% de leads | Airtable tabla Tareas |
| Seguimientos ejecutados a dia 3 | > 90% | Estado tarea != "Pendiente" tras dia 3 |

---

## Costes Estimados

| Herramienta | Coste/mes | Notas |
|-------------|-----------|-------|
| Make.com | 9 EUR | Plan Core (10.000 operaciones) |
| Twilio WhatsApp | ~2-5 EUR | 0.04 EUR/mensaje, ~50-100 mensajes |
| Email (Resend) | 0 EUR | Gratis hasta 3.000 emails/mes |
| Airtable | 0 EUR | Plan gratuito suficiente al inicio |
| **TOTAL** | **~11-14 EUR/mes** | Escalable segun volumen |
