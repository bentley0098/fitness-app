-- Proposals now live in plan_proposals and never touch plan_sessions until
-- approved, so sessions no longer have a "pending" state. Fold any leftovers
-- from the old propose_revision flow back into "planned".
UPDATE "plan_sessions" SET "status" = 'planned' WHERE "status" = 'pending';
