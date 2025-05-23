# 🔐 Home Security & Automation System – PIC16F887A

**Author:** ENG. Karam Abou Sahyoun  
**Microcontroller:** PIC16F887A  
**Compiler:** MPLAB MPASM  

---

## 🧠 Overview

A robust, embedded **home security and automation system** built using the PIC16F887A microcontroller. Features include:

- 🔢 **Password-protected access control**
- 🔥 **Fire & motion detection**
- 🚨 **Alarm system with buzzer and LEDs**
- 💡 **Relay-based environment control**
- 📟 **User interface via LCD and Keypad**

The system uses a default 4-digit PIN (`"1234"`) stored in the internal EEPROM and can be expanded to include advanced features like time-stamping, event logs, and wireless alerts.

---

## ✨ Features

### 🔐 Security
- 4-digit PIN protection for arming/disarming
- Stored in EEPROM (editable in future firmware)
- Default: `"1234"`

### 🔍 Sensors & Detection
- **Fire Sensor:** Active LOW
- **Motion Sensor:** Active LOW
- **Debouncing logic** for stable readings

### 🚨 Alarm System
- **Buzzer + LED alerts** on trigger
- Auto-silence buzzer after ~30s (alarm LED remains ON)
- Armed state LED

### 📟 User Interface
- **16x2 LCD Display**
  - Status messages and PIN prompts
- **4x4 Keypad**
  - PIN input and commands (`*` = Arm/Disarm)

### ⚙️ Automation
- Motion-based **relay activation** (e.g., lights)
- Can be expanded for fans, locks, or HVAC

---

⚡ Hardware Connections
🔌 Power Supply
+5V DC Regulated

Use 0.1µF decoupling capacitors near VDD/VSS

🖥️ LCD (16x2 HD44780)
LCD Pin	PIC Pin
RS	RB0
EN	RB1
D4-D7	RB2–RB5
RW	GND
V0	Potentiometer (Contrast)

⌨️ Keypad (4x4)
Keypad Line	PIC Pin	Direction
Rows R1–R4	RC2–RC5	Output
Cols C1–C4	RD0–RD3	Input + 10kΩ pull-up

🧯 Sensors
Sensor	PIC Pin	Notes
Fire Sensor	RA0	Active LOW, add pull-up if OC
Motion Sensor	RA1	Active LOW, add pull-up if OC

🔈 Outputs
Device	PIC Pin	Notes
Buzzer	RC0	Use NPN transistor or ULN2003 if >20mA
Relay Ctrl	RC1	Same as above, with flyback diode
Armed LED	RA2	Series 330Ω resistor to GND
Alarm LED	RA3	Series 330Ω resistor to GND

📷 Conceptual Wiring Diagram
text
Copy
Edit
                     +5V
                      |
                  [10k Pot]
                      |
                    V0 (LCD)
                      |
                    PIC16F887A
    ----------------------------------------
    RA0 <--- Fire Sensor       RB0 ---> LCD RS
    RA1 <--- Motion Sensor     RB1 ---> LCD EN
    RA2 ---> Armed LED         RB2–RB5 ---> LCD D4–D7
    RA3 ---> Alarm LED
    RC0 ---> Buzzer (via NPN or ULN)
    RC1 ---> Relay (via NPN or ULN)
    RC2–RC5 ---> Keypad Rows (Out)
    RD0–RD3 <--- Keypad Cols (In w/ Pull-up)
    VDD ---> +5V         VSS ---> GND
🛠️ Setup Guide
Assemble the circuit as per wiring chart.

Open the project in MPLAB using MPASM.

Build the project and program the .hex file to your PIC16F887A using a PICkit or other programmer.

Power up the circuit with regulated +5V.

Startup Message displays on LCD. You're ready!

⚠️ Best Practices
Use transistor drivers for buzzers and relays (don’t overload I/O pins).

Pull-up resistors are essential for keypad and sensor stability.

Adjust software delays if your oscillator ≠ 4MHz.

Use a stable power source with decoupling capacitors.

Limit EEPROM writes to reduce wear.

🚀 Future Upgrades
Add "Change PIN" functionality.

Log security events to EEPROM or SD card.

Integrate Real-Time Clock (RTC).

Add GSM or Wi-Fi notifications.

Web dashboard for remote control.