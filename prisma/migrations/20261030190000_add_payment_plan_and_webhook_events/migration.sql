ALTER TABLE "payments"
    ADD COLUMN "plan_id" UUID,
    ADD COLUMN "paid_at" TIMESTAMPTZ(6),
    ADD COLUMN "refund_acknowledged_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_payments_plan" ON "payments"("plan_id");

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "plans"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payment_id" UUID,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_webhook_events_event_id_key"
    ON "payment_webhook_events"("event_id");
CREATE INDEX "idx_payment_webhook_events_payment"
    ON "payment_webhook_events"("payment_id");

ALTER TABLE "payment_webhook_events"
    ADD CONSTRAINT "payment_webhook_events_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
