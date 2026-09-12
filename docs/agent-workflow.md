# Discord → zCRM workflow

JayZoo can operate the CRM directly through the agent API. Every request must include:

```text
X-API-Key: <JAYZOO_API_KEY>
X-Business-ID: <business UUID>
```

Use the business UUID for the active marketing workspace. Keep the Discord message ID as
`external_ref`; this makes retries safe.

## Common actions

When a prospect replies:

1. `PUT /api/v1/agent/leads` with company/contact details, `status=contacted`, and the
   Discord message ID as `external_ref`.
2. `POST /api/v1/agent/leads/{id}/interactions` with `interaction_type=reply`, the
   message summary, and the same Discord message ID.
3. Create a reminder when a next action/date is known.

When a proposal is requested:

1. `PATCH /api/v1/agent/leads/{id}/status` with `status=proposal`.
2. Upload the quotation to `POST /api/v1/leads/{id}/attachments` as multipart form data,
   using `kind=quotation`.
3. Log a `proposal_sent` interaction and add a follow-up reminder.

The agent endpoints are deliberately narrow. They do not grant business administration;
business and membership changes remain authenticated admin operations.
