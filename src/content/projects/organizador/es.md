---
title: Organizador
summary: 'Organizador de tareas en Ruby on Rails con tareas compartidas, roles
  y notas en vivo. Nació en dos cursos de Rails; después lo actualicé a Rails
  8.1, lo cubrí con pruebas y lo desplegué.'
stack:
  - Ruby on Rails
  - PostgreSQL
  - Hotwire
  - Devise
  - CanCanCan
  - Bootstrap
  - Minitest
  - Railway
links:
  live: https://organizador-production-59cdf977.up.railway.app/test
  repo: https://github.com/crehds/organizador
cover: ./cover.jpg
kind: personal
featured: false
status: published
date: 2026-11-16
---

Organizador es un organizador de tareas. Cada tarea tiene una categoría, una
fecha de vencimiento, un dueño y participantes con un rol, y las personas
agregan notas a una tarea sin recargar la página. Los permisos deciden quién
puede administrar cada tarea, quién solo puede leerla y quién no tiene acceso.

Nació como el proyecto de dos cursos de Rails de Platzi. Después lo actualicé
de Rails 7.0 a 8.1 y de Ruby 3.1 a 3.4, una versión a la vez, con una suite de
pruebas de integración que agregué y que se mantuvo en verde en cada paso.
También corregí errores que el proyecto del curso todavía tenía, como notas que
cualquier usuario con sesión iniciada podía agregar a cualquier tarea.

El enlace al sitio inicia sesión con el usuario de demostración, sin
contraseña.
