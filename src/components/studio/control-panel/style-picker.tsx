"use client";

import { useState, useRef } from "react";
import { Square, Image, User, Gem, Sun, Home, Coffee, Grid3X3, Palette, Smile } from "lucide-react";
import { useT } from "@/components/i18n-provider";

interface StyleDef {
  key: string; zh: string; en: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  prompt: string; promptZh: string;
}

// FLUX has input_images for product reference — only describe scene/lighting/mood
// Gemini/GPT need full prompt since they're text-to-image only
function simplifyForFlux(prompt: string): string {
  return prompt
    .replace(/\b(100mm macro lens|f\/1\d|f\/[2-9]\.\d|ISO\s*\d+|2048x\d+|sRGB|color[ -]accurate|filling\s*\d+%|85 percent)\b[^,.]*[,.]?\s*/gi, "")
    .replace(/Absolutely no.*?\./gi, "")
    .replace(/No (props|text|watermarks|reflections|lens flare|color cast)[^.]*\./gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/\.\s*\./g, ".")
    .trim();
}

const STYLES: StyleDef[] = [
  // ═══════════════════════════════════════════════════════════
  // 1. Pure White Background — Amazon/Shopify mandatory hero
  // ═══════════════════════════════════════════════════════════
  { key: "white", zh: "纯白底", en: "White BG", icon: Square,
    prompt: "E-commerce product photography, pure white background #FFFFFF, product centered filling exactly 85 percent of frame, front three-quarter angle. Lighting: dual softboxes at 45 degrees left and right, 5500K color temperature, light output ratio 2:1 key-to-fill for subtle dimensionality. Ground contact shadow only — soft grey alpha at 15 percent opacity, no floating appearance. 100mm macro lens, f/11 aperture for full product sharpness, ISO 100. Color calibrated targets, sRGB profile. Absolutely no props, no text, no watermarks, no reflections, no lens flare, no color cast. 2048x2048px square, 8K resolution. Commercial Amazon/Shopify hero shot standard.",
    promptZh: "电商白底产品摄影，纯白背景#FFFFFF，产品居中占画面85%，正面45度视角。布光：左右45度各一个柔光箱，色温5500K，主辅光比2:1营造微妙立体感。仅保留着地阴影——柔灰透明度15%，无漂浮感。100mm微距镜头，f/11光圈保证产品全局锐利，ISO 100。色彩校准，sRGB色彩空间。绝无道具、无文字、无水印、无反光、无镜头光晕、无偏色。2048x2048正方形，8K分辨率。商业Amazon/Shopify主图标准。" },

  // ═══════════════════════════════════════════════════════════
  // 2. Lifestyle Scene — #1 Shopify conversion booster
  // ═══════════════════════════════════════════════════════════
  { key: "scene", zh: "场景图", en: "Lifestyle", icon: Image,
    prompt: "Editorial lifestyle product photography, product placed naturally as compositional hero in a curated aspirational interior — bright modern room, abundant natural window light from left side, 5600K daylight balanced. Composition: product sharp in foreground lower-right third, shallow depth of field f/2.8 using 85mm lens, background softly blurred with creamy bokeh. Warm neutral undertones, soft natural shadows, no harsh contrast. Styling: thoughtful but unforced — a linen throw draped casually nearby, ceramic mug, open book, fresh botanicals as subtle accents. Authentic lived-in atmosphere, not sterile or staged. Editorial interior magazine quality (Kinfolk, Cereal aesthetic). 4K, photorealistic, warm and inviting.",
    promptZh: "编辑级生活方式产品摄影，产品自然作为视觉焦点置于精心布置的高级室内——明亮现代房间，左侧大面积自然窗光，5600K日光色温。构图：产品在右下方三分之一处锐利合焦，85mm镜头f/2.8大光圈浅景深，背景柔化奶油散景。暖中性色调，柔和自然阴影，避免强反差。场景布置：精心但不刻意——亚麻盖毯不经意搭在旁边、陶瓷杯、翻开的书、新鲜绿植做低调点缀。真实生活气息，拒绝摆拍塑料感。编辑级室内杂志品质（Kinfolk、Cereal美学）。4K，照片级真实，温暖宜人。" },

  // ═══════════════════════════════════════════════════════════
  // 3. Model Shot — authentic person using product, reduces returns 22%
  // ═══════════════════════════════════════════════════════════
  { key: "in_use", zh: "模特图", en: "Model", icon: User,
    prompt: "Authentic lifestyle model product photography. One real person naturally interacting with the product — candid mid-action moment, not stiff posing, not looking at camera. Soft diffused daylight from large window, 5500K, relaxed home or street or office environment appropriate to product category. 50mm lens at f/2.0, focus locked on the product and the interaction area, model's face softly out of focus when product is the hero. The product must be the visual focal point — viewer's eye goes to product first, model second. Warm natural skin tones, relaxed body language. Diversity-friendly casting. Editorial quality (Everlane, Outdoor Voices, Uniqlo lookbook style). 4K, photorealistic, no fashion-editorial drama — everyday realness.",
    promptZh: "真实生活方式模特产品摄影。一位真人自然与产品互动——抓拍动作进行中的瞬间，不刻意摆拍，不看镜头。大面积窗户柔和漫射日光，5500K，与产品品类匹配的松弛家居/街拍/办公环境。50mm镜头f/2.0，焦点锁定产品和互动区域，产品为主角时模特面部柔焦。产品必须是第一视觉焦点——视线先到产品再到模特。温暖自然肤色，松弛肢体语言。包容多元选角。编辑级品质（Everlane、Outdoor Voices、优衣库画册风格）。4K，照片级真实，拒绝时尚大片的距离感——日常的真实感。" },

  // ═══════════════════════════════════════════════════════════
  // 4. Multi-Angle Grid — build buyer confidence, reduce return rate
  // ═══════════════════════════════════════════════════════════
  { key: "angles", zh: "多角度", en: "Multi-Angle", icon: Grid3X3,
    prompt: "Professional e-commerce multi-angle product photography composited into clean layout. Five views of the same product: front, 45-degree front, side profile, rear, and top-down. Pure white background #FFFFFF across all frames. Uniform studio lighting 5500K, identical exposure, same product scale across all views — exactly 1:1 relative sizing. Clean grid arrangement with equal spacing, thin 1px light grey separator lines optional. Product must appear identical in color/material/finish across all angles — no lighting inconsistency. 8K resolution, commercial catalog quality, no text overlay except optional angle labels in 10px light sans-serif. Suitable for Amazon image slots 2-4 and Shopify product galleries.",
    promptZh: "专业电商多角度产品摄影合成布局。同一产品五视图：正面、45度斜角、侧面、背面、俯视。全部纯白背景#FFFFFF。统一摄影棚灯光5500K，曝光一致，各视图产品比例严格1:1相对大小。干净网格排布，等距间距，可选1px浅灰分隔线。所有角度产品颜色/材质/表面处理必须一致——不可出现灯光偏差。8K分辨率，商业画册品质。无文字覆盖（可选10px浅灰无衬线角度标签）。适合Amazon图片位2-4和Shopify产品画廊。" },

  // ═══════════════════════════════════════════════════════════
  // 5. Luxury Editorial — Truff / Aesop / Oura Ring style
  // ═══════════════════════════════════════════════════════════
  { key: "marble", zh: "奢华风", en: "Luxury", icon: Gem,
    prompt: "Ultra-premium luxury product editorial photography. Product centered on genuine white Carrara marble surface with visible natural grey veining — or dark walnut wood with fine grain texture. Single directional soft key light raking from upper-left at precisely 30 degrees, creating sculptural depth and long elegant shadow falling to lower-right. Subtle accent: matte brass or brushed gold prop (architectural object, raw stone, single stem dried botanical) placed in deep background, heavily blurred. Generous negative space — precisely 45 percent of frame left empty. Color palette: desaturated warm neutrals, sage, stone, cream, charcoal, no saturated colors. 85mm tilt-shift lens effect, product in razor focus, everything else dreamy soft. Aesop, Le Labo, Tom Ford Beauty editorial aesthetic. Portrait 4:5 ratio, 4K, cinematic feel.",
    promptZh: "超高端奢华产品编辑摄影。产品居中置于天然白色卡拉拉大理石台面（可见天然灰色纹理）——或深色胡桃木细纹表面。单一定向柔主光从左上方精确30度斜射，营造雕塑深度，拉出向右下方的优雅长影。低调点缀：哑光黄铜或拉丝金摆件（建筑感摆件、天然原石、单枝干花草）置于远景大幅虚化。大量留白——画面精确45%为空。色调：低饱和暖中性色，鼠尾草绿、石色、奶油、炭灰，无色度过高。85mm移轴效果，产品锐利如刀锋，其余梦幻柔化。Aesop、Le Labo、Tom Ford Beauty 编辑美学。竖版4:5比例，4K，电影级质感。" },

  // ═══════════════════════════════════════════════════════════
  // 6. Outdoor Golden Hour — Instagram/TikTok viral aesthetic
  // ═══════════════════════════════════════════════════════════
  { key: "natural", zh: "户外自然", en: "Outdoor", icon: Sun,
    prompt: "Golden hour outdoor product photography. Product in a natural setting — mossy stone, weathered wood bench, wild grass, or sandy beach — during the magic 20 minutes before sunset. Warm directional sunlight at 3200K creating natural lens flare (controlled, artistic), long romantic shadows, and rim-lit product edges glowing gold. Background: shallow depth f/1.8, soft bokeh circles from distant foliage catching sunset light, hazy atmosphere with subtle dust motes or pollen floating in the light rays. Product remains sharp center-frame, well-exposed — use reflector fill to prevent silhouette. Earthy, organic, wellness-lifestyle aesthetic — feels like a spontaneous beautiful moment captured, not a commercial shoot. 16:9 cinematic ratio, 4K photorealistic, Instagram Reels / TikTok Shop ready.",
    promptZh: "黄金时段户外产品摄影。产品置于自然环境——苔藓石面、风化的木凳、野草或沙滩——在日落前20分钟的魔法时刻。3200K暖色定向阳光，制造有控制的艺术性镜头光晕、悠长浪漫的阴影、产品边缘被金色轮廓光勾勒。背景：f/1.8大光圈浅景深，远处叶丛捕捉到落日形成柔美散景圆圈，薄雾氛围中微尘或花粉在光线中漂浮。产品保持中央锐利合焦，曝光准确——使用反光板补光避免剪影。泥土、有机、健康生活方式美学——仿佛偶然捕捉的美好瞬间，非商业摆拍。16:9电影比例，4K照片级真实，适配Instagram Reels/TikTok Shop。" },

  // ═══════════════════════════════════════════════════════════
  // 7. Cosy Home / Hygge — Scandinavian-Japandi warmth
  // ═══════════════════════════════════════════════════════════
  { key: "cosy", zh: "温馨家", en: "Cosy Home", icon: Home,
    prompt: "Warm hygge interior product photography. Product naturally integrated into a thoughtfully styled living corner. Large soft window light from left, diffused through sheer linen curtain, 4500K warm-neutral. Materials palette: natural linen in oatmeal, chunky knit throw in cream, warm oak or ash wood with visible grain, matte ceramic vessel, dried eucalyptus or pampas grass in stoneware vase, beeswax candle with gentle flame. Composition: product in foreground right-third sharp focus, background receding into soft warm blur. Shallow depth f/2.2 on 50mm lens. Scandinavian-Japandi fusion: minimal but soulful, functional but poetic. Atmosphere of quiet Sunday morning — steam from tea, golden sunlight creeping across floorboards. Editorial interior photography (Architectural Digest, Dezeen). 4K, soul-warming.",
    promptZh: "温暖治愈室内产品摄影。产品自然融入精心布置的生活角落。左侧大面积柔和窗光，透过亚麻薄纱帘漫射，4500K暖中性色温。材质调色板：燕麦色天然亚麻、奶油色粗针织盖毯、可见木纹的暖橡木或白蜡木、哑光陶器、粗陶花瓶中的干桉叶或蒲苇、蜂蜡蜡烛与温柔火苗。构图：产品在前景右三分之一锐利合焦，背景后退融入温暖柔焦。50mm f/2.2浅景深。北欧-侘寂融合：简约但有灵魂，实用但富有诗意。安静周日早晨的氛围——茶的热气、金色阳光爬过地板。编辑级室内摄影（Architectural Digest、Dezeen）。4K，治愈心灵。" },

  // ═══════════════════════════════════════════════════════════
  // 8. Dark & Moody — Aesop / Byredo / Le Labo cinematic
  // ═══════════════════════════════════════════════════════════
  { key: "dark_moody", zh: "暗调高级", en: "Dark & Moody", icon: Coffee,
    prompt: "Cinematic dark moody product photography. Product as sculptural subject emerging from deep charcoal void — background 95 percent black with subtle vignette gradient. Single hard key light (fresnel spotlight) from upper-right at 45 degrees, creating dramatic chiaroscuro with crisp shadow edges and intense highlight rolloff on product surfaces. Subtle rim light at 5 percent intensity from opposite side to separate product silhouette from black background. Rich deep blacks at RGB (15,15,15) — never crushed to pure black. Controlled specular highlights on glass/metal/gloss surfaces. Atmosphere: a single whisper of smoke or dust motes floating in the light beam. Independent luxury brand aesthetic (Byredo, Aesop, Le Labo, Diptyque). Square 1:1 ratio, 4K, timeless and mysterious — the product as objet d'art.",
    promptZh: "电影级暗调产品摄影。产品如雕塑从深邃炭黑虚空中浮现——背景95%黑配微妙暗角渐变。单光源硬主光（菲涅尔聚光灯）从右上方45度打下，营造戏剧性明暗对比，清晰阴影边缘，产品表面高光精致滚降。对侧5%强度微妙轮廓光分离产品剪影与黑色背景。浓郁深黑RGB(15,15,15)——绝不压死至纯黑。玻璃/金属/光面材质受控镜面高光。氛围：一缕轻烟或几颗微尘在光束中漂浮。独立奢侈品牌美学（Byredo、Aesop、Le Labo、Diptyque）。正方形1:1比例，4K，永恒而神秘——产品即是艺术品。" },

  // ═══════════════════════════════════════════════════════════
  // 9. Cyberpunk — electronics / sneakers / gaming / streetwear
  // ═══════════════════════════════════════════════════════════
  { key: "cyberpunk", zh: "赛博朋克", en: "Cyberpunk", icon: Coffee,
    prompt: "Cyberpunk aesthetic product photography. Product center-frame on a reflective wet asphalt or dark metallic surface. Dual neon rim lights: cyan (#00FFFF) from left, magenta (#FF00FF) from right, creating intense colored edge glow wrapping the product. Atmospheric background: volumetric fog with visible light rays, subtle holographic grid lines receding into darkness, distant blurred city lights in warm amber and cool teal. Water droplets or condensation on nearby surface reflecting neon. Product must remain clearly visible and well-exposed — the colored lighting enhances but does not obscure. Warm product tones (natural material colors) contrast with cool vibrant neon environment. Blade Runner 2049 production design quality. Suitable for: gaming peripherals, mechanical keyboards, sneakers, smartwatches, headphones, streetwear accessories, tech gadgets. Ultrawide 21:9 cinematic ratio, 4K, sci-fi editorial.",
    promptZh: "赛博朋克美学产品摄影。产品居中置于反光湿润沥青或深色金属表面。双霓虹轮廓光：左侧青色(#00FFFF)，右侧品红(#FF00FF)，营造强烈彩色边缘光包裹产品。氛围背景：体积雾中可见光束，微妙全息网格线向暗处延伸，远处模糊城市灯光呈暖琥珀与冷青色。附近表面水滴或凝结水珠反射霓虹光。产品必须保持清晰可见、曝光准确——彩色光源增强氛围而非遮挡产品。暖色产品本色与冷色霓虹环境形成对比。银翼杀手2049制作设计品质。适合：游戏外设、机械键盘、潮鞋、智能手表、耳机、街头配饰、科技小物。超宽21:9电影比例，4K，科幻编辑级。" },

  // ═══════════════════════════════════════════════════════════
  // 10. Canvas Art / Watercolor — the PRODUCT STAYS EXACTLY THE SAME,
  //     only the background/surface is watercolor canvas texture
  //     Etsy, Pinterest, artisan brands, handmade goods, ceramics
  // ═══════════════════════════════════════════════════════════
  { key: "canvas", zh: "画布风", en: "Canvas Art", icon: Palette,
    prompt: "Art canvas product photography. THE PRODUCT ITSELF REMAINS COMPLETELY UNCHANGED — identical shape, color, material, every detail exactly as the reference image. Only the background and surface are styled as an art canvas. Surface beneath the product: textured cold-pressed 300gsm watercolor paper with visible tooth and fibre, or raw unprimed linen canvas with natural slub weave. Background wall: soft flowing watercolor pigment washes — dusty cerulean blue blending into warm ochre, soft sage green, blush rose, raw umber tones — with visible wet-on-wet diffusion blooms, dry brush texture, and granulating pigment separation. The background looks like an abstract watercolor painting created by a fine artist. Product sits centered on the canvas surface in razor-sharp focus at f/11, clearly separated from the artistic backdrop. Lighting: soft natural north-facing window light from left, cool-neutral 5000K, casting gentle shadows on the textured surface. The product is a real object photographed in an artist's studio — not painted, not illustrated, not transformed. 4:5 portrait ratio, 4K, Pinterest editorial, Etsy artisan boutique aesthetic.",
    promptZh: "画布艺术产品摄影。产品本身完全不变——形状、颜色、材质、每一个细节都与参考图一致。只有背景和台面做成画布艺术风格。产品下方台面：有纹理的300gsm冷压水彩纸，可见纸张纹理和纤维，或未经底涂的原色亚麻画布带天然竹节纹理。背景墙面：流动的水彩颜料渲染——灰蔚蓝融入暖赭石、柔和鼠尾草绿、绯红玫瑰、生褐——带有可见的湿碰湿扩散晕染、干笔触纹理和颗粒化颜料分离。背景看起来像画家创作的抽象水彩画。产品居中置于画布表面上，f/11超锐利合焦，与艺术背景清晰分离。布光：左侧柔和的北向自然窗光，冷中性5000K，在纹理表面上投下柔和淡影。产品是在艺术家工作室里拍摄的真实物品——不是画出来的、不是插画、不是变身。4:5竖版比例，4K，Pinterest编辑级，Etsy手工匠人精品美学。" },

  // ═══════════════════════════════════════════════════════════
  // 11. Kawaii / Cartoon — the PRODUCT STAYS EXACTLY THE SAME,
  //     only the background becomes cute and playful
  //     Pet supplies, kids products, beauty, snacks, stationery
  // ═══════════════════════════════════════════════════════════
  { key: "kawaii", zh: "卡通风", en: "Kawaii", icon: Smile,
    prompt: "Kawaii pastel product photography. THE PRODUCT ITSELF REMAINS COMPLETELY UNCHANGED — identical shape, color, material, every detail exactly as the reference image. Only the background and surroundings are styled in a cute aesthetic. Background: soft candy-colored pastel gradient from blush pink to lavender to baby blue, decorated with subtle floating elements — tiny matte gold stars, sparkle bursts, soft pillowy clouds, miniature ♡ hearts — all kept small and unobtrusive so the product remains the clear hero. Surface beneath product: matte white or light pastel pink platform with soft rounded edges. Lighting: soft diffused studio lighting from front and top, 5200K, no harsh shadows on the product. Product is in sharp focus at f/11, background decorations softly blurred at f/2.8 creating depth separation. The product looks like a premium product shot on a cute desktop wallpaper — not a toy, not a figurine, not transformed. The real product, in a joyful gift-worthy setting. Perfect for: pet supplies, children's products, Korean beauty, Japanese snacks, stickers, stationery, keychains, phone cases. Square 1:1, 4K, clean commercial product photography with playful atmosphere.",
    promptZh: "可爱粉彩产品摄影。产品本身完全不变——形状、颜色、材质、每一个细节都与参考图一致。只改变背景和周围氛围，做成可爱风格。背景：柔和糖果色粉彩渐变，从绯红粉过渡到薰衣草紫再到婴儿蓝，装饰微小的漂浮元素——哑光金色小星星、闪光爆发、柔软棉花糖云朵、迷你♡爱心——全部小而低调，不抢产品风头。产品下方表面：哑光白或浅粉彩平台，柔和的圆角边缘。布光：前上方柔和漫射摄影棚灯光，5200K，产品无硬阴影。产品以f/11锐利合焦，背景装饰以f/2.8柔和虚化形成深度层次。产品看起来像是在可爱的桌面壁纸上拍摄的高级产品图——不是玩具、不是公仔、不是变身。是真实的产品，在一个快乐有送礼感的氛围中。完美适合：宠物用品、儿童产品、韩妆、日系零食、贴纸、文具、钥匙扣、手机壳。正方形1:1，4K，干净商业产品摄影+俏皮氛围。" },

  // ═══════════════════════════════════════════════════════════
  // 12. Infographic — Amazon A+ Content, 15-25% conversion lift
  // ═══════════════════════════════════════════════════════════
  { key: "infographic", zh: "信息图", en: "Infographic", icon: Image,
    prompt: "Professional e-commerce infographic product image. Layout: 60 percent left zone — product on pure white or subtle warm grey gradient background, well-lit, sharp. 40 percent right zone — clean information panel with elegant minimalist line icons (16px stroke weight, brand accent color) paired with short 3-5 word feature callouts in clean sans-serif typography (Inter or SF Pro style, 14px regular weight). Each feature row separated by a 1px light grey horizontal rule with generous padding. Color system: product on white, icons and accent elements in brand primary color, text in charcoal #333333. Subtle geometric background pattern (dot grid or thin diagonal lines at 5 percent opacity) behind text panel only. Modern UI/UX inspired layout — looks like a premium app onboarding screen. Overall feeling: informative, trustworthy, premium. Amazon A+ Content and Shopify product description section standard. 8K, razor-sharp text rendering, no spelling errors, no visual clutter.",
    promptZh: "专业电商信息图产品图。布局：左侧60%——产品置于纯白或微妙暖灰渐变背景，打光良好，锐利清晰。右侧40%——干净信息面板，优雅极简线条图标（16px描边粗细，品牌强调色）搭配简短3-5词卖点文字标注，清爽无衬线字体（Inter或苹方风格，14px常规字重）。每行卖点以1px浅灰水平分隔线区隔，宽松间距。色彩系统：产品白底，图标和强调元素用品牌主色，正文深灰#333333。仅文字面板背后有微妙几何图案（点阵或细对角线5%透明度）。现代UI/UX设计灵感——像高端App引导页。整体感受：信息丰富、可信赖、高级感。Amazon A+内容和Shopify产品描述区域标准。8K，文字锐利如刀，无拼写错误，无视觉拥挤。" },
];

