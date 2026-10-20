-- Source of truth: growth-balance-baseline.md + first-fruit-uh-calibration.md.
-- Calibration candidates are explicit, NOT finalized gameplay settings.
return {
    soilCapacity = 1000,
    soilRetentionPerUH = 0.99,
    soilEfficiencyK = 200,
    rootPreference = {0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90},
    treeBaseAffinity = {0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95},
    extraAffinity = 1,
    singleChannelShare = 0.30,
    seedlingGrowth = 45,
    saplingGrowth = 90,
    reserveCapacity = 180,
    growthCurveMidpoint = 95,
    growthCurveWidth = 12,
    -- Candidate from deterministic 1uh calibration, not a locked rate.
    rootCapCandidatePerUH = {Seed = 2, Seedling = 1.85, Sapling = 16},
    growthBudgetCandidatePerUH = 5.4,
    -- Explicit DEBUG-only soil injection. Not a collectible element ball.
    debugSupplyV = 80
}
