-- Independent Miliastra 7.1 client layout script: fixed one-screen UI.
-- Snapshot/History must be TextBox controls, not scrolling TextWindows.
local names = {'PlaceSoil', 'PlantSeed', 'ElementPrev', 'ElementNext',
    'AddElement', 'NextTick', 'Next10Ticks', 'Reset'}
local root, snapshot, history
local lastW, lastH = 0, 0

local function place(control, x, y, width, height)
    control:SetAnchorMin(0.5, 0.5)
    control:SetAnchorMax(0.5, 0.5)
    control:SetPivot(0.5, 0.5)
    control:SetAnchoredPosition(x, y)
    control:SetSizeDelta(width, height)
end

local function layout()
    local w, h = game.GetUICanvasSize()
    if not w or not h or w <= 0 or h <= 0 then return end
    if w == lastW and h == lastH then return end
    lastW, lastH = w, h

    local margin = math.max(8, math.min(w, h) * 0.025)
    local gap, width = 8, w - 2 * margin
    local columns = w >= h and 4 or 2
    local rows = 8 / columns
    local buttonH = math.min(56, h * (columns == 4 and 0.12 or 0.075))
    local buttonsH = rows * buttonH + (rows - 1) * gap
    local bodyH = h - 2 * margin - buttonsH - 2 * gap
    local historyH = math.max(32, bodyH * 0.18)
    local snapshotH = bodyH - historyH - gap
    local bottom, left = -h / 2 + margin, -w / 2 + margin

    place(snapshot, 0, bottom + buttonsH + 2 * gap +
        historyH + snapshotH / 2, width, snapshotH)
    place(history, 0, bottom + buttonsH + gap +
        historyH / 2, width, historyH)

    snapshot.fontSize = math.max(12, math.floor(math.min(22,
        width / 29, snapshotH / 12)))
    history.fontSize = math.max(12, math.floor(math.min(18,
        width / 29, historyH / 3)))
    snapshot.adaptiveFontSize, history.adaptiveFontSize = true, true
    snapshot.minimumFontSize, history.minimumFontSize = 11, 11

    local buttonW = (width - (columns - 1) * gap) / columns
    for i, name in ipairs(names) do
        local control = root:FindChild(name)
        if control then
            local col = (i - 1) % columns
            local row = math.floor((i - 1) / columns)
            place(control, left + buttonW * (col + 0.5) + gap * col,
                bottom + buttonsH - buttonH * (row + 0.5) -
                    gap * row, buttonW, buttonH)
        end
    end
end

function OnStart()
    root = game.FindClientUIRoot('WK_TextTrialRoot')
    if not root then
        printerr('WK_TextTrialLayout: missing WK_TextTrialRoot')
        return
    end
    snapshot, history = root:FindChild('Snapshot'), root:FindChild('History')
    if not snapshot or not history then
        printerr('WK_TextTrialLayout: missing Snapshot / History')
        return
    end
    layout()
    script:EnableUpdate(true)
end

function OnUpdate(_dt)
    if snapshot then layout() end
end
