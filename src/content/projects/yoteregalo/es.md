---
title: Yo te regalo
summary: 'Marketplace de tarjetas de regalo digitales para Bolivia: los
  clientes compran tarjetas de negocios afiliados, pagan con tarjeta o QR
  bancario y las reciben por correo.'
role: Desarrollador full-stack (freelance)
kind: freelance
stack:
  - Ruby on Rails
  - PostgreSQL
  - Sidekiq
  - RSpec
  - Vue
  - Quasar
  - Pinia
  - Tailwind CSS
  - Vitest
  - GitLab CI
  - AWS
links:
  live: https://www.yoteregalo.com
cover: ./cover.jpg
featured: true
status: published
date: 2026-11-12
---

Yo te regalo tiene dos partes: una API en Ruby on Rails y una aplicación en
Quasar (Vue 3) que se publica como sitio web y como aplicación web progresiva.
La usan tres tipos de usuarios: los clientes que compran y envían tarjetas de
regalo, los negocios que las canjean y cobran, y los administradores de la
plataforma.

La API procesa pagos con tarjeta con verificación bancaria y pagos con QR
bancario, emite facturas electrónicas y ejecuta tareas programadas que
concilian los pagos y vencen las órdenes sin usar. Ambas partes se prueban y
se despliegan con GitLab CI.

El código fuente es privado. El sitio en producción es público.
