# Allotment API

API para gestão de venues, eventos e allotments, construída com NestJS 11, Prisma 7 e PostgreSQL 16.

## Tecnologias

- **Runtime:** Node.js 20+
- **Framework:** NestJS 11
- **Linguagem:** TypeScript 5.7
- **ORM:** Prisma 7 com adaptador `pg`
- **Banco de dados:** PostgreSQL 16
- **Documentação:** Swagger (OpenAPI)
- **Validação:** class-validator + class-transformer
- **Testes:** Jest + Supertest
- **Containerização:** Docker + Docker Compose

## Estrutura de pastas

```
allotment-api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── activities/          # Registro de atividades recentes
│   ├── allotments/          # Módulo de allotments (CRUD + status + posição)
│   │   └── dto/
│   ├── events/              # Módulo de eventos
│   │   └── dto/
│   ├── venues/              # Módulo de venues (espaços/locais)
│   │   └── dto/
│   ├── health/              # Health check endpoint
│   ├── prisma/              # Módulo e serviço do Prisma
│   └── common/
│       └── filters/         # Filtro global de exceções HTTP
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
└── .env.example
```

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- npm

## Desenvolvimento local

### 1. Clonar e instalar dependências

```bash
git clone <url-do-repositório>
cd allotment-api
npm install
```

O `postinstall` executa `prisma generate` automaticamente.

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` preenchendo as variáveis do banco:

```env
NODE_ENV=development
PORT=3333
CORS_ORIGINS=http://localhost:3000
API_PREFIX=api/v1
SWAGGER_ENABLED=true

POSTGRES_USER=allotment_user
POSTGRES_PASSWORD=allotment_pass
POSTGRES_DB=allotment_db
DATABASE_URL="postgresql://allotment_user:allotment_pass@localhost:5432/allotment_db?schema=public"
```

### 3. Subir o banco de dados

```bash
docker compose --profile local up -d
```

Isso sobe apenas o container do PostgreSQL.

### 4. Executar as migrações

```bash
npx prisma migrate deploy
```

### 5. Iniciar a aplicação

```bash
npm run start:dev
```

## Produção com Docker

Sobe o banco e a API em containers, com migração automática na inicialização.

```bash
docker compose --profile prod up -d
```

Para rebuild da imagem da API após alterações:

```bash
docker compose --profile prod up -d --build
```

## Build manual

```bash
npm run build
npm run start:prod
```

## Endpoints

| Recurso       | Base URL                         |
|---------------|----------------------------------|
| Swagger UI    | `http://localhost:3333/docs`     |
| Health check  | `http://localhost:3333/health`   |
| API base      | `http://localhost:3333/api/v1`   |

### Módulos disponíveis

| Módulo       | Prefixo              |
|--------------|----------------------|
| Venues       | `/api/v1/venues`     |
| Events       | `/api/v1/events`     |
| Allotments   | `/api/v1/allotments` |
| Activities   | `/api/v1/activities` |

## Variáveis de ambiente

| Variável          | Padrão        | Descrição                              |
|-------------------|---------------|----------------------------------------|
| `NODE_ENV`        | `development` | Ambiente de execução                   |
| `PORT`            | `3333`        | Porta da aplicação                     |
| `CORS_ORIGINS`    | —             | Origens permitidas (separadas por vírgula) |
| `API_PREFIX`      | `api/v1`      | Prefixo global das rotas               |
| `SWAGGER_ENABLED` | `true`        | Ativa a documentação Swagger           |
| `POSTGRES_USER`   | —             | Usuário do PostgreSQL                  |
| `POSTGRES_PASSWORD` | —           | Senha do PostgreSQL                    |
| `POSTGRES_DB`     | —             | Nome do banco de dados                 |
| `DATABASE_URL`    | —             | URL de conexão completa do PostgreSQL  |

## Scripts npm

| Comando             | Descrição                          |
|---------------------|------------------------------------|
| `npm run start:dev` | Inicia em modo watch (dev)         |
| `npm run build`     | Compila o projeto                  |
| `npm run start:prod`| Inicia a build compilada           |
| `npm test`          | Executa os testes unitários        |
| `npm run test:e2e`  | Executa os testes end-to-end       |
| `npm run lint`      | Lint com correção automática       |
| `npm run format`    | Formata o código com Prettier      |
