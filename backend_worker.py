import os
import time
from io import BytesIO
import requests
import firebase_admin
from firebase_admin import credentials, firestore
from PIL import Image, ImageDraw, ImageFont

# ==========================================
# 1. INITIALIZE FIREBASE ADMIN SDK (Firestore Only)
# ==========================================
cred = credentials.Certificate("firebase_key.json")
firebase_admin.initialize_app(cred)

db = firestore.client()


# ==========================================
# 2. FIFA CARD GENERATOR FUNCTION
# ==========================================
def generate_fut_card(player_data, raw_photo_img=None):
    """
    Renders a custom FIFA-style card image with PIL and returns a BytesIO buffer.
    """
    CARD_WIDTH, CARD_HEIGHT = 600, 880
    card = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), (0, 0, 0, 0))

    # Load Card Frame Base Template (Gold / Custom)
    card_type = player_data.get("cardType", "gold").lower()
    frame_path = f"assets/frames/{card_type}.png"
    
    if os.path.exists(frame_path):
        frame = Image.open(frame_path).convert("RGBA").resize((CARD_WIDTH, CARD_HEIGHT))
        card.paste(frame, (0, 0), frame)
    else:
        # Fallback: Draw a basic golden card background if template image is missing
        draw_bg = ImageDraw.Draw(card)
        draw_bg.rectangle([0, 0, CARD_WIDTH, CARD_HEIGHT], fill=(212, 175, 55, 255))

    # Paste Player Cutout Photo
    if raw_photo_img:
        photo = raw_photo_img.convert("RGBA")
        photo = photo.resize((320, 320), Image.Resampling.LANCZOS)
        card.paste(photo, (140, 150), photo)

    # Prepare Drawing Context for Stats & Text
    draw = ImageDraw.Draw(card)

    # Load Custom Font (Fallback to default if custom font file is missing)
    try:
        font_large = ImageFont.truetype("assets/fonts/DINPro-CondBold.otf", 64)
        font_medium = ImageFont.truetype("assets/fonts/DINPro-CondBold.otf", 40)
        font_small = ImageFont.truetype("assets/fonts/DINPro-CondBold.otf", 28)
    except IOError:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Draw Rating & Position
    rating = str(player_data.get("rating", "99"))
    position = str(player_data.get("position", "OH")).upper()
    name = str(player_data.get("name", "PLAYER")).upper()

    draw.text((100, 140), rating, fill=(255, 255, 255), font=font_large, anchor="mm")
    draw.text((100, 200), position, fill=(255, 255, 255), font=font_medium, anchor="mm")

    # Draw Player Name
    draw.text((CARD_WIDTH // 2, 520), name, fill=(255, 255, 255), font=font_large, anchor="mm")

    # Draw Stats Grid (Spike, Block, Serve, Dig, Set, Rec)
    stats = [
        ("SPK", str(player_data.get("spk", 85))),
        ("BLK", str(player_data.get("blk", 80))),
        ("SRV", str(player_data.get("srv", 88))),
        ("DIG", str(player_data.get("dig", 82))),
        ("SET", str(player_data.get("set", 75))),
        ("REC", str(player_data.get("rec", 84))),
    ]

    # Grid position coordinates for 2-column stat display
    col1_x, col2_x = 180, 380
    start_y = 590
    row_height = 55

    for idx, (label, val) in enumerate(stats):
        col = col1_x if idx < 3 else col2_x
        row = idx % 3
        curr_y = start_y + (row * row_height)

        # Draw Stat Value & Label
        draw.text((col, curr_y), val, fill=(255, 255, 255), font=font_medium, anchor="rm")
        draw.text((col + 15, curr_y), label, fill=(220, 220, 220), font=font_small, anchor="lm")

    # Save rendered card to a BytesIO memory buffer
    buffer = BytesIO()
    card.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


# ==========================================
# 3. WORKER PROCESS (Scans Firestore & Renders)
# ==========================================
def process_unrendered_players():
    players_ref = db.collection("players").stream()

    for doc in players_ref:
        p_data = doc.to_dict()
        p_id = doc.id

        # Comment this check out temporarily if you want to force re-generating all cards
        if p_data.get("generatedCardUrl"):
            continue

        print(f"Processing card for: {p_data.get('name', 'Unknown')} ({p_id})...")

        # Download raw cutout image if present
        raw_photo_img = None
        if p_data.get("rawPhotoUrl"):
            try:
                res = requests.get(p_data["rawPhotoUrl"], timeout=10)
                if res.status_code == 200:
                    raw_photo_img = Image.open(BytesIO(res.content))
            except Exception as e:
                print(f"Error downloading photo for {p_id}: {e}")

        try:
            # Generate FIFA Card Image Buffer
            card_buffer = generate_fut_card(p_data, raw_photo_img)

            # Save PNG locally inside assets/cards/
            os.makedirs("assets/cards", exist_ok=True)
            local_path = f"assets/cards/{p_id}.png"

            with open(local_path, "wb") as f:
                f.write(card_buffer.getbuffer())

            # Update Firestore with local relative URL for GitHub Pages
            relative_url = f"assets/cards/{p_id}.png"
            db.collection("players").doc(p_id).update({
                "generatedCardUrl": relative_url
            })

            print(f"Successfully generated local card: {relative_url}")

        except Exception as e:
            print(f"Worker error processing {p_id}: {e}")


# ==========================================
# 4. MAIN WORKER LOOP
# ==========================================
if __name__ == "__main__":
    print("🚀 FIFA Card Generation Worker Started...")
    while True:
        process_unrendered_players()
        time.sleep(5)