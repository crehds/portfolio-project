---
title: Automotriz MGRL
summary: 'A management system for an auto repair shop: clients, vehicles,
  maintenance packages and services scheduled by mileage.'
role: Sole developer (freelance)
kind: freelance
stack:
  - NestJS
  - TypeScript
  - TypeORM
  - MySQL
  - Redis
  - BullMQ
  - React
  - Vite
  - TanStack Query
  - Tailwind CSS
  - Docker
  - AWS
  - GitHub Actions
links:
  live: https://app.automotrizmgrl.com
cover: ./cover.jpg
featured: true
status: published
date: 2026-11-02
---

The shop's staff use it to register clients and their vehicles, record
mileage, define maintenance types and packages, and see which services each
vehicle is due for. Roles and permissions decide what each staff member can
see and change.

It is one repository with a NestJS API and a React app. The API stores data in
MySQL and runs background jobs on Redis; the app is a static site. Unit and
end-to-end tests run in GitHub Actions before each deploy to AWS.

The source code is private. The live link opens the sign-in screen, because
the system is for the shop's staff.
