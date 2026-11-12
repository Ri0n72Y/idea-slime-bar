-- 璃月厨房 U1：由 Lua 实例化 16:9 界面。资源模板须先在千星编辑器注册。
-- 此脚本仅负责主屏、七格选择与反馈；不创建 U2 种子或推进游戏日。

local BASE_WIDTH, BASE_HEIGHT = 1920, 1080
local SCENE_NAME = "LK_U1_Runtime"

-- 唯一布局来源：以 1920x1080 的左上角为坐标原点，运行时统一缩放。
local LAYOUT = {
    header    = { x = 40,   y = 22,  w = 1840, h = 102, title = "璃月厨房" },
    visitor   = { x = 40,   y = 145, w = 340,  h = 565, title = "访客" },
    crystal   = { x = 666,  y = 149, w = 518,  h = 518, title = "洞天水晶球" },
    orders    = { x = 1470, y = 145, w = 410,  h = 352, title = "限时委托" },
    discovery = { x = 1470, y = 517, w = 410,  h = 193, title = "探索地图" },
    shell     = { x = 40,   y = 742, w = 340,  h = 308, title = "剥壳" },
    inventory = { x = 400,  y = 742, w = 1040, h = 140, title = "物品栏" },
    storage   = { x = 400,  y = 902, w = 1040, h = 148, title = "仓储" },
    juicer    = { x = 1470, y = 742, w = 410,  h = 308, title = "榨汁 / 装杯" },
    feedback  = { x = 400,  y = 674, w = 1040, h = 49 },
    plots = {
        { id = "P01", x = 930,  y = 407, unlocked = true },
        { id = "P02", x = 930,  y = 252, unlocked = false },
        { id = "P03", x = 1063, y = 330, unlocked = false },
        { id = "P04", x = 1063, y = 484, unlocked = false },
        { id = "P05", x = 930,  y = 561, unlocked = false },
        { id = "P06", x = 797,  y = 484, unlocked = false },
        { id = "P07", x = 797,  y = 330, unlocked = false },
    },
}

-- 这些参数必须由脚本映射从编辑器实际注册的客户端控件模板填写。
-- 空值或非法值直接报错退出；不猜测模板索引，也不使用模拟器私有造控件接口。
local TEMPLATE_PARAMS = {
    container = "LK_TPL_CONTAINER",
    frame = "LK_TPL_FRAME",
    orb = "LK_TPL_ORB",
    hexOpen = "LK_TPL_HEX_OPEN",
    hexLocked = "LK_TPL_HEX_LOCKED",
    selection = "LK_TPL_SELECTION",
    text = "LK_TPL_TEXT",
    hit = "LK_TPL_HIT",
}

local Game = {
    day = 1,
    adeptalEnergy = { balance = 0 },
    selectedPlotId = nil,
    plots = {},
    feedback = "点击已开垦地格可选择或取消",
}
for _, plot in ipairs(LAYOUT.plots) do
    Game.plots[plot.id] = { id = plot.id, unlocked = plot.unlocked }
end

local Ui = {
    root = nil,
    scene = nil,
    controls = {},
    layouts = {},
    listeners = {},
    templates = {},
    canvasWidth = 0,
    canvasHeight = 0,
}

local function log(message)
    print("[LK/U1] " .. message)
end

local function detachListeners()
    for _, listener in ipairs(Ui.listeners) do
        if listener.area and listener.area.alive then
            listener.area:RemoveCursorEventListener(listener.eventType, listener.callback)
        end
    end
    Ui.listeners = {}
end

local function destroyScene(root)
    -- 也回收脚本重新装载后留下的同名场景，保持单一实例。
    local old = root and root.alive and root:GetChild(SCENE_NAME)
    if old and old.alive then
        game.DestroyClientUIControl(old)
    elseif Ui.scene and Ui.scene.alive then
        game.DestroyClientUIControl(Ui.scene)
    end
    Ui.scene = nil
    Ui.controls = {}
    Ui.layouts = {}
