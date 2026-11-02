CREATE TYPE "submission_method" AS ENUM ('manual', 'automatic');

ALTER TABLE "attempts"
ADD COLUMN "objective_score" DECIMAL(8,2),
ADD COLUMN "objective_max_score" DECIMAL(8,2),
ADD COLUMN "submitted_via" "submission_method";

CREATE UNIQUE INDEX "evaluations_response_id_key" ON "evaluations"("response_id");
