import os
import csv
import time
import base64
import cv2
import numpy as np
import paho.mqtt.client as mqtt
import smtplib
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders
from datetime import datetime, timedelta
from threading import Thread, Timer
from io import BytesIO
from PIL import Image
import json # Ensure json is imported

# Directories
REGISTERED_DIR = 'registered_users'
ATTENDANCE_DIR = 'attendance_logs'
SAVED_IMAGES_DIR = 'received_images'

# SMTP Configuration (adjust as needed)
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
SMTP_USERNAME = ''#you Email
SMTP_PASSWORD = ''#smtp app password
FROM_EMAIL = ''#add your email
BROKER ='Mqtt Broker'
TOPIC_IMAGE = "attendance/image"
TOPIC_START = "attendance/start"
TOPIC_CONFIRM_BASE = "attendance/confirm" # Base topic for confirmations

# Globals
recognizers = {}              # {class_name: recognizer}
label_map = {}                # {class_name: {label_id: name}}
active_classes = {}           # {class_name: end_time}
recorded_today = {}           # {class_name: set(names)}
doctor_emails = {}            # {class_name: doctor_email}

# --- MQTT Client Initialization (Moved to Global Scope) ---
client = mqtt.Client()
# --- End MQTT Client Initialization ---

# Load training data
def train_models():
    for class_name in os.listdir(REGISTERED_DIR):
        class_path = os.path.join(REGISTERED_DIR, class_name)
        recognizer = cv2.face.LBPHFaceRecognizer_create()
        faces, labels = [], []
        label_map[class_name] = {}
        label_counter = 0

        for filename in os.listdir(class_path):
            filepath = os.path.join(class_path, filename)
            img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
            if img is None:
                print(f"[WARN] Cannot load image {filepath}")
                continue
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
            faces_rect = face_cascade.detectMultiScale(img, scaleFactor=1.1, minNeighbors=5)
            for (x, y, w, h) in faces_rect:
                face = img[y:y + h, x:x + w]
                name = os.path.splitext(filename)[0]
                faces.append(face)
                labels.append(label_counter)
                label_map[class_name][label_counter] = name
                label_counter += 1
                break

        if faces:
            recognizer.train(faces, np.array(labels))
            recognizers[class_name] = recognizer
            recorded_today[class_name] = set()
            print(f"[TRAIN] Trained model for {class_name} with {len(faces)} faces.")
        else:
            print(f"[WARN] No faces found for class {class_name}")

# Send email with attachment
def send_email(to_email, subject, body, attachment_path):
    print("[DEBUG] Preparing email...")
    if not os.path.exists(attachment_path):
        print(f"[ERROR] Attachment file not found: {attachment_path}. Cannot send email.")
        return

    msg = MIMEMultipart()
    msg['From'] = FROM_EMAIL
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    print(f"[DEBUG] Email prepared: To={to_email}, Subject={subject}")

    # Attach CSV
    try:
        with open(attachment_path, 'rb') as f:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="{os.path.basename(attachment_path)}"')
        msg.attach(part)
        print("[DEBUG] CSV attachment added.")
    except Exception as e:
        print(f"[ERROR] Failed to attach CSV: {e}")
        return # Don't send if attachment failed

    # Send Email
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.set_debuglevel(0)  # Change to 1 for verbose SMTP logs
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            print(f"[EMAIL] Sent attendance log to {to_email}")
    except smtplib.SMTPAuthenticationError as auth_err:
         print(f"[ERROR] SMTP Authentication failed: {auth_err}. Check username/password/app password.")
    except Exception as e:
        print(f"[ERROR] Failed to send email: {e}")


# Mark attendance AND SEND CONFIRMATION
def mark_attendance(class_name, name):
    global client # Access the global MQTT client

    if name in recorded_today.get(class_name, set()): # Use .get for safety
        print(f"[LOG] Attendance already marked for {name} in {class_name} today.")
        return # Already recorded

    # Ensure the class set exists
    if class_name not in recorded_today:
        recorded_today[class_name] = set()

    recorded_today[class_name].add(name)
    os.makedirs(ATTENDANCE_DIR, exist_ok=True)
    csv_path = os.path.join(ATTENDANCE_DIR, f"{class_name}.csv")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    file_exists = os.path.isfile(csv_path)

    try:
        with open(csv_path, 'a', newline='') as f:
            writer = csv.writer(f)
            # Write header if file is new
            if not file_exists or os.path.getsize(csv_path) == 0:
                 writer.writerow(['Name', 'Timestamp'])
            writer.writerow([name, now])
        print(f"[LOG] Marked attendance: {name} in {class_name} at {now}")

        # --- Send Confirmation via MQTT ---
        confirmation_topic = f"{TOPIC_CONFIRM_BASE}/{class_name}"
        confirmation_payload = json.dumps({"status": "success", "name": name}) # Include name for potential ESP display
        try:
            if client.is_connected(): # Check if client is connected before publishing
                 result, mid = client.publish(confirmation_topic, confirmation_payload)
                 if result == mqtt.MQTT_ERR_SUCCESS:
                      print(f"[MQTT] Sent confirmation to {confirmation_topic}")
                 else:
                      print(f"[ERROR] Failed to send confirmation MQTT message (Error code: {result})")
            else:
                 print("[ERROR] Cannot send confirmation, MQTT client not connected.")

        except Exception as mqtt_e:
            print(f"[ERROR] Exception during MQTT confirmation publish: {mqtt_e}")
        # --- End Confirmation ---

    except IOError as e:
         print(f"[ERROR] Could not write to attendance file {csv_path}: {e}")
    except Exception as e:
         print(f"[ERROR] Unexpected error during attendance marking: {e}")

