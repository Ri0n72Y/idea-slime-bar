-- Miliastra client entry. Editor owns every UI position and property.
-- All imported WK2/* Lua modules need Client Script Resource Explorer maps.
local Config = require("WK2/config")
local State = require("WK2/state")
local Step = require("WK2/step")
local Present = require("WK2/present")
local root, snapshot, history
local world, selected, messages = State.new(), 2, {}

local function note(message)
    messages[#messages + 1] = message
    if #messages > 2 then table.remove(messages, 1) end
end

local function render()
    snapshot.text = Present.snapshot(world, selected)
    history.text = table.concat(messages, "\n")
end

local function bind(name, fn)
    local button = root:FindChild(name)
    if not button then
        printerr("WK2 missing UI button: " .. name)
        return
    end
    button:AddCursorEventListener(Enum.CursorEventType.CursorClick, fn)
end

local function debugStep(count)
    local completed, lastEvent, reason = 0, nil, nil
    for _ = 1, count do
        local ok, event = Step.advance(world, 1, Config)
        if not ok then reason = event; break end
        completed = completed + 1
        if event then lastEvent = event end
    end
    note("推进 " .. completed .. " uh" ..
        (lastEvent and (" -> " .. lastEvent) or "") ..
        (reason and (" [" .. reason .. "]") or ""))
    render()
end

function OnStart()
    root = script.object -- Confirmed in creator's real Miliastra UI.
    if not root then printerr("WK2 has no attached client UI host"); return end
    snapshot, history = root:FindChild("Snapshot"), root:FindChild("History")
    if not snapshot or not history then
        printerr("WK2 requires Snapshot and History under " ..
            tostring(root.name))
        return
    end
    note("新基线调试：手动推进 uh；非服务端权威计算")
    bind("PlaceSoil", function()
        note(State.placeSoil(world) and "铺土" or "无法重复铺土"); render()
    end)
    bind("PlantSeed", function()
        note(State.plant(world, Config) and "播种" or "需要空树位+土壤")
        render()
    end)
    bind("ElementPrev", function()
        selected = (selected + 5) % 7 + 1; render()
    end)
    bind("ElementNext", function()
        selected = selected % 7 + 1; render()
    end)
    bind("AddElement", function()
        if State.debugSupply(world, selected, Config.debugSupplyV) then
            note("DEBUG: 土壤注入 80V（不是元素球）")
        else note("先铺土") end
        render()
    end)
    bind("NextTick", function() debugStep(1) end)
    bind("Next10Ticks", function() debugStep(10) end)
    bind("Reset", function()
        world, selected, messages = State.new(), 2, {}
        note("已重置本地试玩"); render()
    end)
    print("WK2: attached " .. tostring(root.name))
    render()
end
