# BMKA Core Module

This is the main module of the entire system. It contains the data model, database migration, and dashboard API. All components of the BMKA system should refer to the data model defined here.

## Tech Stack

**Stack:** NodeJS (mininum version: 20)

**Framework:** AdonisJS 6

## Setup

#### 1. Install all of required package

```bash
npm install
```

#### 2. Copy and fill in the env file

```bash
cp .env.example .env
```

You need to fill the environment variable based on your own environment.

## Run

```bash
npm run dev
```

## DB Migration

For admin access roles and the bootstrap Super Admin, follow the [RBAC seed guide](../docs/ADMIN_RBAC_SEED.md). Use the targeted `admin_rbac_seeder` for RBAC setup; the general seeder below includes demo data.

#### Run Migration

```bash
node ace migration:run
node ace db:seed
```

#### Reset All Migration And Run The Seeder

```bash
node ace migration:refresh --seed
```
