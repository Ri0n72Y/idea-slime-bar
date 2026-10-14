-- Pure dimensionless functions: no editor APIs and no mutable state.
local Curves = {}

local function clamp(value, low, high)
    return math.max(low, math.min(value, high))
end

local function sigmoid(value)
    return 1 / (1 + math.exp(-value))
end

function Curves.soilEfficiency(soilTotal, cfg)
    local s = clamp(soilTotal, 0, cfg.soilCapacity)
    return math.log(1 + s / cfg.soilEfficiencyK) /
        math.log(1 + cfg.soilCapacity / cfg.soilEfficiencyK)
end

-- M=95/W=12 calibrated preview; no Sapling budget allocation implemented.
function Curves.growthEfficiency(reserveTotal, cfg)
    local capacity = cfg.reserveCapacity
    local m, w = cfg.growthCurveMidpoint, cfg.growthCurveWidth
    local low = sigmoid(-m / w)
    local high = sigmoid((capacity - m) / w)
    local current = sigmoid((clamp(reserveTotal, 0, capacity) - m) / w)
    return clamp((current - low) / (high - low), 0, 1)
end

return Curves