end

local function cleanup(root)
    detachListeners()
    destroyScene(root or Ui.root)
end

local function readTemplates()
    for key, paramName in pairs(TEMPLATE_PARAMS) do
        local index = script:GetParam(paramName)
        if type(index) ~= "number" or index <= 0 or index ~= math.floor(index) then
            error("missing_template_index " .. paramName)
        end
        Ui.templates[key] = index
    end
end

local function layoutControl(control, box, textSize)
    local scale = math.min(Ui.canvasWidth / BASE_WIDTH, Ui.canvasHeight / BASE_HEIGHT)
    local centerX = box.x + box.w / 2
    local centerY = box.y + box.h / 2
    -- 画布 API 为左下原点；设计图以左上为原点。
    control:SetAnchorMin(0.5, 0.5)
    control:SetAnchorMax(0.5, 0.5)
    control:SetPivot(0.5, 0.5)
    control:SetAnchoredPosition((centerX - BASE_WIDTH / 2) * scale,
        (BASE_HEIGHT / 2 - centerY) * scale)
    control:SetSizeDelta(box.w * scale, box.h * scale)
    if textSize then
        control.fontSize = math.max(12, math.floor(textSize * scale + 0.5))
    end
end

local function create(kind, name, box, textSize)
    local control = game.InstantiateClientUIControl(Ui.templates[kind], Ui.scene)
    if not control then
        error("instantiate_failed " .. name .. " template=" .. kind)
    end
    control.name = name
    Ui.controls[name] = control
    Ui.layouts[name] = { rect = box, fontSize = textSize }
    layoutControl(control, box, textSize)
    return control
end

local function text(name, value, box, fontSize)
    local control = create("text", name, box, fontSize or 24)
    control.text = value
    return control
end

local function inner(region, dx, dy, w, h)
    return { x = region.x + dx, y = region.y + dy, w = w, h = h }
end

local function createRegions()
    local names = { "header", "visitor", "crystal", "orders", "discovery",
        "shell", "inventory", "storage", "juicer", "feedback" }
    for _, key in ipairs(names) do
        local region = LAYOUT[key]
        local template = key == "crystal" and "orb" or "frame"
        create(template, "LK_F_" .. key, region)
    end

    local heading = {
        { "visitor", "LK_T_VisitorHeading" },
        { "orders", "LK_T_OrderHeading" },
        { "discovery", "LK_T_DiscoveryHeading" },
        { "shell", "LK_T_ShellHeading" },
        { "inventory", "LK_T_InventoryHeading" },
        { "storage", "LK_T_StorageHeading" },
        { "juicer", "LK_T_JuicerHeading" },
    }
    for _, field in ipairs(heading) do
        local region = LAYOUT[field[1]]
        text(field[2], region.title, inner(region, 24, 14, region.w - 48, 42), 28)
    end

    local header = LAYOUT.header
    text("LK_T_Title", header.title, inner(header, 28, 23, 345, 55), 36)
    text("LK_T_Day", "", inner(header, 645, 28, 180, 44), 26)
    text("LK_T_AdeptalEnergy", "", inner(header, 845, 28, 240, 44), 24)
    text("LK_T_Condense", "", inner(header, 1120, 28, 280, 44), 24)
    text("LK_T_EndDay", "", inner(header, 1480, 24, 326, 50), 24)

    text("LK_T_Visitor", "", inner(LAYOUT.visitor, 24, 86, 290, 78), 24)
    text("LK_T_OrderPanel", "", inner(LAYOUT.orders, 24, 90, 360, 86), 24)
    text("LK_T_Discovery", "", inner(LAYOUT.discovery, 24, 85, 360, 68), 24)
    text("LK_T_ShellStation", "", inner(LAYOUT.shell, 24, 91, 292, 100), 24)
    text("LK_T_Juicer", "", inner(LAYOUT.juicer, 24, 91, 360, 102), 24)
    text("LK_T_Inventory", "", inner(LAYOUT.inventory, 215, 20, 780, 45), 22)
    text("LK_T_Storage", "", inner(LAYOUT.storage, 215, 20, 780, 45), 22)
    text("LK_T_SelectedPlot", "", inner(LAYOUT.feedback, 18, 5, 290, 39), 22)
    text("LK_T_Feedback", "", inner(LAYOUT.feedback, 320, 5, 705, 39), 22)
    text("LK_T_CrystalTitle", LAYOUT.crystal.title,
        inner(LAYOUT.crystal, 151, 1, 240, 36), 27)
    text("LK_T_Ground", "",
        inner(LAYOUT.crystal, 140, 481, 250, 34), 19)
