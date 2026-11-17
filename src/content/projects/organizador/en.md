---
title: Organizador
summary: 'A task organizer in Ruby on Rails with shared tasks, roles and live
  notes. It started in two Rails courses; I then upgraded it to Rails 8.1,
  covered it with tests and deployed it.'
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
  live: https://organizador-production-59cdf977.up.railway.app/
  repo: https://github.com/crehds/organizador
cover: ./cover.jpg
kind: personal
featured: false
status: published
date: 2026-11-16
---

Organizador is a task organizer. Each task has a category, a due date, an
owner and participants with a role, and people add notes to a task without
reloading the page. Permissions decide who can manage each task, who can only
read it and who is kept out.

It started as the project of two Platzi courses on Rails. Afterwards I
upgraded it from Rails 7.0 to 8.1 and from Ruby 3.1 to 3.4, one version at a
time, with an integration test suite I added that stayed green at every step.
I also fixed bugs the course project still had, such as notes that any
signed-in user could add to any task.

On the live site, the "Probar el demo" button creates a temporary account of
your own with sample data and signs you in, with no password. The account and
its data are deleted after 24 hours.
