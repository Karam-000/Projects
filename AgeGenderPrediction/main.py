# -*- coding: utf-8 -*-

# 1. Monkey patching MUST come absolutely first
import eventlet
eventlet.monkey_patch()

# 2. Now import all other modules
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import torch
from PIL import Image
import io
import torchvision.transforms as transforms
import torch.nn as nn
import base64
import os # Keep os import here

# --- Flask App Initialization ---
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) # Allow all origins for now
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# --- Model Definition ---
class MultiTaskModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.base = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(), nn.MaxPool2d(2), nn.Dropout(0.25),
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(), nn.MaxPool2d(2), nn.Dropout(0.25),
            nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.MaxPool2d(2), nn.Dropout(0.25),
            nn.Conv2d(128, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(), nn.MaxPool2d(2), nn.Dropout(0.25),
            nn.Flatten()
        )
        self.flatten_size = 256 * 8 * 8
        self.age_head = nn.Sequential(
            nn.Linear(self.flatten_size, 512), nn.BatchNorm1d(512), nn.ReLU(), nn.Dropout(0.5),
            nn.Linear(512, 128), nn.BatchNorm1d(128), nn.ReLU(),
            nn.Linear(128, 1)
        )
        self.gender_head = nn.Sequential(
            nn.Linear(self.flatten_size, 512), nn.BatchNorm1d(512), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(512, 256), nn.BatchNorm1d(256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, 1),
        )
        self._initialize_weights()

    def _initialize_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d): nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.Linear): nn.init.xavier_normal_(m.weight); nn.init.constant_(m.bias, 0)

    def forward(self, x):
        x = self.base(x)
        age = self.age_head(x)
        gender = self.gender_head(x)
        return age.squeeze(1), gender.squeeze(1)
# --- End Model Definition ---

# --- Global Variables & Setup ---
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

model = MultiTaskModel().to(device)

# --- CORRECTED Path Handling ---
# Get the directory where this script (main2.py) is located
script_dir = os.path.dirname(os.path.abspath(__file__))



# OPTION 2: Use the absolute path if it's fixed and you are sure it's correct
# Use a raw string (r"...") to handle backslashes easily
model_path = r"C:\Users\karam\Downloads\multi_task_model (1).pth"
# --- Choose ONE of the above model_path options ---

# Construct the Haar Cascade path reliably
haar_filename = 'haarcascade_frontalface_default.xml'
try:
    # Try standard cv2 data location
    cascade_path = os.path.join(cv2.data.haarcascades, haar_filename)
    if not os.path.exists(cascade_path):
        # Fallback: Check relative to script (if you copied it there)
        cascade_path_fallback = os.path.join(script_dir, haar_filename)
        if os.path.exists(cascade_path_fallback):
            cascade_path = cascade_path_fallback
        else:
             raise FileNotFoundError("Haar Cascade XML file not found.")
except AttributeError: # Handle cases where cv2.data might not exist
     cascade_path = os.path.join(script_dir, haar_filename) # Check relative to script


# Load Model
try:
    print(f"Attempting to load model from: {model_path}") # Debug print
    model.load_state_dict(torch.load(model_path, map_location=device))
    print(f"Model loaded successfully.")
except FileNotFoundError:
    print(f"ERROR: Model file not found at '{model_path}'. Please ensure the file exists at this location.")
    exit()
except Exception as e:
    print(f"Error loading model state_dict: {e}")
    exit()
model.eval()

# Load Face Cascade
try:
    print(f"Attempting to load Haar Cascade from: {cascade_path}") # Debug print
    face_cascade = cv2.CascadeClassifier(cascade_path)
    if face_cascade.empty():
        raise IOError(f"Failed to load Haar Cascade from the specified path.")
    else:
        print(f"Haar Cascade loaded successfully.")
except Exception as e:
    print(f"Error loading Haar Cascade: {e}")
    exit()

# Image Preprocessing Transform
preprocess = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])
# --- End Setup ---


# --- Utility Functions ---
# (Keep your utility functions: crop_face, predict_age_gender, base64_to_cv2_image, cv2_image_to_base64)
def crop_face(pil_image):
    # ... (implementation as before) ...
    cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    if len(faces) == 0: return None
    (x, y, w, h) = faces[0]
    margin = 20
    x1 = max(0, x - margin)
    y1 = max(0, y - margin)
    x2 = min(pil_image.width, x + w + margin)
    y2 = min(pil_image.height, y + h + margin)
    face_crop = pil_image.crop((x1, y1, x2, y2))
    return face_crop