end

local function createSlots()
    -- U1 空槽位只有可见边框；没有物品实例、拖拽与隐含操作。
    for index = 1, 7 do
        create("frame", "LK_F_InventorySlot" .. index, {
            x = LAYOUT.inventory.x + 215 + (index - 1) * 111,
            y = LAYOUT.inventory.y + 74, w = 92, h = 50,
        })
        create("frame", "LK_F_StorageSlot" .. index, {
            x = LAYOUT.storage.x + 215 + (index - 1) * 111,
            y = LAYOUT.storage.y + 78, w = 92, h = 53,
        })
    end
end

local function createPlots()
    for _, plot in ipairs(LAYOUT.plots) do
        local suffix = string.sub(plot.id, 2)
        create(plot.unlocked and "hexOpen" or "hexLocked", "LK_I_Plot" .. suffix .. "Base", {
            x = plot.x - 64, y = plot.y - 58, w = 128, h = 116,
        })
        local highlight = create("selection", "LK_I_Plot" .. suffix .. "Selected", {
            x = plot.x - 68, y = plot.y - 62, w = 136, h = 124,
        })
        highlight:SetVisible(false)
        text("LK_T_Plot" .. suffix .. "State", "", {
            x = plot.x - 77, y = plot.y - 25, w = 154, h = 50,
        }, 20)
    end
    -- 交互热区最后创建并置顶：状态文字和装饰图片不阻断点击。
    for _, plot in ipairs(LAYOUT.plots) do
        local suffix = string.sub(plot.id, 2)
        local area = create("hit", "LK_C_Plot" .. suffix, {
            x = plot.x - 56, y = plot.y - 50, w = 112, h = 100,
        })
        area.raycastTarget = true
        area:SetAsLastSibling()
    end
end

local function render()
    local controls = Ui.controls
    controls.LK_T_Day.text = "第 " .. tostring(Game.day) .. " 天"
    controls.LK_T_AdeptalEnergy.text = "洞天仙力 " .. tostring(Game.adeptalEnergy.balance)
    controls.LK_T_Condense.text = "凝聚：U2 开放"
    controls.LK_T_EndDay.text = "结束今日（U2 开放）"
    controls.LK_T_Visitor.text = "访客暂未开放（U9）"
    controls.LK_T_Inventory.text = "空物品栏（U2 开始播种）"
    controls.LK_T_Storage.text = "仓储为空（后续开放）"
    controls.LK_T_Ground.text = "洞天地面：空"
    controls.LK_T_ShellStation.text = "剥壳工作台（U4 开放）"
    controls.LK_T_Juicer.text = "榨汁与装杯（U4 开放）"
    controls.LK_T_OrderPanel.text = "委托尚未开放（U5）"
    controls.LK_T_Discovery.text = "探索功能尚未开放（U7）"
    controls.LK_T_SelectedPlot.text = "当前地格：" .. (Game.selectedPlotId or "无")
    controls.LK_T_Feedback.text = Game.feedback
    for _, plot in ipairs(LAYOUT.plots) do
        local suffix = string.sub(plot.id, 2)
        controls["LK_T_Plot" .. suffix .. "State"].text =
            plot.id .. (Game.plots[plot.id].unlocked and " 已开垦" or " 未开垦")
        controls["LK_I_Plot" .. suffix .. "Selected"]:SetVisible(Game.selectedPlotId == plot.id)
    end
