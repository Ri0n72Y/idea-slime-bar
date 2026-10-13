-- F1 developer-only client UI; all authoritative writes use WK_Debug_Write.
-- Attach this mapped script to the WK_DebugRoot client UI root control.
local names = { 'Fire', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo' }
local fields = {
    { 'Soil', 'WK_DBG_SOIL_Elems', 0, true },
    { 'Tree Stage', 'WK_DBG_TREE_Stage', 1, false },
    { 'Tree Reserve', 'WK_DBG_TREE_Elems', 2, true },
    { 'Tree Growth', 'WK_DBG_TREE_Growth', 3, true },
    { 'Base Affinity', 'WK_DBG_TREE_BaseAffinity', 4, true },
    { 'Effective Affinity', 'WK_DBG_TREE_EffectiveAffinity', 5, true },
    { 'Root Preference', 'WK_DBG_TREE_RootPreference', 6, true },
    { 'Last Tick (read-only)', 'WK_DBG_LastGrowthTickAt', -1, false }
}

local root, snapshot, editorText, statusText
local selectedField, selectedElement, draft = 1, 1, 0
local elapsed = 0
local tickRequestsSent = 0
local steps, stepIndex = { 0.01, 0.1, 1, 10, 100 }, 3

local function readField(field)
    return game.GetGlobalCustomVariableValue(Enum.CustomVariableEntityType.Level, field[2])
end

local function at(value, index)
    if value == nil then return nil end
    local ok, item = pcall(function() return value[index] end)
    if ok then return tonumber(item) end
    return nil
end

local function current()
    local f = fields[selectedField]
    local value = readField(f)
    if f[4] then return at(value, selectedElement) end
    return tonumber(value)
end

local function requestRefresh()
    game.ServerSignal('WK_Debug_Refresh'):SendSignal()
end

local function display()
    local lines = {}
    for _, field in ipairs(fields) do
        local value = readField(field)
        if field[4] then
            local entries = {}
            for i = 1, 7 do
                local v = at(value, i)
                entries[i] = names[i] .. ':' .. (v and string.format('%.3f', v) or '?')
            end
            lines[#lines + 1] = field[1] .. '  ' .. table.concat(entries, '  ')
        else
            lines[#lines + 1] = field[1] .. ': ' .. tostring(value or '?')
        end
    end
    local ack = game.GetGlobalCustomVariableValue(
        Enum.CustomVariableEntityType.Level, 'WK_DBG_NextTickRequests')
    local result = game.GetGlobalCustomVariableValue(
        Enum.CustomVariableEntityType.Level, 'WK_DBG_NextTickResult')
    lines[#lines + 1] = 'Next Tick: server ACK=' .. tostring(ack or '?')
        .. ' / sent=' .. tostring(tickRequestsSent)
    lines[#lines + 1] = 'Next Tick result: ' .. tostring(result or '?')
    snapshot.text = table.concat(lines, '\n')
    local f = fields[selectedField]
    local part = f[4] and (' / ' .. names[selectedElement]) or ''
    editorText.text = f[1] .. part .. ' = ' .. string.format('%.3f', draft) .. '  step=' .. tostring(steps[stepIndex])
end

local function selectField(delta)
    selectedField = (selectedField - 1 + delta + #fields) % #fields + 1
    draft = current() or 0
    display()
end

local function selectElement(delta)
    selectedElement = (selectedElement - 1 + delta + 7) % 7 + 1
    draft = current() or 0
    display()
end

local function changeDraft(direction)
    local field = fields[selectedField][3]
    if field < 0 then return end
    local step = field == 1 and 1 or steps[stepIndex]
    local limit = (field == 1 and 2) or (field == 6 and 1) or
        ((field == 4 or field == 5) and 10) or 100000
    draft = math.min(limit, math.max(0, draft + direction * step))
    if field == 1 then draft = math.floor(draft) end
    display()
end

local function changeStep(direction)
    stepIndex = (stepIndex - 1 + direction + #steps) % #steps + 1
    display()
end

local function apply()
    local f = fields[selectedField]
    if f[3] < 0 then
        statusText.text = 'Read-only value'
        return
    end
    local sig = game.ServerSignal('WK_Debug_Write')
    sig:AddInt(f[3])
    sig:AddInt(selectedElement - 1)
    sig:AddFloat(draft)
    sig:SendSignal()
    statusText.text = 'Sent to server; use Refresh to confirm'
end

local function bind(name, handler)
    local control = root:FindChild(name)
    if not control then
        printerr('Missing debug control: ' .. name)
        return
    end
    control:AddCursorEventListener(Enum.CursorEventType.CursorClick, handler)
end

function OnStart()
    root = game.FindClientUIRoot('WK_DebugRoot')
    if not root then
        printerr('Missing WK_DebugRoot client control container')
        script:EnableUpdate(false)
        return
    end
    if not game.IsTestPlay() then
        root:SetVisible(false)
        script:EnableUpdate(false)
        return
    end
    snapshot = root:FindChild('Snapshot')
    editorText = root:FindChild('EditorValue')
    statusText = root:FindChild('Status')
    if not snapshot or not editorText or not statusText then
        printerr('Missing debug text controls')
        script:EnableUpdate(false)
        return
    end
    bind('FieldPrev', function() selectField(-1) end)
    bind('FieldNext', function() selectField(1) end)
    bind('ElementPrev', function() selectElement(-1) end)
    bind('ElementNext', function() selectElement(1) end)
    bind('StepPrev', function() changeStep(-1) end)
    bind('StepNext', function() changeStep(1) end)
    bind('Decrease', function() changeDraft(-1) end)
    bind('Increase', function() changeDraft(1) end)
    bind('Zero', function()
        if fields[selectedField][3] >= 0 then draft = 0; display() end
    end)
    bind('Apply', apply)
    bind('NextTick', function()
        tickRequestsSent = tickRequestsSent + 1
        game.ServerSignal('WK_Debug_NextTick'):SendSignal()
        statusText.text = 'Next Tick requested; check server ACK and result'
        display()
    end)
    bind('ReloadDraft', function() draft = current() or 0; display() end)
    bind('Refresh', function()
        requestRefresh()
        statusText.text = 'Refresh requested; waiting for Level mirror'
    end)
    requestRefresh()
    display()
end

function OnUpdate(dt)
    if not snapshot then return end
    elapsed = elapsed + dt
    if elapsed >= 0.5 then
        elapsed = 0
        display()
    end
end
