-- Stamps every page with the date it was rendered, shown as "Last checkpoint"
-- in the header's title row (notebook.js moves it there). Lua runs in the C
-- locale, so the month name is always English.
function Pandoc(doc)
  local date = tonumber(os.date("%d")) .. os.date(" %B %Y")
  table.insert(doc.blocks, pandoc.RawBlock("html",
    '<span class="nb-checkpoint" hidden>Last checkpoint: ' .. date .. "</span>"))
  return doc
end