# When time is up, send attendance to doctor
def finalize_and_email(class_name):
    print(f"[DEBUG] Finalizing and emailing attendance for {class_name}")
    csv_path = os.path.join(ATTENDANCE_DIR, f"{class_name}.csv")
    to_email = doctor_emails.get(class_name)

    if not to_email:
        print(f"[WARN] No doctor email found for class {class_name}. Skipping email.")
    elif not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0:
         print(f"[WARN] Attendance file {csv_path} is empty or doesn't exist. Skipping email.")
         # Optionally send an email saying no attendance was recorded
         # body = f"No attendance was recorded for class {class_name} during the session."
         # subject = f"Empty Attendance Log for {class_name}"
         # try: send_email(to_email, subject, body, None) # Need send_email adaptation for no attachment
         # except: pass # Ignore email failure if file was empty anyway
    else:
        subject = f"Attendance Log for {class_name} - {datetime.now().strftime('%Y-%m-%d')}"
        body = f"Please find attached the attendance log for {class_name} recorded on {datetime.now().strftime('%Y-%m-%d')}."
        send_email(to_email, subject, body, csv_path)

    # Clean up AFTER potential email sending attempt
    if class_name in active_classes:
        del active_classes[class_name]
    if class_name in doctor_emails:
        del doctor_emails[class_name]
    # Clear the set for the next session, but keep the CSV file
    if class_name in recorded_today:
         recorded_today[class_name] = set()

    # --- Optionally clear the CSV file after sending ---
    # Comment this out if you want to keep a running log file on the server
    try:
        if os.path.exists(csv_path):
            with open(csv_path, 'w') as f:
                pass # This will clear the file
            print(f"[INFO] Cleared attendance log file: {csv_path}")
    except Exception as e:
        print(f"[ERROR] Failed to clear attendance log file {csv_path}: {e}")
    # --- End optional CSV clearing ---

    print(f"[INFO] Finalized attendance session for {class_name}")


# Handle image processing
def process_image(class_name, b64_image):
    # Check if class is active first
    if class_name not in active_classes or datetime.now() > active_classes.get(class_name, datetime.min): # Safe check
        print(f"[INFO] Class {class_name} not active. Image not processed.")
        return

    try:
        image_data = base64.b64decode(b64_image)

        # ###############################################################
        # ### Optional Block: Save Received Image ###
        # ###############################################################
        try:
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            save_directory = os.path.join(SAVED_IMAGES_DIR, class_name)
            os.makedirs(save_directory, exist_ok=True)
            save_path = os.path.join(save_directory, f"received_{timestamp_str}.jpg")
            with open(save_path, 'wb') as f:
                f.write(image_data)
            # print(f"[DEBUG] Saved received image to: {save_path}") # Optional: less verbose log
        except Exception as save_e:
            print(f"[ERROR] Failed to save received image: {save_e}")
        # ###############################################################
        # ### End Optional Block ###
        # ###############################################################

        image = Image.open(BytesIO(image_data)).convert('L') # Convert to grayscale
        img_np = np.array(image)

        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        if face_cascade.empty():
             print("[ERROR] Failed to load Haarcascade for face detection.")
             return

        faces = face_cascade.detectMultiScale(img_np, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)) # Added minSize

        if len(faces) == 0:
            print("[INFO] No face detected in received image.")
            return

        recognizer = recognizers.get(class_name)
        class_labels = label_map.get(class_name)

        if recognizer is None:
            print(f"[WARN] No recognition model found for class {class_name}")
            return
        if class_labels is None:
             print(f"[WARN] No label map found for class {class_name}")
             return

        # Process only the first detected face for simplicity
        (x, y, w, h) = faces[0]
        face = img_np[y:y + h, x:x + w]


        # face = cv2.resize(face, (100, 100)) # Example resize, match training size


        label, confidence = recognizer.predict(face)

        CONFIDENCE_THRESHOLD = 90# Adjust LBPH threshold (lower is stricter)

        print(f"[DEBUG] Prediction for {class_name}: Label={label}, Confidence={confidence:.2f}") # Debug

        if confidence < CONFIDENCE_THRESHOLD:
            name = class_labels.get(label)
            if name:
                print(f"[RECOGNIZE] Face recognized in {class_name}: {name} (Confidence: {confidence:.2f})")
                mark_attendance(class_name, name) # Call the modified function
            else:
                print(f"[WARN] Recognized label {label} has no name mapping in class {class_name}. Map: {class_labels}")
        else:
            print(f"[INFO] Unknown face detected in {class_name} (Confidence: {confidence:.2f} >= {CONFIDENCE_THRESHOLD})")

    except base64.binascii.Error as b64_err:
        print(f"[ERROR] Failed to decode Base64 image string: {b64_err}")
    except cv2.error as cv_err:
         print(f"[ERROR] OpenCV error during image processing: {cv_err}")
    except Exception as e:
        print(f"[ERROR] Failed during image processing/recognition: {e}")


