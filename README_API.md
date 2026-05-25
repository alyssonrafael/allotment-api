# API Reference — Allotment Manager

> **Stack:** NestJS · Prisma · PostgreSQL · class-validator
> **Base URL:** `http://localhost:3333/api/v1`

---

## Hierarquia de Domínio

```
Venue (Pavilhão)
  └── Event (Evento)          ← venueId obrigatório; type obrigatório; status derivado das datas
        └── Allotment (Stand) ← eventId obrigatório; posição validada contra o canvas
```

---

## Schema Prisma

```prisma
enum AllotmentStatus {
  AVAILABLE  // Disponível
  RESERVED   // Reservado
  SOLD       // Vendido
  BLOCKED    // Bloqueado
}

enum EventType {
  FEIRA
  CONGRESSO
  EXPO
  CORPORATE
}

enum ActivityType {
  CREATED    // evento ou lote criado
  UPDATED    // evento ou lote atualizado
  DELETED    // evento ou lote removido
  SOLD       // lote passou para SOLD
  RESERVED   // lote passou para RESERVED
  BLOCKED    // lote passou para BLOCKED
  AVAILABLE  // lote passou para AVAILABLE
}

model Venue {
  id           String   @id @default(uuid())
  name         String
  description  String?
  width        Float
  height       Float
  city         String
  state        String   // sigla UF — 2 chars
  street       String?
  neighborhood String?
  zipCode      String?
  accent       String   // CSS color token
  photo        String   // CSS gradient
  events       Event[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Event {
  id           String      @id @default(uuid())
  name         String
  type         EventType
  startDate    DateTime
  endDate      DateTime
  venueId      String
  venue        Venue       @relation(fields: [venueId], references: [id])
  canvasWidth  Float       // snapshot da largura do venue no momento do cadastro
  canvasHeight Float       // snapshot da altura do venue
  allotments   Allotment[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model Allotment {
  id        String          @id @default(uuid())
  name      String
  code      String
  x         Float           // posição X em metros (origem: canto superior esquerdo)
  y         Float           // posição Y em metros
  width     Float           // mínimo: 1
  height    Float           // mínimo: 1
  status    AllotmentStatus @default(AVAILABLE)
  price     Float
  eventId   String
  event     Event           @relation(fields: [eventId], references: [id], onDelete: Cascade)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@unique([eventId, code])
}

model RecentActivity {
  id        String       @id @default(uuid())
  eventId   String
  event     Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  action    String       // descrição legível: "Lote A01 foi reservado"
  type      ActivityType // usado pelo frontend para selecionar ícone
  createdAt DateTime     @default(now())
}
```

---

## Tipos Compartilhados

```typescript
type UUID      = string;  // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
type ISODate   = string;  // "2025-09-15T00:00:00.000Z"

type AllotmentStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED";
type EventType       = "FEIRA" | "CONGRESSO" | "EXPO" | "CORPORATE";
type EventStatus     = "upcoming" | "active" | "finished"; // DERIVADO — nunca enviado no body
type ActivityType    = "CREATED" | "UPDATED" | "DELETED" | "SOLD" | "RESERVED" | "BLOCKED" | "AVAILABLE";

// Formato padrão de erro (todos os endpoints)
interface ApiError {
  statusCode: number;
  message: string;
  detail: string | string[]; // array quando erro de validação de campos (400)
}

interface RecentActivity {
  id: UUID;
  action: string;        // descrição legível gerada automaticamente
  type: ActivityType;    // usado para selecionar ícone no frontend
  createdAt: ISODate;
}
```

### EventStatus — lógica de derivação

O campo `status` **não é armazenado**. O backend computa na resposta:

| Condição | status |
|----------|--------|
| `now > endDate` (fim do dia) | `"finished"` |
| `now >= startDate` | `"active"` |
| `now < startDate` | `"upcoming"` |

---

## Venues — `/venues`

### Rotas

