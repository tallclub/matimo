---
name: hubspot
description: "Complete guide to all HubSpot CRM tools — contacts, companies, deals, tickets, products, line items, pipelines, and entity management."
version: "1.0.0"
license: "MIT"
metadata:
  category: "CRM"
  difficulty: "intermediate"
  apply-to: "hubspot-create-contact hubspot-get-contact hubspot-update-contact hubspot-delete-contact hubspot-list-contacts hubspot-create-company hubspot-get-company hubspot-update-company hubspot-delete-company hubspot-list-companies hubspot-create-deal hubspot-get-deal hubspot-update-deal hubspot-delete-deal hubspot-list-deals hubspot-create-ticket hubspot-get-ticket hubspot-update-ticket hubspot-delete-ticket hubspot-list-tickets hubspot-create-product hubspot-get-product hubspot-update-product hubspot-delete-product hubspot-list-products hubspot-create-line-item hubspot-get-line-item hubspot-update-line-item hubspot-delete-line-item hubspot-list-line-items hubspot-create-quote hubspot-get-quote hubspot-update-quote hubspot-delete-quote hubspot-list-quotes hubspot-create-task hubspot-get-task hubspot-update-task hubspot-delete-task hubspot-list-tasks hubspot-create-note hubspot-get-note hubspot-update-note hubspot-delete-note hubspot-list-notes hubspot-create-meeting hubspot-get-meeting hubspot-update-meeting hubspot-delete-meeting hubspot-list-meetings hubspot-create-call hubspot-get-call hubspot-update-call hubspot-delete-call hubspot-list-calls"
  author: "Matimo"
  tags: "hubspot,crm,contacts,deals,companies,pipeline,sales"
---

# HubSpot

Complete guide to using Matimo's HubSpot CRM tools for managing contacts, companies, deals, tickets, and all CRM entities.

## Entity Types & Tools

HubSpot tools follow a CRUD pattern. Each entity type has 5 operations:

| Entity | Create | Get | Update | Delete | List |
|--------|--------|-----|--------|--------|------|
| Contacts | `hubspot-create-contact` | `hubspot-get-contact` | `hubspot-update-contact` | `hubspot-delete-contact` | `hubspot-list-contacts` |
| Companies | `hubspot-create-company` | `hubspot-get-company` | `hubspot-update-company` | `hubspot-delete-company` | `hubspot-list-companies` |
| Deals | `hubspot-create-deal` | `hubspot-get-deal` | `hubspot-update-deal` | `hubspot-delete-deal` | `hubspot-list-deals` |
| Tickets | `hubspot-create-ticket` | `hubspot-get-ticket` | `hubspot-update-ticket` | `hubspot-delete-ticket` | `hubspot-list-tickets` |
| Products | `hubspot-create-product` | `hubspot-get-product` | `hubspot-update-product` | `hubspot-delete-product` | `hubspot-list-products` |
| Line Items | `hubspot-create-line-item` | `hubspot-get-line-item` | `hubspot-update-line-item` | `hubspot-delete-line-item` | `hubspot-list-line-items` |
| Quotes | `hubspot-create-quote` | `hubspot-get-quote` | `hubspot-update-quote` | `hubspot-delete-quote` | `hubspot-list-quotes` |
| Tasks | `hubspot-create-task` | `hubspot-get-task` | `hubspot-update-task` | `hubspot-delete-task` | `hubspot-list-tasks` |
| Notes | `hubspot-create-note` | `hubspot-get-note` | `hubspot-update-note` | `hubspot-delete-note` | `hubspot-list-notes` |
| Meetings | `hubspot-create-meeting` | `hubspot-get-meeting` | `hubspot-update-meeting` | `hubspot-delete-meeting` | `hubspot-list-meetings` |
| Calls | `hubspot-create-call` | `hubspot-get-call` | `hubspot-update-call` | `hubspot-delete-call` | `hubspot-list-calls` |

## Authentication

Requires `HUBSPOT_ACCESS_TOKEN` (private app token) or OAuth2. Token needs scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`, etc.

---

## Core Operations

### Create

All create tools accept a `properties` object:
```json
{ "properties": { "email": "alice@acme.com", "firstname": "Alice", "lastname": "Smith" } }
```
Returns the created object with its `id`.

### Get

All get tools accept an `objectId` (string) and optional `properties` list to limit returned fields.

### Update

All update tools accept `objectId` and `properties` with fields to change.

### Delete

All delete tools accept `objectId`. Moves to recycling bin (recoverable for 90 days).

### List

All list tools accept optional `limit` (max 100), `after` (cursor for pagination), and `properties` (fields to return).

---

## Contacts

**Key properties:** `email`, `firstname`, `lastname`, `phone`, `company`, `website`, `lifecyclestage` (subscriber → lead → opportunity → customer).

**Best practices:**
- Always deduplicate by email before creating
- Set `lifecyclestage` appropriately
- Use `hs_lead_status` to track sales qualification

---

## Companies

**Key properties:** `name`, `domain`, `industry`, `numberofemployees`, `annualrevenue`, `city`, `state`, `country`.

**Best practices:**
- Use `domain` as the unique identifier
- Associate contacts to companies after creation

---

## Deals

**Key properties:** `dealname`, `dealstage`, `pipeline`, `amount`, `closedate`, `hubspot_owner_id`.

**Pipeline stages** (default): appointmentscheduled → qualifiedtobuy → presentationscheduled → decisionmakerboughtin → contractsent → closedwon / closedlost.

**Best practices:**
- Always set `pipeline` when creating
- Update `dealstage` as deal progresses
- Set `amount` and `closedate` for forecasting

---

## Tickets

**Key properties:** `subject`, `content`, `hs_pipeline`, `hs_pipeline_stage`, `hs_ticket_priority` (HIGH/MEDIUM/LOW).

---

## Engagement Entities

Tasks, Notes, Meetings, and Calls are engagement objects that track interactions.

**Tasks:** `hs_task_subject`, `hs_task_body`, `hs_task_status` (NOT_STARTED/IN_PROGRESS/COMPLETED), `hs_task_priority`.
**Notes:** `hs_note_body`, `hs_timestamp`.
**Meetings:** `hs_meeting_title`, `hs_meeting_body`, `hs_meeting_start_time`, `hs_meeting_end_time`.
**Calls:** `hs_call_title`, `hs_call_body`, `hs_call_duration`, `hs_call_direction` (INBOUND/OUTBOUND).

---

## Common Workflows

### Lead Qualification Pipeline
1. Create contact: `hubspot-create-contact`
2. Create company: `hubspot-create-company`
3. Create deal: `hubspot-create-deal` in first pipeline stage
4. Log activities: `hubspot-create-note`, `hubspot-create-call`
5. Progress deal: `hubspot-update-deal` to advance stage

### Support Ticket Flow
1. Create ticket: `hubspot-create-ticket` with priority
2. Log investigation: `hubspot-create-note`
3. Update status: `hubspot-update-ticket` as work progresses
4. Close: `hubspot-update-ticket` to closed stage

### Bulk Operations
1. List entities with pagination (`after` cursor)
2. Process each entity
3. HubSpot rate limit: 100 requests per 10 seconds

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 `Unauthorized` | Invalid token | Check `HUBSPOT_ACCESS_TOKEN` |
| 404 `Not Found` | Invalid object ID | Verify ID exists |
| 409 `Conflict` | Duplicate (e.g., email exists) | Search first, then create |
| 429 `Rate limit` | Too many requests | 100 req/10 sec — implement backoff |
| 400 `Property doesn't exist` | Wrong property name | Check HubSpot property definitions |
