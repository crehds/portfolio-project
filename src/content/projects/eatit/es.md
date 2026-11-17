---
title: eatIt
summary: 'API REST en Ruby on Rails para un restaurante: los productos de su
  menú y los pedidos que se hacen de ellos, con documentación interactiva
  generada desde la suite de pruebas.'
stack:
  - Ruby on Rails
  - PostgreSQL
  - RSpec
  - OpenAPI
  - Swagger UI
  - Railway
links:
  live: https://eatit-production-acb74386.up.railway.app/
  repo: https://github.com/crehds/eatIt
cover: ./cover.jpg
kind: personal
featured: false
status: published
date: 2026-11-16
---

eatIt es una API sin front-end: el enlace al sitio abre su documentación
interactiva, donde se puede probar cualquier endpoint con los datos públicos
de demostración. La documentación se genera a partir de pruebas que llaman a
la API real, así que la suite de pruebas falla cuando deja de coincidir con lo
que hace la API.

La demostración pública y mis datos privados comparten una sola base de datos.
Las solicitudes sin token leen y cambian los datos de demostración; un token
de portador da acceso a registros privados que los visitantes no pueden ver ni
cambiar. Una tarea diaria borra lo que cambiaron los visitantes y vuelve a
cargar el menú y los pedidos originales.

La actualicé de Rails 7.0 a 8.1 y de Ruby 3.1 a 3.4, una versión de Rails a la
vez, con la suite de pruebas en verde en cada paso. La API se suspende cuando
no tiene tráfico, así que la primera solicitud después de una pausa puede
tardar unos segundos.
