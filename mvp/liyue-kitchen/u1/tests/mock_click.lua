-- 本地 Lua 模拟控件模型：只验证脚本逻辑，不代表千星编辑器实机验收。
local outputs = {}
local originalPrint = print
print = function(message)
    outputs[#outputs + 1] = message
end

local controls = {}
local function addControl(name)
    local control = { name = name, text = "", visible = false, callbacks = {} }
    function control:SetVisible(value)
        self.visible = value
    end
    function control:AddCursorEventListener(event, callback)
        self.callbacks[event] = self.callbacks[event] or {}
        table.insert(self.callbacks[event], callback)
    end
    function control:RemoveCursorEventListener(event, callback)
        local listeners = self.callbacks[event]
        if not listeners then
            return
        end
        for i = #listeners, 1, -1 do
            if listeners[i] == callback then
                table.remove(listeners, i)
            end
        end
        if #listeners == 0 then
            self.callbacks[event] = nil
        end
    end
    controls[name] = control
end

local textNames = {
    "LK_T_Day", "LK_T_AdeptalEnergy", "LK_T_Condense", "LK_T_Visitor",
    "LK_T_Inventory", "LK_T_Storage", "LK_T_Ground", "LK_T_ShellStation",
    "LK_T_Juicer", "LK_T_OrderPanel", "LK_T_Discovery", "LK_T_EndDay",
    "LK_T_SelectedPlot", "LK_T_Feedback",
}
for _, name in ipairs(textNames) do addControl(name) end
for i = 1, 7 do
    local suffix = string.format("%02d", i)
    addControl("LK_C_Plot" .. suffix)
    addControl("LK_T_Plot" .. suffix .. "State")
    addControl("LK_I_Plot" .. suffix .. "Selected")
end

local root = { showCursor = false }
function root:GetChild(name)
    return controls[name]
end
script = { object = root }
Enum = { CursorEventType = { CursorClick = 8 } }

dofile("mvp/liyue-kitchen/u1/client_main.lua")

local function listenerCount(index)
    local area = controls["LK_C_Plot" .. string.format("%02d", index)]
    local listeners = area.callbacks[8]
    return listeners and #listeners or 0
end

local function assertAllListenerCounts(expected, message)
    for i = 1, 7 do
        assert(listenerCount(i) == expected, message .. " plot " .. i .. " count=" .. listenerCount(i))
    end
end

local function click(index)
    local area = controls["LK_C_Plot" .. string.format("%02d", index)]
    local listeners = area.callbacks[8]
    assert(listeners and #listeners > 0, "no click listener for plot " .. index)
    listeners[1]()
end

OnStart()
assert(root.showCursor, "root cursor should be enabled")
assert(controls.LK_T_Day.text == "第 1 天")
assert(controls.LK_T_AdeptalEnergy.text == "洞天仙力 0")
assert(controls.LK_T_Plot01State.text == "P01 已开垦")
assert(controls.LK_T_Plot02State.text == "P02 未开垦")
assert(controls.LK_T_Inventory.text:find("空"))
assert(controls.LK_T_EndDay.text:find("U2"))
assertAllListenerCounts(1, "initial start should register one listener")

click(1)
assert(controls.LK_T_SelectedPlot.text == "当前地格：P01")
assert(controls.LK_I_Plot01Selected.visible)
click(2)
assert(controls.LK_T_SelectedPlot.text == "当前地格：P01", "locked plot changed selection")
assert(controls.LK_T_Feedback.text:find("P02"))
assert(not controls.LK_I_Plot02Selected.visible)
click(1)
assert(controls.LK_T_SelectedPlot.text == "当前地格：无")
assert(not controls.LK_I_Plot01Selected.visible)
click(7)
assert(controls.LK_T_Feedback.text:find("P07"), "plotId mapping failed")
assert(controls.LK_T_Day.text == "第 1 天", "click advanced day")

-- 正常重复 OnStart 必须先移除旧回调，不能累积订阅。
OnStart()
assertAllListenerCounts(1, "repeated start must not duplicate listeners")

-- 缺失 script.object 重入时，先前成功启动的监听必须清除。
script.object = nil
OnStart()
assertAllListenerCounts(0, "missing host must clear previous listeners")
assert(outputs[#outputs]:find("no_script_object"), "missing host failure not logged")

-- 恢复宿主并启动，再移除 Enum；清理不能依赖当前全局 Enum。
script.object = root
OnStart()
assertAllListenerCounts(1, "start after host recovery should bind once")
local savedEnum = Enum
Enum = nil
OnStart()
assertAllListenerCounts(0, "missing Enum must clear previous listeners")
assert(outputs[#outputs]:find("no_cursor_click_enum"), "missing Enum failure not logged")

-- 恢复 Enum 后可以再次启动；漏绑控件也必须先清掉旧监听。
Enum = savedEnum
OnStart()
assertAllListenerCounts(1, "start after Enum recovery should bind once")
local savedFeedback = controls.LK_T_Feedback
controls.LK_T_Feedback = nil
OnStart()
assertAllListenerCounts(0, "missing control must not leave previous listeners")
assert(outputs[#outputs]:find("binding_failed"), "missing control failure not logged")

controls.LK_T_Feedback = savedFeedback
OnStart()
assertAllListenerCounts(1, "start after control recovery should bind once")
OnDestroy()
assertAllListenerCounts(0, "OnDestroy must remove all listeners")

originalPrint("PASS U1 mock: plot click behavior, repeated start, missing host/Enum/control cleanup, and OnDestroy")
