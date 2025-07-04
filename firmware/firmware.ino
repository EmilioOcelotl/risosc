#include ".env.h"  // Contiene WIFI_SSID, WIFI_PASSWORD, API_URL

#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>

#undef NULL
#define NULL 0

#include <WiFi.h>
#include <HTTPClient.h>
#include "NfcAdapter.h"

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* targetUrl = API_URL;

// Pines del LED RGB integrado (Ánodo común)
#define LED_R 14
#define LED_G 15
#define LED_B 16

enum SystemState {
  STATE_WAITING,
  STATE_READING,
  STATE_READ,
  STATE_MATCH,
  STATE_COOLDOWN
};

SystemState currentState = STATE_WAITING;
unsigned long lastReadTime = 0;
const unsigned long COOLDOWN_TIME = 3000;

PN532_I2C pn532_i2c(Wire);
NfcAdapter nfc = NfcAdapter(pn532_i2c);

void setup() {
  Serial.begin(115200);
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  setColor(255, 255, 255);
  connectWiFi();
  nfc.begin();
  setState(STATE_WAITING);
}

void loop() {
  switch (currentState) {
    case STATE_WAITING:
      if (nfc.tagPresent()) setState(STATE_READING);
      break;
    case STATE_READING:
      readAndProcessTag();
      break;
    case STATE_READ:
    case STATE_MATCH:
      if (millis() - lastReadTime > 1000) {
        setState(STATE_COOLDOWN);
        lastReadTime = millis();
      }
      break;
    case STATE_COOLDOWN:
      if (millis() - lastReadTime > COOLDOWN_TIME) {
        setState(STATE_WAITING);
      }
      break;
  }
  delay(100);
}

void connectWiFi() {
  Serial.println("Conectando a WiFi...");
  setColor(255, 255, 0);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi conectado. IP: " + WiFi.localIP().toString());
}

void readAndProcessTag() {
  if (!nfc.tagPresent()) {
    setState(STATE_WAITING);
    return;
  }

  NfcTag tag = nfc.read();
  Serial.println("\n--- TAG DETECTADO ---");
  tag.print();

  bool match = false;

  if (tag.hasNdefMessage()) {
    NdefMessage message = tag.getNdefMessage();
    for (int i = 0; i < message.getRecordCount(); i++) {
      NdefRecord record = message.getRecord(i);
      if (record.getTnf() == TNF_WELL_KNOWN && record.getType() == "U") {
        String url = getUrlFromRecord(record);
        Serial.println("URL leída: " + url);
        int index = getIndexFromUrl(url);
        if (index >= 0 && index <= 3) {
          sendWebNotification(index);
          match = true;
        }
      }
    }
  }

  setState(match ? STATE_MATCH : STATE_READ);
  lastReadTime = millis();
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
  return url.substring(paramStart + 5).toInt();
}

void sendWebNotification(int index) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi no conectado, reintentando...");
    connectWiFi();
    return;
  }

  HTTPClient http;
  String payload = "{\"index\":" + String(index) + "}";

  Serial.println("Enviando POST con índice: " + String(index));
  setColor(0, 255, 0); // Verde

  http.begin(apiBase);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.printf("POST enviado. Código HTTP: %d\n", httpCode);
  } else {
    Serial.printf("Error al enviar POST: %d\n", httpCode);
  }

  http.end();
}

void setState(SystemState newState) {
  if (currentState == newState) return;
  currentState = newState;

  switch (newState) {
    case STATE_WAITING:
      setColor(255, 255, 0); Serial.println("Esperando tarjeta..."); break;
    case STATE_READING:
      setColor(0, 0, 255); Serial.println("Leyendo..."); break;
    case STATE_READ:
      setColor(255, 0, 255); Serial.println("Tarjeta leída (sin match)"); break;
    case STATE_MATCH:
      setColor(255, 0, 0); Serial.println("¡Match! Notificación enviada."); break;
    case STATE_COOLDOWN:
      setColor(0, 255, 0); Serial.println("Cooldown..."); break;
  }
}

void setColor(int r, int g, int b) {
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}