interface StylePickerProps {
  value: string | null;
  engineType?: string;
  onChange: (key: string, prompt: string) => void;
  onReferenceImage?: (url: string | null) => void;
  onReferenceImageUploaded?: () => void;
}

export function StylePicker({ value, onChange, onReferenceImage, onReferenceImageUploaded, engineType }: StylePickerProps) {
  const { t, locale } = useT();
  const isZh = locale === "zh";
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function select(s: StyleDef) {
    let prompt = isZh ? s.promptZh : s.prompt;
    // FLUX has input_images for img2img — shorten prompt to scene-only
    if (engineType === "flux") {
      prompt = simplifyForFlux(prompt);
    }
    onChange(s.key === value ? "" : s.key, s.key === value ? "" : prompt);
  }

  function handleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRefUrl(url);
    onReferenceImage?.(url);
    onReferenceImageUploaded?.(); // notify parent to auto-switch to FLUX for img2img
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{t("landing.nav.styles")}</span>
      <div className="grid grid-cols-4 gap-1.5">
        {STYLES.map((s) => {
          const Icon = s.icon;
          const isActive = value === s.key;
          return (
            <button key={s.key} type="button" onClick={() => select(s)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
                isActive ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500/20" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}>
              <Icon size={18} className={isActive ? "text-brand-600" : ""} />
              <span className="text-[10px] font-medium leading-tight text-center">{isZh ? s.zh : s.en}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg border border-dashed border-zinc-300 text-[10px] text-zinc-400 hover:text-zinc-600 hover:border-zinc-400 transition-colors cursor-pointer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          {refUrl ? (isZh ? "已上传参考图" : "Reference set") : (isZh ? "参考风格图" : "Style Reference")}
        </button>
        {refUrl && <button type="button" onClick={() => { setRefUrl(null); onReferenceImage?.(null); }} className="text-[10px] text-red-400 hover:text-red-600 px-1">{isZh ? "清除" : "Clear"}</button>}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefUpload} />
      </div>
    </div>
  );
}
