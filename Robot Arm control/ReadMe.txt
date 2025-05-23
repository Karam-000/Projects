# Robotic Arm Control Software for ESP32

This project provides a control system for a 4-DOF robotic arm using an **ESP32 microcontroller** and a **PCA9685 PWM driver**, with wireless communication via **MQTT** and automatic WiFi configuration using **WiFiManager**. The code supports precise movement control using **inverse kinematics (IK)**, sequential motion planning (Approach/Retreat sequences), and physical feedback from a **clamp microswitch**.

## 📌 Features

- ✅ **WiFi Auto-Configuration**: Uses `WiFiManager` to allow easy setup without hardcoding credentials.
- 🔌 **MQTT Communication**: Connects to an MQTT broker for remote command and response handling.
- 🤖 **Inverse Kinematics (IK)**: Calculates joint angles for desired end-effector positions in 3D space.
- 🔄 **Sequential Motion Planning**: Implements two movement sequences:
  - **Approach Sequence**: Base → Shoulder & Elbow (for reaching targets).
  - **Retreat Sequence**: Shoulder & Elbow → Base (for returning safely).
- 🛠️ **Smooth Servo Movement**: Interpolates servo positions for smooth transitions.
- 🧰 **Clamp Control**: Includes logic for opening/closing the clamp with microswitch feedback.
- 🗺️ **Predefined Positions**: Home position, Pickup/Drop-off location, and a 3x3 shelf grid.
- 📡 **Command Handling**: Accepts commands over MQTT for movement, pick-and-place operations, and manual control.

---

## ⚙️ Hardware Setup

### Components Used
- **ESP32 Microcontroller**
- **PCA9685 PWM Driver Module**
- **Servos**:
  - Base Servo (Channel 0)
  - Shoulder Servo (Channel 1)
  - Elbow Servo (Channel 2)
  - Clamp Servo (Channel 3)
- **Microswitch** connected to GPIO 15 for clamp feedback.

### Pin Connections

| ESP32       | PCA9685        |
|-------------|----------------|
| 3V3         | VCC            |
| GND         | GND            |
| GPIO21      | SDA            |
| GPIO22      | SCL            |

| Component     | ESP32 Pin |
|---------------|-----------|
| Clamp Switch  | GPIO15    |

---

## 📦 Command Reference

Commands are sent via MQTT topic `robotic_arm/command`. Format:

```
<command_id> [arg1] [arg2] ...
```

| Command ID | Description                        | Arguments                   |
|------------|------------------------------------|-----------------------------|
| 1          | Move to HOME position              | None                        |
| 2          | Move to PICKUP position            | None                        |
| 3          | Open Clamp                         | None                        |
| 4          | Close Clamp                        | None                        |
| 5          | Pick object from shelf             | `<row>` `<col>`             |
| 6          | Place object on shelf              | `<row>` `<col>`             |
| 7          | Test IK with coordinates           | `<x>` `<y>` `<z>`           |
| 8          | Manual angle control               | `<base_deg>` `<shoulder_deg>` `<elbow_deg>` |

---

## 📐 Kinematic Model

The robotic arm uses a **Denavit-Hartenberg (DH)** model with the following link parameters:

- **Link Lengths (`a`)**: `[0, 10.5, 17] cm`
- **Link Offsets (`d`)**: `[7, 0, 0] cm`
- **Joint Limits**:
  - Base: ±180°
  - Shoulder: 0–180°
  - Elbow: -135° to 0°

Forward and inverse kinematics functions support real-time position updates and trajectory planning.

---

## 📂 Included Functions

- `setup()` – Initializes hardware, connects to WiFi, and sets initial arm position.
- `loop()` – Maintains MQTT connection and listens for incoming commands.
- `reconnect()` – Reconnects to MQTT broker if disconnected.
- `mqttCallback()` – Handles incoming MQTT messages.
- `processCommand()` – Parses and executes commands based on ID.
- `smoothMoveShoulderElbow()` – Simultaneous shoulder and elbow movement.
- `smoothMoveServo()` – Smooth movement for base or clamp.
- `set_servos_approach()` / `set_servos_retreat()` – Sequential movement logic.
- `inverse_kinematics()` / `forward_kinematics()` – Position-to-angle conversion.
- `pickFromShelf()` / `placeAtShelf()` – Full pick-and-place automation.

---

## 📬 MQTT Topics

- **Command Topic**: `robotic_arm/command`
- **Response Topic**: `robotic_arm/response`
- **Completion Topic**: `complete/action`

Responses include success/failure status and detailed debug information.

---

## 🛠️ Debugging

Serial output provides detailed debug logs including:
- WiFi and MQTT connection status
- Servo movements
- Joint angle calculations
- IK/FK results
- Clamp state changes

---

## 📄 Example Usage

To move the arm to the pickup position:
```bash
mosquitto_pub -t "robotic_arm/command" -m "2"
```

To pick an object from shelf row 0, column 1:
```bash
mosquitto_pub -t "robotic_arm/command" -m "5 0 1"
```

---

## 📁 Project Structure

- `setup()` – Hardware initialization and network/MQTT setup
- `loop()` – Main program loop
- `Kinematics` – Inverse and forward kinematics
- `Movement` – Smooth servo movement and approach/retreat logic
- `Action Sequences` – Pick/place automation
- `MQTT` – Communication and command parsing

---

## 📝 Notes

- Ensure all servos are calibrated properly for accurate positioning.
- Use the serial monitor for debugging during development.
- The clamp switch is used to detect when the object is securely grasped.
- Shelf coordinates can be customized to suit different configurations.

---

## 📞 Contact

For questions or issues, please open an issue on GitHub or contact the developer directly.

--- 

**Enjoy building your robotic arm!** 🤖🔧