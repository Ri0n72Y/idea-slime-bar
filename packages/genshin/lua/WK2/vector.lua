-- One domain element vector: Fire, Hydro, Anemo, Electro, Dendro, Cryo, Geo.
-- Design documents index 0..6; native Lua tables use 1..7.
local Vector = {}

function Vector.zero()
    return {0, 0, 0, 0, 0, 0, 0}
end

function Vector.copy(values)
    local result = {}
    for i = 1, 7 do result[i] = values[i] end
    return result
end

function Vector.sum(values)
    local n = 0
    for i = 1, 7 do n = n + values[i] end
    return n
end

function Vector.add(target, addition)
    for i = 1, 7 do target[i] = target[i] + addition[i] end
end

function Vector.scale(target, factor)
    for i = 1, 7 do target[i] = target[i] * factor end
end

return Vector
