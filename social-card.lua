-- Points each page's social preview (og:image, twitter:image) at its card in
-- images/social/, listed in cards.json by _social-cards/make_cards.py. Quarto
-- shares the image marked .preview-image, so a hidden, lazy one is added;
-- browsers never fetch it. Pages without a card get the default one, and a
-- page that sets `image:` in its front matter keeps that instead. The 404
-- page is never shared, and Quarto rewrites its links, so it's left alone.
local cards

local function load_cards()
  local file = io.open(pandoc.path.join({ quarto.project.directory, "images", "social", "cards.json" }))
  if not file then return {} end
  local ok, data = pcall(pandoc.json.decode, file:read("a"))
  file:close()
  return ok and data.cards or {}
end

local function escape(text)
  return (text:gsub("&", "&amp;"):gsub('"', "&quot;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end

function Pandoc(doc)
  if doc.meta.image then return nil end
  cards = cards or load_cards()
  local page = pandoc.path.make_relative(quarto.doc.input_file, quarto.project.directory):gsub("\\", "/")
  if page == "404.qmd" then return nil end
  local card = cards[page:gsub("%.qmd$", ""):gsub("/", "-")] or cards["default"]
  if not card then return nil end
  local up = string.rep("../", select(2, page:gsub("/", "")))
  table.insert(doc.blocks, pandoc.RawBlock("html", string.format(
    '<div hidden><img class="preview-image" src="%simages/social/%s" alt="%s" width="1200" height="630" loading="lazy"></div>',
    up, card.file, escape(card.alt))))
  return doc
end
