-- Migrate existing clinics from old plan keys to new plan pricing (2026)
--
-- solo  → starter: $350/mo, 200 SMS, 100 AI
-- team  → growth:  $600/mo, 600 SMS, 250 AI
-- multi → scale:   $1000/mo, 1500 SMS, 600 AI
-- trial and enterprise stay the same

UPDATE "Clinic"
SET
    plan = 'starter',
    "smsMonthlyLimit" = 200,
    "aiMonthlyLimit" = 100,
    "dailyMessageCap" = 100
WHERE plan = 'solo';

UPDATE "Clinic"
SET
    plan = 'growth',
    "smsMonthlyLimit" = 600,
    "aiMonthlyLimit" = 250,
    "dailyMessageCap" = 200
WHERE plan = 'team';

UPDATE "Clinic"
SET
    plan = 'scale',
    "smsMonthlyLimit" = 1500,
    "aiMonthlyLimit" = 600,
    "dailyMessageCap" = 500
WHERE plan = 'multi';
