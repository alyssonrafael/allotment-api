# Allotment API

API para gestão de eventos e allotments construída com NestJS, Prisma 7 e PostgreSQL.

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

O `.env` já está pré-configurado para o banco Docker local. Edite se necessário.

### 3. Subir o banco de dados

```bash
docker-compose --profile local up -d
```

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
docker-compose --profile prod up -d
```

Para rebuild da imagem da API após alterações:

```bash
docker-compose --profile prod up -d --build
```

## Build manual

```bash
npm run build
npm run start:prod
```

## Endpoints

- **Swagger UI**: `http://localhost:3000/docs`
- **Health check**: `http://localhost:3000/health`
- **API base**: `http://localhost:3000/api/v1`

## Variáveis de ambiente

| Variável          | Padrão                                                                                  | Descrição                    |
|-------------------|-----------------------------------------------------------------------------------------|------------------------------|
| `NODE_ENV`        | `development`                                                                           | Ambiente de execução         |
| `PORT`            | `3000`                                                                                  | Porta da aplicação           |
| `API_PREFIX`      | `api/v1`                                                                                | Prefixo global das rotas     |
| `DATABASE_URL`    | `postgresql://allotment_user:allotment_pass@localhost:5432/allotment_db?schema=public`  | URL do PostgreSQL            |
| `SWAGGER_ENABLED` | `true`                                                                                  | Ativa a documentação Swagger |
