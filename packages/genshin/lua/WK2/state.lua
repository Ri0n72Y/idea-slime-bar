-- In-memory trial state only: no persistence or network authority.
local Vector = require("WK2/vector")
local State = {}

function State.new()
    return {soil = nil, tree = nil, elapsedUH = 0}
end

function State.placeSoil(world)
    if world.soil then return false end
    world.soil = Vector.zero()
    return true
end

function State.plant(world, cfg)
    if not world.soil or world.tree then return false end
    world.tree = {
        stage = "Seed",
        growth = Vector.zero(),
        reserve = nil, -- Seed / Seedling have no Reserve, not zero Reserve.
        baseAffinity = Vector.copy(cfg.treeBaseAffinity),
        effectiveAffinity = Vector.copy(cfg.treeBaseAffinity),
        budGrowth = nil,
        leaves = {}
    }
    return true
end

-- Not production cultivation. The user manually chooses an element for debug.
function State.debugSupply(world, index, amount)
    if not world.soil or index < 1 or index > 7 or amount <= 0 then
        return false
    end
    world.soil[index] = world.soil[index] + amount
    -- Overflow is resolved proportionally at the next Growth settlement.
    return true
end

return State
