import os
import time
import requests
from io import BytesIO
import firebase_admin
from firebase_admin import credentials, firestore, storage
from PIL import Image, ImageDraw, ImageFont

# 1. Initialize Firebase Admin SDK
cred = credentials.Certificate("firebase_key.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'WeekendVolley.appspot.com'  # Replace with your Firebase Storage bucket name
})

db = firestore.client()
bucket = storage.bucket()

def generate_fut_card(player_data, raw_photo_img):
    CARD_WIDTH, CARD_HEIGHT = 600, 880
    card = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    
    # Theme background frame
    theme = player_data.get("cardTheme", "gold")
    frame_path = f"assets/frames/{theme}.png"
    if os.path.exists(frame_path):
        frame_img = Image.open(frame_path).convert("RGBA").resize((CARD_WIDTH, CARD_HEIGHT))
        card.paste(frame_img, (0, 0), frame_img)
    else:
        draw.rounded_rectangle([20, 20, CARD_WIDTH - 20, CARD_HEIGHT - 20], radius=35, fill=(224, 170, 62), outline=(184, 134, 11), width=8)

    # Paste player cutout photo
    if raw_photo_img:
        photo = raw_photo_img.convert("RGBA")
        photo.thumbnail((360, 400))
        card.paste(photo, (180, 100), photo)

    # Load Fonts
    font_path = "assets/fonts/DINPro-CondBold.otf"
    try:
        font_ovr = ImageFont.truetype(font_path, 80)
        font_pos = ImageFont.truetype(font_path, 40)
        font_name = ImageFont.truetype(font_path, 48)
        font_stats = ImageFont.truetype(font_path, 32)
    except IOError:
        font_ovr = font_pos = font_name = font_stats = ImageFont.load_default()

    text_color = (17, 17, 17) if theme in ["gold", "icon"] else (255, 255, 255)

    # Text rendering
    draw.text((80, 80), str(player_data.get("ovr", 85)), fill=text_color, font=font_ovr)
    draw.text((85, 165), str(player_data.get("pos", "UNI")).upper()[:3], fill=text_color, font=font_pos)
    draw.text((85, 225), f"#{player_data.get('jersey', '0')}", fill=text_color, font=font_pos)

    # Render Player Name
    name = player_data.get("name", "PLAYER").upper()
    bbox = draw.textbbox((0, 0), name, font=font_name)
    text_w = bbox[2] - bbox[0]
    draw.text(((CARD_WIDTH - text_w) // 2, 500), name, fill=text_color, font=font_name)

    # Render Stats
    stats = player_data.get("stats", {})
    stat_items = [
        ("ATK", stats.get("atk", 70)), ("BLK", stats.get("blk", 70)),
        ("SRV", stats.get("srv", 70)), ("STM", stats.get("stm", 70)),
        ("RCV", stats.get("rcv", 70)), ("TMW", stats.get("tmw", 70))
    ]
    for i, (label, val) in enumerate(stat_items):
        x = 100 if i % 2 == 0 else 350
        y = 590 + (i // 2) * 55
        draw.text((x, y), f"{val} {label}", fill=text_color, font=font_stats)

    output_buffer = BytesIO()
    card.save(output_buffer, format="PNG")
    output_buffer.seek(0)
    return output_buffer

def process_unrendered_players():
    # Fetch players from Firestore
    players_ref = db.collection("players").stream()
    
    for doc in players_ref:
        p_data = doc.to_dict()
        p_id = doc.id

        # Skip if card is already generated
 #       if p_data.get("generatedCardUrl"):
  #          continue

        print(f"Processing card for: {p_data.get('name')}...")

        # Download photo if present
        raw_photo_img = None
        if p_data.get("rawPhotoUrl"):
            try:
                res = requests.get(p_data["rawPhotoUrl"])
                if res.status_code == 200:
                    raw_photo_img = Image.open(BytesIO(res.content))
            except Exception as e:
                print(f"Error downloading photo: {e}")

        # Render card
        card_buffer = generate_fut_card(p_data, raw_photo_img)

        # Upload card PNG to Firebase Storage
        blob = bucket.blob(f"generated_cards/{p_id}.png")
        blob.upload_from_file(card_buffer, content_type="image/png")
        blob.make_public()
        generated_url = blob.public_url

        # Save public image URL into Firestore database
        db.collection("players").doc(p_id).update({
            "generatedCardUrl": generated_url
        })
        print(f"Card successfully uploaded & linked: {generated_url}")

# Continuous background listener loop
if __name__ == "__main__":
    print("Python card generation worker running...")
    while True:
        try:
            process_unrendered_players()
        except Exception as err:
            print("Worker error:", err)
        time.sleep(5)  # Checks for new card requests every 5 seconds