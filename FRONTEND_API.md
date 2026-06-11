# Frontend API Contract — Allotment Manager

**Base URL:** `http://localhost:3333/api/v1`  
**Content-Type:** `application/json`

Este arquivo é o contrato prático para o front. Ele já considera o upgrade de andares:

- `Venue` representa o pavilhão físico.
- `VenueFloor` representa os andares físicos do pavilhão.
- `EventFloor` representa os andares escolhidos para um evento, como snapshot.
- `Allotment` sempre pertence a um `eventFloorId`.
- `canvasWidth/canvasHeight` continuam existindo, mas são alias do primeiro `EventFloor`.
- `Event.allowFloorDimensionChanges` controla se dimensões dos andares do evento podem mudar depois de criado.
- `Event.defaultAllotmentPrice` é usado quando o front cria um stand sem `price`.

---

## Tipos Base

```typescript
type UUID = string;
type ISODate = string;

type AllotmentStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'BLOCKED';
type EventType = 'FEIRA' | 'CONGRESSO' | 'EXPO' | 'CORPORATE';
type EventStatus = 'upcoming' | 'active' | 'finished';
type ActivityType =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'SOLD'
  | 'RESERVED'
  | 'BLOCKED'
  | 'AVAILABLE';

interface ApiError {
  statusCode: number;
  message: string;
  detail: string | string[];
}
```

---

## Modelo Mental Para O Front

```text
Venue
  floors: VenueFloor[]

Event
  eventFloors: EventFloor[]
  allotments: Allotment[]
```

Use `Event.eventFloors` para desenhar abas/segmentos de andares no editor.

Ao renderizar o canvas:

1. Escolha o `activeEventFloor`.
2. Use `activeEventFloor.width` e `activeEventFloor.height`.
3. Liste apenas stands com `allotment.eventFloorId === activeEventFloor.id`.

Stands em andares diferentes podem ter as mesmas coordenadas. Stands no mesmo andar não podem sobrepor.

---

## Venues

### Tipos

```typescript
interface VenueFloor {
  id: UUID;
  venueId: UUID;
  name: string;
  level: number;      // 0 = Térreo, 1 = 1º andar, etc.
  width: number;
  height: number;
  sortOrder: number;
  isDefault: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface Venue {
  id: UUID;
  name: string;
  description: string | null;
  width: number;      // legado/resumo do andar default
  height: number;     // legado/resumo do andar default
  city: string;
  state: string;
  street: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  accent: string;
  photo: string;
  floors: VenueFloor[];
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

interface CreateVenueFloorPayload {
  name: string;
  level: number;
  width: number;
  height: number;
  sortOrder?: number;
  isDefault?: boolean;
}

interface CreateVenuePayload {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  city: string;
  state: string;
  street?: string;
  neighborhood?: string;
  zipCode?: string;
  accent: string;
  photo: string;
  floors?: CreateVenueFloorPayload[];
}

type UpdateVenuePayload = Partial<CreateVenuePayload>;
type UpdateVenueFloorPayload = Partial<CreateVenueFloorPayload>;
```

### Rotas

```typescript
GET     /venues
GET     /venues/:id
POST    /venues
PUT     /venues/:id
DELETE  /venues/:id
GET     /venues/:id/revenue

POST    /venues/:venueId/floors
PUT     /venue-floors/:id
DELETE  /venue-floors/:id
```

### Criar Pavilhão Com Andares

```json
{
  "name": "Pavilhão Norte",
  "city": "São Paulo",
  "state": "SP",
  "accent": "#2563eb",
  "photo": "linear-gradient(135deg, #2563eb 0%, #6366f1 60%, #8b5cf6 100%)",
  "floors": [
    { "name": "Térreo", "level": 0, "width": 100, "height": 60, "sortOrder": 0, "isDefault": true },
    { "name": "1º andar", "level": 1, "width": 80, "height": 50, "sortOrder": 1 },
    { "name": "2º andar", "level": 2, "width": 70, "height": 40, "sortOrder": 2 }
  ]
}
```

### Criar Pavilhão Legado

