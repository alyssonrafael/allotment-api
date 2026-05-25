# API Reference — Allotment Manager

**Base URL:** `http://localhost:3333/api/v1`
**Content-Type:** `application/json`

---

## Tipos Compartilhados

```typescript
type UUID = string;    // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
type ISODate = string; // ISO 8601: "2025-09-15T00:00:00.000Z"

type AllotmentStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED";
type EventType       = "FEIRA" | "CONGRESSO" | "EXPO" | "CORPORATE";
type EventStatus     = "upcoming" | "active" | "finished"; // DERIVADO — nunca enviado, só recebido
type ActivityType    = "CREATED" | "UPDATED" | "DELETED" | "SOLD" | "RESERVED" | "BLOCKED" | "AVAILABLE";

// Formato padrão de erro
interface ApiError {
  statusCode: number;
  message: string;
  detail: string | string[]; // array quando erro de validação de campos
}

interface RecentActivity {
  id: UUID;
  action: string;        // descrição legível: "Lote A01 foi reservado"
  type: ActivityType;    // use para selecionar o ícone no feed
  createdAt: ISODate;
}

interface EventRevenue {
  realized: number;       // soma dos lotes SOLD
  inNegotiation: number;  // soma dos lotes RESERVED
  total: number;          // realized + inNegotiation
  counts: {
    sold: number;
    reserved: number;
    available: number;
    blocked: number;
  };
}
```

### EventStatus — como é computado

O campo `status` **não é armazenado no banco**. O backend calcula na hora da resposta:

| Condição | status |
|----------|--------|
| `now > endDate` (final do dia) | `"finished"` |
| `now >= startDate` | `"active"` |
| `now < startDate` | `"upcoming"` |

---

## Hierarquia de domínio

```
Venue (Pavilhão)
  └── Event (Evento)          ← venueId obrigatório; type obrigatório; status derivado
        └── Allotment (Stand) ← eventId obrigatório; posição validada contra o canvas
```

---

## Venues — `/venues`

### Tipos

```typescript
interface Venue {
  id: UUID;
  name: string;
  description: string | null;
  width: number;        // largura do pavilhão em metros
  height: number;       // profundidade do pavilhão em metros
  // Endereço
  city: string;
  state: string;        // sigla UF — 2 chars: "SP"
  street: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  // Visual
  accent: string;       // CSS color token: "var(--primary)"
  photo: string;        // CSS gradient: "linear-gradient(135deg, ...)"
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface VenueListItem extends Venue {
  _count: { events: number };
}

interface VenueWithEvents extends Venue {
  events: Array<{
    id: UUID;
    name: string;
    startDate: ISODate;
    endDate: ISODate;
  }>;
}

interface CreateVenueBody {
  name: string;         // mín. 3 chars
  description?: string;
  width: number;        // mín. 1
  height: number;       // mín. 1
  city: string;         // mín. 2 chars
  state: string;        // exatamente 2 chars (ex: "SP")
  street?: string;
  neighborhood?: string;
  zipCode?: string;
  accent: string;       // CSS color token
  photo: string;        // CSS gradient string
}

type UpdateVenueBody = Partial<CreateVenueBody>;
```

### Capas visuais predefinidas

```typescript
export const VENUE_PHOTOS = [
  { id: 'blue',   accent: 'var(--primary)', photo: 'linear-gradient(135deg, #2563eb 0%, #6366f1 60%, #8b5cf6 100%)' },
  { id: 'orange', accent: 'var(--accent)',  photo: 'linear-gradient(135deg, #f97316 0%, #ea580c 60%, #c2410c 100%)' },
  { id: 'violet', accent: 'var(--violet)',  photo: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 60%, #ec4899 100%)' },
  { id: 'green',  accent: 'var(--green)',   photo: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)' },
] as const;
```

---

### `POST /venues`

**Body:** `CreateVenueBody`

