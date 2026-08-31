from PIL import Image, ImageDraw, ImageFont
import os

base_path = r'C:\Users\ax2\Documents\技术博客\20260830-harpscore\images\A_cinematic_close_up_of_a_poli_2026-08-31T13-07-20.png'
out_path = r'C:\Users\ax2\Documents\技术博客\20260830-harpscore\images\cover.png'

img = Image.open(base_path)
W, H = img.size
# 公众号头条封面严格 2.35:1，高清用 1080×459
out_w, out_h = 1080, 459
# 按目标宽度等比缩放后居中裁剪
scale = out_w / W
new_h = int(H * scale)
img = img.resize((out_w, new_h), Image.LANCZOS)
top = (new_h - out_h) // 2
cover = img.crop((0, top, out_w, top + out_h))

# 轻微暗化叠加层，提升文字可读性
overlay = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 80))
cover = Image.alpha_composite(cover.convert('RGBA'), overlay).convert('RGB')


def load_font(size):
    candidates = [
        r'C:\Windows\Fonts\msyhbd.ttc',
        r'C:\Windows\Fonts\msyh.ttc',
        r'C:\Windows\Fonts\simhei.ttf',
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_centered_shadow(draw, text, y, font, fill, shadow=(0, 0, 0, 160)):
    w, _h = text_size(draw, text, font)
    x = (cover.width - w) // 2
    draw.text((x + 2, y + 2), text, font=font, fill=shadow)
    draw.text((x, y), text, font=font, fill=fill)


draw = ImageDraw.Draw(cover)
title_font = load_font(86)
sub_font = load_font(32)
tag_font = load_font(20)

title = "HarpScore"
subtitle = "我做了一个开源的布鲁斯口琴乐谱软件"
tag = "从规划到实现  ·  14 首内置曲谱  ·  附完整 Prompt"

tw, th = text_size(draw, title, title_font)
_, sh = text_size(draw, subtitle, sub_font)
_, tgh = text_size(draw, tag, tag_font)
gap1 = 14
gap2 = 22
total_h = th + gap1 + sh + gap2 + tgh
start_y = (cover.height - total_h) // 2

# 标题
y = start_y
draw_centered_shadow(draw, title, y, title_font, fill=(255, 255, 235))
y += th + gap1
# 副标题
draw_centered_shadow(draw, subtitle, y, sub_font, fill=(255, 255, 235))
y += sh + gap2
# 小分隔线 + tag
line_w = 120
line_y = y - 10
draw.line(
    ((cover.width - line_w) // 2, line_y, (cover.width + line_w) // 2, line_y),
    fill=(255, 255, 235, 200),
    width=1,
)
draw_centered_shadow(draw, tag, y, tag_font, fill=(230, 230, 210))

cover.save(out_path, quality=95)
print('cover saved:', out_path, cover.size)
