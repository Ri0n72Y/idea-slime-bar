-- 璃月厨房 U1：主场景与七格水晶球点击底座。
-- 此脚本挂载于编辑器中已布置的 LK_C_Root 客户端控件容器。
-- 静态布局与美术由编辑器创建；本脚本只接管 U1 状态及反馈。

local PLOT_ORDER = { "P01", "P02", "P03", "P04", "P05", "P06", "P07" }

local Game = {
    day = 1,
    adeptalEnergy = { balance = 0 },
    selectedPlotId = nil,
    plots = {
        P01 = { id = "P01", unlocked = true },
        P02 = { id = "P02", unlocked = false },
        P03 = { id = "P03", unlocked = false },
        P04 = { id = "P04", unlocked = false },
        P05 = { id = "P05", unlocked = false },
        P06 = { id = "P06", unlocked = false },
        P07 = { id = "P07", unlocked = false },
    },
    feedback = "点击水晶球地格查看状态",
}

local TEXT_KEYS = {
    "LK_T_Day", "LK_T_AdeptalEnergy", "LK_T_Condense",
    "LK_T_Visitor", "LK_T_Inventory", "LK_T_Storage",
    "LK_T_Ground", "LK_T_ShellStation", "LK_T_Juicer",
    "LK_T_OrderPanel", "LK_T_Discovery", "LK_T_EndDay",
    "LK_T_SelectedPlot", "LK_T_Feedback",
}

local Ui = { root = nil, controls = {}, listeners = {} }

local function detachListeners()
    -- 清理依赖注册时保存的事件类型，不读取当前全局 Enum。
    for _, listener in ipairs(Ui.listeners) do
        if listener.area and listener.area.RemoveCursorEventListener then
            listener.area:RemoveCursorEventListener(listener.eventType, listener.callback)
        end
    end
    Ui.listeners = {}
end

local function log(message)
    print("[LK/U1] " .. message)
end

local function setText(name, value)
    Ui.controls[name].text = value
end

local function plotSuffix(plotId)
    return string.sub(plotId, 2, 3)
end

local function render()
    setText("LK_T_Day", "第 " .. tostring(Game.day) .. " 天")
    setText("LK_T_AdeptalEnergy", "洞天仙力 " .. tostring(Game.adeptalEnergy.balance))
    setText("LK_T_Condense", "凝聚：U2 开放")
    setText("LK_T_Visitor", "访客位（U9 开放）")
    setText("LK_T_Inventory", "物品栏：空（U2 开放）")
    setText("LK_T_Storage", "仓储：空（后续开放）")
    setText("LK_T_Ground", "洞天地面：空")
    setText("LK_T_ShellStation", "剥壳工作区（U4 开放）")
    setText("LK_T_Juicer", "榨汁／装杯工作区（U4 开放）")
    setText("LK_T_OrderPanel", "限时委托（U5 开放）")
    setText("LK_T_Discovery", "探索地图（U7 开放）")
    setText("LK_T_EndDay", "结束今日（U2 开放）")
    setText("LK_T_SelectedPlot", "当前地格：" .. (Game.selectedPlotId or "无"))
    setText("LK_T_Feedback", Game.feedback)

    for _, plotId in ipairs(PLOT_ORDER) do
        local suffix = plotSuffix(plotId)
        local plot = Game.plots[plotId]
        local state = plot.unlocked and "已开垦" or "未开垦"
        setText("LK_T_Plot" .. suffix .. "State", plotId .. " " .. state)
        Ui.controls["LK_I_Plot" .. suffix .. "Selected"]:SetVisible(Game.selectedPlotId == plotId)
    end
end

local function clickPlot(plotId)
    local plot = Game.plots[plotId]
    if not plot then
        Game.feedback = "未知地格：" .. tostring(plotId)
        log("plot_click id=" .. tostring(plotId) .. " status=unknown")
    elseif not plot.unlocked then
        Game.feedback = "地格 " .. plotId .. " 尚未开垦（U6 开放）"
        log("plot_click id=" .. plotId .. " status=locked selected=" .. (Game.selectedPlotId or "none"))
    elseif Game.selectedPlotId == plotId then
        Game.selectedPlotId = nil
        Game.feedback = "已取消选择 " .. plotId
        log("plot_click id=" .. plotId .. " status=deselected")
    else
        Game.selectedPlotId = plotId
        Game.feedback = "已选中 " .. plotId .. "（U1 仅查看地格）"
        log("plot_click id=" .. plotId .. " status=selected")
    end
    render()
end

local function bindControls(root)
    local missing = {}
    local function bind(name)
        local control = root:GetChild(name)
        local isPlotArea = string.sub(name, 1, 9) == "LK_C_Plot"
        local isSelection = string.sub(name, 1, 9) == "LK_I_Plot"
        if not control
            or (isPlotArea and (not control.AddCursorEventListener or not control.RemoveCursorEventListener))
            or (isSelection and not control.SetVisible)
            or (not isPlotArea and not isSelection and type(control.text) ~= "string") then
            missing[#missing + 1] = name
        else
            Ui.controls[name] = control
        end
    end

    for _, key in ipairs(TEXT_KEYS) do
        bind(key)
    end
    for _, plotId in ipairs(PLOT_ORDER) do
        local suffix = plotSuffix(plotId)
        bind("LK_C_Plot" .. suffix)
        bind("LK_T_Plot" .. suffix .. "State")
        bind("LK_I_Plot" .. suffix .. "Selected")
    end

    if #missing > 0 then
        log("binding_failed missing=" .. table.concat(missing, ","))
        return false
    end
    return true
end

function OnStart()
    -- 必须先清理上一次成功启动的监听，再检查本次启动环境。
    -- 即使 script.object 或全局 Enum 已失效，也不能遗留旧订阅。
    detachListeners()
    Ui.root = nil
    Ui.controls = {}

    local root = script and script.object
    if not root then
        log("binding_failed reason=no_script_object")
        return
    end

    local eventType = Enum and Enum.CursorEventType and Enum.CursorEventType.CursorClick
    if not eventType then
        log("binding_failed reason=no_cursor_click_enum")
        return
    end

    Ui.root = root
    if not bindControls(root) then
        Ui.root = nil
        Ui.controls = {}
        return
    end

    root.showCursor = true
    for _, plotId in ipairs(PLOT_ORDER) do
        local id = plotId  -- 每次循环独立持有稳定业务 ID，绝不依据鼠标坐标猜格子。
        local area = Ui.controls["LK_C_Plot" .. plotSuffix(id)]
        area.raycastTarget = true
        local callback = function(_)
            clickPlot(id)
        end
        area:AddCursorEventListener(eventType, callback)
        Ui.listeners[#Ui.listeners + 1] = {
            area = area,
            eventType = eventType,
            callback = callback,
        }
    end
    render()
    log("ready plots=7 unlocked=P01 input=CursorClick")
end

function OnDestroy()
    detachListeners()
    Ui.root = nil
    Ui.controls = {}
end