```json
{
  "name": "Pavilhão Sul",
  "width": 100,
  "height": 60,
  "city": "São Paulo",
  "state": "SP",
  "accent": "#2563eb",
  "photo": "linear-gradient(135deg, #2563eb 0%, #6366f1 60%, #8b5cf6 100%)"
}
```

A API cria automaticamente o andar:

```json
{ "name": "Térreo", "level": 0, "width": 100, "height": 60, "isDefault": true }
```

### Erros Importantes

| Status | Quando |
|--------|--------|
| `400` | body inválido, levels duplicados, `floors` ausente sem `width/height` |
| `409` | criar/editar andar com `level` já existente |
| `409` | remover último andar físico |

---

## Events

### Tipos

```typescript
interface EventFloor {
  id: UUID;
  eventId: UUID;
  venueFloorId: UUID | null;
  name: string;
  level: number;
  width: number;
  height: number;
  sortOrder: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface SelectEventFloorPayload {
  venueFloorId: UUID;
  width?: number;
  height?: number;
}

interface Event {
  id: UUID;
  name: string;
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;
  status: EventStatus;
  venueId: UUID;
  canvasWidth: number;   // alias do primeiro EventFloor
  canvasHeight: number;  // alias do primeiro EventFloor
  allowFloorDimensionChanges: boolean;
  defaultAllotmentPrice: number | null;
  eventFloors?: EventFloor[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface EventListItem extends Event {
  venue: { id: UUID; name: string };
  _count: { allotments: number };
}

interface EventDetail extends Event {
  venue: {
    id: UUID;
    name: string;
    width: number;
    height: number;
    floors: VenueFloor[];
  };
  eventFloors: EventFloor[];
  allotments: Allotment[];
}

interface CreateEventPayload {
  name: string;
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;
  venueId: UUID;
  selectedFloors?: SelectEventFloorPayload[];
  allowFloorDimensionChanges?: boolean; // default: true
  defaultAllotmentPrice?: number | null;
  canvasWidth?: number;   // legado
  canvasHeight?: number;  // legado
}

interface UpdateEventPayload {
  name?: string;
  type?: EventType;
  startDate?: ISODate;
  endDate?: ISODate;
  canvasWidth?: number;   // legado; ajusta o primeiro EventFloor
  canvasHeight?: number;  // legado; ajusta o primeiro EventFloor
  allowFloorDimensionChanges?: boolean;
  defaultAllotmentPrice?: number | null;
}

interface UpdateEventFloorPayload {
  name?: string;
  width?: number;
  height?: number;
}
```

### Rotas

```typescript
GET     /events?venueId=&type=&status=
GET     /events/:id
POST    /events
PUT     /events/:id
DELETE  /events/:id
GET     /events/:id/dashboard
GET     /events/:id/revenue
GET     /events/:id/activities

GET     /events/:id/floors
POST    /events/:id/floors
PATCH   /event-floors/:id
DELETE  /event-floors/:id
GET     /event-floors/:id/dashboard
```

### Criar Evento Escolhendo Andares

```json
{
  "name": "Expo Tech 2026",
  "type": "FEIRA",
  "startDate": "2026-08-10T12:00:00.000Z",
  "endDate": "2026-08-15T12:00:00.000Z",
  "venueId": "venue-uuid",
  "allowFloorDimensionChanges": true,
  "defaultAllotmentPrice": 1500,
  "selectedFloors": [
    { "venueFloorId": "terreo-venue-floor-uuid" },
    { "venueFloorId": "primeiro-andar-venue-floor-uuid", "width": 60, "height": 40 }
  ]
}
```

Se `selectedFloors` não for enviado, a API seleciona o andar default do pavilhão.

Se `allowFloorDimensionChanges` não for enviado, a API assume `true`.
Se `defaultAllotmentPrice` for `null` ou ausente, stands criados sem `price` recebem `0`.

### Resposta De `GET /events/:id`

```json
{
  "id": "event-uuid",
  "name": "Expo Tech 2026",
  "type": "FEIRA",
  "status": "upcoming",
  "venueId": "venue-uuid",
  "canvasWidth": 100,
  "canvasHeight": 60,
  "allowFloorDimensionChanges": true,
  "defaultAllotmentPrice": 1500,
  "venue": {
    "id": "venue-uuid",
    "name": "Pavilhão Norte",
    "width": 100,
    "height": 60,
    "floors": []
  },
  "eventFloors": [
    {
      "id": "event-floor-terreo",
      "eventId": "event-uuid",
      "venueFloorId": "venue-floor-terreo",
      "name": "Térreo",
      "level": 0,
      "width": 100,
      "height": 60,
      "sortOrder": 0
    }
  ],
  "allotments": []
}
```

