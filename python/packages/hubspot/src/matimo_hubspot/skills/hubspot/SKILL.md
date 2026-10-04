---
name: hubspot
description: "Complete guide to all HubSpot CRM tools — contacts, companies, deals, tickets, products, line items, pipelines, and entity management."
version: "1.0.0"
license: "MIT"
metadata:
  category: "CRM"
  difficulty: "intermediate"
  apply-to: "hubspot-create-company hubspot-create-contact hubspot-create-custom-object hubspot-create-deal hubspot-create-invoice hubspot-create-lead hubspot-create-line-item hubspot-create-order hubspot-create-product hubspot-create-ticket hubspot-delete-company hubspot-delete-contact hubspot-delete-custom-object hubspot-delete-deal hubspot-delete-invoice hubspot-delete-lead hubspot-delete-line-item hubspot-delete-order hubspot-delete-product hubspot-delete-ticket hubspot-get-company hubspot-get-contact hubspot-get-custom-object hubspot-get-deal hubspot-get-invoice hubspot-get-lead hubspot-get-line-item hubspot-get-order hubspot-get-product hubspot-get-ticket hubspot-list-companies hubspot-list-contacts hubspot-list-custom-objects hubspot-list-deals hubspot-list-invoices hubspot-list-leads hubspot-list-line-items hubspot-list-orders hubspot-list-products hubspot-list-tickets hubspot-update-company hubspot-update-contact hubspot-update-custom-object hubspot-update-deal hubspot-update-invoice hubspot-update-lead hubspot-update-line-item hubspot-update-order hubspot-update-product hubspot-update-ticket"
  author: "Matimo"
  tags: "hubspot,crm,contacts,deals,companies,pipeline,sales"
---

# HubSpot

Complete guide to using Matimo's HubSpot CRM tools for managing contacts, companies, deals, tickets, and all CRM entities.

## Entity Types & Tools

Every entity has the same five operations. Delete tools ask for approval before running.

| Entity | Create | Get | Update | Delete | List |
|--------|--------|-----|--------|--------|------|
| Contacts | `hubspot-create-contact` | `hubspot-get-contact` | `hubspot-update-contact` | `hubspot-delete-contact` | `hubspot-list-contacts` |
| Companies | `hubspot-create-company` | `hubspot-get-company` | `hubspot-update-company` | `hubspot-delete-company` | `hubspot-list-companies` |
| Deals | `hubspot-create-deal` | `hubspot-get-deal` | `hubspot-update-deal` | `hubspot-delete-deal` | `hubspot-list-deals` |
| Tickets | `hubspot-create-ticket` | `hubspot-get-ticket` | `hubspot-update-ticket` | `hubspot-delete-ticket` | `hubspot-list-tickets` |
| Leads | `hubspot-create-lead` | `hubspot-get-lead` | `hubspot-update-lead` | `hubspot-delete-lead` | `hubspot-list-leads` |
| Products | `hubspot-create-product` | `hubspot-get-product` | `hubspot-update-product` | `hubspot-delete-product` | `hubspot-list-products` |
| Line Items | `hubspot-create-line-item` | `hubspot-get-line-item` | `hubspot-update-line-item` | `hubspot-delete-line-item` | `hubspot-list-line-items` |
| Orders | `hubspot-create-order` | `hubspot-get-order` | `hubspot-update-order` | `hubspot-delete-order` | `hubspot-list-orders` |
| Invoices | `hubspot-create-invoice` | `hubspot-get-invoice` | `hubspot-update-invoice` | `hubspot-delete-invoice` | `hubspot-list-invoices` |
| Custom Objects | `hubspot-create-custom-object` | `hubspot-get-custom-object` | `hubspot-update-custom-object` | `hubspot-delete-custom-object` | `hubspot-list-custom-objects` |

There are no tools for quotes, tasks, notes, meetings, calls or associations.

## Authentication

Requires `MATIMO_HUBSPOT_API_KEY`: a private app access token (or an OAuth access token) with the CRM scopes for the objects you use, e.g. `crm.objects.contacts.read` and `crm.objects.contacts.write`.

---

## Core Operations

### Create

Create tools take the entity's fields as top-level parameters (Matimo wraps them in HubSpot's `properties` object):

| Tool | Parameters (* required) |
|------|-------------------------|
| `hubspot-create-contact` / `hubspot-create-lead` | `email`*, `firstname`, `lastname`, `phone`, `company` |
| `hubspot-create-company` | `name`*, `domain` |
| `hubspot-create-deal` | `dealname`*, `dealstage`*, `pipeline`, `amount`, `closedate` |
| `hubspot-create-ticket` | `subject`*, `description`, `priority`, `ticketstatus` |
| `hubspot-create-product` | `name`*, `description`, `price` |
| `hubspot-create-line-item` | `name`, `quantity`, `price`, `description` |
| `hubspot-create-order` | `ordernumber`, `amount`, `orderdate`, `status` |
| `hubspot-create-invoice` | `hs_currency` |
| `hubspot-create-custom-object` | `object_type`*, `name`, `description` |

```json
{ "email": "alice@acme.com", "firstname": "Alice", "lastname": "Smith" }
```

Returns the created object with its `id`. To set a field the create tool doesn't list, create the object and then update it.

### Get

Get tools take `id`; most also take `properties` (an array of field names to return). Custom objects also take `object_type`.

### Update

Update tools take `id` and `properties`, an object of the fields to change:

```json
{ "id": "12345", "properties": { "dealstage": "closedwon", "amount": "5000" } }
```

### Delete

Delete tools take `id` (and `object_type` for custom objects), ask for approval, and move the object to HubSpot's recycling bin.

### List

List tools take optional `limit` (max 100) and `after` (the cursor from the previous page's `paging.next.after`). Contacts, leads, products, line items, orders, invoices and custom objects also take `properties`.

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

`hubspot-create-ticket` sends its `description`, `priority` and `ticketstatus` parameters under those names, which are not HubSpot's standard ticket fields. Create the ticket with `subject` (and the pipeline stage your portal requires), then set `content`, `hs_ticket_priority` and `hs_pipeline_stage` with `hubspot-update-ticket`.

---

## Common Workflows

### Lead Qualification Pipeline
1. Create contact: `hubspot-create-contact`
2. Create company: `hubspot-create-company`
3. Create deal: `hubspot-create-deal` in first pipeline stage
4. Progress deal: `hubspot-update-deal` with a new `dealstage`

### Support Ticket Flow
1. Create ticket: `hubspot-create-ticket`
2. Update status: `hubspot-update-ticket` with `properties.hs_pipeline_stage` as work progresses
3. Close: `hubspot-update-ticket` to the closed stage

### Bulk Operations
1. List entities with pagination (`after` cursor)
2. Process each entity
3. HubSpot rate limit: 100 requests per 10 seconds

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 `Unauthorized` | Invalid token | Check `MATIMO_HUBSPOT_API_KEY` |
| 404 `Not Found` | Invalid object ID | Verify ID exists |
| 409 `Conflict` | Duplicate (e.g., email exists) | Search first, then create |
| 429 `Rate limit` | Too many requests | 100 req/10 sec — implement backoff |
| 400 `Property doesn't exist` | Wrong property name | Check HubSpot property definitions |
