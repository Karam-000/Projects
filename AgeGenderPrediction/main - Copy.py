from flask import Flask, request, jsonify, render_template
from flask_cors import CORS  # Add this import

import torch
from PIL import Image
import numpy as np
import io
import torchvision.transforms as transforms

app = Flask(__name__)
CORS(app)

# Load model
class MultiTaskModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.base = torch.nn.Sequential(
            torch.nn.Conv2d(3, 32, 3, padding=1),
            torch.nn.ReLU(),
            torch.nn.MaxPool2d(2),
            torch.nn.Conv2d(32, 64, 3, padding=1),
            torch.nn.ReLU(),
            torch.nn.MaxPool2d(2),
            torch.nn.Conv2d(64, 128, 3, padding=1),
            torch.nn.ReLU(),
            torch.nn.MaxPool2d(2),
            torch.nn.Flatten()
        )
        self.age_head = torch.nn.Sequential(
            torch.nn.Linear(128 * 16 * 16, 128),
            torch.nn.ReLU(),
            torch.nn.Linear(128, 1)
        )
        self.gender_head = torch.nn.Sequential(
            torch.nn.Linear(128 * 16 * 16, 128),
            torch.nn.ReLU(),
            torch.nn.Linear(128, 1)
        )

    def forward(self, x):
        x = self.base(x)
        age = self.age_head(x)
        gender = self.gender_head(x)
        return age.squeeze(1), gender.squeeze(1)


# Initialize model and load weights
device = torch.device('cpu')
model = MultiTaskModel().to(device)
model.load_state_dict(torch.load("C:\\Users\\karam\\Downloads\\multi_task_model.pth", map_location=device))
model.eval()

# Image preprocessing
preprocess = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

@app.route('/')
def home():
    return render_template('index.html')  # Serve your main HTML page

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    image_file = request.files['image']
    image = Image.open(io.BytesIO(image_file.read()))

    # Convert image to RGB if it has an alpha channel
    if image.mode == 'RGBA':
        image = image.convert('RGB')

    # Preprocess image
    img_tensor = preprocess(image)
    img_tensor = img_tensor.unsqueeze(0).to(device)

    with torch.no_grad():
        age_pred, gender_pred = model(img_tensor)

    age = age_pred.item()
    gender = "Male" if torch.sigmoid(gender_pred) > 0.5 else "Female"

    return jsonify({
        'age': round(age, 1),
        'gender': gender
    })

@app.route('/test', methods=['GET'])
def test_page():
    return '''
    <form method="POST" action="/predict" enctype="multipart/form-data">
        <input type="file" name="image">
        <input type="submit" value="Predict">
    </form>
    '''

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)