### Gerenciar Andares Do Evento

Adicionar andar ao evento:

```json
POST /events/:id/floors

{
  "venueFloorId": "venue-floor-uuid",
  "width": 70,
  "height": 40
}
```

Editar snapshot:

```json
PATCH /event-floors/:id

{
  "name": "Térreo - Área Comercial",
  "width": 80,
  "height": 50
}
```

Remover snapshot:

```typescript
DELETE /event-floors/:id
```

Bloqueios:

- não remove o último andar do evento;
- não remove andar com stands;
- não altera `width/height` se `event.allowFloorDimensionChanges=false`;
- não reduz dimensões se algum stand ficar fora da área;
- não permite dimensão maior que o `VenueFloor` original.

---

## Allotments

### Tipos

```typescript
interface Allotment {
  id: UUID;
  name: string;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: AllotmentStatus;
  price: number;
  eventId: UUID;
  eventFloorId: UUID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface CreateAllotmentPayload {
  name: string;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status?: AllotmentStatus;
  price?: number;
  eventFloorId?: UUID;
}

interface BulkCreateAllotmentsPayload {
  allotments: CreateAllotmentPayload[];
}

type UpdateAllotmentPayload = Partial<
  Omit<Allotment, 'id' | 'eventId' | 'code' | 'createdAt' | 'updatedAt'>
>;

type PatchPositionPayload = { x: number; y: number };
type PatchStatusPayload = { status: AllotmentStatus };
type PatchFloorPayload = { eventFloorId: UUID };
```

### Rotas

```typescript
GET     /events/:eventId/allotments
GET     /events/:eventId/allotments?eventFloorId=event-floor-uuid
POST    /events/:eventId/allotments
POST    /events/:eventId/allotments/bulk
GET     /allotments/:id
PUT     /allotments/:id
PATCH   /allotments/:id/position
PATCH   /allotments/:id/status
PATCH   /allotments/:id/floor
DELETE  /allotments/:id
```

### Criar Stand

```json
{
  "name": "Stand A-01",
  "code": "A-01",
  "x": 0,
  "y": 0,
  "width": 3,
  "height": 3,
  "eventFloorId": "event-floor-uuid"
}
```

`eventFloorId` pode ser omitido apenas se o evento tiver um único andar.
`price` pode ser omitido; nesse caso a API usa `event.defaultAllotmentPrice ?? 0`.

### Criar Stands Em Lote

```json
{
  "allotments": [
    {
      "name": "Stand A-01",
      "code": "A-01",
      "x": 0,
      "y": 0,
      "width": 3,
      "height": 3,
      "eventFloorId": "event-floor-terreo"
    },
    {
      "name": "Stand A-02",
      "code": "A-02",
      "x": 0,
      "y": 0,
      "width": 3,
      "height": 3,
      "eventFloorId": "event-floor-primeiro-andar"
    }
  ]
}
```

### Validação Para UI

Use as mesmas regras do backend antes de enviar:

```typescript
function exceedsFloor(a: Pick<Allotment, 'x' | 'y' | 'width' | 'height'>, floor: EventFloor) {
  return (
    a.x < 0 ||
    a.y < 0 ||
    a.x + a.width > floor.width ||
    a.y + a.height > floor.height
  );
}

function overlaps(a: Allotment, b: Allotment) {
  return (
    a.eventFloorId === b.eventFloorId &&
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
```

Regras:

- Validar colisão apenas entre stands do mesmo `eventFloorId`.
- Filtrar canvas/editor pelo andar ativo.
- `code` é único no evento inteiro, não por andar.
- Ao mover stand para outro andar, validar limite e colisão no destino.

---

## Dashboard

### Tipos

