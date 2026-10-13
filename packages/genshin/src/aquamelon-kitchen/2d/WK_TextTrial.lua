-- Aquamelon Kitchen: single-player CLIENT-ONLY text UI trial.
-- Not F1/F2 authoritative simulation. The partial rules below mirror Web v0.
local names = {'火', '水', '风', '雷', '草', '冰', '岩'}
local initialAffinity = {0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95}
local rootPreference = {0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90}
local stages = {'种子', '幼苗', '树苗'}
local root, snapshot, history, state
local selected, elapsed = 2, 0

local function zeros()
    return {0, 0, 0, 0, 0, 0, 0}
end

local function copy(values)
    local result = {}
    for i = 1, 7 do result[i] = values[i] end
    return result
end

local function total(values)
    local amount = 0
    for i = 1, 7 do amount = amount + values[i] end
    return amount
end

local function note(message)
    table.insert(state.logs, '第' .. state.ticks .. 'Tick：' .. message)
    if #state.logs > 2 then table.remove(state.logs, 1) end
end

local function reset()
    state = {soilPlaced = false, tree = nil, soil = zeros(), ticks = 0,
        logs = {'试玩：铺土→播种→输入元素'}}
    selected, elapsed = 2, 0
end

local function tick()
    state.ticks = state.ticks + 1
    if not state.soilPlaced then return end

    local soilTotal = total(state.soil)
    if soilTotal > 100 then
        for i = 1, 7 do
            state.soil[i] = state.soil[i] * 100 / soilTotal
        end
    end
    for i = 1, 7 do state.soil[i] = state.soil[i] * 0.99 end
    local tree = state.tree
    if not tree then return end

    local absorbed, budget = {}, 0
    for i = 1, 7 do
        local cap = 6 * 0.3 * tree.base[i]
        absorbed[i] = math.min(state.soil[i] * rootPreference[i], cap)
        budget = budget + absorbed[i]
    end
    local factor = budget > 6 and 6 / budget or 1
    for i = 1, 7 do
        absorbed[i] = absorbed[i] * factor
        state.soil[i] = state.soil[i] - absorbed[i]
    end

    if tree.stage < 2 then
        for i = 1, 7 do
            tree.growth[i] = tree.growth[i] + absorbed[i] * tree.effective[i]
        end
        local growthTotal = total(tree.growth)
        for i = 1, 7 do
            tree.effective[i] = tree.base[i] +
                (growthTotal > 0 and tree.growth[i] / growthTotal or 0)
        end
        local threshold = tree.stage == 0 and 45 or 90
        if growthTotal >= threshold then
            tree.stage = tree.stage + 1
            tree.base = copy(tree.effective)
            tree.effective = copy(tree.base)
            tree.growth = zeros()
            note('成长为' .. stages[tree.stage + 1])
        end
    else
        -- Sapling metabolism, buds, leaves and fruit require the full Web domain.
        for i = 1, 7 do tree.reserve[i] = tree.reserve[i] + absorbed[i] end
    end
end

local function vectorText(label, values)
    local parts = {}
    for i = 1, 7 do
        local num = values[i] < 10 and string.format('%.1f', values[i])
            or string.format('%.0f', values[i])
        parts[i] = names[i] .. num
    end
    return label .. ' ' .. table.concat(parts, ' ', 1, 4) ..
        '\n     ' .. table.concat(parts, ' ', 5, 7)
end

local function display()
    if not snapshot then return end
    local tree = state.tree
    local stage = tree and stages[tree.stage + 1] or '未播种'
    local progress = tree and string.format('%.1f', total(tree.growth)) or '0'
    local goal = tree and (tree.stage == 0 and '/45' or
        tree.stage == 1 and '/90' or '') or ''
    snapshot.text = table.concat({
        '水瓜厨房 · 文字试玩',
        'Tick ' .. state.ticks .. '｜10秒/次｜元素 ' .. names[selected],
        (state.soilPlaced and '有土' or '空地') .. '｜' .. stage ..
            '｜成长 ' .. progress .. goal,
        vectorText('土壤', state.soil),
        vectorText('Growth', tree and tree.growth or zeros()),
        vectorText('Reserve', tree and tree.reserve or zeros())
    }, '\n')
    history.text = table.concat(state.logs, '\n')
end

local function act(message, command)
    if command() then note(message) end
    display()
end

local function bind(name, callback)
    local control = root:FindChild(name)
    if control then
        control:AddCursorEventListener(Enum.CursorEventType.CursorClick, callback)
    else
        printerr('WK_TextTrial missing button: ' .. name)
    end
end

function OnStart()
    print('WK_TextTrial OnStart')
    root = game.FindClientUIRoot('WK_TextTrailRoot')
    if not root then
        local available = {}
        for _, candidate in ipairs(game.GetClientUIRoots() or {}) do
            available[#available + 1] = candidate.name or '(unnamed)'
        end
        printerr('WK_TextTrailRoot not found; client UI roots: ' ..
            table.concat(available, ', '))
        return
    end
    snapshot = root:FindChild('Snapshot')
    history = root:FindChild('History')
    if not snapshot or not history then
        printerr('WK_TextTrial missing Snapshot / History text control')
        return
    end
    reset()
    bind('PlaceSoil', function()
        act('铺设土壤', function()
            if state.soilPlaced then return false end
            state.soilPlaced = true
            return true
        end)
    end)
    bind('PlantSeed', function()
        act('种下水瓜种子', function()
            if not state.soilPlaced or state.tree then return false end
            state.tree = {stage = 0, growth = zeros(), reserve = zeros(),
                base = copy(initialAffinity), effective = copy(initialAffinity)}
            return true
        end)
    end)
    bind('ElementPrev', function()
        selected = (selected + 5) % 7 + 1
        display()
    end)
    bind('ElementNext', function()
        selected = selected % 7 + 1
        display()
    end)
    bind('AddElement', function()
        act('土壤 +' .. names[selected] .. ' 10（试玩快捷输入）', function()
            if not state.soilPlaced then return false end
            state.soil[selected] = state.soil[selected] + 10
            return true
        end)
    end)
    bind('NextTick', function() tick(); display() end)
    bind('Next10Ticks', function()
        for _ = 1, 10 do tick() end
        note('手动推进10 Tick')
        display()
    end)
    bind('Reset', function() reset(); display() end)
    display()
    script:EnableUpdate(true)
end

function OnUpdate(dt)
    if not snapshot or type(dt) ~= 'number' or dt <= 0 then return end
    elapsed = elapsed + math.min(dt, 1)
    if elapsed >= 10 then
        elapsed = elapsed - 10
        tick()
        display()
    end
end
