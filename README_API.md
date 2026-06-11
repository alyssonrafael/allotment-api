# API Reference — Allotment Manager

> **Stack:** NestJS · Prisma · PostgreSQL · class-validator  
> **Base URL:** `http://localhost:3333/api/v1`  
> **Content-Type:** `application/json`

---

## Hierarquia De Domínio

```text
Venue (Pavilhão físico)
  └── VenueFloor (Andar físico do pavilhão)

Event (Evento)
  └── EventFloor (Snapshot de um VenueFloor usado no evento)
        └── Allotment (Stand/Lote posicionado em um andar do evento)
```

Regras principais:

- `Venue` continua tendo `width` e `height` como campos legados/resumo, mas a fonte estrutural agora é `floors`.
- Todo pavilhão deve ter pelo menos um `VenueFloor`.
- Se `POST /venues` não enviar `floors`, a API cria automaticamente um andar `Térreo`, `level: 0`, usando `width` e `height`.
- `EventFloor` é um snapshot: alterar um `VenueFloor` não altera eventos existentes.
- `Event.canvasWidth` e `Event.canvasHeight` continuam existindo como alias do primeiro `EventFloor`, para compatibilidade.
- `Event.allowFloorDimensionChanges` controla se `width/height` dos `EventFloor` podem ser alterados depois da criação.
- `Event.defaultAllotmentPrice` é o preço padrão opcional para novos stands criados sem `price`.
- `Allotment` pertence a um `eventFloorId`.
- Colisão e limites são validados por andar do evento.
- `Allotment.code` continua único no evento inteiro: `@@unique([eventId, code])`.

---

## Schema Prisma

```prisma
enum AllotmentStatus {
  AVAILABLE
  RESERVED
  SOLD
  BLOCKED
}

enum EventType {
  FEIRA
  CONGRESSO
  EXPO
  CORPORATE
}

enum ActivityType {
  CREATED
  UPDATED
  DELETED
  SOLD
  RESERVED
  BLOCKED
  AVAILABLE
}

model Venue {
  id           String       @id @default(uuid())
  name         String
  description  String?
  width        Float        // legado/resumo do andar default
  height       Float        // legado/resumo do andar default
  city         String
  state        String
  street       String?
  neighborhood String?
  zipCode      String?
  accent       String
  photo        String
  floors       VenueFloor[]
  events       Event[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}

model VenueFloor {
  id          String       @id @default(uuid())
  venueId     String
  venue       Venue        @relation(fields: [venueId], references: [id], onDelete: Cascade)
  name        String
  level       Int
  width       Float
  height      Float
  sortOrder   Int          @default(0)
  isDefault   Boolean      @default(false)
  eventFloors EventFloor[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@unique([venueId, level])
}

model Event {
  id               String           @id @default(uuid())
  name             String
  type             EventType
  startDate        DateTime
  endDate          DateTime
  venueId          String
  venue            Venue            @relation(fields: [venueId], references: [id])
  canvasWidth      Float            // alias do primeiro EventFloor
  canvasHeight     Float            // alias do primeiro EventFloor
  allowFloorDimensionChanges Boolean @default(true)
  defaultAllotmentPrice Float?
  eventFloors      EventFloor[]
  allotments       Allotment[]
  recentActivities RecentActivity[]
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
}

model EventFloor {
  id           String      @id @default(uuid())
  eventId      String
  event        Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  venueFloorId String?
  venueFloor   VenueFloor? @relation(fields: [venueFloorId], references: [id], onDelete: SetNull)
  name         String
  level        Int
  width        Float
  height       Float
  sortOrder    Int         @default(0)
  allotments   Allotment[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@unique([eventId, level])
}

model Allotment {
  id           String          @id @default(uuid())
  name         String
  code         String
  x            Float
  y            Float
  width        Float
  height       Float
  status       AllotmentStatus @default(AVAILABLE)
  price        Float
  eventId      String
  event        Event           @relation(fields: [eventId], references: [id], onDelete: Cascade)
  eventFloorId String
  eventFloor   EventFloor      @relation(fields: [eventFloorId], references: [id], onDelete: Cascade)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([eventId, code])
}

model RecentActivity {
  id        String       @id @default(uuid())
  eventId   String
  event     Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  action    String
  type      ActivityType
  createdAt DateTime     @default(now())
}
```