end

local function onPlotClick(plotId)
    if not Game.plots[plotId].unlocked then
        Game.feedback = plotId .. " 尚未开垦（U6 开放）"
        log("plot_click id=" .. plotId .. " status=locked selected=" .. (Game.selectedPlotId or "none"))
    elseif Game.selectedPlotId == plotId then
        Game.selectedPlotId = nil
        Game.feedback = "已取消选择 " .. plotId
        log("plot_click id=" .. plotId .. " status=deselected")
    else
        Game.selectedPlotId = plotId
        Game.feedback = "已选中 " .. plotId .. "（U1 仅查看）"
        log("plot_click id=" .. plotId .. " status=selected")
    end
    render()
end

local function bindPlotClicks(eventType)
    for _, plot in ipairs(LAYOUT.plots) do
        local plotId = plot.id
        local area = Ui.controls["LK_C_Plot" .. string.sub(plotId, 2)]
        local callback = function(_)
            onPlotClick(plotId)
        end
        area:AddCursorEventListener(eventType, callback)
        Ui.listeners[#Ui.listeners + 1] = {
            area = area, eventType = eventType, callback = callback,
        }
    end
end

local function build(root, eventType)
    local width, height = game.GetUICanvasSize()
    if type(width) ~= "number" or type(height) ~= "number" or width <= 0 or height <= 0 then
        error("invalid_canvas_size")
    end
    Ui.canvasWidth, Ui.canvasHeight = width, height
    readTemplates()
    root.showCursor = true
    Ui.scene = game.InstantiateClientUIControl(Ui.templates.container, root)
    if not Ui.scene then
        error("instantiate_failed " .. SCENE_NAME)
    end
    Ui.scene.name = SCENE_NAME
    Ui.scene:SetAnchorMin(0, 0)
    Ui.scene:SetAnchorMax(1, 1)
    Ui.scene:SetPivot(0.5, 0.5)
    Ui.scene:SetAnchoredPosition(0, 0)
    Ui.scene:SetSizeDelta(0, 0)
    createRegions()
    createSlots()
    createPlots()
    bindPlotClicks(eventType)
    render()
    log("ready plots=7 borders=10 canvas=" .. width .. "x" .. height)
end

function OnStart()
    -- 重入时先解除旧事件并清理运行时场景；旧客户端布局由编辑器清除。
    cleanup()
    local root = script and script.object
    if not root then
        log("binding_failed reason=no_script_object")
        return
    end
    Ui.root = root
    cleanup(root)
    if not game or not game.InstantiateClientUIControl or not game.DestroyClientUIControl
        or not game.GetUICanvasSize then
        log("binding_failed reason=missing_official_ui_api")
        return
    end
    local eventType = Enum and Enum.CursorEventType and Enum.CursorEventType.CursorClick
    if not eventType then
        log("binding_failed reason=no_cursor_click_enum")
        return
    end
    local ok, err = pcall(build, root, eventType)
    if not ok then
        cleanup(root)
        log("binding_failed reason=" .. tostring(err))
        return
    end
    script:EnableUpdate(true) -- 仅在画布尺寸变化时重算位置。
end

function OnUpdate(_dt)
    if not Ui.scene or not Ui.scene.alive then
        return
    end
    local width, height = game.GetUICanvasSize()
    if width == Ui.canvasWidth and height == Ui.canvasHeight then
        return
    end
    if width <= 0 or height <= 0 then
        return
    end
    Ui.canvasWidth, Ui.canvasHeight = width, height
    for name, spec in pairs(Ui.layouts) do
        layoutControl(Ui.controls[name], spec.rect, spec.fontSize)
    end
    log("relayout canvas=" .. width .. "x" .. height)
end

function OnDestroy()
    cleanup()
end