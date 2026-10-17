-- Single unit-hour domain boundary; presentation and real clocks live elsewhere.
local Soil = require("WK2/soil")
local Seed = require("WK2/seed")
local Step = {}

function Step.advance(world, deltaUH, cfg)
    if type(deltaUH) ~= "number" or deltaUH <= 0 or
        deltaUH > 1 or deltaUH ~= deltaUH then
        return false, "INVALID_DELTA_UH"
    end
    if world.tree and world.tree.stage == "Sapling" then
        -- Do not counterfeit Sapling Reserve metabolism or organ settlement.
        return false, "SAPLING_SETTLEMENT_NOT_IMPLEMENTED"
    end

    if not world.soil then
        world.elapsedUH = world.elapsedUH + deltaUH
        return true
    end
    local absorbed = Soil.settle(world.soil, world.tree, deltaUH, cfg)
    local event
    if world.tree then event = Seed.grow(world.tree, absorbed, cfg) end
    world.elapsedUH = world.elapsedUH + deltaUH
    return true, event
end

return Step
