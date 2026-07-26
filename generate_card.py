import os
from PIL import Image, ImageDraw, ImageFont

def generate_fut_card(player_data, output_path):
    CARD_WIDTH = 600
    CARD_HEIGHT = 880
    
    # 1. Create Transparent Canvas
    card = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    
    # 2. Load Frame Template
    theme = player_data.get("cardTheme", "gold")
    frame_path = f"assets/frames/{theme}.png"
    
    if os.path.exists(frame_path):
        frame_img = Image.open(frame_path).convert("RGBA").resize((CARD_WIDTH, CARD_HEIGHT))
        card.paste(frame_img, (0, 0), frame_img)
    else:
        # Fallback metallic gradient background if frame image is missing
        draw.rounded_rectangle([20, 20, CARD_WIDTH - 20, CARD_HEIGHT - 20], radius=35, fill=(224, 170, 62), outline=(184, 134, 11), width=8)

    # 3. Paste Player Cutout Photo
    photo_path = player_data.get("photo_path")
    if photo_path and os.path.exists(photo_path):
        player_img = Image.open(photo_path).convert("RGBA")
        player_img.thumbnail((360, 400))
        # Overlay photo onto upper-right section of card
        card.paste(player_img, (180, 100), player_img)

    # 4. Load Custom Fonts
    font_path = "assets/fonts/DINPro-CondBold.otf"
    try:
        font_ovr = ImageFont.truetype(font_path, 80)
        font_pos = ImageFont.truetype(font_path, 40)
        font_name = ImageFont.truetype(font_path, 48)
        font_stats = ImageFont.truetype(font_path, 32)
    except IOError:
        font_ovr = font_pos = font_name = font_stats = ImageFont.load_default()

    text_color = (17, 17, 17) if theme in ["gold", "icon"] else (255, 255, 255)

    # 5. Render Top Badge Stack (Rating, Position, Jersey)
    draw.text((80, 80), str(player_data.get("ovr", 85)), fill=text_color, font=font_ovr)
    draw.text((85, 165), str(player_data.get("pos", "UNI")).upper()[:3], fill=text_color, font=font_pos)
    draw.line([(80, 215), (140, 215)], fill=text_color, width=3)
    draw.text((85, 225), f"#{player_data.get('jersey', '0')}", fill=text_color, font=font_pos)

    # 6. Render Player Name
    name = player_data.get("name", "PLAYER").upper()
    bbox = draw.textbbox((0, 0), name, font=font_name)
    text_w = bbox[2] - bbox[0]
    draw.text(((CARD_WIDTH - text_w) // 2, 500), name, fill=text_color, font=font_name)
    draw.line([(60, 560), (CARD_WIDTH - 60, 560)], fill=text_color, width=2)

    # 7. Render Attribute Stats Grid
    stats = player_data.get("stats", {})
    stat_items = [
        ("ATK", stats.get("atk", 70)),
        ("BLK", stats.get("blk", 70)),
        ("SRV", stats.get("srv", 70)),
        ("STM", stats.get("stm", 70)),
        ("RCV", stats.get("rcv", 70)),
        ("TMW", stats.get("tmw", 70)),
    ]

    col1_x, col2_x, start_y, row_gap = 100, 350, 590, 55
    for i, (label, val) in enumerate(stat_items):
        x = col1_x if i % 2 == 0 else col2_x
        y = start_y + (i // 2) * row_gap
        draw.text((x, y), f"{val} {label}", fill=text_color, font=font_stats)

    # 8. Ensure Output Folder Exists & Save PNG Output
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    card.save(output_path, "PNG")
    print(f"Generated card at: {output_path}")

# Run directly
if __name__ == "__main__":
    sample_player = {
        "name": "Nishida",
        "ovr": 94,
        "pos": "OPP",
        "jersey": "11",
        "cardTheme": "toty",
        "photo_path": "sample_player.png",
        "stats": {"atk": 96, "blk": 88, "srv": 98, "stm": 92, "rcv": 81, "tmw": 90}
    }
    generate_fut_card(sample_player, "cards/nishida_card.png")