-- Confirmed 45G / 90G continuous tree Growth semantics.
local Vector = require("WK2/vector")
local Seed = {}

local function learn(tree, extraAffinity)
    local total = Vector.sum(tree.growth)
    for i = 1, 7 do
        local offset = total > 0 and tree.growth[i] / total or 0
        tree.effectiveAffinity[i] = tree.baseAffinity[i] +
            extraAffinity * offset
    end
end

function Seed.grow(tree, absorbed, cfg)
    for i = 1, 7 do
        tree.growth[i] = tree.growth[i] +
            absorbed[i] * tree.effectiveAffinity[i]
    end
    learn(tree, cfg.extraAffinity)

    local total = Vector.sum(tree.growth)
    if tree.stage == "Seed" and total >= cfg.seedlingGrowth then
        tree.stage = "Seedling"
        -- Do NOT reset Growth or reapply the early Affinity offset.
        return "Seedling"
    end
    if tree.stage == "Seedling" and total >= cfg.saplingGrowth then
        tree.stage = "Sapling"
        tree.reserve = Vector.copy(tree.growth) -- per-element 1G -> 1V
        tree.growth = Vector.zero()
        -- Close the early learning axis exactly once at Sapling entry.
        tree.baseAffinity = Vector.copy(tree.effectiveAffinity)
        tree.budGrowth = Vector.zero() -- first Bud immediately appears.
        return "Sapling"
    end
    return nil
end

return Seed