# MQTT handlers
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[MQTT] Connected successfully to broker.")
        client.subscribe([(TOPIC_START, 0), (TOPIC_IMAGE, 0)])
        print(f"[MQTT] Subscribed to {TOPIC_START}")
        print(f"[MQTT] Subscribed to {TOPIC_IMAGE}")
    else:
        print(f"[ERROR] MQTT Connection failed with result code {rc}")


def on_message(client, userdata, msg):
    print(f"[MQTT] Message received on topic {msg.topic}")
    try:
        payload = msg.payload.decode('utf-8') # Decode payload
    except Exception as decode_err:
         print(f"[ERROR] Could not decode MQTT payload: {decode_err}")
         return

    if msg.topic == TOPIC_START:
        try:
            data = json.loads(payload)
            class_name = data.get('class')
            email = data.get('email')

            if not class_name or not email:
                 print("[ERROR] Invalid START payload. Missing 'class' or 'email'. Payload:", payload)
                 return

        except json.JSONDecodeError as json_err:
            print(f"[ERROR] Invalid JSON in START payload: {json_err}. Payload:", payload)
            return
        except Exception as e:
             print(f"[ERROR] Error processing START message: {e}")
             return

        if class_name in active_classes:
            print(f"[WARN] Class {class_name} is already active until {active_classes[class_name]}. Ignoring new start.")
            return

        if class_name not in recognizers:
            print(f"[ERROR] Received start for unknown class '{class_name}'. Train model first.")
            return # Don't start session for untrained class

        duration_minutes = 3 # Make session duration configurable if needed
        end_time = datetime.now() + timedelta(minutes=duration_minutes)
        active_classes[class_name] = end_time
        recorded_today[class_name] = set() # Reset attendance set for the new session
        doctor_emails[class_name] = email
        print(f"[START] Class '{class_name}' session started. Active until {end_time}. Email to {email}")

        # Schedule finalization using threading.Timer
        timer_seconds = duration_minutes * 60
        finalize_timer = Timer(timer_seconds, finalize_and_email, args=(class_name,))
        finalize_timer.daemon = True # Allows program to exit even if timer is waiting
        finalize_timer.start()
        print(f"[INFO] Scheduled finalization for '{class_name}' in {duration_minutes} minutes.")

    elif msg.topic == TOPIC_IMAGE:
        try:
            data = json.loads(payload)
            class_name = data.get("class")
            b64_image = data.get("image")

            if not class_name or not b64_image:
                 print("[ERROR] Invalid IMAGE payload. Missing 'class' or 'image'.")
                 return

            if class_name not in active_classes:
                 print(f"[WARN] Received image for inactive class '{class_name}'. Ignoring.")
                 return

            # Process in a separate thread to avoid blocking MQTT loop
            img_thread = Thread(target=process_image, args=(class_name, b64_image))
            img_thread.daemon = True
            img_thread.start()

        except json.JSONDecodeError as json_err:
            print(f"[ERROR] Invalid JSON in IMAGE payload: {json_err}.")
        except Exception as e:
            print(f"[ERROR] Error processing IMAGE message: {e}")

def on_disconnect(client, userdata, rc):
    print(f"[MQTT] Disconnected with result code {rc}")
    if rc != 0:
        print("[MQTT] Unexpected disconnection. Attempting to reconnect...")
        # Implement reconnection logic here if needed, e.g., using a loop or backoff strategy

def on_log(client, userdata, level, buf):
    # Optional: More detailed logging from Paho MQTT client
    # print(f"[MQTT LOG-{level}] {buf}")
    pass

# Main Execution Block
if __name__ == "__main__":
    print("[INFO] Starting Attendance System Server...")
    train_models() # Train models on startup

    # Assign callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    # client.on_log = on_log # Uncomment for verbose MQTT logs

    print(f"[INFO] Connecting to MQTT broker at {BROKER}...")
    try:
        client.connect(BROKER, 1883, 60) # Increased keepalive to 60s
        client.loop_forever() # Start network loop (blocking)
    except ConnectionRefusedError:
         print(f"[FATAL] Connection to MQTT broker {BROKER} refused. Is it running?")
    except OSError as os_err:
         print(f"[FATAL] Network error connecting to MQTT broker: {os_err}")
    except KeyboardInterrupt:
         print("[INFO] Shutting down server...")
         client.disconnect()
         print("[INFO] MQTT client disconnected.")
    except Exception as e:
         print(f"[FATAL] An unexpected error occurred: {e}")
         client.disconnect() # Attempt to disconnect cleanly