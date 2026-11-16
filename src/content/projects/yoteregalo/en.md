---
title: Yo te regalo
summary: 'A digital gift card marketplace for Bolivia: customers buy gift
  cards for partner businesses, pay by card or bank QR, and receive them by
  email.'
role: Full-stack developer (freelance)
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

Yo te regalo has two parts: a Ruby on Rails API and a Quasar (Vue 3) app that
ships as a website and as a progressive web app. Three kinds of users share it:
customers who buy and send gift cards, businesses that redeem them and get
paid, and the administrators who run the platform.

The API handles card payments with bank verification and bank QR payments,
issues electronic tax invoices, and runs scheduled jobs that reconcile
payments and expire unused orders. Both parts are tested and deployed through
GitLab CI.

The source code is private. The live site is public.