```json
{
  "name": "Pavilhão Norte",
  "description": "Pavilhão principal — Ala Norte",
  "width": 100,
  "height": 60,
  "city": "São Paulo",
  "state": "SP",
  "street": "Av. Olavo Fontoura, 1209",
  "neighborhood": "Santana",
  "zipCode": "02012-021",
  "accent": "var(--primary)",
  "photo": "linear-gradient(135deg, #2563eb 0%, #6366f1 60%, #8b5cf6 100%)"
}
```

**Resposta `201`:** `Venue`

**Erros:**

| Status | Quando |
|--------|--------|
| `400` | `name` < 3 chars, `state` ≠ 2 chars, `width`/`height` < 1, `city` ausente, `accent`/`photo` ausentes |

---

### `GET /venues`

**Resposta `200`:** `VenueListItem[]`

---

### `GET /venues/:id`

**Resposta `200`:** `VenueWithEvents`

**Erros:** `404` Venue não encontrado

---

### `PUT /venues/:id`

**Body:** `UpdateVenueBody` (todos os campos opcionais)

**Resposta `200`:** `Venue`

**Erros:** `400` campo inválido · `404` não encontrado

---

### `GET /venues/:id/revenue`

Receita do pavilhão **agregada de todos os seus eventos**, separada por status dos lotes.

**Resposta `200`:** `EventRevenue`

```json
{
  "realized": 15000,
  "inNegotiation": 8500,
  "total": 23500,
  "counts": { "sold": 5, "reserved": 3, "available": 10, "blocked": 2 }
}
```

**Erros:** `404`

---

### `DELETE /venues/:id`

Falha com `409` se o pavilhão tiver eventos vinculados — remova os eventos primeiro.

**Resposta `204`:** sem body

**Erros:** `404` não encontrado · `409` possui eventos vinculados

---

## Events — `/events`

### Tipos

```typescript
interface Event {
  id: UUID;
  name: string;
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;
  status: EventStatus;  // campo computado — NÃO enviado no body
  venueId: UUID;
  canvasWidth: number;  // snapshot da largura do pavilhão
  canvasHeight: number; // snapshot da altura do pavilhão
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface EventListItem extends Event {
  venue: { id: UUID; name: string };
  _count: { allotments: number };
}

interface EventDetail extends Event {
  venue: { id: UUID; name: string; width: number; height: number };
  allotments: Allotment[];
}

interface CreateEventBody {
  name: string;         // mín. 3 chars
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;     // deve ser >= startDate
  venueId: UUID;
  canvasWidth?: number;  // padrão: venue.width
  canvasHeight?: number; // padrão: venue.height
}

// venueId NÃO pode ser alterado após criação
interface UpdateEventBody {
  name?: string;
  type?: EventType;
  startDate?: ISODate;
  endDate?: ISODate;
  canvasWidth?: number;
  canvasHeight?: number;
}
```

### Tipos de evento e suas cores

```typescript
export const EVENT_TYPES = [
  { id: 'FEIRA',     label: 'Feira',       color: 'var(--primary)' },
  { id: 'CONGRESSO', label: 'Congresso',   color: 'var(--violet)'  },
  { id: 'EXPO',      label: 'Exposição',   color: 'var(--accent)'  },
  { id: 'CORPORATE', label: 'Corporativo', color: 'var(--green)'   },
] as const;
```

---

### `POST /events`

O backend preenche `canvasWidth`/`canvasHeight` automaticamente a partir do venue se não forem enviados.
O campo `status` é retornado mas **nunca** deve ser enviado.

**Body:** `CreateEventBody`