Migrações principais:

- `prisma/migrations/20260609000000_add_floor_entities/migration.sql`
- `prisma/migrations/20260610000000_add_event_floor_controls/migration.sql`

A migração de andares remove eventos, stands e atividades existentes, preserva `Venue` e cria um `VenueFloor` default `Térreo` para cada pavilhão. A migração de controles adiciona campos ao `Event` sem apagar dados.

---

## Tipos Compartilhados

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

interface VenueFloor {
  id: UUID;
  venueId: UUID;
  name: string;
  level: number;
  width: number;
  height: number;
  sortOrder: number;
  isDefault: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

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

interface EventDashboardTotals {
  area: number;
  occupiedArea: number;
  occupancy: number;
  totalStands: number;
  revenuePotential: number;
}

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
```

### EventStatus

`status` não é armazenado. Ele é calculado na resposta:

| Condição | status |
|----------|--------|
| `now > endDate` no fim do dia | `finished` |
| `now >= startDate` | `active` |
| `now < startDate` | `upcoming` |

---

## Venues — `/venues`

### Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/venues` | Criar pavilhão físico e seus andares |
| `GET` | `/venues` | Listar pavilhões com `floors` e contagem de eventos |
| `GET` | `/venues/:id` | Buscar pavilhão com `floors` e eventos |
| `PUT` | `/venues/:id` | Atualizar dados do pavilhão |
| `DELETE` | `/venues/:id` | Remover pavilhão sem eventos |
| `GET` | `/venues/:id/revenue` | Receita agregada de todos os eventos do pavilhão |
| `POST` | `/venues/:venueId/floors` | Criar andar físico |
| `PUT` | `/venue-floors/:id` | Atualizar andar físico |
| `DELETE` | `/venue-floors/:id` | Remover andar físico |

Também existem aliases internos em `/venues/floors/:id` para `PUT` e `DELETE`.

### Tipos

```typescript
interface Venue {
  id: UUID;
  name: string;
  description: string | null;
  width: number;        // legado/resumo do andar default
  height: number;       // legado/resumo do andar default
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

interface CreateVenueFloorBody {
  name: string;
  level: number;
  width: number;
  height: number;
  sortOrder?: number;
  isDefault?: boolean;
}

interface CreateVenueBody {
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
  floors?: CreateVenueFloorBody[];
}

type UpdateVenueBody = Partial<CreateVenueBody>;
type UpdateVenueFloorBody = Partial<CreateVenueFloorBody>;
```

### `POST /venues`

Body com andares explícitos:

```json
{
  "name": "Pavilhão Norte",
  "description": "Pavilhão com três andares",
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

Body legado, sem `floors`:

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

Nesse caso, a API cria:

```json
{
  "name": "Térreo",
  "level": 0,
  "width": 100,
  "height": 60,
  "sortOrder": 0,
  "isDefault": true
}
```

Erros comuns:

| Status | Quando |
|--------|--------|
| `400` | campos inválidos, `floors` ausente sem `width/height`, levels duplicados |
| `409` | level duplicado em rota de criação de andar |

### `POST /venues/:venueId/floors`

```json
{
  "name": "Mezanino",
  "level": 1,
  "width": 80,
  "height": 45,
  "sortOrder": 1,
  "isDefault": false
}
```

Se `isDefault: true`, a API desmarca os outros andares como default e atualiza `Venue.width/height` para o novo default.

### `PUT /venue-floors/:id`

Atualiza nome, `level`, dimensões, ordenação ou default.

### `DELETE /venue-floors/:id`

Bloqueios:

- `404` se o andar não existir.
- `409` se for o último andar do pavilhão.

Eventos existentes não são alterados, porque usam `EventFloor` como snapshot.

---

## Events — `/events`

### Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/events` | Criar evento e snapshots `EventFloor` |
| `GET` | `/events` | Listar eventos |
| `GET` | `/events/:id` | Buscar evento com `venue`, `eventFloors` e `allotments` |
| `PUT` | `/events/:id` | Atualizar dados do evento |
| `DELETE` | `/events/:id` | Remover evento e seus stands |
| `GET` | `/events/:id/dashboard` | Dashboard geral do evento, agregando todos os andares |
| `GET` | `/events/:id/revenue` | Receita por status |
| `GET` | `/events/:id/activities` | Atividades recentes |
| `GET` | `/events/:id/floors` | Listar andares usados pelo evento |
| `POST` | `/events/:id/floors` | Adicionar andar do pavilhão ao evento |
| `PATCH` | `/event-floors/:id` | Ajustar snapshot do andar no evento |
| `DELETE` | `/event-floors/:id` | Remover andar do evento |
| `GET` | `/event-floors/:id/dashboard` | Dashboard de um andar específico |

### Tipos

```typescript
interface SelectEventFloorBody {
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

interface CreateEventBody {
  name: string;
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;
  venueId: UUID;
  canvasWidth?: number;      // legado; aplicado ao andar default se selectedFloors ausente
  canvasHeight?: number;     // legado; aplicado ao andar default se selectedFloors ausente
  selectedFloors?: SelectEventFloorBody[];
  allowFloorDimensionChanges?: boolean; // default: true
  defaultAllotmentPrice?: number | null;
}

interface UpdateEventBody {
  name?: string;
  type?: EventType;
  startDate?: ISODate;
  endDate?: ISODate;
  canvasWidth?: number;      // legado; ajusta o primeiro EventFloor
  canvasHeight?: number;     // legado; ajusta o primeiro EventFloor
  allowFloorDimensionChanges?: boolean;
  defaultAllotmentPrice?: number | null;
}
```

### `POST /events`

Selecionando dois andares do pavilhão:

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

Sem `selectedFloors`, a API usa o `VenueFloor.isDefault === true`; se não existir, usa o primeiro andar.

Se `allowFloorDimensionChanges` for omitido, o valor padrão é `true`.
Se `defaultAllotmentPrice` for `null` ou omitido, stands criados sem `price` recebem `0`.

Erros:

| Status | Quando |
|--------|--------|
| `400` | `endDate < startDate`, andar não pertence ao pavilhão, dimensões maiores que o andar físico, seleção duplicada |
| `404` | pavilhão não encontrado |

### `GET /events/:id`

Retorna `eventFloors` e `allotments` com `eventFloorId`:

```json
{
  "id": "event-uuid",
  "name": "Expo Tech 2026",
  "canvasWidth": 100,
  "canvasHeight": 60,
  "allowFloorDimensionChanges": true,
  "defaultAllotmentPrice": 1500,
  "status": "upcoming",
  "eventFloors": [
    {
      "id": "event-floor-uuid",
      "eventId": "event-uuid",
      "venueFloorId": "venue-floor-uuid",
      "name": "Térreo",
      "level": 0,
      "width": 100,
      "height": 60,
      "sortOrder": 0
    }
  ],
  "allotments": [
    {
      "id": "allotment-uuid",
      "eventFloorId": "event-floor-uuid",
      "code": "A-01",
      "x": 0,
      "y": 0,
      "width": 3,
      "height": 3,
      "status": "AVAILABLE",
      "price": 1500
    }
  ]
}
```

### `POST /events/:id/floors`

Adiciona ao evento um novo snapshot de um `VenueFloor` do mesmo pavilhão:

```json
{
  "venueFloorId": "venue-floor-uuid",
  "width": 70,
  "height": 40
}
```

### `PATCH /event-floors/:id`

```json
{
  "name": "Térreo - Área Comercial",
  "width": 80,
  "height": 50
}
```

Bloqueios:

- `400` se exceder dimensões do `VenueFloor` original.
- `409` se o evento tiver `allowFloorDimensionChanges=false` e o payload alterar `width` ou `height`.
- `409` se algum stand existente ficar fora das novas dimensões.

Alterar apenas `name` continua permitido mesmo quando `allowFloorDimensionChanges=false`.

### `DELETE /event-floors/:id`

Bloqueios:

- `409` se for o último andar do evento.
- `409` se existir stand nesse andar.

---

## Allotments — `/events/:eventId/allotments` e `/allotments/:id`

### Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/events/:eventId/allotments` | Criar stand |
| `POST` | `/events/:eventId/allotments/bulk` | Criar vários stands |
| `GET` | `/events/:eventId/allotments?eventFloorId=` | Listar stands do evento, opcionalmente filtrando por andar |
| `GET` | `/allotments/:id` | Buscar stand |
| `PUT` | `/allotments/:id` | Atualizar stand |
| `PATCH` | `/allotments/:id/position` | Atualizar posição |
| `PATCH` | `/allotments/:id/status` | Atualizar status |
| `PATCH` | `/allotments/:id/floor` | Mover stand para outro andar do evento |
| `DELETE` | `/allotments/:id` | Remover stand |

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

interface CreateAllotmentBody {
  name: string;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status?: AllotmentStatus;
  price?: number; // ausente = Event.defaultAllotmentPrice ?? 0
  eventFloorId?: UUID;
}

interface BulkCreateAllotmentsBody {
  allotments: CreateAllotmentBody[];
}

type UpdateAllotmentBody = Partial<
  Omit<Allotment, 'id' | 'eventId' | 'code' | 'createdAt' | 'updatedAt'>
>;

interface PatchPositionBody {
  x: number;
  y: number;
}

interface PatchStatusBody {
  status: AllotmentStatus;
}

interface PatchFloorBody {
  eventFloorId: UUID;
}
```

### Regras De Validação

- Se o evento tiver apenas um `EventFloor`, `eventFloorId` pode ser omitido na criação.
- Se o evento tiver múltiplos andares, `eventFloorId` é obrigatório.
- Se `price` for omitido, a API usa `Event.defaultAllotmentPrice`; se o evento não tiver padrão, usa `0`.
- `x + width <= eventFloor.width`.
- `y + height <= eventFloor.height`.
- Stands não podem se sobrepor dentro do mesmo `eventFloorId`.
- Stands podem ocupar as mesmas coordenadas em andares diferentes.
- `code` é único no evento inteiro, mesmo em andares diferentes.

### `POST /events/:eventId/allotments`

```json
{
  "name": "Stand Central",
  "code": "A-01",
  "x": 0,
  "y": 0,
  "width": 3,
  "height": 3,
  "eventFloorId": "event-floor-uuid"
}
```

No exemplo acima, o preço será herdado do `Event.defaultAllotmentPrice` ou será `0`.

### `POST /events/:eventId/allotments/bulk`

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
      "price": 1500,
      "eventFloorId": "event-floor-terreo"
    },
    {
      "name": "Stand A-02",
      "code": "A-02",
      "x": 0,
      "y": 0,
      "width": 3,
      "height": 3,
      "price": 1500,
      "eventFloorId": "event-floor-primeiro-andar"
    }
  ]
}
```

---

## Dashboard — `/events/:id/dashboard` E `/event-floors/:id/dashboard`

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

### `GET /events/:id/dashboard`

Retorna visão geral do evento somando todos os andares.

```json
{
  "event": { "id": "event-uuid", "name": "Expo Tech 2026", "status": "upcoming" },
  "venue": { "id": "venue-uuid", "name": "Pavilhão Norte" },
  "eventFloors": [],
  "totals": {
    "area": 10000,
    "occupiedArea": 270,
    "occupancy": 2.7,
    "totalStands": 30,
    "revenuePotential": 45000
  },
  "revenue": {
    "realized": 15000,
    "inNegotiation": 8500,
    "total": 23500,
    "counts": { "sold": 5, "reserved": 3, "available": 20, "blocked": 2 }
  },
  "statusCounts": { "sold": 5, "reserved": 3, "available": 20, "blocked": 2 },
  "floors": []
}
```

### `GET /event-floors/:id/dashboard`

Retorna visão de um andar específico. Use para heatmap e telas por andar.

```json
{
  "event": { "id": "event-uuid", "name": "Expo Tech 2026", "status": "upcoming" },
  "venue": { "id": "venue-uuid", "name": "Pavilhão Norte" },
  "eventFloor": { "id": "event-floor-uuid", "name": "Térreo", "width": 100, "height": 60 },
  "totals": {
    "area": 6000,
    "occupiedArea": 120,
    "occupancy": 2,
    "totalStands": 12,
    "revenuePotential": 18000
  },
  "revenue": {
    "realized": 6000,
    "inNegotiation": 3000,
    "total": 9000,
    "counts": { "sold": 2, "reserved": 1, "available": 8, "blocked": 1 }
  },
  "statusCounts": { "sold": 2, "reserved": 1, "available": 8, "blocked": 1 },
  "allotments": [],
  "heatmap": { "width": 100, "height": 60, "allotments": [] }
}
```

---

## Revenue E Activities

### `GET /events/:id/revenue`

Aceita filtro opcional por andar do evento:

```text
GET /events/:id/revenue?eventFloorId=event-floor-uuid
```

Sem filtro, agrega todos os stands de todos os andares. Com `eventFloorId`, agrega apenas os stands daquele andar e valida que o andar pertence ao evento.

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
```

### `GET /venues/:id/revenue`

Agrega todos os stands de todos os eventos do pavilhão, em todos os andares.

### `GET /events/:id/activities`

Retorna atividades recentes das últimas 24h.

```typescript
interface RecentActivity {
  id: UUID;
  action: string;
  type: ActivityType;
  createdAt: ISODate;
}
```

---

## AI — `/ai`

### `POST /ai/parse-venue`

Extrai pavilhão e andares a partir de linguagem natural.

```typescript
interface ParseVenueRequest {
  prompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
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

type ParseVenueResponse =
  | {
      status: 'complete';
      venue: ParsedVenue;
      suggestedEvent: null | {
        name: string;
        type: EventType;
        startDate: ISODate;
        endDate: ISODate;
        canvasWidth: number;
        canvasHeight: number;
      };
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

Regras:

- Se o usuário mencionar vários andares sem dimensões suficientes, a IA deve pedir os dados faltantes.
- Se só houver dimensão geral, retorna `floors` com `Térreo`.
- Medidas fracionadas são arredondadas para inteiros.

### `POST /ai/parse-event`

Extrai evento, andares selecionados e layout por andar.

```typescript
interface ParseEventRequest {
  prompt: string;
  venueId: UUID;
  canvasWidth?: number;   // legado
  canvasHeight?: number;  // legado
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface ParsedEvent {
  name: string;
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;
  canvasWidth: number;   // primeiro andar selecionado
  canvasHeight: number;  // primeiro andar selecionado
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

Fluxo recomendado:

1. Front chama `/ai/parse-event`.
2. Front cria o evento com `event.selectedFloors`.
3. Resposta de `POST /events` retorna `eventFloors`.
4. Front mapeia cada allotment gerado por `venueFloorId` ou `floorLevel` para o `eventFloorId` correspondente.
5. Front cria os stands com `/events/:eventId/allotments/bulk`.

---

## Resumo De Rotas

```text
GET     /api/v1/health

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
GET     /api/v1/events/:id/activities
GET     /api/v1/events/:id/floors
POST    /api/v1/events/:id/floors
PATCH   /api/v1/event-floors/:id
DELETE  /api/v1/event-floors/:id

POST    /api/v1/events/:eventId/allotments
POST    /api/v1/events/:eventId/allotments/bulk
GET     /api/v1/events/:eventId/allotments?eventFloorId=
GET     /api/v1/allotments/:id
PUT     /api/v1/allotments/:id
PATCH   /api/v1/allotments/:id/position
PATCH   /api/v1/allotments/:id/status
PATCH   /api/v1/allotments/:id/floor
DELETE  /api/v1/allotments/:id

POST    /api/v1/ai/parse-venue
POST    /api/v1/ai/parse-event
```
