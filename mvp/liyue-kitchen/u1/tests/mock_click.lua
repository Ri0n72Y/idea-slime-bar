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
        self.callbacks[event] = callback
    end
    function control:RemoveCursorEventListener(event, callback)
        if self.callbacks[event] == callback then
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
OnStart()
assert(root.showCursor, "root cursor should be enabled")
assert(controls.LK_T_Day.text == "第 1 天")
assert(controls.LK_T_AdeptalEnergy.text == "洞天仙力 0")
assert(controls.LK_T_Plot01State.text == "P01 已开垦")
assert(controls.LK_T_Plot02State.text == "P02 未开垦")
assert(controls.LK_T_Inventory.text:find("空"))
assert(controls.LK_T_EndDay.text:find("U2"))
for i = 1, 7 do
    local suffix = string.format("%02d", i)
    assert(controls["LK_C_Plot" .. suffix].callbacks[8], "unbound " .. suffix)
end

local function click(index)
    controls["LK_C_Plot" .. string.format("%02d", index)].callbacks[8]()
end
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
OnDestroy()
for i = 1, 7 do
    assert(not controls["LK_C_Plot" .. string.format("%02d", i)].callbacks[8], "event not removed")
end

-- 任一必需控件缺失时，不注册部分监听。
controls.LK_T_Feedback = nil
OnStart()
for i = 1, 7 do
    assert(not controls["LK_C_Plot" .. string.format("%02d", i)].callbacks[8])
end
assert(outputs[#outputs]:find("binding_failed"))
originalPrint("PASS U1 mock: 7 bindings, center select/deselect, locked rejection, render, teardown, missing control")
