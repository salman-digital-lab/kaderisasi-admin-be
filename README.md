
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

#### Run Migration

```bash
node ace migration:run 
node ace db:seed
```

#### Reset All Migration And Run The Seeder

```bash
node ace migration:refresh --seed
```