```json
{
  "name": "Expo Tech 2025",
  "type": "FEIRA",
  "startDate": "2025-09-11T00:00:00.000Z",
  "endDate": "2025-09-14T00:00:00.000Z",
  "venueId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Resposta `201`:** `Event & { venue: { id: UUID; name: string } }`

```json
{
  "id": "e1f2g3h4-e5f6-7890-abcd-ef1234567890",
  "name": "Expo Tech 2025",
  "type": "FEIRA",
  "startDate": "2025-09-11T00:00:00.000Z",
  "endDate": "2025-09-14T00:00:00.000Z",
  "status": "upcoming",
  "venueId": "a1b2c3d4-...",
  "canvasWidth": 100,
  "canvasHeight": 60,
  "venue": { "id": "a1b2c3d4-...", "name": "Pavilhão Norte" },
  "createdAt": "2025-05-23T12:00:00.000Z",
  "updatedAt": "2025-05-23T12:00:00.000Z"
}
```

**Erros:**

| Status | Quando |
|--------|--------|
| `400` | Campo inválido ou `endDate < startDate` |
| `404` | Venue não encontrado |

---

### `GET /events`

**Query params (todos opcionais):**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `venueId` | `UUID` | Filtra pelo pavilhão |
| `type` | `EventType` | Filtra por tipo (`FEIRA`, `CONGRESSO`, `EXPO`, `CORPORATE`) |
| `status` | `EventStatus` | Filtra por status computado (`upcoming`, `active`, `finished`) |

> `?status=` é filtrado em memória após o banco (o status não é armazenado).

**Resposta `200`:** `EventListItem[]`

---

### `GET /events/:id`

**Resposta `200`:** `EventDetail`

```json
{
  "id": "e1f2g3h4-...",
  "name": "Expo Tech 2025",
  "type": "FEIRA",
  "startDate": "2025-09-11T00:00:00.000Z",
  "endDate": "2025-09-14T00:00:00.000Z",
  "status": "upcoming",
  "canvasWidth": 100,
  "canvasHeight": 60,
  "venue": { "id": "a1b2c3d4-...", "name": "Pavilhão Norte", "width": 100, "height": 60 },
  "allotments": [ ... ],
  "createdAt": "2025-05-23T12:00:00.000Z",
  "updatedAt": "2025-05-23T12:00:00.000Z"
}
```

**Erros:** `404` Evento não encontrado

---

### `PUT /events/:id`

`venueId` **não** pode ser alterado. Use `canvasWidth`/`canvasHeight` para área parcial do pavilhão.

**Body:** `UpdateEventBody`

**Resposta `200`:** `Event`

**Erros:** `400` campo inválido ou `endDate < startDate` · `404` não encontrado

---

### `DELETE /events/:id`

Os allotments são **removidos em cascata** automaticamente.

**Resposta `204`:** sem body

**Erros:** `404` não encontrado

---

### `GET /events/:id/revenue`

Receita do evento separada por status dos lotes.

**Resposta `200`:** `EventRevenue`

```json
{
  "realized": 15000,
  "inNegotiation": 8500,
  "total": 23500,
  "counts": { "sold": 5, "reserved": 3, "available": 10, "blocked": 2 }
}
```

**Erros:** `404`

---

### `GET /events/:id/activities`

Feed de atividades do evento nas **últimas 24 horas**, da mais recente à mais antiga.

**Resposta `200`:** `RecentActivity[]`

```json
[
  { "id": "uuid", "action": "Lote A01 passou para RESERVED", "type": "RESERVED", "createdAt": "2026-05-25T14:32:00.000Z" },
  { "id": "uuid", "action": "Lote B03 foi criado",           "type": "CREATED",  "createdAt": "2026-05-25T13:10:00.000Z" }
]
```

**Erros:** `404`

#### Mapeamento de ícones sugerido

```typescript
export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  CREATED:   'PlusCircle',    // verde
  UPDATED:   'Pencil',        // azul
  DELETED:   'Trash2',        // vermelho
  SOLD:      'BadgeDollarSign', // verde escuro
  RESERVED:  'Handshake',     // âmbar
  BLOCKED:   'Ban',           // cinza
  AVAILABLE: 'CheckCircle',   // verde claro
};
```

---

## Allotments — `/events/:eventId/allotments` e `/allotments/:id`

### Tipos

```typescript
interface Allotment {
  id: UUID;
  name: string;
  code: string;    // único por evento
  x: number;       // posição X em metros (origem: canto sup. esquerdo)
  y: number;       // posição Y em metros
  width: number;   // mín. 1
  height: number;  // mín. 1
  status: AllotmentStatus;
  price: number;   // mín. 0
  eventId: UUID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface CreateAllotmentBody {
  name: string;
  code: string;              // único dentro do evento
  x: number;                 // mín. 0
  y: number;                 // mín. 0
  width: number;             // mín. 1
  height: number;            // mín. 1
  status?: AllotmentStatus;  // padrão: "AVAILABLE"
  price: number;             // mín. 0
}

interface UpdateAllotmentBody {  // code NÃO pode ser alterado
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  status?: AllotmentStatus;
  price?: number;
}

interface UpdateAllotmentPositionBody { x: number; y: number; }
interface UpdateAllotmentStatusBody   { status: AllotmentStatus; }
```

### Regras de posicionamento

```
x >= 0  e  y >= 0
x + width  <= event.canvasWidth
y + height <= event.canvasHeight
Nenhum stand pode sobrepor outro (AABB)
```

---

### `POST /events/:eventId/allotments`

**Body:** `CreateAllotmentBody` · **Resposta `201`:** `Allotment`

**Erros:** `400` campos inválidos · `404` evento não encontrado · `409` código duplicado / fora dos limites / sobreposição

---

### `GET /events/:eventId/allotments`

**Resposta `200`:** `Allotment[]`

---

### `GET /allotments/:id`

**Resposta `200`:** `Allotment` · **Erros:** `404`

---

### `PUT /allotments/:id`

Revalida posição, dimensões e colisão. `code` não pode ser alterado.

**Body:** `UpdateAllotmentBody` · **Resposta `200`:** `Allotment`

**Erros:** `400` · `404` · `409` colisão ou limites excedidos

---

### `PATCH /allotments/:id/position`

Leve — só atualiza `x` e `y`. Ideal para drag & drop.

**Body:** `UpdateAllotmentPositionBody`

```json
{ "x": 10, "y": 5 }
```

**Resposta `200`:** `Allotment` · **Erros:** `400` · `404` · `409`

---

### `PATCH /allotments/:id/status`

Não revalida posição nem colisão.

**Body:** `UpdateAllotmentStatusBody`

```json
{ "status": "SOLD" }
```

**Valores aceitos:** `"AVAILABLE"` `"RESERVED"` `"SOLD"` `"BLOCKED"`

**Resposta `200`:** `Allotment` · **Erros:** `400` · `404`

---

### `DELETE /allotments/:id`

**Resposta `204`:** sem body · **Erros:** `404`

---

## Resumo das rotas

```
Venues
  POST    /api/v1/venues
  GET     /api/v1/venues
  GET     /api/v1/venues/:id
  PUT     /api/v1/venues/:id
  DELETE  /api/v1/venues/:id
  GET     /api/v1/venues/:id/revenue   receita agregada de todos os eventos

Events
  POST    /api/v1/events
  GET     /api/v1/events                    ?venueId=  ?type=  ?status=
  GET     /api/v1/events/:id                inclui venue + allotments + status
  PUT     /api/v1/events/:id
  DELETE  /api/v1/events/:id                cascade → allotments removidos
  GET     /api/v1/events/:id/revenue        receita por status dos lotes
  GET     /api/v1/events/:id/activities     atividades recentes (últimas 24h)

Allotments
  POST    /api/v1/events/:eventId/allotments
  GET     /api/v1/events/:eventId/allotments
  GET     /api/v1/allotments/:id
  PUT     /api/v1/allotments/:id
  PATCH   /api/v1/allotments/:id/position   apenas x, y (drag & drop)
  PATCH   /api/v1/allotments/:id/status     apenas status
  DELETE  /api/v1/allotments/:id
```

---

## Tratamento de erros

```typescript
interface ApiError {
  statusCode: number;
  message: string;
  detail: string | string[]; // array em erros de validação (400)
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json() as Promise<T>;
}
```
