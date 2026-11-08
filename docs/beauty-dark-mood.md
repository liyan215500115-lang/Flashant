# Beauty dark mood (category-only)

`CATEGORY_PROFILES.beauty.defaultStyle` is `dark_moody`. Detail prompts append `BEAUTY_DARK_SURFACE_GUARD` only when `category === "beauty"` (template and non-template branches in the batch detail builder). Electronics stays `dark_moody` on its own hint and does not receive this guard. `TYPE_TEMPLATES.selling_points` is unchanged (white catalog).

## Cross-SKU QA 2026-11-08

- S1 PARTIAL PASS. S2–S5 6/6 pass.
- Fashion and electronics were not pulled into the beauty cold-blue charcoal narrative.
- Material and multi-SKU flatlay fidelity is still weak (invented brand text, recombined kits). Not a production marketing-still standard.
- This change does not claim a stable dark-table selling_points path. White vs dark selling_points strategy is deferred.
