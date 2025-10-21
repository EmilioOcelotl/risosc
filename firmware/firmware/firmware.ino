#include "src/env.h"  // Contiene WIFI_SSID, WIFI_PASSWORD, API_URL

#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>

#undef NULL
#define NULL 0

#include <WiFi.h>
#include <HTTPClient.h>
#include "NfcAdapter.h"
#include <time.h>

// Pines
#define LED_R 14
#define LED_G 15
#define LED_B 16
#define PN532_POWER_PIN 5

enum SystemState {
  STATE_WAITING,
  STATE_PROCESSING,
  STATE_SUCCESS,
  STATE_ERROR
};

SystemState currentState = STATE_WAITING;
unsigned long lastStateChange = 0;
const unsigned long STATE_DELAY = 2000;

PN532_I2C pn532_i2c(Wire);
NfcAdapter nfc = NfcAdapter(pn532_i2c);

void setup() {
  Serial.begin(115200);
  Serial.println("🚀 Iniciando lector NFC...");

  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  pinMode(PN532_POWER_PIN, OUTPUT);

  setColor(255, 255, 255); // Blanco = iniciando
  connectWiFi();
  syncTime();
  
  digitalWrite(PN532_POWER_PIN, HIGH); // Siempre encendido
  delay(500);
  nfc.begin();
  
  setState(STATE_WAITING);
}

void loop() {
  switch (currentState) {
    case STATE_WAITING:
      if (nfc.tagPresent()) {
        setState(STATE_PROCESSING);
      }
      break;
      
    case STATE_PROCESSING:
      processTag();
      break;
      
    case STATE_SUCCESS:
    case STATE_ERROR:
      if (millis() - lastStateChange > STATE_DELAY) {
        setState(STATE_WAITING);
      }
      break;
  }
  
  delay(100);
}

void processTag() {
  Serial.println("🔍 Detectado - Leyendo...");
  
  if (!nfc.tagPresent()) {
    Serial.println("❌ Tag perdido durante lectura");
    setState(STATE_ERROR);
    return;
  }

  NfcTag tag = nfc.read();
  
  if (!tag.hasNdefMessage()) {
    Serial.println("❌ Tag no contiene NDEF");
    setState(STATE_ERROR);
    return;
  }

  NdefMessage message = tag.getNdefMessage();
  int foundIndex = -1;
  
  for (int i = 0; i < message.getRecordCount(); i++) {
    NdefRecord record = message.getRecord(i);
    if (record.getTnf() == TNF_WELL_KNOWN && record.getType() == "U") {
      String url = getUrlFromRecord(record);
      Serial.println("🔗 URL: " + url);
      
      foundIndex = getIndexFromUrl(url);
      if (foundIndex >= 0 && foundIndex <= 3) {
        break;
      }
    }
  }

  if (foundIndex >= 0) {
    Serial.println("🎯 Índice: " + String(foundIndex));
    sendToEndpoint(foundIndex);
  } else {
    Serial.println("❌ Índice no válido");
    setState(STATE_ERROR);
  }
}

void sendToEndpoint(int index) {
  Serial.println("📤 Enviando índice " + String(index) + " a: " + String(API_URL));
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Reconectando WiFi...");
    connectWiFi();
  }

  HTTPClient http;
  String payload = "{\"index\":" + String(index) + "}";
  
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    Serial.println("✅ Enviado correctamente");
    setState(STATE_SUCCESS);
  } else {
    Serial.println("❌ Error HTTP: " + String(httpCode));
    setState(STATE_ERROR);
  }
  
  http.end();
}

String getUrlFromRecord(NdefRecord &record) {
  byte payload[record.getPayloadLength()];
  record.getPayload(payload);
  String url;

  switch (payload[0]) {
    case 0x01: url = "http://www."; break;
    case 0x02: url = "https://www."; break;
    case 0x03: url = "http://"; break;
    case 0x04: url = "https://"; break;
    default: url = ""; break;
  }

  for (int i = 1; i < record.getPayloadLength(); i++) {
    url += (char)payload[i];
  }

  return url;
}

int getIndexFromUrl(String url) {
  int paramStart = url.indexOf("?nfc=");
  if (paramStart == -1) return -1;
  
  String indexStr = url.substring(paramStart + 5);
  int ampPos = indexStr.indexOf('&');
  if (ampPos != -1) {
    indexStr = indexStr.substring(0, ampPos);
  }
  
  return indexStr.toInt();
}

void setState(SystemState newState) {
  if (currentState == newState) return;
  
  currentState = newState;
  lastStateChange = millis();
  
  switch (newState) {
    case STATE_WAITING:
      setColor(0, 0, 100); // Azul = esperando
      Serial.println("⏳ Esperando tarjeta...");
      break;
    case STATE_PROCESSING:
      setColor(100, 100, 0); // Amarillo = procesando
      Serial.println("🔄 Procesando...");
      break;
    case STATE_SUCCESS:
      setColor(0, 100, 0); // Verde = éxito
      Serial.println("🎉 Éxito!");
      break;
    case STATE_ERROR:
      setColor(100, 0, 0); // Rojo = error
      Serial.println("💥 Error");
      break;
  }
}

void setColor(int r, int g, int b) {
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}

void connectWiFi() {
  Serial.println("📡 Conectando WiFi...");
  setColor(255, 255, 0); // Amarillo
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n❌ WiFi falló");
  }
}

void syncTime() {
  configTzTime("CST6CDT,M3.2.0/2,M11.1.0/2", "pool.ntp.org", "time.nist.gov");
  
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    Serial.printf("⏰ Hora: %02d:%02d:%02d\n", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  }
}