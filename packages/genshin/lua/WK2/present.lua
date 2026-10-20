-- Read-only projection for manually arranged editor widgets.
local Vector = require("WK2/vector")
local Present = {}
local names = {"火", "水", "风", "雷", "草", "冰", "岩"}
local function printVector(label, values)
    if not values then return label .. ": —" end
    local parts = {}
    for i = 1, 7 do
        parts[i] = names[i] .. string.format("%.1f", values[i])
    end
    return label .. " " .. table.concat(parts, " ", 1, 4) ..
        "\n    " .. table.concat(parts, " ", 5, 7)
end

function Present.snapshot(world, selected)
    local tree = world.tree
    local stage = tree and tree.stage or "未播种"
    local growth = tree and Vector.sum(tree.growth) or 0
    return table.concat({
        "水瓜厨房 · Lua 新基线试玩",
        "进度: " .. string.format("%.2f uh", world.elapsedUH) ..
            " / 选择 " .. names[selected],
        "土地: " .. (world.soil and "已铺土" or "空地") ..
            " / " .. stage .. " / Growth " .. string.format("%.1f", growth),
        printVector("Soil", world.soil),
        printVector("Growth", tree and tree.growth or nil),
        printVector("Reserve", tree and tree.reserve or nil),
        tree and tree.stage == "Sapling" and
            "Sapling 结算尚未接入；不会伪造生长" or ""
    }, "\n")
end

return Present