```typescript
interface DashboardTotals {
  area: number;
  occupiedArea: number;
  occupancy: number;      // percentual 0-100
  totalStands: number;
  revenuePotential: number;
}

interface DashboardFloorSummary extends EventFloor {
  totals: DashboardTotals;
  revenue: EventRevenue;
  statusCounts: EventRevenue['counts'];
}

interface EventDashboard {
  event: Event;
  venue: Venue;
  eventFloors: EventFloor[];
  totals: DashboardTotals;
  revenue: EventRevenue;
  statusCounts: EventRevenue['counts'];
  floors: DashboardFloorSummary[];
}

interface EventFloorDashboard {
  event: Event;
  venue: Venue;
  eventFloor: EventFloor;
  totals: DashboardTotals;
  revenue: EventRevenue;
  statusCounts: EventRevenue['counts'];
  allotments: Allotment[];
  heatmap: {
    width: number;
    height: number;
    allotments: Allotment[];
  };
}
```

### Rotas

```typescript
GET /events/:id/dashboard
GET /event-floors/:id/dashboard
```

Use `/events/:id/dashboard` para a visão geral agregada de todos os andares.
Use `/event-floors/:id/dashboard` quando o front estiver renderizando uma visão específica de andar ou heatmap.
Dashboards e telas financeiras devem oferecer escopo `Todos os andares` ou um `eventFloorId` específico.

`statusCounts` e `revenue.counts` têm o mesmo formato:

```typescript
{ sold: number; reserved: number; available: number; blocked: number }
```

---

## Revenue E Activities

### Tipos

```typescript
interface EventRevenue {
  realized: number;
  inNegotiation: number;
  total: number;
  counts: {
    sold: number;
    reserved: number;
    available: number;
    blocked: number;
  };
}

interface RecentActivity {
  id: UUID;
  action: string;
  type: ActivityType;
  createdAt: ISODate;
}
```

### Rotas

```typescript
GET /events/:id/revenue
GET /events/:id/revenue?eventFloorId=
GET /venues/:id/revenue
GET /events/:id/activities
```

`GET /events/:id/revenue` sem filtro agrega todos os stands, em todos os andares.
Com `eventFloorId`, agrega apenas o andar informado e valida que ele pertence ao evento.
`GET /venues/:id/revenue` continua agregando todos os eventos e andares do pavilhão.

---

## AI

### Tipos Compartilhados

```typescript
interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

### `POST /ai/parse-venue`

```typescript
interface ParseVenueRequest {
  prompt: string;
  history?: AIMessage[];
}

interface ParsedVenue {
  name: string;
  description: string | null;
  width: number;
  height: number;
  city: string;
  state: string;
  street: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  accent: string;
  photo: string;
  floors: Array<{
    name: string;
    level: number;
    width: number;
    height: number;
    sortOrder: number;
    isDefault: boolean;
  }>;
}

interface AISuggestedEvent {
  name: string;
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;
  canvasWidth: number;
  canvasHeight: number;
}

type ParseVenueResponse =
  | {
      status: 'complete';
      venue: ParsedVenue;
      suggestedEvent: AISuggestedEvent | null;
      confidence: number;
      missing: string[];
      warnings: string[];
    }
  | {
      status: 'needs_info';
      questions: string[];
      collected: Partial<ParsedVenue>;
      assistantMessage: string;
    };
```

Se o prompt disser que o pavilhão tem vários andares, a IA tenta preencher `venue.floors`. Se faltarem dimensões de algum andar, retorna `needs_info`.

### `POST /ai/parse-event`

```typescript
interface ParseEventRequest {
  prompt: string;
  venueId: UUID;
  canvasWidth?: number;
  canvasHeight?: number;
  history?: AIMessage[];
}

interface ParsedEvent {
  name: string;
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;
  canvasWidth: number;
  canvasHeight: number;
  selectedFloors: Array<{
    venueFloorId: UUID;
    level: number;
    width: number;
    height: number;
  }>;
}

interface AIGeneratedAllotment {
  code: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'AVAILABLE';
  price: number;
  venueFloorId?: UUID;
  floorLevel?: number;
}