| Método   | Rota                    | Descrição                            | Status |
|----------|-------------------------|--------------------------------------|--------|
| `POST`   | `/venues`               | Criar pavilhão                       | `201`  |
| `GET`    | `/venues`               | Listar pavilhões                     | `200`  |
| `GET`    | `/venues/:id`           | Buscar por ID                        | `200`  |
| `PUT`    | `/venues/:id`           | Atualizar pavilhão                   | `200`  |
| `DELETE` | `/venues/:id`           | Remover pavilhão                     | `204`  |
| `GET`    | `/venues/:id/revenue`   | Receita agregada de todos os eventos | `200`  |

### Tipos

```typescript
interface Venue {
  id: UUID;
  name: string;
  description: string | null;
  width: number;
  height: number;
  city: string;
  state: string;            // "SP"
  street: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  accent: string;           // CSS color token: "var(--primary)"
  photo: string;            // CSS gradient: "linear-gradient(135deg, ...)"
  createdAt: ISODate;
  updatedAt: ISODate;
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
  accent: string;
  photo: string;
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

### DTOs

```typescript
// create-venue.dto.ts
export class CreateVenueDto {
  @IsString() @MinLength(3)         name!: string;
  @IsOptional() @IsString()         description?: string;
  @IsNumber() @Min(1)               width!: number;
  @IsNumber() @Min(1)               height!: number;
  @IsString() @MinLength(2)         city!: string;
  @IsString() @Length(2, 2)         state!: string;
  @IsOptional() @IsString()         street?: string;
  @IsOptional() @IsString()         neighborhood?: string;
  @IsOptional() @IsString()         zipCode?: string;
  @IsString()                       accent!: string;
  @IsString()                       photo!: string;
}

// update-venue.dto.ts
export class UpdateVenueDto extends PartialType(CreateVenueDto) {}
```

### POST `/venues`

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
| `400` | `name` < 3 chars, `state` ≠ 2 chars, `width`/`height` < 1, `city`/`accent`/`photo` ausentes |

### GET `/venues`

**Resposta `200`:** `(Venue & { _count: { events: number } })[]`

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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
    "photo": "linear-gradient(135deg, #2563eb 0%, #6366f1 60%, #8b5cf6 100%)",
    "createdAt": "2025-01-10T10:00:00.000Z",
    "updatedAt": "2025-01-10T10:00:00.000Z",
    "_count": { "events": 3 }
  }
]
```

### GET `/venues/:id`

**Resposta `200`:** `Venue & { events: { id, name, startDate, endDate }[] }`

```json
{
  "id": "a1b2c3d4-...",
  "name": "Pavilhão Norte",
  "events": [
    { "id": "e1f2g3h4-...", "name": "Expo Tech 2025", "startDate": "2025-09-11T00:00:00.000Z", "endDate": "2025-09-14T00:00:00.000Z" }
  ]
}
```

**Erro `404`:** `{ "statusCode": 404, "message": "Venue a1b2c3d4-... not found", "detail": "..." }`

### PUT `/venues/:id`

**Body:** `UpdateVenueBody` (todos os campos opcionais) · **Resposta `200`:** `Venue`

**Erros:** `400` campo inválido · `404` não encontrado

### GET `/venues/:id/revenue`

Receita do pavilhão **agregada de todos os seus eventos**, separada por status dos lotes.

- **`realized`** → soma dos lotes `SOLD` em todos os eventos do pavilhão
- **`inNegotiation`** → soma dos lotes `RESERVED` em todos os eventos do pavilhão
- **`total`** → `realized + inNegotiation`

**Resposta `200`:**

```json
{
  "realized": 15000,
  "inNegotiation": 8500,
  "total": 23500,
  "counts": {
    "sold": 5,
    "reserved": 3,
    "available": 10,
    "blocked": 2
  }
}
```

**Erros:** `404` Pavilhão não encontrado

### DELETE `/venues/:id`

Falha com `409` se houver eventos vinculados — remova os eventos primeiro.

**Resposta `204`:** sem body · **Erros:** `404` · `409` possui eventos

---

## Events — `/events`

### Rotas

