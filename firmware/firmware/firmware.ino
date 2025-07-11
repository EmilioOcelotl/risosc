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

// Horario de funcionamiento (puede cruzar medianoche)
const int startHour = 22;
const int startMinute = 40;
const int endHour = 23;
const int endMinute = 46;

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

bool pn532Active = false;

void setup() {
  Serial.begin(115200);

  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  pinMode(PN532_POWER_PIN, OUTPUT);

  setColor(255, 255, 255); // Blanco = encendiendo
  connectWiFi();
  syncTime();

  powerPn532(false); // Arranca apagado
  setState(STATE_WAITING);
}

void loop() {
  handlePn532Schedule(); // Verifica si el módulo debe estar activo

  if (!pn532Active) {
    delay(500);
    return;
  }

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

// Encender o apagar el PN532
void powerPn532(bool on) {
  digitalWrite(PN532_POWER_PIN, on ? HIGH : LOW);
  pn532Active = on;

  if (on) {
    delay(500);
    nfc.begin();
  }
}

// Verifica si se encuentra dentro del horario programado
void handlePn532Schedule() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return;

  int currentMinutes = timeinfo.tm_hour * 60 + timeinfo.tm_min;
  int startMinutes = startHour * 60 + startMinute;
  int endMinutes = endHour * 60 + endMinute;

  bool isWithinSchedule;

  if (startMinutes < endMinutes) {
    isWithinSchedule = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    isWithinSchedule = currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  if (isWithinSchedule) {
    if (!pn532Active) powerPn532(true);
  } else {
    if (pn532Active) powerPn532(false);
  }
}

// Sincroniza con el servidor NTP
void syncTime() {
  configTzTime("CST6", "pool.ntp.org", "time.nist.gov");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    delay(1000);
  }
}

// Conecta al WiFi
void connectWiFi() {
  setColor(255, 255, 0); // Amarillo
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

// Lee una etiqueta NFC
void readAndProcessTag() {
  if (!nfc.tagPresent()) {
    setState(STATE_WAITING);
    return;
  }

  NfcTag tag = nfc.read();

  bool match = false;

  if (tag.hasNdefMessage()) {
    NdefMessage message = tag.getNdefMessage();
    for (int i = 0; i < message.getRecordCount(); i++) {
      NdefRecord record = message.getRecord(i);
      if (record.getTnf() == TNF_WELL_KNOWN && record.getType() == "U") {
        String url = getUrlFromRecord(record);
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

// Extrae la URL desde el NDEF
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

// Extrae el índice del parámetro ?nfc=
int getIndexFromUrl(String url) {
  int paramStart = url.indexOf("?nfc=");
  if (paramStart == -1) return -1;
  return url.substring(paramStart + 5).toInt();
}

// Envía notificación web
void sendWebNotification(int index) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  HTTPClient http;
  String payload = "{\"index\":" + String(index) + "}";

  Serial.println("📤 Enviando etiqueta NFC al servidor...");

  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.printf("✅ POST enviado correctamente. Código HTTP: %d\n", httpCode);
  } else {
    Serial.printf("❌ Error al enviar POST. Código: %d\n", httpCode);
  }

  http.end();
}

// Cambia el estado del sistema y color del LED
void setState(SystemState newState) {
  if (currentState == newState) return;
  currentState = newState;

  switch (newState) {
    case STATE_WAITING:
      setColor(255, 255, 0); break;
    case STATE_READING:
      setColor(0, 0, 255); break;
    case STATE_READ:
      setColor(255, 0, 0); break;
    case STATE_MATCH:
      setColor(0, 255, 0); break;
    case STATE_COOLDOWN:
      setColor(10, 10, 10); break;
  }
}

// Control del LED RGB
void setColor(int r, int g, int b) {
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}