type ParseEventResponse =
  | {
      status: 'complete';
      event: ParsedEvent;
      allotments: AIGeneratedAllotment[];
      summary: {
        total: number;
        placed: number;
        discarded: number;
        groups: Array<{
          width: number;
          height: number;
          count: number;
          placed: number;
          floorLevel?: number | null;
        }>;
      };
      warnings: string[];
      missing: string[];
    }
  | {
      status: 'needs_info';
      questions: string[];
      collected: Partial<Pick<ParsedEvent, 'name' | 'type' | 'startDate' | 'endDate'>>;
      assistantMessage: string;
    };
```

### Fluxo Front Com IA E Andares

1. Chame `POST /ai/parse-event`.
2. Se vier `needs_info`, mostre `assistantMessage` e reenvie com `history`.
3. Se vier `complete`, crie o evento com:

```typescript
await createEvent({
  name: result.event.name,
  type: result.event.type,
  startDate: result.event.startDate,
  endDate: result.event.endDate,
  venueId,
  selectedFloors: result.event.selectedFloors.map((floor) => ({
    venueFloorId: floor.venueFloorId,
    width: floor.width,
    height: floor.height,
  })),
});
```

4. Use a resposta de `POST /events`, que traz `eventFloors`, para montar o mapa:

```typescript
const byVenueFloorId = new Map(event.eventFloors.map((floor) => [floor.venueFloorId, floor]));
const byLevel = new Map(event.eventFloors.map((floor) => [floor.level, floor]));

const payload = {
  allotments: result.allotments.map((stand) => {
    const floor =
      (stand.venueFloorId ? byVenueFloorId.get(stand.venueFloorId) : undefined) ??
      (stand.floorLevel != null ? byLevel.get(stand.floorLevel) : undefined);

    if (!floor) throw new Error(`Andar não encontrado para ${stand.code}`);

    return {
      name: stand.name,
      code: stand.code,
      x: stand.x,
      y: stand.y,
      width: stand.width,
      height: stand.height,
      status: stand.status,
      price: stand.price,
      eventFloorId: floor.id,
    };
  }),
};

await bulkCreateAllotments(event.id, payload);
```

---

## Ordem Recomendada De Migração Do Front

1. Atualizar tipos `Venue`, `Event`, `Allotment` com `floors`, `eventFloors` e `eventFloorId`.
2. Atualizar criação de pavilhão para permitir múltiplos andares.
3. Atualizar criação de evento para escolher `selectedFloors`.
4. Atualizar editor de pavilhão para ter andar ativo.
5. Filtrar stands pelo `eventFloorId` ativo.
6. Trocar validação de canvas de `event.canvasWidth/canvasHeight` para `activeEventFloor.width/height`.
7. Atualizar IA para mapear `venueFloorId/floorLevel` para `eventFloorId` após criar o evento.
8. Usar `/events/:eventId/allotments/bulk` para inserir layout gerado.

---

## Resumo De Rotas

```text
POST    /api/v1/venues
GET     /api/v1/venues
GET     /api/v1/venues/:id
PUT     /api/v1/venues/:id
DELETE  /api/v1/venues/:id
GET     /api/v1/venues/:id/revenue
POST    /api/v1/venues/:venueId/floors
PUT     /api/v1/venue-floors/:id
DELETE  /api/v1/venue-floors/:id

POST    /api/v1/events
GET     /api/v1/events
GET     /api/v1/events/:id
PUT     /api/v1/events/:id
DELETE  /api/v1/events/:id
GET     /api/v1/events/:id/revenue
GET     /api/v1/events/:id/revenue?eventFloorId=
GET     /api/v1/events/:id/activities
GET     /api/v1/events/:id/floors
POST    /api/v1/events/:id/floors
PATCH   /api/v1/event-floors/:id
DELETE  /api/v1/event-floors/:id

GET     /api/v1/events/:eventId/allotments?eventFloorId=
POST    /api/v1/events/:eventId/allotments
POST    /api/v1/events/:eventId/allotments/bulk
GET     /api/v1/allotments/:id
PUT     /api/v1/allotments/:id
PATCH   /api/v1/allotments/:id/position
PATCH   /api/v1/allotments/:id/status
PATCH   /api/v1/allotments/:id/floor
DELETE  /api/v1/allotments/:id

POST    /api/v1/ai/parse-venue
POST    /api/v1/ai/parse-event
```