| Método   | Rota                    | Descrição                          | Status |
|----------|-------------------------|------------------------------------|--------|
| `POST`   | `/events`               | Criar evento                       | `201`  |
| `GET`    | `/events`               | Listar eventos (filtros opcionais) | `200`  |
| `GET`    | `/events/:id`           | Buscar evento (venue + allotments) | `200`  |
| `PUT`    | `/events/:id`           | Atualizar evento                   | `200`  |
| `DELETE` | `/events/:id`           | Remover evento (cascade stands)    | `204`  |
| `GET`    | `/events/:id/revenue`   | Receita por status dos lotes       | `200`  |
| `GET`    | `/events/:id/activities`| Atividades recentes (últimas 24h)  | `200`  |

### Tipos

```typescript
interface Event {
  id: UUID;
  name: string;
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;
  status: EventStatus;  // DERIVADO — nunca enviar no body
  venueId: UUID;
  canvasWidth: number;
  canvasHeight: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface CreateEventBody {
  name: string;          // mín. 3 chars
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;      // deve ser >= startDate
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

### DTOs

```typescript
// create-event.dto.ts
export class CreateEventDto {
  @IsString() @MinLength(3)            name!: string;
  @IsEnum(EventType)                   type!: EventType;
  @IsDateString()                      startDate!: string;
  @IsDateString()                      endDate!: string;
  @IsUUID()                            venueId!: string;
  @IsOptional() @IsNumber() @Min(1)    canvasWidth?: number;
  @IsOptional() @IsNumber() @Min(1)    canvasHeight?: number;
}

// update-event.dto.ts — venueId omitido, todos os demais opcionais
export class UpdateEventDto extends PartialType(OmitType(CreateEventDto, ['venueId'] as const)) {}
```

### Validações de negócio

```typescript
// events.service.ts
if (new Date(dto.endDate) < new Date(dto.startDate)) {
  throw new BadRequestException('endDate must be >= startDate');
}