def predict_age_gender(face_crop_pil):
     # ... (implementation as before) ...
    if face_crop_pil is None: return None, None
    img_tensor = preprocess(face_crop_pil).unsqueeze(0).to(device)
    with torch.no_grad(): age_pred, gender_pred = model(img_tensor)
    age = age_pred.item()
    gender_prob = torch.sigmoid(gender_pred).item()
    gender = "Female" if gender_prob > 0.5 else "Male"
    return round(age, 1), gender

def base64_to_cv2_image(base64_string):
    # ... (implementation as before) ...
    if not base64_string or "," not in base64_string: return None
    try:
        header, encoded = base64_string.split(',', 1)
        img_data = base64.b64decode(encoded)
        nparr = np.frombuffer(img_data, np.uint8)
        img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img_cv2
    except Exception as e: print(f"Error decoding base64 string: {e}"); return None

def cv2_image_to_base64(img_cv2):
    # ... (implementation as before) ...
    if img_cv2 is None: return None
    try:
        _, buffer = cv2.imencode('.jpg', img_cv2, [cv2.IMWRITE_JPEG_QUALITY, 85])
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        return "data:image/jpeg;base64," + jpg_as_text
    except Exception as e: print(f"Error encoding cv2 image to base64: {e}"); return None
# --- End Utility Functions ---

# --- Flask Routes & SocketIO Handlers ---
# (Keep your routes and handlers: @app.route('/'), @app.route('/predict'), @socketio.on(...))
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict_single_image():
    if 'image' not in request.files: return jsonify({'error': 'No image provided'}), 400
    image_file = request.files['image']
    try:
        image_pil = Image.open(io.BytesIO(image_file.read()))
        if image_pil.mode != 'RGB': image_pil = image_pil.convert('RGB')
        face_crop_pil = crop_face(image_pil)
        if face_crop_pil is None: return jsonify({'error': 'No face detected in the image'}), 400
        age, gender = predict_age_gender(face_crop_pil)
        if age is None: return jsonify({'error': 'Prediction failed after face detection'}), 500
        return jsonify({'age': age, 'gender': gender})
    except Exception as e: print(f"Error in /predict route: {e}"); return jsonify({'error': f'Error processing image: {str(e)}'}), 500

@socketio.on('connect')
def handle_connect(): print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect(): print(f'Client disconnected: {request.sid}')

@socketio.on('image_frame')
def handle_image_frame(data):
    # (Implementation as before)
    try:
        img_cv2 = base64_to_cv2_image(data)
        if img_cv2 is None: emit('processing_error', {'error': 'Could not decode frame'}, room=request.sid); return

        gray = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(40, 40))
        processed_image = img_cv2.copy()

        for (x, y, w, h) in faces:
            margin = 15
            y1 = max(0, y - margin); x1 = max(0, x - margin)
            y2 = min(processed_image.shape[0], y + h + margin); x2 = min(processed_image.shape[1], x + w + margin)
            face_crop_cv2 = processed_image[y1:y2, x1:x2]
            if face_crop_cv2.size == 0: continue
            face_crop_pil = Image.fromarray(cv2.cvtColor(face_crop_cv2, cv2.COLOR_BGR2RGB))
            age, gender = predict_age_gender(face_crop_pil)
            if age is not None:
                cv2.rectangle(processed_image, (x, y), (x+w, y+h), (0, 255, 0), 2)
                label = f"{gender}, {age:.0f}"
                label_size, base_line = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                y_label = max(y, label_size[1] + 10)
                cv2.rectangle(processed_image, (x, y_label - label_size[1] - 6), (x + label_size[0], y_label - base_line +6) , (0, 255, 0), cv2.FILLED)
                cv2.putText(processed_image, label, (x, y_label-4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, lineType=cv2.LINE_AA)

        processed_frame_base64 = cv2_image_to_base64(processed_image)
        if processed_frame_base64: emit('processed_frame', processed_frame_base64, room=request.sid)

    except Exception as e: print(f"Error processing video frame: {e}"); emit('processing_error', {'error': f'Backend error: {str(e)}'}, room=request.sid)
# --- End Routes/Handlers ---


# --- Main Execution ---
if __name__ == '__main__':
    print("Starting Flask-SocketIO server...")
    # use_reloader=False is recommended with eventlet/gevent to avoid issues
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False)