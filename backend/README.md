# Backend

Spring Boot backend for the intranet inspection system.

## Prerequisites

- Java 21
- Maven
- PostgreSQL 15 or 16

## Database

Create a database:

```sql
CREATE DATABASE inspection_system;
```

Default local credentials are configured in `src/main/resources/application.yml`:

```text
username: postgres
password: postgres
```

Change those values if your PostgreSQL setup is different.

## Run

```bash
mvn spring-boot:run
```

Seed users:

```text
sbu1 / password
inspector1 / password
```

