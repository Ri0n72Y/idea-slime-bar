-- Seed / Seedling Soil -> Root pathway. Mutates only the Soil vector.
local Vector = require("WK2/vector")
local Curves = require("WK2/curves")
local Soil = {}

function Soil.settle(soil, tree, deltaUH, cfg)
    local total = Vector.sum(soil)
    if total > cfg.soilCapacity then
        Vector.scale(soil, cfg.soilCapacity / total)
    end
    Vector.scale(soil, cfg.soilRetentionPerUH ^ deltaUH)
    if not tree then return Vector.zero() end

    -- Stage caps are explicit calibration candidates. One shared soil factor.
    local stageCap = cfg.rootCapCandidatePerUH[tree.stage]
    local sharedCap = stageCap *
        Curves.soilEfficiency(Vector.sum(soil), cfg) * deltaUH
    local absorbed, totalCandidate = {}, 0

    for i = 1, 7 do
        local available = soil[i] * cfg.rootPreference[i]
        local channelCap = stageCap * cfg.singleChannelShare *
            tree.baseAffinity[i] * deltaUH
        absorbed[i] = math.min(available, channelCap)
        totalCandidate = totalCandidate + absorbed[i]
    end
    local factor = totalCandidate > sharedCap and
        sharedCap / totalCandidate or 1
    for i = 1, 7 do
        absorbed[i] = absorbed[i] * factor
        soil[i] = soil[i] - absorbed[i]
    end
    return absorbed
end

return Soil
