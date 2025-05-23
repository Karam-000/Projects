#include "esp_camera.h"
#include <WiFi.h>
#include <PubSubClient.h>

// Wi-Fi credentials
const char* ssid = ""; //enter your wifi ssid
const char* password = "";//enter your password

// MQTT broker details
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;
const char* mqtt_topic_command = "esp32/cam/command";
const char* mqtt_topic_image = "esp32/cam/image";

// Wi-Fi & MQTT clients
WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);

  // Initialize camera
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  
  config.pin_pwdn = -1;        // Power down not used
  config.pin_reset = -1;       // No hardware reset
  config.pin_xclk = 0;
  config.pin_sscb_sda = 26;
  config.pin_sscb_scl = 27;
  config.pin_d7 = 35;
  config.pin_d6 = 34;
  config.pin_d5 = 39;
  config.pin_d4 = 36;
  config.pin_d3 = 21;
  config.pin_d2 = 19;
  config.pin_d1 = 18;
  config.pin_d0 = 5;
  config.pin_vsync = 25;
  config.pin_href = 23;
  config.pin_pclk = 22;
  
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_QVGA; // 320x240 (ESP32 does NOT support 320x320)
    config.jpeg_quality = 10; // Lower = better quality
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera initialization failed!");
    return;
  }

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to Wi-Fi");

  // Connect to MQTT broker
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP32-CAM")) {
      Serial.println("connected");
      client.subscribe(mqtt_topic_command);
    } else {
      Serial.print("Failed, rc=");
      Serial.print(client.state());
      Serial.println(" retry in 5 seconds");
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message received on topic [");
  Serial.print(topic);
  Serial.print("]: ");

  char command[32];
  strncpy(command, (char*)payload, min(length, sizeof(command) - 1));
  command[min(length, sizeof(command) - 1)] = '\0';

  if (strcmp(command, "capture") == 0) {
    Serial.println("Capture command received! Taking picture...");
    captureAndSendImage();
  }
}

void captureAndSendImage() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed!");
    return;
  }

  Serial.printf("Captured image! Size: %u bytes\n", fb->len);

  // Send image size first
  char sizeMsg[20];
  snprintf(sizeMsg, sizeof(sizeMsg), "size:%u", fb->len);
  client.publish(mqtt_topic_image, sizeMsg);
  delay(200); // Allow receiver to process size message

  // Send image in chunks
  const size_t chunkSize = 1024;
  size_t totalChunks = (fb->len + chunkSize - 1) / chunkSize;

  for (size_t i = 0; i < totalChunks; i++) {
    size_t offset = i * chunkSize;
    size_t toSend = min(fb->len - offset, chunkSize);

    if (client.publish(mqtt_topic_image, (const uint8_t*)(fb->buf + offset), toSend)) {
      Serial.printf("Sent chunk %u/%u (%u bytes)\n", i + 1, totalChunks, toSend);
    } else {
      Serial.printf("Failed to send chunk %u\n", i);
    }
    delay(10);
  }

  // Send end-of-image marker
  client.publish(mqtt_topic_image, "END");
  Serial.println("Image sent successfully!");

  // Release frame buffer
  esp_camera_fb_return(fb);
}
