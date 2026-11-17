---
title: eatIt
summary: 'A REST API in Ruby on Rails for a restaurant: the products on its
  menu and the orders placed for them, with interactive documentation
  generated from the test suite.'
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

eatIt is an API with no front-end: the live link opens its interactive
documentation, where any endpoint can be tried on the public demo data. The
documentation is built from tests that call the real API, so it fails the
test suite when it stops matching what the API does.

The public demo and my private data share one database. Requests without a
token read and change the demo data; a bearer token reaches private records
that visitors cannot see or change. A daily job deletes what visitors changed
and reloads the original menu and orders.

I upgraded it from Rails 7.0 to 8.1 and from Ruby 3.1 to 3.4, one Rails
version at a time, with the test suite green at every step. The API sleeps
when idle, so the first request after a pause can take a few seconds.