private computeStatus(start: Date, end: Date): EventStatus {
  const now = new Date();
  const endOfDay = new Date(end);
  endOfDay.setHours(23, 59, 59, 999);
  if (now > endOfDay) return 'finished';
  if (now >= start)   return 'active';
  return 'upcoming';
}
```

### POST `/events`

O backend copia `width`/`height` do venue para `canvasWidth`/`canvasHeight` se não forem enviados.

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

**Resposta `201`:**

```json
{
  "id": "e1f2g3h4-...",
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

### GET `/events`

**Query params (todos opcionais):**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `venueId` | `UUID` | Filtra pelo pavilhão |
| `type` | `EventType` | Filtra por tipo |
| `status` | `EventStatus` | Filtra por status computado |

> `?status=` é filtrado em memória após a consulta ao banco (não é coluna armazenada).

**Resposta `200`:** `(Event & { venue: { id, name }, _count: { allotments } })[]`

### GET `/events/:id`

**Resposta `200`:** `Event & { venue: { id, name, width, height }, allotments: Allotment[] }`

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

**Erro `404`:** `{ "statusCode": 404, "message": "Event e1f2g3h4-... not found", "detail": "..." }`

### PUT `/events/:id`

`venueId` não pode ser alterado. Use `canvasWidth`/`canvasHeight` para área parcial do pavilhão.

**Body:** `UpdateEventBody` · **Resposta `200`:** `Event`

**Erros:** `400` campo inválido ou `endDate < startDate` · `404` não encontrado

### DELETE `/events/:id`

Os allotments são **removidos em cascata** automaticamente.

**Resposta `204`:** sem body · **Erro `404`:** não encontrado

### GET `/events/:id/revenue`

Retorna a receita do evento agrupada por status dos lotes.

- **`realized`** → soma dos preços dos lotes com status `SOLD`
- **`inNegotiation`** → soma dos preços dos lotes com status `RESERVED`
- **`total`** → `realized + inNegotiation`

**Resposta `200`:**

```json
{
  "realized": 15000,
  "inNegotiation": 8500,
  "total": 23500,
  "counts": {
    "sold": 5,
    "reserved": 3,
    "available": 10,
    "blocked": 2
  }
}
```

**Erros:** `404` Evento não encontrado

### GET `/events/:id/activities`

Retorna as atividades relacionadas ao evento nas **últimas 24 horas**, em ordem decrescente de data.

Atividades são geradas automaticamente pelo backend a cada operação de criação, atualização, remoção ou mudança de status de eventos e lotes.

**Resposta `200`:** `RecentActivity[]`

```json
[
  {
    "id": "uuid",
    "action": "Lote A01 passou para RESERVED",
    "type": "RESERVED",
    "createdAt": "2026-05-25T14:32:00.000Z"
  },
  {
    "id": "uuid",
    "action": "Lote B03 foi criado",
    "type": "CREATED",
    "createdAt": "2026-05-25T13:10:00.000Z"
  }
]
```

**Erros:** `404` Evento não encontrado

#### Eventos que geram atividade automaticamente

| Ação | Mensagem | ActivityType |
|------|----------|--------------|
| Criar evento | `Evento "X" foi criado` | `CREATED` |
| Atualizar evento | `Evento "X" foi atualizado` | `UPDATED` |
| Remover evento | `Evento "X" foi removido` | `DELETED` |
| Criar lote | `Lote "A01" foi criado` | `CREATED` |
| Atualizar lote | `Lote "A01" foi atualizado` | `UPDATED` |
| Mover lote (posição) | `Lote "A01" teve posição ajustada` | `UPDATED` |
| Lote → SOLD | `Lote "A01" passou para SOLD` | `SOLD` |
| Lote → RESERVED | `Lote "A01" passou para RESERVED` | `RESERVED` |
| Lote → BLOCKED | `Lote "A01" passou para BLOCKED` | `BLOCKED` |
| Lote → AVAILABLE | `Lote "A01" passou para AVAILABLE` | `AVAILABLE` |
| Remover lote | `Lote "A01" foi removido` | `DELETED` |

---

## Allotments — `/events/:eventId/allotments` e `/allotments/:id`

### Rotas

| Método   | Rota                             | Descrição                      | Status |
|----------|----------------------------------|--------------------------------|--------|
| `POST`   | `/events/:eventId/allotments`    | Criar stand                    | `201`  |
| `GET`    | `/events/:eventId/allotments`    | Listar stands do evento        | `200`  |
| `GET`    | `/allotments/:id`                | Buscar stand por ID            | `200`  |
| `PUT`    | `/allotments/:id`                | Atualizar stand (revalida)     | `200`  |
| `PATCH`  | `/allotments/:id/position`       | Atualizar posição (drag & drop)| `200`  |
| `PATCH`  | `/allotments/:id/status`         | Atualizar status               | `200`  |
| `DELETE` | `/allotments/:id`                | Remover stand                  | `204`  |

### Tipos

```typescript
interface Allotment {
  id: UUID;
  name: string;
  code: string;    // único por evento
  x: number;       // posição X em metros (origem: canto superior esquerdo)
  y: number;       // posição Y em metros
  width: number;   // mínimo: 1
  height: number;  // mínimo: 1
  status: AllotmentStatus;
  price: number;   // mínimo: 0
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

interface UpdateAllotmentBody { // code NÃO pode ser alterado
  name?: string; x?: number; y?: number;
  width?: number; height?: number;
  status?: AllotmentStatus; price?: number;
}

interface UpdateAllotmentPositionBody { x: number; y: number; }
interface UpdateAllotmentStatusBody   { status: AllotmentStatus; }
```

### DTOs

```typescript
// create-allotment.dto.ts
export class CreateAllotmentDto {
  @IsString()                    name!: string;
  @IsString()                    code!: string;
  @IsNumber() @Min(0)            x!: number;
  @IsNumber() @Min(0)            y!: number;
  @IsNumber() @IsPositive()      width!: number;
  @IsNumber() @IsPositive()      height!: number;
  @IsOptional() @IsEnum(AllotmentStatus) status?: AllotmentStatus;
  @IsNumber() @Min(0)            price!: number;
}

// update-allotment.dto.ts — code omitido, todos os demais opcionais
export class UpdateAllotmentDto extends PartialType(OmitType(CreateAllotmentDto, ['code'] as const)) {}

// update-allotment-position.dto.ts
export class UpdateAllotmentPositionDto {
  @IsNumber() @Min(0) x!: number;
  @IsNumber() @Min(0) y!: number;
}

// update-allotment-status.dto.ts
export class UpdateAllotmentStatusDto {
  @IsEnum(AllotmentStatus) status!: AllotmentStatus;
}
```

### Validações de negócio

```typescript
// allotments.service.ts

private validateBounds(
  a: { x: number; y: number; width: number; height: number },
  event: { canvasWidth: number; canvasHeight: number }
): void {
  if (a.x < 0 || a.y < 0 || a.x + a.width > event.canvasWidth || a.y + a.height > event.canvasHeight) {
    throw new ConflictException('Allotment exceeds canvas boundaries');
  }
}

private validateCollision(
  a: { x: number; y: number; width: number; height: number },
  others: Allotment[]
): void {
  const collides = others.some(
    b => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
  if (collides) throw new ConflictException('Allotment collides with an existing stand');
}
```

### POST `/events/:eventId/allotments`

**Body:** `CreateAllotmentBody`

```json
{
  "name": "Stand A01",
  "code": "A01",
  "x": 0,
  "y": 0,
  "width": 4,
  "height": 3,
  "status": "AVAILABLE",
  "price": 12000
}
```

**Resposta `201`:** `Allotment`

**Erros:**

| Status | Quando |
|--------|--------|
| `400` | Campos inválidos |
| `404` | Evento não encontrado |
| `409` | Código duplicado no evento, stand fora dos limites ou sobreposição |

### GET `/events/:eventId/allotments`

**Resposta `200`:** `Allotment[]`

### GET `/allotments/:id`

**Resposta `200`:** `Allotment` · **Erro `404`:** não encontrado

### PUT `/allotments/:id`

Revalida posição, dimensões e colisão. `code` não pode ser alterado.

**Body:** `UpdateAllotmentBody` · **Resposta `200`:** `Allotment`

**Erros:** `400` · `404` · `409` colisão ou limites excedidos

### PATCH `/allotments/:id/position`

Endpoint leve para drag & drop — só atualiza `x` e `y`. Revalida limites e colisão.

**Body:** `UpdateAllotmentPositionBody`

```json
{ "x": 10, "y": 5 }
```

**Resposta `200`:** `Allotment` · **Erros:** `400` · `404` · `409`

### PATCH `/allotments/:id/status`

Não revalida posição nem colisão.

**Body:** `UpdateAllotmentStatusBody`

```json
{ "status": "SOLD" }
```

**Valores aceitos:** `AVAILABLE` · `RESERVED` · `SOLD` · `BLOCKED`

**Resposta `200`:** `Allotment` · **Erros:** `400` · `404`

### DELETE `/allotments/:id`

**Resposta `204`:** sem body · **Erro `404`:** não encontrado

---

## Resumo de todos os endpoints

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
  GET     /api/v1/events/:id                venue + allotments + status computado
  PUT     /api/v1/events/:id
  DELETE  /api/v1/events/:id                cascade → allotments removidos
  GET     /api/v1/events/:id/revenue        receita por status dos lotes
  GET     /api/v1/events/:id/activities     atividades recentes (últimas 24h)

Allotments
  POST    /api/v1/events/:eventId/allotments
  GET     /api/v1/events/:eventId/allotments
  GET     /api/v1/allotments/:id
  PUT     /api/v1/allotments/:id     revalida colisão
  PATCH   /api/v1/allotments/:id/position   só x, y (drag & drop)
  PATCH   /api/v1/allotments/:id/status     só status
  DELETE  /api/v1/allotments/:id
```

---

## Tratamento de erros

Todos os erros seguem o mesmo shape:

```typescript
interface ApiError {
  statusCode: number;
  message: string;
  detail: string | string[]; // array em erros de validação (400)
}
```

---

## Setup rápido

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Subir o banco
docker-compose --profile local up -d

# 4. Rodar as migrations
npx prisma migrate deploy

# 5. Iniciar o servidor
npm run start:dev
# API: http://localhost:3333
# Swagger: http://localhost:3333/docs
# Health: http://localhost:3333/health
```
