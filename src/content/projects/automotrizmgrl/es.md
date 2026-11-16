---
title: Automotriz MGRL
summary: 'Sistema de gestión para un taller automotriz: clientes, vehículos,
  paquetes de mantenimiento y servicios programados por kilometraje.'
role: Único desarrollador (freelance)
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

El personal del taller lo usa para registrar clientes y sus vehículos, anotar
el kilometraje, definir tipos y paquetes de mantenimiento y ver qué servicios
le corresponden a cada vehículo. Los roles y permisos determinan qué puede ver
y modificar cada persona.

Es un solo repositorio con una API en NestJS y una aplicación en React. La API
guarda los datos en MySQL y ejecuta tareas en segundo plano con Redis; la
aplicación es un sitio estático. Las pruebas unitarias y de extremo a extremo
se ejecutan en GitHub Actions antes de cada despliegue en AWS.

El código fuente es privado. El enlace abre la pantalla de inicio de sesión,
porque el sistema es para el personal del taller.
